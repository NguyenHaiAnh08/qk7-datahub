# ==============================================================================
# scripts/gen_cert.ps1 — Tạo chứng chỉ SSL/TLS chuẩn cho QK7 DataHub (PowerShell)
# Hỗ trợ: mkcert (Dev/LAN) & certbot (Prod)
# ==============================================================================
param(
    [string]$Mode = "mkcert",
    [string]$Domain = "192.168.1.229"
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent $ScriptDir
$CertsDir = Join-Path $RootDir "backend\certs"

if (-not (Test-Path $CertsDir)) {
    New-Item -ItemType Directory -Path $CertsDir -Force | Out-Null
}

Write-Host "=======================================================================" -ForegroundColor Cyan
Write-Host "  QK7 DataHub — Trình tạo chứng chỉ SSL/TLS Bảo Mật" -ForegroundColor Green
Write-Host "  Chế độ: $Mode | Mục tiêu: $Domain" -ForegroundColor Yellow
Write-Host "=======================================================================" -ForegroundColor Cyan

if ($Mode -eq "mkcert") {
    $mkcertCmd = Get-Command mkcert -ErrorAction SilentlyContinue
    if (-not $mkcertCmd) {
        Write-Error "Không tìm thấy lệnh 'mkcert'. Hãy cài đặt qua winget install FiloSottile.mkcert"
        exit 1
    }

    Write-Host "⚙️  Cài đặt CA nội bộ vào Windows Certificate Store..." -ForegroundColor Gray
    & mkcert -install

    $certFile = Join-Path $CertsDir "cert.pem"
    $keyFile = Join-Path $CertsDir "private-key.pem"

    Write-Host "⚙️  Đang sinh chứng chỉ SAN cho $Domain, localhost, 127.0.0.1..." -ForegroundColor Gray
    & mkcert -cert-file $certFile -key-file $keyFile $Domain "localhost" "127.0.0.1" "trungtamdulieuso.tqs.com" "::1"

    $caRoot = & mkcert -CAROOT
    Write-Host ""
    Write-Host "✅ Tạo chứng chỉ thành công!" -ForegroundColor Green
    Write-Host "   Cert: $certFile" -ForegroundColor Cyan
    Write-Host "   Key:  $keyFile" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "📌 File Root CA máy chủ: $caRoot\rootCA.pem" -ForegroundColor Yellow
} elseif ($Mode -eq "certbot") {
    Write-Host "⚙️  Chạy certbot standalone..." -ForegroundColor Gray
    & certbot certonly --standalone -d $Domain --non-interactive --agree-tos -m "admin@$Domain"
    Copy-Item "C:\Certbot\live\$Domain\fullchain.pem" (Join-Path $CertsDir "cert.pem") -Force
    Copy-Item "C:\Certbot\live\$Domain\privkey.pem" (Join-Path $CertsDir "private-key.pem") -Force
    Write-Host "✅ Cap chung chi Lets Encrypt thanh cong!" -ForegroundColor Green
} else {
    Write-Error "Che do khong hop le. Dung mkcert hoac certbot."
    exit 1
}

