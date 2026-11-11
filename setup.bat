@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
title QK7 DATAHUB - TRINH CAI DAT TOAN DIEN (AUTO-INSTALLER v4)
color 0A

REM Thiet lap thu muc goc he thong
set "ROOT=%~dp0"
cd /d "%ROOT%"

echo ========================================================================
echo    TRUONG QUAN SU QUAN KHU 7 - DATAHUB
echo    HE THONG LUU TRU, QUAN TRI VA KHAI THAC TAI LIEU SO BAO MAT
echo    TRINH CAI DAT TOAN DIEN VA DONG GOI AIR-GAP - AUTO-INSTALLER v4
echo ========================================================================
echo Thoi diem khoi chay: %DATE% %TIME%
echo Thu muc goc he thong: %ROOT%
echo.

:step_0
REM ========================================================================
REM BUOC 0: KIEM TRA MOI TRUONG VA KET NOI MANG
REM ========================================================================
echo [0/8] Kiem tra moi truong he thong va ket noi mang...

REM Kiem tra Node.js
where node >nul 2>&1
if !errorlevel! neq 0 (
    set "ERR_MSG=Thieu Node.js tren he thong. Yeu cau cai dat Node.js >= 22.13 truoc khi chay setup."
    goto :error_handler
)
for /f "tokens=*" %%v in ('node -v 2^>nul') do echo   [OK] Node.js da san sang: %%v

REM Kiem tra Python
where python >nul 2>&1
if !errorlevel! neq 0 (
    set "ERR_MSG=Thieu Python tren he thong. Yeu cau cai dat Python >= 3.10 truoc khi chay setup."
    goto :error_handler
)
for /f "tokens=*" %%v in ('python --version 2^>nul') do echo   [OK] Python da san sang: %%v

REM Kiem tra Git
where git >nul 2>&1
if !errorlevel! neq 0 (
    set "ERR_MSG=Thieu Git tren he thong. Yeu cau cai dat Git truoc khi tiep tuc."
    goto :error_handler
)
for /f "tokens=*" %%v in ('git --version 2^>nul') do echo   [OK] Git da san sang: %%v

REM Kiem tra ket noi mang qua ping pypi.org
echo   [INFO] Dang kiem tra ket noi mang qua pypi.org...
ping -n 1 -w 2000 pypi.org >nul 2>&1
if !errorlevel! equ 0 (
    set "HAS_INTERNET=1"
    echo   [OK] Phat hien ket noi Internet thanh cong.
    echo   [CHE DO] ONLINE - Cai dat truc tuyen va dong goi Air-Gap.
) else (
    set "HAS_INTERNET=0"
    echo   [CANH BAO] Khong the ket noi Internet qua ping pypi.org.
    echo   [CHE DO] AIR-GAP OFFLINE - Su dung goi du phong tu offline_packages.
)
echo.

:step_1
REM ========================================================================
REM BUOC 1: CHUAN BI GOI OFFLINE (Chi chay khi co Internet)
REM ========================================================================
if "%HAS_INTERNET%"=="0" (
    echo [1/8] [SKIP] Che do Air-Gap. Bo qua buoc dong goi Offline.
    echo.
    goto :step_2
)

echo [1/8] Dang chuan bi goi Offline cho moi truong Air-Gap...
if not exist "%ROOT%offline_packages" mkdir "%ROOT%offline_packages"
if not exist "%ROOT%offline_packages\npm" mkdir "%ROOT%offline_packages\npm"
if not exist "%ROOT%offline_packages\pip" mkdir "%ROOT%offline_packages\pip"
if not exist "%ROOT%offline_packages\tools" mkdir "%ROOT%offline_packages\tools"

REM 1.1 Dong goi Node.js cho Backend va Frontend
echo   [INFO] Dong goi Node.js dependencies...

cd /d "%ROOT%backend"
if not exist "node_modules" (
    echo   [INFO] Dang chay npm install tai backend...
    call npm install
    if !errorlevel! neq 0 (
        set "ERR_MSG=npm install tai backend gap loi"
        goto :error_handler
    )
) else (
    echo   [SKIP] backend\node_modules da ton tai san.
)
if not exist "%ROOT%offline_packages\npm\backend_node_modules" (
    echo   [INFO] Dang sao chep backend node_modules vao offline_packages...
    xcopy /E /I /Y /Q "%ROOT%backend\node_modules" "%ROOT%offline_packages\npm\backend_node_modules" >nul
    echo   [OK] Da dong goi backend_node_modules thanh cong.
) else (
    echo   [SKIP] offline_packages\npm\backend_node_modules da co san.
)

cd /d "%ROOT%frontend"
if not exist "node_modules" (
    echo   [INFO] Dang chay npm install tai frontend...
    call npm install
    if !errorlevel! neq 0 (
        set "ERR_MSG=npm install tai frontend gap loi"
        goto :error_handler
    )
) else (
    echo   [SKIP] frontend\node_modules da ton tai san.
)
if not exist "%ROOT%offline_packages\npm\frontend_node_modules" (
    echo   [INFO] Dang sao chep frontend node_modules vao offline_packages...
    xcopy /E /I /Y /Q "%ROOT%frontend\node_modules" "%ROOT%offline_packages\npm\frontend_node_modules" >nul
    echo   [OK] Da dong goi frontend_node_modules thanh cong.
) else (
    echo   [SKIP] offline_packages\npm\frontend_node_modules da co san.
)

REM 1.2 Tai truoc cac goi Python Wheels vao offline_packages\pip
echo   [INFO] Dang tai truoc cac goi Python Wheels vao offline_packages\pip...
for %%S in (boxchat ocr-service fingerprint) do (
    echo   [INFO] pip download cho service: %%S...
    cd /d "%ROOT%%%S"
    if exist "requirements.txt" (
        pip download -r requirements.txt -d "%ROOT%offline_packages\pip" --quiet
    )
)
echo   [INFO] Tai truoc Semgrep wheel vao offline_packages\pip...
pip download semgrep -d "%ROOT%offline_packages\pip" --quiet >nul 2>&1

REM 1.3 Tai Security Tools - Gitleaks Windows x64
echo   [INFO] Kiem tra va tai Gitleaks Windows x64...
if not exist "%ROOT%offline_packages\tools\gitleaks.zip" (
    echo   [INFO] Dang tai gitleaks_8.20.0_windows_x64.zip tu GitHub Releases...
    curl.exe -L -s -S "https://github.com/gitleaks/gitleaks/releases/download/v8.20.0/gitleaks_8.20.0_windows_x64.zip" -o "%ROOT%offline_packages\tools\gitleaks.zip" >nul 2>&1
    if not exist "%ROOT%offline_packages\tools\gitleaks.zip" (
        powershell -NoProfile -ExecutionPolicy Bypass -Command "$ProgressPreference = 'SilentlyContinue'; [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://github.com/gitleaks/gitleaks/releases/download/v8.20.0/gitleaks_8.20.0_windows_x64.zip' -OutFile '%ROOT%offline_packages\tools\gitleaks.zip'"
    )
    if exist "%ROOT%offline_packages\tools\gitleaks.zip" (
        echo   [OK] Da tai gitleaks.zip vao offline_packages\tools thanh cong.
    ) else (
        echo   [CANH BAO] Khong the tai gitleaks.zip. Ban co the copy thu cong file nay vao offline_packages\tools.
    )
) else (
    echo   [SKIP] offline_packages\tools\gitleaks.zip da co san.
)
echo   [OK] Da hoan tat chuan bi goi Offline.
echo.

:step_2
REM ========================================================================
REM BUOC 2: CAI DAT NODE.JS (Backend va Frontend)
REM ========================================================================
echo [2/8] Dang xu ly Node.js cho Backend va Frontend...

REM Backend node_modules
cd /d "%ROOT%backend"
if not exist "node_modules" (
    if "%HAS_INTERNET%"=="1" (
        echo   [INFO] Cai dat backend dependencies truc tuyen...
        call npm install
        if !errorlevel! neq 0 (
            set "ERR_MSG=npm install tai backend that bai"
            goto :error_handler
        )
    ) else (
        echo   [INFO] Khoi phuc backend node_modules tu goi Offline...
        if exist "%ROOT%offline_packages\npm\backend_node_modules" (
            xcopy /E /I /Y /Q "%ROOT%offline_packages\npm\backend_node_modules" "%ROOT%backend\node_modules" >nul
            echo   [OK] Da khoi phuc backend node_modules tu offline package.
        ) else (
            set "ERR_MSG=Khong tim thay offline_packages\npm\backend_node_modules trong che do Air-Gap"
            goto :error_handler
        )
    )
) else (
    echo   [SKIP] Backend da co node_modules san.
)

REM Frontend node_modules
cd /d "%ROOT%frontend"
if not exist "node_modules" (
    if "%HAS_INTERNET%"=="1" (
        echo   [INFO] Cai dat frontend dependencies truc tuyen...
        call npm install
        if !errorlevel! neq 0 (
            set "ERR_MSG=npm install tai frontend that bai"
            goto :error_handler
        )
    ) else (
        echo   [INFO] Khoi phuc frontend node_modules tu goi Offline...
        if exist "%ROOT%offline_packages\npm\frontend_node_modules" (
            xcopy /E /I /Y /Q "%ROOT%offline_packages\npm\frontend_node_modules" "%ROOT%frontend\node_modules" >nul
            echo   [OK] Da khoi phuc frontend node_modules tu offline package.
        ) else (
            set "ERR_MSG=Khong tim thay offline_packages\npm\frontend_node_modules trong che do Air-Gap"
            goto :error_handler
        )
    )
) else (
    echo   [SKIP] Frontend da co node_modules san.
)
echo.

:step_3
REM ========================================================================
REM BUOC 3: CAI DAT PYTHON SERVICES (Boxchat, OCR, Fingerprint)
REM ========================================================================
echo [3/8] Dang xu ly cac dich vu Python - boxchat, ocr-service, fingerprint...

for %%S in (boxchat ocr-service fingerprint) do (
    echo.
    echo   --------------------------------------------------------
    echo   [DICH VU] Xu ly: %%S
    echo   --------------------------------------------------------
    cd /d "%ROOT%%%S"
    
    if not exist "venv" (
        echo   [INFO] Dang tao moi virtual environment venv cho %%S...
        python -m venv venv
        if !errorlevel! neq 0 (
            set "ERR_MSG=Tao virtual environment venv tai %%S that bai"
            goto :error_handler
        )
        echo   [OK] Da tao venv tai %%S.
    ) else (
        echo   [SKIP] %%S da co thu muc venv san.
    )

    if exist "venv\Scripts\activate.bat" (
        call venv\Scripts\activate.bat
        if !errorlevel! neq 0 (
            set "ERR_MSG=Khong the kich hoat venv tai %%S"
            goto :error_handler
        )

        if "%HAS_INTERNET%"=="1" (
            echo   [INFO] Cai dat dependencies truc tuyen cho %%S...
            python -m pip install --upgrade pip >nul 2>&1
            if exist "requirements.txt" (
                pip install -r requirements.txt
                if !errorlevel! neq 0 (
                    echo   [CANH BAO] Cai dat requirements cho %%S co the can kiem tra them.
                ) else (
                    echo   [OK] Da cai dat requirements cho %%S thanh cong.
                )
            )
        ) else (
            echo   [INFO] Cai dat dependencies tu offline_packages\pip cho %%S...
            if exist "requirements.txt" (
                pip install --no-index --find-links="%ROOT%offline_packages\pip" -r requirements.txt
                if !errorlevel! neq 0 (
                    echo   [CANH BAO] Cai dat offline requirements cho %%S co the thieu mot so wheel.
                ) else (
                    echo   [OK] Da cai dat offline requirements cho %%S thanh cong.
                )
            )
        )
        call deactivate
    ) else (
        set "ERR_MSG=Khong tim thay venv\Scripts\activate.bat tai %%S"
        goto :error_handler
    )
)
echo.

:step_4
REM ========================================================================
REM BUOC 4: CAI DAT SECURITY TOOLS (Gitleaks va Semgrep)
REM ========================================================================
echo [4/8] Dang kiem tra va cai dat Security Tools...

REM Gitleaks
if not exist "%ROOT%tools\gitleaks\gitleaks.exe" (
    if not exist "%ROOT%tools\gitleaks" mkdir "%ROOT%tools\gitleaks"
    
    if "%HAS_INTERNET%"=="1" (
        if not exist "%ROOT%offline_packages\tools\gitleaks.zip" (
            echo   [INFO] Dang tai gitleaks.zip tu GitHub Releases...
            curl.exe -L -s -S "https://github.com/gitleaks/gitleaks/releases/download/v8.20.0/gitleaks_8.20.0_windows_x64.zip" -o "%ROOT%offline_packages\tools\gitleaks.zip" >nul 2>&1
            if not exist "%ROOT%offline_packages\tools\gitleaks.zip" (
                powershell -NoProfile -ExecutionPolicy Bypass -Command "$ProgressPreference = 'SilentlyContinue'; [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://github.com/gitleaks/gitleaks/releases/download/v8.20.0/gitleaks_8.20.0_windows_x64.zip' -OutFile '%ROOT%offline_packages\tools\gitleaks.zip'"
            )
        )
    )

    if exist "%ROOT%offline_packages\tools\gitleaks.zip" (
        echo   [INFO] Dang giai nen Gitleaks vao tools\gitleaks...
        powershell -NoProfile -ExecutionPolicy Bypass -Command "Expand-Archive -Path '%ROOT%offline_packages\tools\gitleaks.zip' -DestinationPath '%ROOT%tools\gitleaks' -Force"
        if exist "%ROOT%tools\gitleaks\gitleaks.exe" (
            echo   [OK] Da cai dat Gitleaks vao tools\gitleaks\gitleaks.exe.
        ) else (
            echo   [CANH BAO] Giai nen xong nhung khong tim thay gitleaks.exe.
        )
    ) else (
        echo   [CANH BAO] Khong tim thay file offline_packages\tools\gitleaks.zip de cai dat Gitleaks.
    )
) else (
    echo   [SKIP] Gitleaks da co san tai tools\gitleaks\gitleaks.exe.
)

REM Semgrep
where semgrep >nul 2>&1
if !errorlevel! equ 0 (
    echo   [SKIP] Semgrep da duoc cai dat tren he thong.
) else (
    if "%HAS_INTERNET%"=="1" (
        echo   [INFO] Dang thu cai dat Semgrep qua winget hoac pip...
        winget install --id Semgrep.Semgrep -e --silent --accept-package-agreements --accept-source-agreements >nul 2>&1
        where semgrep >nul 2>&1
        if !errorlevel! neq 0 (
            pip install semgrep >nul 2>&1
        )
        where semgrep >nul 2>&1
        if !errorlevel! equ 0 (
            echo   [OK] Da cai dat Semgrep thanh cong.
        ) else (
            echo   [CANH BAO] Khong the tu dong cai Semgrep. Ban co the cai thu cong sau.
        )
    ) else (
        echo   [INFO] Dang thu cai dat Semgrep tu goi offline_packages\pip...
        pip install --no-index --find-links="%ROOT%offline_packages\pip" semgrep >nul 2>&1
        where semgrep >nul 2>&1
        if !errorlevel! equ 0 (
            echo   [OK] Da cai dat Semgrep tu offline_packages.
        ) else (
            echo   [CANH BAO] Semgrep khong co san trong offline_packages\pip tren may Air-Gap.
        )
    )
)
echo.

:step_5
REM ========================================================================
REM BUOC 5: KIEM TRA AI MODELS VA MONKEYOCRV2 WEIGHTS
REM ========================================================================
echo [5/8] Kiem tra AI Models va MonkeyOCRv2 Weights...

REM Kiem tra MonkeyOCRv2 Weights
if exist "%ROOT%ocr-service\model_weight\MonkeyOCRv2-B-Parsing\model.safetensors" (
    echo   [OK] Da tim thay MonkeyOCRv2 Model Weights tai:
    echo        ocr-service\model_weight\MonkeyOCRv2-B-Parsing
) else (
    echo.
    echo   ======================================================================
    echo   [CANH BAO DO] KHONG TIM THAY TRONG SO MONKEYOCRV2!
    echo   Thieu file: ocr-service\model_weight\MonkeyOCRv2-B-Parsing\model.safetensors
    echo   Trong moi truong Air-Gap, vui long copy thu muc model_weight tu may khac:
    echo   Nguon: MonkeyOCRv2-B-Parsing\
    echo   Dich:  %ROOT%ocr-service\model_weight\MonkeyOCRv2-B-Parsing\
    echo   ======================================================================
    echo.
)

REM Kiem tra Ollama Models
where ollama >nul 2>&1
if !errorlevel! equ 0 (
    if "%HAS_INTERNET%"=="1" (
        echo   [INFO] Dang kiem tra va tai Ollama Models - qwen2.5:3b va bge-m3...
        echo   [INFO] Pulling qwen2.5:3b...
        ollama pull qwen2.5:3b
        echo   [INFO] Pulling bge-m3...
        ollama pull bge-m3
        echo   [OK] Da cap nhat cac model Ollama thanh cong.
    ) else (
        echo   [CANH BAO] Che do Air-Gap: Vui long copy thu muc model Ollama tu may khac sang.
        echo              Thuong nam tai: C:\Users\%%USERNAME%%\.ollama\models
    )
) else (
    echo   [CANH BAO] Khong tim thay Ollama tren PATH. Vui long cai dat Ollama de chay Boxchat AI.
)
echo.

:step_6
REM ========================================================================
REM BUOC 6: KHOI TAO CAC FILE CAU HINH MOI TRUONG (.env)
REM ========================================================================
echo [6/8] Kiem tra va khoi tao cac file cau hinh .env...

REM Root .env
if not exist "%ROOT%.env" (
    if exist "%ROOT%.env.example" (
        copy "%ROOT%.env.example" "%ROOT%.env" >nul
        echo   [TAO MOI] Da tao file .env tu .env.example
    ) else (
        echo   [CANH BAO] Khong tim thay file .env.example o thu muc goc.
    )
) else (
    echo   [SKIP] File .env o thu muc goc da ton tai.
)

REM Backend .env
if not exist "%ROOT%backend\.env" (
    if exist "%ROOT%backend\.env.example" (
        copy "%ROOT%backend\.env.example" "%ROOT%backend\.env" >nul
        echo   [TAO MOI] Da tao file backend\.env tu backend\.env.example
    ) else (
        echo   [CANH BAO] Khong tim thay file backend\.env.example.
    )
) else (
    echo   [SKIP] File backend\.env da ton tai.
)

REM Boxchat .env
if not exist "%ROOT%boxchat\.env" (
    if exist "%ROOT%boxchat\.env.example" (
        copy "%ROOT%boxchat\.env.example" "%ROOT%boxchat\.env" >nul
        echo   [TAO MOI] Da tao file boxchat\.env tu boxchat\.env.example
    ) else (
        echo   [CANH BAO] Khong tim thay file boxchat\.env.example.
    )
) else (
    echo   [SKIP] File boxchat\.env da ton tai.
)

REM OCR .env
if not exist "%ROOT%ocr-service\.env" (
    if exist "%ROOT%ocr-service\.env.example" (
        copy "%ROOT%ocr-service\.env.example" "%ROOT%ocr-service\.env" >nul
        echo   [TAO MOI] Da tao file ocr-service\.env tu ocr-service\.env.example
    ) else (
        echo   [CANH BAO] Khong tim thay file ocr-service\.env.example.
    )
) else (
    echo   [SKIP] File ocr-service\.env da ton tai.
)
echo.

:step_7
REM ========================================================================
REM BUOC 7: BUILD FRONTEND (Production)
REM ========================================================================
echo [7/8] Dang Build Frontend - Production SPA...
cd /d "%ROOT%frontend"
call npm run build
if !errorlevel! neq 0 (
    set "ERR_MSG=Build Frontend that bai (npm run build gap loi bien dich)"
    goto :error_handler
)
echo   [OK] Da build Frontend thanh cong vao backend\public.
echo.

:step_8
REM ========================================================================
REM BUOC 8: HOAN TAT CAI DAT
REM ========================================================================
echo ========================================================================
echo [8/8] HE THONG DA SAN SANG VAN HANH!
echo ========================================================================
echo   [+] Node.js Backend va Frontend: SAN SANG
echo   [+] Python Services (Boxchat, OCR, Fingerprint): SAN SANG
echo   [+] Security Scanners (Gitleaks, Semgrep): SAN SANG
echo   [+] MonkeyOCRv2 Model Weights: DA KIEM TRA
echo   [+] Static Assets: Da build san tai backend\public\index.html
echo.
echo   Luu y quan trong:
echo   1. Kiem tra lai file backend\.env de cau hinh ket noi SQL Server (DB_PASSWORD)
echo      va JWT_SECRET / FP_ENC_KEY theo quy dinh bao mat quan su.
echo   2. De khoi dong he thong, hay chay: scripts\s.bat (hoac s.bat)
echo   3. De chay che do Development, chay: scripts\s-dev.bat
echo ========================================================================
echo.
pause
exit /b 0

REM ========================================================================
REM KHU VUC XU LY LOI (ERROR HANDLER)
REM ========================================================================
:error_handler
color 0C
echo.
echo ========================================================================
echo [LOI NGHIEP TRONG] QUA TRINH CAI DAT BI GIAN DOAN!
echo ========================================================================
echo Nguyen nhan loi: !ERR_MSG!
echo Thu muc xay ra loi: %CD%
echo Thoi diem loi: %DATE% %TIME%
echo.
echo Huong xu ly:
echo   1. Kiem tra log chi tiet phia tren de xac dinh nguyen nhan.
echo   2. Dam bao cac dependencies he thong (Node ^>= 22.13, Python ^>= 3.10, Git) da san sang.
echo   3. Trong moi truong Air-Gap, dam bao thu muc offline_packages da duoc sao chep day du.
echo ========================================================================
echo.
pause
exit /b 1
