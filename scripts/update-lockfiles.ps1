# Regenera los package-lock.json (raíz y frontend) dentro de Linux (node:24-alpine),
# el mismo entorno que usa CI.
#
# POR QUÉ: npm en Windows omite dependencias opcionales de plataforma (@emnapi/core,
# @emnapi/runtime) que Linux sí exige. Si regeneras un lockfile en Windows y lo
# commiteas, `npm ci` falla en CI con "Missing: @emnapi/core from lock file".
#
# Uso: powershell -ExecutionPolicy Bypass -File scripts/update-lockfiles.ps1
# Requisito: Docker disponible.

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path '.').Path
$front = (Resolve-Path 'frontend').Path
$out = Join-Path $env:TEMP ('lockgen-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $out -Force | Out-Null

function Regenerate([string]$ProjectRoot) {
  docker run --rm `
    -v "${ProjectRoot}:/repo:ro" `
    -v "${out}:/out" `
    -w /tmp node:24-alpine `
    sh -c "mkdir -p /tmp/gen && cp /repo/package.json /repo/package-lock.json /tmp/gen/ && cd /tmp/gen && npm install --package-lock-only --no-audit --no-fund >/dev/null 2>&1; cp package-lock.json /out/lock.json"
  if ($LASTEXITCODE -ne 0) { throw "Fallo al regenerar el lockfile de $ProjectRoot" }
  Copy-Item (Join-Path $out 'lock.json') (Join-Path $ProjectRoot 'package-lock.json') -Force
  Write-Host "Regenerado: $(Join-Path $ProjectRoot 'package-lock.json')"
}

try {
  Regenerate $root
  Regenerate $front
  Write-Host 'Listo. Revisa git status y haz commit.'
} finally {
  Remove-Item -LiteralPath $out -Recurse -Force -ErrorAction SilentlyContinue
}
