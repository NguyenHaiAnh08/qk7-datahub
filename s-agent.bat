@echo off
chcp 65001 >nul
title QK7 Fingerprint Agent - Client
cd /d "%~dp0"

echo ==========================================
echo   QK7 FINGERPRINT AGENT - CLIENT
echo ==========================================
echo.

REM --- 1. Kiem tra cac file can thiet ---
if not exist "agent.py" (
    echo [LOI] Khong tim thay agent.py trong thu muc hien tai.
    echo Thu muc hien tai: %CD%
    echo Dat file .bat nay CUNG THU MUC voi agent.py.
    pause
    exit /b 1
)

if not exist "libzkfp.dll" (
    echo [LOI] Khong tim thay libzkfp.dll.
    echo File nay phai nam cung thu muc voi agent.py.
    echo Neu thieu, copy tu: C:\Windows\System32\libzkfp.dll
    pause
    exit /b 1
)

if not exist ".env" (
    echo [LOI] Khong tim thay file .env
    echo Tao file .env voi noi dung:
    echo   BACKEND_WS_URL=ws://192.168.1.229:8000/ws/fingerprint
    echo   BRIDGE_TOKEN=^<copy tu server backend\.env^>
    echo   DEVICE_SERVER_HOST=127.0.0.1
    echo   DEVICE_SERVER_PORT=9001
    pause
    exit /b 1
)

REM --- 2. Kiem tra Python ---
where python >nul 2>&1
if errorlevel 1 (
    echo [LOI] Khong tim thay Python trong PATH.
    echo Cai Python 3.10+ tu python.org
    echo Nho TICK vao o "Add Python to PATH" khi cai.
    pause
    exit /b 1
)

REM --- 3. Kiem tra module pyzkfp ---
python -c "import pyzkfp" >nul 2>&1
if errorlevel 1 (
    echo [LOI] Chua cai module pyzkfp.
    echo Chay lenh sau trong thu muc nay:
    echo   pip install -r requirements.txt
    pause
    exit /b 1
)

REM --- 4. Canh bao neu .env tro ve localhost (loi pho bien) ---
findstr /C:"BACKEND_WS_URL=ws://localhost" ".env" >nul
if not errorlevel 1 (
    echo [CANH BAO] BACKEND_WS_URL dang tro ve localhost.
    echo Tren may client, localhost la chinh may nay, KHONG phai server.
    echo Sua .env thanh:
    echo   BACKEND_WS_URL=ws://192.168.1.229:8000/ws/fingerprint
    pause
    exit /b 1
)
findstr /C:"BACKEND_WS_URL=ws://127.0.0.1" ".env" >nul
if not errorlevel 1 (
    echo [CANH BAO] BACKEND_WS_URL dang tro ve 127.0.0.1.
    echo Tren may client, 127.0.0.1 la chinh may nay, KHONG phai server.
    echo Sua .env thanh:
    echo   BACKEND_WS_URL=ws://192.168.1.229:8000/ws/fingerprint
    pause
    exit /b 1
)

REM --- 5. Hien thi cau hinh hien tai ---
echo [OK] Cau hinh hop le.
echo.
echo --- Cau hinh hien tai (tu .env) ---
for /f "tokens=1,2 delims==" %%A in ('findstr /B "BACKEND_WS_URL= BRIDGE_TOKEN=" ".env"') do (
    if /I "%%A"=="BACKEND_WS_URL" echo   Server:      %%B
    if /I "%%A"=="BRIDGE_TOKEN" (
        set "TOKEN=%%B"
        call :ShowToken
    )
)
echo.
echo --- Dich vu local ---
echo   Tram kiem soat: http://127.0.0.1:9001/device-id
echo   Web:            http://192.168.1.229:8000
echo.
echo ==========================================
echo   Dang khoi dong Fingerprint Agent...
echo   (Nhan Ctrl+C hoac dong cua so de dung)
echo ==========================================
echo.

python agent.py

echo.
echo ==========================================
echo   Agent da dung.
echo ==========================================
pause
exit /b 0

:ShowToken
set "T=%TOKEN:~0,12%"
echo   Bridge Token: %T%...
goto :eof