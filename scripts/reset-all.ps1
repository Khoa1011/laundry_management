$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
. (Join-Path $PSScriptRoot 'docker-common.ps1')
Push-Location $repoRoot

try {
    if (-not (Test-Path -LiteralPath '.env')) {
        throw 'Missing .env file. Copy .env.example to .env before using the Compose scripts.'
    }

    Write-Host 'WARNING: This permanently deletes all local MySQL data for this Compose project.' -ForegroundColor Red
    $confirmation = Read-Host 'Type DELETE to remove containers and volumes'

    if ($confirmation -cne 'DELETE') {
        Write-Host 'Reset cancelled. No volumes were deleted.' -ForegroundColor Yellow
        exit 0
    }

    Invoke-DockerCommand -Arguments @('compose', 'down', '-v', '--remove-orphans') `
        -FailureMessage 'Docker Compose could not delete the stack and its volumes.'

    Write-Host 'Local containers and MySQL data were deleted.' -ForegroundColor Green
}
catch {
    Write-Error $_
    exit 1
}
finally {
    Pop-Location
}
