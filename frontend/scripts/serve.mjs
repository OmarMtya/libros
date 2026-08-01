import { spawn } from 'node:child_process';

const port = process.env.PORT ?? '4200';
const host = process.env.HOST ?? '0.0.0.0';

const child = spawn('npx', ['ng', 'serve', '--host', host, '--port', port], {
  shell: true,
  stdio: 'inherit',
});

child.on('exit', (code) => process.exit(code ?? 1));
