# ==============================================================================
# free-port.ps1 — Giải phóng triệt để cổng 8001 và file khóa Qdrant (QK7 DataHub)
# Tương thích 100% Windows 10/11 Pro (build 26300+), WindowsApps Python 3.12
# ==============================================================================
$ErrorActionPreference = "SilentlyContinue"

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "  QK7 DATAHUB - GIAI PHONG CONG 8001 & QDRANT LOCK" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

# 1. Tìm và diệt tất cả các tiến trình đang chiếm cổng 8001
$targetPort = 8001
$connections = Get-NetTCPConnection -LocalPort $targetPort -ErrorAction SilentlyContinue

if ($connections) {
    $pids = $connections | Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($p in $pids) {
        if ($p -and $p -gt 0) {
            Write-Host "[1/3] Phat hien tien trinh dang chiem cong $targetPort (PID: $p). Dang tat..." -ForegroundColor Yellow
            # Diệt theo cây tiến trình (/T) bằng taskkill
            & taskkill /F /T /PID $p 2>$null | Out-Null
            Stop-Process -Id $p -Force -ErrorAction SilentlyContinue
        }
    }
} else {
    Write-Host "[1/3] Cong $targetPort hien khong co ket noi TCP nao." -ForegroundColor Green
}

# 2. Quét dọn các tiến trình Python mồ côi (kể cả python3.12.exe từ Windows Store)
# và các tiến trình cmd/uvicorn liên quan đến main.py / boxchat
$staleProcesses = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
    ($_.Name -like "python*" -or $_.Name -eq "cmd.exe") -and
    ($_.CommandLine -like "*boxchat*" -or $_.CommandLine -like "*main.py*" -or $_.CommandLine -like "*8001*")
}

if ($staleProcesses) {
    foreach ($proc in $staleProcesses) {
        if ($proc.ProcessId -ne $PID) {
            Write-Host "[2/3] Dang dong tien trinh cu: $($proc.Name) (PID: $($proc.ProcessId))..." -ForegroundColor Yellow
            & taskkill /F /T /PID $proc.ProcessId 2>$null | Out-Null
            Stop-Process -Id $proc.ProcessId -Force -ErrorAction SilentlyContinue
        }
    }
} else {
    Write-Host "[2/3] Khong co tien trinh Python boxchat ton du." -ForegroundColor Green
}

# Chờ hệ điều hành giải phóng socket (tối đa 5 giây)
$waited = 0
while ($waited -lt 10) {
    $active = Get-NetTCPConnection -LocalPort $targetPort -ErrorAction SilentlyContinue
    if (-not $active) { break }
    Start-Sleep -Milliseconds 500
    $waited++
}

# 3. Dọn dẹp file khóa Qdrant (.lock) nếu còn tồn dư sau khi tắt tiến trình
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$qdrantLock = Join-Path $scriptDir "local_storage\qdrant_data\.lock"

if (Test-Path $qdrantLock) {
    Write-Host "[3/3] Phat hien file khoa Qdrant ton du: $qdrantLock" -ForegroundColor Yellow
    try {
        Remove-Item $qdrantLock -Force -ErrorAction Stop
        Write-Host "[3/3] Da giai phong file khoa Qdrant thanh cong." -ForegroundColor Green
    } catch {
        # Nếu đang bị hệ điều hành nhả chậm, chờ 1s rồi thử lại
        Start-Sleep -Seconds 1
        Remove-Item $qdrantLock -Force -ErrorAction SilentlyContinue
        if (Test-Path $qdrantLock) {
            Write-Host "[CANH BAO] File khoa Qdrant van chua the xoa. VectorStore se tu dong retry." -ForegroundColor Yellow
        } else {
            Write-Host "[3/3] Da giai phong file khoa Qdrant sau retry." -ForegroundColor Green
        }
    }
} else {
    Write-Host "[3/3] Kho Qdrant khong bi khoa (san sang ghi nhan)." -ForegroundColor Green
}

Write-Host "[OK] Hoan tat giai phong cong 8001 va Qdrant!" -ForegroundColor Green
Write-Host ""
