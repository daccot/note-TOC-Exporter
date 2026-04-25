[CmdletBinding()]
param(
    [string]$Version = "2.5.1",
    [string]$CommitMessage = "Release v2.5.1"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$DistDir = Join-Path $RepoRoot "dist"
$ReleaseDir = Join-Path $RepoRoot "dist-release"
$ZipPath = Join-Path $ReleaseDir "note-toc-exporter-v$Version.zip"
$RequiredDistFiles = @(
    "manifest.json",
    "background.js",
    "content.js",
    "popup.js",
    "options.js",
    "sidepanel.js",
    "popup.html",
    "options.html",
    "sidepanel.html",
    "icon16.png",
    "icon32.png",
    "icon48.png",
    "icon128.png"
)

function Invoke-Step {
    param([Parameter(Mandatory = $true)][string]$Command)

    Write-Host "[RUN] $Command"
    $process = Start-Process -FilePath "cmd.exe" -ArgumentList @("/d", "/c", $Command) -WorkingDirectory $RepoRoot -NoNewWindow -Wait -PassThru
    if ($process.ExitCode -ne 0) {
        throw "Command failed with exit code $($process.ExitCode): $Command"
    }
}

function Assert-FileContains {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$Pattern,
        [Parameter(Mandatory = $true)][string]$Description
    )

    if (-not (Select-String -Path $Path -Pattern $Pattern -Quiet)) {
        throw "$Description not found in $Path"
    }
}

function Validate-Dist {
    if (-not (Test-Path -LiteralPath $DistDir)) {
        throw "dist directory was not generated."
    }

    foreach ($file in $RequiredDistFiles) {
        $path = Join-Path $DistDir $file
        if (-not (Test-Path -LiteralPath $path)) {
            throw "Missing dist file: $file"
        }
    }

    $manifest = Get-Content -LiteralPath (Join-Path $DistDir "manifest.json") -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($manifest.version -ne $Version) {
        throw "dist/manifest.json version is $($manifest.version), expected $Version"
    }
    if ($manifest.background.service_worker -ne "background.js") {
        throw "dist/manifest.json service_worker is $($manifest.background.service_worker)"
    }
    if ($manifest.action.default_popup -ne "popup.html") {
        throw "dist/manifest.json default_popup is $($manifest.action.default_popup)"
    }
    if ($manifest.options_page -ne "options.html") {
        throw "dist/manifest.json options_page is $($manifest.options_page)"
    }
    if ($manifest.side_panel.default_path -ne "sidepanel.html") {
        throw "dist/manifest.json side_panel.default_path is $($manifest.side_panel.default_path)"
    }

    Assert-FileContains -Path (Join-Path $DistDir "popup.html") -Pattern 'src="popup\.js"' -Description "popup.js script reference"
    Assert-FileContains -Path (Join-Path $DistDir "options.html") -Pattern 'src="options\.js"' -Description "options.js script reference"
    Assert-FileContains -Path (Join-Path $DistDir "sidepanel.html") -Pattern 'src="sidepanel\.js"' -Description "sidepanel.js script reference"

    $junk = Get-ChildItem -LiteralPath $DistDir -Force | Where-Object { $_.Name -like "_patch_*" -or $_.Name -like "_repair_*" -or $_.Name -like "_runtime_*" -or $_.Name -like "_fix_*" }
    if ($junk) {
        throw "Unexpected repair artifacts found in dist: $($junk.Name -join ', ')"
    }
}

function New-ReleaseZip {
    if (-not (Test-Path -LiteralPath $ReleaseDir)) {
        New-Item -ItemType Directory -Path $ReleaseDir -Force | Out-Null
    }
    if (Test-Path -LiteralPath $ZipPath) {
        Remove-Item -LiteralPath $ZipPath -Force
    }

    Compress-Archive -Path (Join-Path $DistDir "*") -DestinationPath $ZipPath -Force

    $zipEntries = [System.IO.Compression.ZipFile]::OpenRead($ZipPath).Entries.FullName
    if ($zipEntries -contains "dist/manifest.json" -or $zipEntries -contains "dist/background.js") {
        throw "ZIP contains nested dist/ directory."
    }
    if (-not ($zipEntries -contains "manifest.json")) {
        throw "ZIP does not contain manifest.json at root."
    }
    if (-not ($zipEntries -contains "background.js")) {
        throw "ZIP does not contain background.js at root."
    }
}

Push-Location $RepoRoot
try {
    Invoke-Step "npm run typecheck"
    Invoke-Step "npm run build"
    Invoke-Step "npm run copy-static"
    Validate-Dist
    New-ReleaseZip
    Invoke-Step "git status --short"
    Invoke-Step "git add ."
    Invoke-Step "git commit -m ""$CommitMessage"""
    Invoke-Step "git push"
    Write-Host "[OK] Release ready: $ZipPath"
} finally {
    Pop-Location
}
