# Stops every chrome.exe whose command line has the given text (the profile folder of a test run), so the next run finds the
# debugging port and the profile free. usage: powershell -NoProfile -ExecutionPolicy Bypass -File killchrome.ps1 <text>
param([string]$Text)
Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" |
  Where-Object { $_.CommandLine -and $_.CommandLine.Contains($Text) } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
