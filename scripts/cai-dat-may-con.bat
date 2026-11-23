@echo off
title QK7 DataHub - Cai Dat 1-Click Cho May Con

REM ==============================================================================
REM scripts\cai-dat-may-con.bat - Cai dat 1 cham tren May Con Windows
REM
REM Cach dung tren May Con:
REM   1) Mo trinh duyet tren May Con vao:  http://192.168.1.229/ca
REM      roi bam nut vang "Tai Bo Cai 1-Click Windows (.bat)".
REM   2) Hoac copy file nay sang May Con va click dup chay:
REM      scripts\cai-dat-may-con.bat [IP_MAY_CHU]
REM ==============================================================================

set "SRV_IP=%~1"
if "%SRV_IP%"=="" set "SRV_IP=192.168.1.229"
set "DOM=trungtamdulieuso.tqsqk7.edu"
set "QK7_BAT_DIR=%~dp0"

net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [ADMIN] Dang xin quyen Administrator de cai chung chi va ten mien...
    powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -ArgumentList '%SRV_IP%' -Verb RunAs"
    exit /b
)

echo ======================================================================
echo   QK7 DATAHUB - KICH HOAT TRUY CAP MAY CON
echo   May chu  : %SRV_IP%
echo   Ten mien : https://%DOM%
echo ======================================================================
echo.

set "TMP_PS=%TEMP%\qk7-client-setup.ps1"
(
    echo $ErrorActionPreference = 'Stop'
    echo $srvIp = '%SRV_IP%'
    echo $dom   = '%DOM%'
    echo $scanDirs = @^((Get-Location^).Path, $env:QK7_BAT_DIR^) ^| Where-Object { $_ -and ^(Test-Path $_^) } ^| Select-Object -Unique
    echo foreach ^($d in $scanDirs^) {
    echo     Get-ChildItem -Path $d -File -ErrorAction SilentlyContinue ^| Where-Object { $_.Length -eq 0 -and $_.Name -match '^\d{1,3}(\.\d{1,3}){3}\)$' } ^| Remove-Item -Force -ErrorAction SilentlyContinue
    echo }
    echo $tmpCa = Join-Path $env:TEMP 'QK7-DataHub-RootCA.crt'
    echo Write-Host "[1/3] Dang tai chung chi goc tu http://$srvIp/ca/rootCA.crt ..." -ForegroundColor Cyan
    echo Invoke-WebRequest -UseBasicParsing -Uri "http://$srvIp/ca/rootCA.crt" -OutFile $tmpCa
    echo Import-Certificate -FilePath $tmpCa -CertStoreLocation Cert:\LocalMachine\Root ^| Out-Null
    echo Remove-Item $tmpCa -Force -ErrorAction SilentlyContinue
    echo Write-Host "      [OK] Da nap chung chi QK7 DataHub Root CA vao Windows!" -ForegroundColor Green
    echo Write-Host "[2/3] Dang cap nhat ten mien ($dom = $srvIp)..." -ForegroundColor Cyan
    echo $hostsPath = Join-Path $env:SystemRoot 'System32\drivers\etc\hosts'
    echo $rawLines = @^(Get-Content -Path $hostsPath -ErrorAction SilentlyContinue^)
    echo $cleanLines = New-Object System.Collections.Generic.List[string]
    echo foreach ^($ln in $rawLines^) {
    echo     if ^($ln -match 'trungtamdulieuso\.tqs\.com^|trungtamdulieuso\.tqsqk7\.edu^|tqsqk7\.cntt'^) { continue }
    echo     $cleanLines.Add^($ln^)
    echo }
    echo $cleanLines.Add^("$srvIp  $dom"^)
    echo $cleanLines.Add^("$srvIp  tqsqk7.cntt"^)
    echo $hostsWritten = $false
    echo try {
    echo     attrib -r -h -s $hostsPath 2^>$null ^| Out-Null
    echo     [System.IO.File]::WriteAllLines^($hostsPath, $cleanLines, ^(New-Object System.Text.ASCIIEncoding^)^)
    echo     $hostsWritten = $true
    echo } catch {
    echo     try {
    echo         icacls $hostsPath /grant "*S-1-5-32-544:(M)" 2^>$null ^| Out-Null
    echo         attrib -r -h -s $hostsPath 2^>$null ^| Out-Null
    echo         Set-Content -Path $hostsPath -Value $cleanLines -Encoding ASCII -Force
    echo         $hostsWritten = $true
    echo     } catch {
    echo         Write-Host "      [CANH BAO] File hosts dang bi khoa (thuong do phan mem diet virus/bao ve hosts)." -ForegroundColor Yellow
    echo     }
    echo }
    echo if ^($hostsWritten^) {
    echo     Write-Host "      [OK] Da ghi $dom = $srvIp vao file hosts!" -ForegroundColor Green
    echo } else {
    echo     Write-Host "      [DU PHONG] Dang kiem tra May chu DNS noi bo tai $srvIp`:53 ..." -ForegroundColor Cyan
    echo     $dnsReady = $false
    echo     try {
    echo         $tcp = New-Object System.Net.Sockets.TcpClient
    echo         $iar = $tcp.BeginConnect^($srvIp, 53, $null, $null^)
    echo         if ^($iar.AsyncWaitHandle.WaitOne^(1500^)^) { $tcp.EndConnect^($iar^); $dnsReady = $true }
    echo         $tcp.Close^(^)
    echo     } catch {}
    echo     if ^($dnsReady^) {
    echo         $route = Get-NetRoute -DestinationPrefix '0.0.0.0/0' -ErrorAction SilentlyContinue ^| Sort-Object RouteMetric ^| Select-Object -First 1
    echo         if ^($route^) {
    echo             $gw = $route.NextHop
    echo             $dnsList = if ^($gw -and $gw -ne $srvIp -and $gw -ne '0.0.0.0'^) { @^($srvIp, $gw^) } else { @^($srvIp^) }
    echo             Set-DnsClientServerAddress -InterfaceIndex $route.ifIndex -ServerAddresses $dnsList
    echo             Write-Host "      [OK] Da chuyen sang DNS Noi Bo ($($dnsList -join ', ')) - khong can sua file hosts!" -ForegroundColor Green
    echo         }
    echo     } else {
    echo         Write-Host ""
    echo         Write-Host "      [KHAC PHUC] File hosts bi phan mem diet virus (BKAV/Kaspersky/Defender/MiAV) khoa:" -ForegroundColor Red
    echo         Write-Host "        - Cach 1 (Khuyen dung): Tren may chu $srvIp chay scripts\start-dns.bat roi chay lai file nay." -ForegroundColor Yellow
    echo         Write-Host "        - Cach 2: Tam tat tinh nang Bao ve file hosts trong phan mem diet virus roi chay lai." -ForegroundColor Yellow
    echo         exit 2
    echo     }
    echo }
    echo ipconfig /flushdns ^| Out-Null
    echo Write-Host "[3/3] Dang xac minh phan giai ten mien $dom..." -ForegroundColor Cyan
    echo $resolved = @^(^)
    echo try { $resolved = @^([System.Net.Dns]::GetHostAddresses^($dom^) ^| ForEach-Object { $_.IPAddressToString }^) } catch {}
    echo if ^($resolved -contains $srvIp^) {
    echo     Write-Host "      [OK] Xac minh thanh cong: $dom = $srvIp" -ForegroundColor Green
    echo } else {
    echo     Write-Warning "      [CANH BAO] Chua phan giai duoc $dom = $srvIp (hien tai: $($resolved -join ', '))."
    echo }
) > "%TMP_PS%"

powershell -NoProfile -ExecutionPolicy Bypass -File "%TMP_PS%"
set "PS_ERR=%errorlevel%"
del /f /q "%TMP_PS%" >nul 2>&1

if %PS_ERR% neq 0 (
    echo.
    echo [LOI] Qua trinh cai dat chua hoan tat. Xem dong huong dan mau vang/do o tren.
    pause
    exit /b 1
)

echo.
echo [HOAN TAT] Dang mo trinh duyet truy cap https://%DOM% ...
echo (Luu y: Neu trinh duyet dang mo san, hay dong het tab cu roi mo lai!)
start "" "https://%DOM%"
pause
exit /b 0
