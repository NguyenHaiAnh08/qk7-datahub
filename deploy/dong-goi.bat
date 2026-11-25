@echo off
rem ============================================================
rem  DONG GOI QK7 DataHub DE DUA LEN MAY CHU
rem  Chay tren MAY DEV:  deploy\dong-goi.bat
rem  Ket qua: thu muc QK7_release\ (o canh thu muc du an)
rem  KHONG mang: node_modules, .env, uploads, certs cu, mkcert.exe
rem ============================================================
setlocal
chcp 65001 >nul

set "ROOT=%~dp0.."
pushd "%ROOT%"
set "ROOT=%CD%"
popd
set "OUT=%ROOT%\QK7_release"

echo.
echo [1/5] Build frontend (ra backend\public)...
pushd "%ROOT%\frontend"
if not exist node_modules (
  echo     Chua co node_modules frontend -^> npm install
  call npm install
  if errorlevel 1 goto :fail
)
call npm run build
if errorlevel 1 popd & goto :fail
popd

if not exist "%ROOT%\backend\public\index.html" (
  echo [LOI] Khong thay backend\public\index.html sau khi build.
  goto :fail
)

echo.
echo [2/5] Don thu muc dong goi cu: %OUT%
if exist "%OUT%" rmdir /s /q "%OUT%"
mkdir "%OUT%"

echo.
echo [3/5] Chep backend (kem frontend da build)...
robocopy "%ROOT%\backend" "%OUT%\backend" /E /NFL /NDL /NJH /NJS /NP ^
  /XD "%ROOT%\backend\node_modules" "%ROOT%\backend\uploads" "%ROOT%\backend\certs" ^
  /XF .env .env.local mkcert.exe *.log
if errorlevel 8 goto :fail

echo.
echo [4/5] Chep HTTPS (may chu + may con) va script khoi dong...
robocopy "%ROOT%\deploy\https\may-chu" "%OUT%\deploy\https\may-chu" /E /NFL /NDL /NJH /NJS /NP /XF mkcert.exe
if errorlevel 8 goto :fail
robocopy "%ROOT%\deploy\https\may-con" "%OUT%\deploy\https\may-con" /E /NFL /NDL /NJH /NJS /NP
if errorlevel 8 goto :fail
copy /y "%ROOT%\deploy\https\HUONG-DAN.md" "%OUT%\deploy\https\" >nul
copy /y "%ROOT%\package.json" "%OUT%\" >nul
robocopy "%ROOT%\scripts" "%OUT%\scripts" /E /NFL /NDL /NJH /NJS /NP
if errorlevel 8 goto :fail

echo.
echo [5/5] Kiem tra goi...
set "MISS="
if not exist "%OUT%\backend\server.js" set "MISS=%MISS% backend\server.js"
if not exist "%OUT%\backend\public\index.html" set "MISS=%MISS% backend\public\index.html"
if not exist "%OUT%\backend\migrations" set "MISS=%MISS% backend\migrations"
if not exist "%OUT%\deploy\https\may-chu\certs\server.crt" set "MISS=%MISS% certs\server.crt"
if not exist "%OUT%\deploy\https\may-chu\certs\server.key" set "MISS=%MISS% certs\server.key"
if defined MISS (
  echo [LOI] Thieu:%MISS%
  goto :fail
)
if exist "%OUT%\backend\.env" echo [CANH BAO] Co .env trong goi - xoa di!

echo.
echo ================= XONG =================
echo Goi nam o: %OUT%
echo.
echo CAN LAM TIEP tren may chu:
echo   1. cd backend ^&^& npm install --omit=dev
echo   2. Tao backend\.env rieng (DB_*, khoa bi mat, 6 dong HTTPS trong deploy\https\may-chu\env-https.mau)
echo   3. Restore DB va chay cac file trong backend\migrations neu chua co
echo   4. Mo cong 8000, chay: node --max-old-space-size=4096 server.js (hoac PM2)
echo.
echo CANH BAO: goi co deploy\https\may-chu\RootCA\rootCA-key.pem (khoa goc).
echo   Chep bang USB, KHONG gui qua email/chat/git. Phat cho may con CHI rootCA.crt.
pause
endlocal
exit /b 0

:fail
echo.
echo [THAT BAI] Dong goi chua hoan tat. Xem loi o tren.
pause
endlocal
exit /b 1
