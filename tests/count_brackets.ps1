$path = "codigo-padre.html"
$txt = Get-Content -Raw -Path $path
$pairs = @("(", ")", "{", "}", "[", "]")
foreach ($c in $pairs) {
    $count = ([regex]::Matches($txt, [regex]::Escape($c))).Count
    Write-Output "$c => $count"
}