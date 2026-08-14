import { spawn, execFileSync } from 'node:child_process';
import {
  mkdtempSync,
  readFileSync,
  writeFileSync,
  rmSync,
  readdirSync,
  mkdirSync,
  statSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

function killTree(pid) {
  try {
    execFileSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' });
  } catch {}
}

const here = dirname(fileURLToPath(import.meta.url));
const CHROME =
  process.env.CHROME_PATH ||
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const SCALE = Math.max(1, Number(process.env.SCALE || 2));
const W = 1080;
const H = 1920;
const OUT_DIR = join(here, 'export');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class CDP {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.id = 0;
    this.pending = new Map();
    this.listeners = new Map();
  }

  async open() {
    await new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = reject;
    });
    this.ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id !== undefined) {
        const p = this.pending.get(msg.id);
        if (!p) return;
        this.pending.delete(msg.id);
        msg.error ? p.reject(new Error(JSON.stringify(msg.error))) : p.resolve(msg.result);
      } else {
        const key = (msg.sessionId ? msg.sessionId + ':' : '') + msg.method;
        const cbs = this.listeners.get(key);
        if (cbs) for (const cb of [...cbs]) cb(msg.params);
      }
    };
  }

  send(method, params = {}, sessionId) {
    return new Promise((resolve, reject) => {
      const id = ++this.id;
      this.pending.set(id, { resolve, reject });
      this.ws.send(
        JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }),
      );
    });
  }

  once(method, sessionId) {
    return new Promise((resolve) => {
      const key = (sessionId ? sessionId + ':' : '') + method;
      const cbs = this.listeners.get(key) || [];
      const cb = (params) => {
        this.listeners.set(key, cbs.filter((c) => c !== cb));
        resolve(params);
      };
      cbs.push(cb);
      this.listeners.set(key, cbs);
    });
  }

  close() {
    try {
      this.ws.close();
    } catch {}
  }
}

async function findChromePort(profileDir) {
  const portFile = join(profileDir, 'DevToolsActivePort');
  for (let i = 0; i < 100; i++) {
    try {
      const content = readFileSync(portFile, 'utf8').split(/\r?\n/);
      if (content[0]) return Number(content[0]);
    } catch {}
    await sleep(100);
  }
  throw new Error('No se pudo obtener el puerto de depuración de Chrome');
}

async function findBrowserWsUrl(port) {
  for (let i = 0; i < 50; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`);
      const info = await res.json();
      if (info.webSocketDebuggerUrl) return info.webSocketDebuggerUrl;
    } catch {}
    await sleep(200);
  }
  throw new Error('No se pudo conectar al endpoint de depuración de Chrome');
}

async function renderPage(cdp, url, outPath) {
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.send('Target.attachToTarget', {
    targetId,
    flatten: true,
  });

  await cdp.send('Page.enable', {}, sessionId);
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: W,
    height: H,
    deviceScaleFactor: SCALE,
    mobile: false,
  }, sessionId);

  const loaded = cdp.once('Page.loadEventFired', sessionId);
  await cdp.send('Page.navigate', { url }, sessionId);
  console.log('  · navegando:', basename(url));
  await loaded;

  await cdp.send(
    'Runtime.evaluate',
    { expression: 'document.fonts.ready.then(() => true)', awaitPromise: true, returnByValue: true },
    sessionId,
  );
  console.log('  · fuentes listas');

  for (let i = 0; i < 80; i++) {
    const res = await cdp.send(
      'Runtime.evaluate',
      {
        expression: 'Array.from(document.images).every((i) => i.complete && i.naturalWidth > 0)',
        returnByValue: true,
      },
      sessionId,
    );
    if (res.result?.value) break;
    await sleep(250);
  }
  console.log('  · imágenes listas');
  await sleep(400);

  const { data } = await cdp.send(
    'Page.captureScreenshot',
    { format: 'png', fromSurface: true },
    sessionId,
  );
  writeFileSync(outPath, Buffer.from(data, 'base64'));
  console.log(`  ✓ ${basename(outPath)}  (${W * SCALE}x${H * SCALE}px)`);

  await cdp.send('Target.closeTarget', { targetId });
}

async function main() {
  const files = readdirSync(here)
    .filter((f) => /\.html$/i.test(f))
    .filter((f) => statSync(join(here, f)).isFile());
  if (!files.length) throw new Error('No hay archivos .html en la carpeta');

  mkdirSync(OUT_DIR, { recursive: true });

  const profileDir = mkdtempSync(join(tmpdir(), 'story-render-'));
  const chrome = spawn(
    CHROME,
    [
      '--headless=new',
      '--hide-scrollbars',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      '--force-color-profile=srgb',
      `--user-data-dir=${profileDir}`,
      '--remote-debugging-port=0',
      'about:blank',
    ],
    { stdio: 'ignore' },
  );

  let cdp;
  try {
    const port = await findChromePort(profileDir);
    const wsUrl = await findBrowserWsUrl(port);
    cdp = new CDP(wsUrl);
    await cdp.open();

    console.log(`Renderizando ${files.length} historias a ${W * SCALE}x${H * SCALE}px...`);
    for (const f of files) {
      const url = 'file:///' + join(here, f).replace(/\\/g, '/');
      await renderPage(cdp, url, join(OUT_DIR, f.replace(/\.html$/i, '.png')));
    }
  } finally {
    if (cdp) cdp.close();
    killTree(chrome.pid);
    try {
      rmSync(profileDir, { recursive: true, force: true });
    } catch {}
  }
  console.log('Listo →', OUT_DIR);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
