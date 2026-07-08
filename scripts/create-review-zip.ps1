$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$output = Join-Path $root "review-with-aguri.zip"
$excludePrefixes = @(
  "node_modules/",
  "dist/",
  ".git/",
  "public/assets/characters/main/fullbody/rejected/",
  "public/assets/characters/main/fullbody/pending/",
  "public/assets/characters/main/fullbody/prompts/",
  "research_private/",
  "doko-demo-issyo/",
  "dokodemo/"
)
$excludePatterns = @(
  "*.bin", "*.iso", "*.cue", "*.img", "*.sub", "*.ccd", "*.chd",
  "*.BIN", "*.ISO", "*.CUE", "*.IMG", "*.SUB", "*.CCD", "*.CHD",
  "*.zip", "*.tsbuildinfo"
)

if (Test-Path -LiteralPath $output) {
  Remove-Item -LiteralPath $output -Force
}

$files = Get-ChildItem -LiteralPath $root -Recurse -File -Force | Where-Object {
  $relative = $_.FullName.Substring($root.Path.Length + 1).Replace("\", "/")
  foreach ($prefix in $excludePrefixes) {
    if ($relative.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase)) { return $false }
  }
  foreach ($pattern in $excludePatterns) {
    if ($_.Name -like $pattern) { return $false }
  }
  return $true
}

$files | Compress-Archive -DestinationPath $output -Force
Write-Host "Created $output"
