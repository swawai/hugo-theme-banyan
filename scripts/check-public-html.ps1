param(
    [string]$PublicDir = "public"
)

$ErrorActionPreference = "Stop"

function Test-Pattern {
    param(
        [string]$Text,
        [string]$Pattern
    )

    return [bool]([regex]::IsMatch($Text, $Pattern))
}

$themeRoot = (Resolve-Path $PSScriptRoot\..).Path
$siteRoot = (Resolve-Path (Join-Path $themeRoot "..\..")).Path
$publicPath = Join-Path $siteRoot $PublicDir

if (-not (Test-Path $publicPath)) {
    throw "Public directory not found: $publicPath"
}

$allowedInline = @(
    (Join-Path $publicPath "index.html"),
    (Join-Path $publicPath "zh\index.html"),
    (Join-Path $publicPath "zh-tw\index.html")
) | ForEach-Object { [System.IO.Path]::GetFullPath($_) }

$htmlFiles = Get-ChildItem -Path $publicPath -Recurse -File -Include *.html
$issues = New-Object System.Collections.Generic.List[string]
$summary = [ordered]@{
    Total = 0
    InlineOnly = 0
    ExternalOnly = 0
    Both = 0
    Neither = 0
}

foreach ($file in $htmlFiles) {
    $path = [System.IO.Path]::GetFullPath($file.FullName)
    $text = Get-Content $path -Raw

    $hasInline = Test-Pattern $text '<style>@view-transition'
    $hasExternal = Test-Pattern $text 'rel="stylesheet"|rel=stylesheet'
    $hasMainJs = Test-Pattern $text '/js/main(\.min)?\.[^"'' >]+'
    $hasCanonical = Test-Pattern $text '<link rel="canonical"|<link rel=canonical'

    $summary.Total++
    if ($hasInline -and -not $hasExternal) { $summary.InlineOnly++ }
    if (-not $hasInline -and $hasExternal) { $summary.ExternalOnly++ }
    if ($hasInline -and $hasExternal) { $summary.Both++ }
    if (-not $hasInline -and -not $hasExternal) { $summary.Neither++ }

    $shouldInline = $allowedInline -contains $path

    if ($shouldInline) {
        if (-not $hasInline) {
            $issues.Add("Expected inline CSS but none found: $path")
        }
        if ($hasExternal) {
            $issues.Add("Expected no external main stylesheet on inline page: $path")
        }
    }
    else {
        if ($hasInline) {
            $issues.Add("Unexpected inline CSS on non-home page: $path")
        }
        if (-not $hasExternal) {
            $issues.Add("Missing external main stylesheet on non-home page: $path")
        }
    }

    if (-not $hasMainJs) {
        $issues.Add("Missing main JS bundle: $path")
    }

    if (-not $hasCanonical) {
        $issues.Add("Missing canonical link: $path")
    }
}

Write-Host "Checked $($summary.Total) HTML files in $publicPath"
Write-Host "inlineOnly=$($summary.InlineOnly) externalOnly=$($summary.ExternalOnly) both=$($summary.Both) neither=$($summary.Neither)"
Write-Host "Allowed inline pages:"
$allowedInline | ForEach-Object { Write-Host "  $_" }

if ($issues.Count -gt 0) {
    Write-Host ""
    Write-Host "Issues found:" -ForegroundColor Red
    $issues | ForEach-Object { Write-Host "  $_" -ForegroundColor Red }
    exit 1
}

Write-Host "Public HTML check passed." -ForegroundColor Green
