$path = "c:\Users\eddie\OneDrive\Documents\Upwork Projects\plantelligence-dev\components\wizard\new-client-steps\step-3-key-contacts\slides\first-contact-prompt.tsx"
$content = [System.IO.File]::ReadAllText($path)
# Replace Who's with Who's
$content = $content -replace "Who's the main point", "Who's the main point"
# Replace 's benefits after the span
$content = $content -replace "(</span>)\s*'s benefits", "`$1`n          's benefits"
[System.IO.File]::WriteAllText($path, $content, [System.Text.UTF8Encoding]::new($false))
Write-Output "Done"
