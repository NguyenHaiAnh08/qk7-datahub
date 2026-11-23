@echo off
rem ============================================================
rem  CAP CHUNG CHI CHO MAY CHU (dung chung 1 Root CA cho moi may chu)
rem  Cach dung: de file nay + mkcert.exe cung 1 thu muc.
rem    - Lan dau: tu tao Root CA moi trong thu muc RootCA\
rem    - Lan sau (may chu moi / gia han): dung lai RootCA\ da co
rem  Ket qua: thu muc certs\server.crt , certs\server.key
rem ============================================================
setlocal

rem ---- SUA CHO DUNG MAY CHU ----
set "DOMAIN=trungtamdulieuso.tqs.com"
set "SERVER_IP=172.22.1.111"
rem Them ten khac neu can (cach nhau dau cach), de trong neu khong:
set "EXTRA_NAMES="
rem ------------------------------

set "CAROOT=%~dp0RootCA"
set "OUT=%~dp0certs"

if not exist "%~dp0mkcert.exe" (
  echo [LOI] Khong thay mkcert.exe canh file nay.
  pause
  exit /b 1
)

if not exist "%CAROOT%\rootCA-key.pem" (
  echo [THONG BAO] Chua co Root CA -^> tao moi. Nho SAO LUU thu muc RootCA ngay sau do.
  mkdir "%CAROOT%" >nul 2>&1
  "%~dp0mkcert.exe" -install
) else (
  echo [OK] Dung lai Root CA co san: %CAROOT%
)

mkdir "%OUT%" >nul 2>&1

echo.
echo Cap chung chi cho: %DOMAIN% %EXTRA_NAMES% %SERVER_IP% localhost 127.0.0.1
"%~dp0mkcert.exe" -cert-file "%OUT%\server.crt" -key-file "%OUT%\server.key" %DOMAIN% %EXTRA_NAMES% %SERVER_IP% localhost 127.0.0.1
if errorlevel 1 (
  echo [LOI] Cap chung chi that bai.
  pause
  exit /b 1
)

rem Ban sao Root CA cong khai de phat cho may con (KHONG phat rootCA-key.pem)
copy /y "%CAROOT%\rootCA.pem" "%OUT%\rootCA.crt" >nul

echo.
echo ===== KIEM TRA TEN TRONG CHUNG CHI (phai co du ten + IP) =====
certutil -dump "%OUT%\server.crt" | findstr /i /c:"DNS Name" /c:"IP Address" /c:"NotAfter"

echo.
echo XONG.
echo  - Dat trong backend\.env:  xem file env-https.mau
echo  - Phat cho MAY CON: %OUT%\rootCA.crt  (cung file cai-rootca-may-con.bat)
echo  - TUYET DOI KHONG phat/commit: %CAROOT%\rootCA-key.pem  (sao luu vao USB cat ket)
pause
endlocal
