#Requires -Version 5.1
<#
  Единая проверка Edge Functions из supabase/functions.

  Запуск (из корня репозитория):
    powershell -ExecutionPolicy Bypass -File scripts\check-functions.ps1

  Скрипт сам выставляет DENO_DIR внутрь workspace (иначе кэш Deno пишется в
  %LOCALAPPDATA% и на чужих машинах/в песочнице это может быть запрещено),
  затем запускает:
    deno check — типы четырёх точек входа;
    deno test  — unit-тесты рядом с функциями (*.test.ts).

  Deno не требуется устанавливать в систему: скрипт ищет portable-сборку в
  .tools\deno\deno.exe. Прав администратора не нужно.
#>
$ErrorActionPreference = 'Continue'

$root = Split-Path -Parent $PSScriptRoot
$deno = Join-Path $root '.tools\deno\deno.exe'
$denoDir = Join-Path $root '.tools\deno-cache'
$functions = Join-Path $root 'supabase\functions'
$targets = @(
  'supabase/functions/steam-auth/index.ts',
  'supabase/functions/steam-library/index.ts',
  'supabase/functions/steam-catalog/index.ts',
  'supabase/functions/rawg-enrich/index.ts',
  'supabase/functions/delete-account/index.ts'
)

if (-not (Test-Path -LiteralPath $deno)) {
  Write-Host 'Deno не найден: .tools\deno\deno.exe' -ForegroundColor Red
  Write-Host 'Скачайте portable-сборку для Windows x64 и распакуйте в .tools\deno:'
  Write-Host '  https://github.com/denoland/deno/releases/latest/download/deno-x86_64-pc-windows-msvc.zip'
  Write-Host 'Первый запуск проверок требует сети: Deno скачает зависимости в .tools\deno-cache.'
  exit 1
}

$env:DENO_DIR = $denoDir
$env:DENO_NO_UPDATE_CHECK = '1'

$testOutput = New-Object System.Collections.Generic.List[string]

Push-Location $root
try {
  Write-Host '==> deno check: типы четырёх точек входа' -ForegroundColor Cyan
  & $deno check @targets 2>&1 | ForEach-Object {
    $line = "$_"
    # PS 5.1 иногда отдаёт строку stderr как голое имя исключения — это шум.
    if ($line -eq 'System.Management.Automation.RemoteException') { return }
    Write-Host $line
  }
  $checkExit = $LASTEXITCODE

  Write-Host ''
  Write-Host '==> deno test: unit-тесты функций' -ForegroundColor Cyan
  & $deno test --allow-net --allow-env --allow-read $functions 2>&1 | ForEach-Object {
    $line = "$_"
    if ($line -eq 'System.Management.Automation.RemoteException') { return }
    $testOutput.Add($line)
    Write-Host $line
  }
  $testExit = $LASTEXITCODE
} finally {
  Pop-Location
}

$pipeFailure = ($testOutput | Where-Object { $_ -like '*client pipe failure*' }).Count -gt 0

Write-Host ''
if ($checkExit -eq 0 -and $testExit -eq 0) {
  Write-Host 'ОК: типы и тесты Edge Functions прошли.' -ForegroundColor Green
  exit 0
}

if ($pipeFailure) {
  Write-Host 'deno test не смог запуститься: среда запрещает Deno создавать named pipes.' -ForegroundColor Yellow
  Write-Host 'Это ограничение песочницы, а не ошибка кода: повторите запуск вне её.'
}

Write-Host "ПРОВАЛ: deno check = $checkExit, deno test = $testExit" -ForegroundColor Red
exit 1
