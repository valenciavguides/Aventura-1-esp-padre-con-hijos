param($file = 'codigo-padre.html')
$s = Get-Content $file -Raw
$regex = [regex] '<script(?:\s[^>]*)?>([\s\S]*?)</script>'
$matches = $regex.Matches($s)
$i = 0
$errors = @()
foreach ($m in $matches) {
    $i++
    $code = $m.Groups[1].Value
    $stack = New-Object System.Collections.Stack
    $found = $false
    for ($idx = 0; $idx -lt $code.Length; $idx++) {
        $ch = $code[$idx]
        if ($ch -eq '(' -or $ch -eq '{' -or $ch -eq '[') { $stack.Push(@($ch, $idx)) }
        elseif ($ch -eq ')' -or $ch -eq '}' -or $ch -eq ']') {
            if ($stack.Count -eq 0) { $errors += ('Script #{0}: unmatched closing ''{1}'' at index {2}' -f $i, $ch, $idx); $found = $true; break }
            $top = $stack.Pop()
            $open = $top[0]
            $pairOK = ($open -eq '(' -and $ch -eq ')') -or ($open -eq '{' -and $ch -eq '}') -or ($open -eq '[' -and $ch -eq ']')
            if (-not $pairOK) { $errors += ('Script #{0}: mismatch ''{1}'' vs ''{2}'' at index {3}' -f $i, $open, $ch, $idx); $found = $true; break }
        }
    }
    if (-not $found -and $stack.Count -gt 0) {
        $top = $stack.Pop()
        $errors += ('Script #{0}: unmatched opening ''{1}'' at index {2}' -f $i, $top[0], $top[1])
    }
}
if ($errors.Count -eq 0) { Write-Output 'OK: No bracket mismatches detected in <script> blocks.' } else { $errors | ForEach-Object { Write-Output $_ } ; exit 1 }