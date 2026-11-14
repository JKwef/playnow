# Dot-source this script: . ./scripts/dev-env.ps1
# Changes apply only to the current PowerShell process.
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCommand) {
    $bundledNode = Join-Path $env:USERPROFILE '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin'
    if (-not (Test-Path (Join-Path $bundledNode 'node.exe'))) {
        throw 'Install Node.js 24, then dot-source this script again.'
    }
    $env:PATH = "$bundledNode;$env:PATH"
}
$npmRoot = Join-Path $projectRoot '.tools/npm'
$npmBin = Join-Path $npmRoot 'package/bin'
if (-not (Test-Path (Join-Path $npmBin 'npm-cli.js'))) {
    New-Item -ItemType Directory -Force $npmRoot | Out-Null
    $archive = Join-Path $projectRoot '.tools/npm.tgz'
    Invoke-WebRequest 'https://registry.npmjs.org/npm/-/npm-11.6.2.tgz' -OutFile $archive
    $expected = '585F95094EE5CB2788EE11D90F2A518A7C9EF6E083FA141D0B63CA3383675A20'
    if ((Get-FileHash $archive -Algorithm SHA256).Hash -ne $expected) {
        throw 'npm archive checksum mismatch.'
    }
    tar -xzf $archive -C $npmRoot
    if ($LASTEXITCODE -ne 0) { throw 'Could not extract npm.' }
}
$shimBin = Join-Path $projectRoot '.tools/bin'
New-Item -ItemType Directory -Force $shimBin | Out-Null
Set-Content -LiteralPath (Join-Path $shimBin 'npm.cmd') -Encoding ascii -Value '@node "%~dp0..\npm\package\bin\npm-cli.js" %*'
Set-Content -LiteralPath (Join-Path $shimBin 'npx.cmd') -Encoding ascii -Value '@node "%~dp0..\npm\package\bin\npx-cli.js" %*'
$env:PATH = "$shimBin;$env:PATH"
$env:NPM_CONFIG_CACHE = Join-Path $projectRoot '.npm-cache'
$env:EXPO_NO_TELEMETRY = '1'
node --version
npm.cmd --version
if ($LASTEXITCODE -ne 0) { throw 'npm initialization failed.' }
