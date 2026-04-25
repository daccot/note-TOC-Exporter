[CmdletBinding()]
param(
    [string]$RepoRoot = ""
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($RepoRoot)) {
    $RepoRoot = Split-Path -Parent $PSScriptRoot
}

$distDir = Join-Path $RepoRoot "dist"
if (-not (Test-Path -LiteralPath $distDir)) {
    throw "dist directory not found: $distDir"
}

$staticFiles = @(
    "manifest.json",
    "popup.html",
    "options.html",
    "sidepanel.html",
    "icon16.png",
    "icon32.png",
    "icon48.png",
    "icon128.png"
)

foreach ($file in $staticFiles) {
    $source = Join-Path $RepoRoot $file
    if (-not (Test-Path -LiteralPath $source)) {
        throw "Missing static file: $source"
    }
    Copy-Item -LiteralPath $source -Destination (Join-Path $distDir $file) -Force
}

$assetsSource = Join-Path $RepoRoot "assets"
if (Test-Path -LiteralPath $assetsSource) {
    $assetsDestination = Join-Path $distDir "assets"
    if (Test-Path -LiteralPath $assetsDestination) {
        Remove-Item -LiteralPath $assetsDestination -Recurse -Force
    }
    Copy-Item -LiteralPath $assetsSource -Destination $assetsDestination -Recurse -Force
}
