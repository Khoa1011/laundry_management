$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
. (Join-Path $PSScriptRoot 'docker-common.ps1')
Push-Location $repoRoot

try {
    if (-not (Test-Path -LiteralPath '.env')) {
        throw 'Missing .env file. Copy .env.example to .env before using the Compose scripts.'
    }

    Invoke-DockerCommand -Arguments @('compose', 'down') `
        -FailureMessage 'Docker Compose could not stop the stack.'

    Write-Host 'The stack is stopped. The MySQL volume was preserved.' -ForegroundColor Green
}
catch {
    Write-Error $_
    exit 1
}
finally {
    Pop-Location
}
