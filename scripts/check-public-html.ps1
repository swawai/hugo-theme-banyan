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

$homeInlinePages = @(
    (Join-Path $publicPath "index.html"),
    (Join-Path $publicPath "zh\index.html"),
    (Join-Path $publicPath "zh-tw\index.html")
) | ForEach-Object { [System.IO.Path]::GetFullPath($_) }

$offlineInlinePages = @(
    (Join-Path $publicPath "offline\index.html"),
    (Join-Path $publicPath "zh\offline\index.html"),
    (Join-Path $publicPath "zh-tw\offline\index.html")
) | ForEach-Object { [System.IO.Path]::GetFullPath($_) }

$customInlinePages = @(
    (Join-Path $publicPath "me\index.html"),
    (Join-Path $publicPath "zh\me\index.html"),
    (Join-Path $publicPath "zh-tw\me\index.html"),
    (Join-Path $publicPath "prefetch-debug\index.html")
) | ForEach-Object { [System.IO.Path]::GetFullPath($_) }

$htmlFiles = Get-ChildItem -Path $publicPath -Recurse -File -Filter *.html
$issues = New-Object System.Collections.Generic.List[string]
$summary = [ordered]@{
    Total = 0
    InlineOnly = 0
    ExternalOnly = 0
    Both = 0
    Neither = 0
}

if (-not $htmlFiles -or $htmlFiles.Count -eq 0) {
    throw "No HTML files found under: $publicPath"
}

foreach ($file in $htmlFiles) {
    $path = [System.IO.Path]::GetFullPath($file.FullName)
    $text = Get-Content $path -Raw

    $isAliasPage = Test-Pattern $text '<meta[^>]+http-equiv=(?:"refresh"|refresh)'
    $hasInline = Test-Pattern $text '<style(?:\s[^>]*)?>'
    $hasExternal = Test-Pattern $text '<link[^>]+rel=(?:"stylesheet"|stylesheet)|<link[^>]+rel=(?:"preload"|preload)[^>]+as=(?:"style"|style)'
    $hasMainJs = Test-Pattern $text '/js/main(\.min)?\.[^"'' >]+'
    $hasCanonical = Test-Pattern $text '<link rel="canonical"|<link rel=canonical'

    $summary.Total++
    if ($hasInline -and -not $hasExternal) { $summary.InlineOnly++ }
    if (-not $hasInline -and $hasExternal) { $summary.ExternalOnly++ }
    if ($hasInline -and $hasExternal) { $summary.Both++ }
    if (-not $hasInline -and -not $hasExternal) { $summary.Neither++ }

    if ($isAliasPage) {
        if (-not $hasCanonical) {
            $issues.Add("Missing canonical link: $path")
        }
        continue
    }

    $isHomeInlinePage = $homeInlinePages -contains $path
    $isOfflineInlinePage = $offlineInlinePages -contains $path

    if ($isHomeInlinePage) {
        if (-not $hasInline) {
            $issues.Add("Expected inline base CSS on home page: $path")
        }
        if (-not $hasExternal) {
            $issues.Add("Expected deferred/external addon stylesheet on home page: $path")
        }
    }
    elseif ($isOfflineInlinePage) {
        if (-not $hasInline) {
            $issues.Add("Expected inline CSS on offline page: $path")
        }
    }
    elseif ($customInlinePages -contains $path) {
        if (-not $hasExternal) {
            $issues.Add("Expected external stylesheet on custom-inline page: $path")
        }
    }
    else {
        if ($hasInline) {
            $issues.Add("Unexpected inline CSS on non-inline page: $path")
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
Write-Host "Home inline pages:"
$homeInlinePages | ForEach-Object { Write-Host "  $_" }
Write-Host "Offline inline pages:"
$offlineInlinePages | ForEach-Object { Write-Host "  $_" }
Write-Host "Custom inline pages:"
$customInlinePages | ForEach-Object { Write-Host "  $_" }

if ($issues.Count -gt 0) {
    Write-Host ""
    Write-Host "Issues found:" -ForegroundColor Red
    $issues | ForEach-Object { Write-Host "  $_" -ForegroundColor Red }
    exit 1
}

Write-Host "Public HTML check passed." -ForegroundColor Green
