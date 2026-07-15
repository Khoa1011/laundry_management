function Invoke-DockerCommand {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string[]]$Arguments,
        [switch]$Quiet,
        [string]$FailureMessage = 'Docker command failed.'
    )

    # Windows PowerShell 5 surfaces native stderr as ErrorRecord objects. Docker
    # may write progress or harmless engine warnings to stderr while returning 0,
    # so command success must be determined from the native exit code.
    $previousErrorActionPreference = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'

    try {
        if ($Quiet) {
            & docker @Arguments *> $null
        }
        else {
            & docker @Arguments
        }

        $exitCode = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $previousErrorActionPreference
    }

    if ($exitCode -ne 0) {
        throw $FailureMessage
    }
}

