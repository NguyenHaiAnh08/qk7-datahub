@echo off
rem ============================================================
rem  CAI TIN CAY ROOT CA + TRO TEN MIEN NOI BO  (CHAY MOT LAN / MAY CON)
rem  Cach dung: chep file nay + rootCA.crt vao cung 1 thu muc,
rem             chuot phai file nay -> "Run as administrator".
rem  Chay lai nhieu lan an toan (khong tao dong trung).
rem ============================================================
setlocal

rem ---- SUA 2 DONG NAY CHO DUNG MOI TRUONG ----
set "DOMAIN=trungtamdulieuso.tqs.com"
set "SERVER_IP=172.22.1.111"
rem --------------------------------------------

set "ROOTCA=%~dp0rootCA.crt"

net session >nul 2>&1
if errorlevel 1 (
  echo [LOI] Can quyen Administrator. Chuot phai file -^> Run as administrator.
  pause
  exit /b 1
)

if not exist "%ROOTCA%" (
  echo [LOI] Khong thay file rootCA.crt canh file .bat nay.
  echo       Chep rootCA.crt (doi ten tu rootCA.pem) vao cung thu muc roi chay lai.
  pause
  exit /b 1
)

echo.
echo [1/4] Cai Root CA vao Trusted Root Certification Authorities...
certutil -addstore -f Root "%ROOTCA%"
if errorlevel 1 (
  echo [LOI] Khong cai duoc Root CA.
  pause
  exit /b 1
)

echo.
echo [2/4] Bat tin cay Root CA cua Windows cho Firefox (neu co dung Firefox)...
reg add "HKLM\SOFTWARE\Policies\Mozilla\Firefox\Certificates" /v ImportEnterpriseRoots /t REG_DWORD /d 1 /f >nul

echo.
echo [3/4] Tro %DOMAIN% ve %SERVER_IP% trong file hosts...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$h=Join-Path $env:SystemRoot 'System32\drivers\etc\hosts'; $d='%DOMAIN%'; $ip='%SERVER_IP%'; $l=@(Get-Content $h | Where-Object { $_ -notmatch [regex]::Escape($d) }); $l += ($ip + '   ' + $d); Set-Content -Path $h -Value $l -Encoding ASCII"
if errorlevel 1 (
  echo [CANH BAO] Khong ghi duoc file hosts. Neu mang da co DNS noi bo thi bo qua.
)

echo.
echo [4/4] Kiem tra...
certutil -store Root | findstr /i /c:"mkcert" >nul
if errorlevel 1 (
  echo   - Root CA: CHUA thay trong kho tin cay ^(kiem tra lai file rootCA.crt^)
) else (
  echo   - Root CA: DA cai
)
ping -n 1 %DOMAIN% | findstr /i /c:"%SERVER_IP%" >nul
if errorlevel 1 (
  echo   - Ten mien: CHUA tro dung %SERVER_IP% ^(kiem tra DNS / hosts / mang^)
) else (
  echo   - Ten mien: tro dung %SERVER_IP%
)

echo.
echo XONG. Dong het trinh duyet roi mo lai:  https://%DOMAIN%:8000
echo Neu van canh bao do: nhan Ctrl+Shift+Delete xoa bo nho dem, hoac khoi dong lai may.
pause
endlocal
