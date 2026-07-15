$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
. (Join-Path $PSScriptRoot 'docker-common.ps1')
Push-Location $repoRoot

try {
    if (-not (Test-Path -LiteralPath '.env')) {
        throw 'Missing .env file. Copy .env.example to .env and review it before restarting.'
    }

    Invoke-DockerCommand -Arguments @('compose', 'down') `
        -FailureMessage 'Docker Compose could not stop the current stack.'

    Invoke-DockerCommand -Arguments @('compose', 'up', '-d', '--build', '--wait') `
        -FailureMessage 'Docker Compose restart or a service health check failed.'

    Invoke-DockerCommand -Arguments @('compose', 'ps') `
        -FailureMessage 'The stack restarted, but service status could not be read.'
}
catch {
    Write-Error $_
    exit 1
}
finally {
    Pop-Location
}
