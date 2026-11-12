# Check for Administrator elevation
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "[INFO] Dang yeu cau quyen Administrator (UAC)..." -ForegroundColor Yellow
    Start-Process powershell.exe -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`"" -Verb RunAs
    exit
}

$Host.UI.RawUI.WindowTitle = "QK7 DataHub - Cau hinh ten mien he thong"
Clear-Host
Write-Host "========================================================================" -ForegroundColor Cyan
Write-Host "   TRUONG QUAN SU QUAN KHU 7 - DATAHUB" -ForegroundColor Green
Write-Host "   CAU HINH TEN MIEN NOI BO: trungtamdulieuso.com & trungtamdulieuso.tqs.com" -ForegroundColor Green
Write-Host "   IP MAY CHU: 192.168.1.151" -ForegroundColor Yellow
Write-Host "========================================================================" -ForegroundColor Cyan
Write-Host ""

$hostsPath = "$env:WINDIR\System32\drivers\etc\hosts"
$hostsContent = Get-Content -Path $hostsPath -Raw -ErrorAction Stop

$entriesToAdd = @(
    "127.0.0.1  trungtamdulieuso.com",
    "127.0.0.1  trungtamdulieuso.tqs.com",
    "192.168.1.151  trungtamdulieuso.com",
    "192.168.1.151  trungtamdulieuso.tqs.com"
)

$newLines = @()
foreach ($entry in $entriesToAdd) {
    if ($hostsContent -match [regex]::Escape($entry)) {
        Write-Host "  [SKIP] Da co san: $entry" -ForegroundColor Gray
    } else {
        $newLines += $entry
        Write-Host "  [+] Se them: $entry" -ForegroundColor Cyan
    }
}

if ($newLines.Count -gt 0) {
    Add-Content -Path $hostsPath -Value ("`n# QK7 DataHub Local Domain Mapping`n" + ($newLines -join "`n"))
    Write-Host ""
    Write-Host "  [OK] Da cap nhat file hosts thanh cong!" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "  [OK] Tat ca ten mien da duoc khai bao san trong file hosts!" -ForegroundColor Green
}

Write-Host "  [INFO] Dang lam moi DNS cache..." -ForegroundColor Yellow
Clear-DnsClientCache
ipconfig /flushdns | Out-Null
Write-Host "  [OK] Da lam moi DNS cache thanh cong." -ForegroundColor Green

Write-Host ""
Write-Host "========================================================================" -ForegroundColor Cyan
Write-Host " [HOAN TAT] Bay gio ban co the truy cap vao he thong!" -ForegroundColor Green
Write-Host ""
Write-Host " 👉 Dia chi 1: https://trungtamdulieuso.com:8000" -ForegroundColor White -BackgroundColor DarkGreen
Write-Host " 👉 Dia chi 2: https://trungtamdulieuso.tqs.com:8000" -ForegroundColor White -BackgroundColor DarkGreen
Write-Host " 👉 Dia chi 3: https://192.168.1.151:8000" -ForegroundColor White -BackgroundColor DarkGreen
Write-Host ""
Write-Host " Luu y: BAT BUOC go ca https:// va :8000 vi he thong su dung SSL." -ForegroundColor Yellow
Write-Host "========================================================================" -ForegroundColor Cyan
Write-Host ""
Read-Host "Nhan phim Enter de dong cua so..."

