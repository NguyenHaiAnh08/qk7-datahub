@echo off
REM ============================================================
REM load-env.bat — Load .env root vào biến môi trường batch
REM Cú pháp: call load-env.bat
REM Sau khi call: %SERVER_IP%, %SERVER_DOMAIN%, %PORT_BACKEND%, ...
REM ============================================================

set "ENV_FILE=%~dp0.env"

if not exist "%ENV_FILE%" (
    echo [LOI] Khong tim thay .env tai %ENV_FILE%
    echo Copy tu .env.example: copy .env.example .env
    exit /b 1
)

REM Đọc từng dòng: bỏ comment (#), split tại = đầu tiên
for /f "usebackq eol=# tokens=1,* delims==" %%a in ("%ENV_FILE%") do (
    call set "%%a=%%b"
)

exit /b 0