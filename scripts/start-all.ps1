$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
. (Join-Path $PSScriptRoot 'docker-common.ps1')
Push-Location $repoRoot

function Assert-DockerReady {
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        throw 'Docker was not found. Install Docker Desktop or Docker Engine with the Compose plugin.'
    }

    Invoke-DockerCommand -Arguments @('compose', 'version') -Quiet `
        -FailureMessage 'The Docker Compose plugin is unavailable. Verify that `docker compose version` succeeds.'

    Invoke-DockerCommand -Arguments @('info') -Quiet `
        -FailureMessage 'Docker Engine is not running. Start Docker Desktop or Docker Engine and try again.'
}

function Get-EnvPort([string]$Name, [string]$DefaultValue) {
    $line = Get-Content -LiteralPath '.env' |
        Where-Object { $_ -match "^\s*$Name\s*=" } |
        Select-Object -Last 1

    if (-not $line) {
        return $DefaultValue
    }

    return (($line -split '=', 2)[1]).Trim()
}

try {
    Assert-DockerReady

    if (-not (Test-Path -LiteralPath '.env')) {
        Write-Host 'Missing .env file.' -ForegroundColor Yellow
        Write-Host 'Create it with: Copy-Item .env.example .env'
        Write-Host 'Then review the local database passwords before starting.'
        throw 'Startup stopped because .env is required.'
    }

    Invoke-DockerCommand -Arguments @('compose', 'up', '-d', '--build', '--wait') `
        -FailureMessage 'Docker Compose startup or a service health check failed.'

    Invoke-DockerCommand -Arguments @('compose', 'ps') `
        -FailureMessage 'The stack started, but service status could not be read.'

    $frontendPort = Get-EnvPort 'FRONTEND_PORT' '5173'
    $backendPort = Get-EnvPort 'BACKEND_PORT' '8080'

    Write-Host ''
    Write-Host "Frontend: http://localhost:$frontendPort" -ForegroundColor Green
    Write-Host "Backend health: http://localhost:$backendPort/actuator/health" -ForegroundColor Green
}
catch {
    Write-Error $_
    exit 1
}
finally {
    Pop-Location
}
