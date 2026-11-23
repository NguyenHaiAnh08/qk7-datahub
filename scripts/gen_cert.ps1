# ==============================================================================
# scripts/gen_cert.ps1  Tao chung chi SSL/TLS chuan cho QK7 DataHub (PowerShell)
# Ho tro:
#   - mkcert       : Dev / LAN noi bo cap nhanh
#   - military-pki : Ha tang Khoa Cong Khai Quan su 2 Tang (1.000.000+ thiet bi, 100% Air-Gap)
#   - certbot      : Staging / Production co Internet (ACME)
# ==============================================================================
param(
    [ValidateSet("mkcert", "military-pki", "certbot")]
    [string]$Mode = "mkcert",
    [string]$Domain = "",
    [string]$Hostname = "trungtamdulieuso.tqsqk7.edu"
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir   = Split-Path -Parent $ScriptDir
$CertsDir  = Join-Path $RootDir "backend\certs"
$FpDir     = Join-Path $RootDir "fingerprint"

if (-not (Test-Path $CertsDir)) {
    New-Item -ItemType Directory -Path $CertsDir -Force | Out-Null
}

# Tu dong do dia chi IPv4 LAN neu khong truyen -Domain
if ([string]::IsNullOrWhiteSpace($Domain)) {
    $detected = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
        Where-Object {
            $_.IPAddress -ne "127.0.0.1" -and
            $_.IPAddress -notlike "169.254.*" -and
            $_.InterfaceAlias -notmatch "Loopback|Bluetooth|vEthernet|Docker|WSL|VPN|Virtual"
        } | Select-Object -First 1 -ExpandProperty IPAddress
    $Domain = if ($detected) { $detected } else { "127.0.0.1" }
}

Write-Host "=======================================================================" -ForegroundColor Cyan
Write-Host "  QK7 DataHub  Trinh tao chung chi SSL/TLS Bao Mat" -ForegroundColor Green
Write-Host "  Che do: $Mode | IP: $Domain | Ten mien: $Hostname" -ForegroundColor Yellow
Write-Host "=======================================================================" -ForegroundColor Cyan

if ($Mode -eq "military-pki") {
    $pkiScript = Join-Path $ScriptDir "setup-military-pki.ps1"
    if (-not (Test-Path $pkiScript)) {
        Write-Error "Khong tim thay $pkiScript"
        exit 1
    }
    & $pkiScript -ServerIP $Domain -Hostname $Hostname
    exit $LASTEXITCODE
} elseif ($Mode -eq "mkcert") {
    $mkcertExe = $null
    $mkcertCmd = Get-Command mkcert -ErrorAction SilentlyContinue
    if ($mkcertCmd) {
        $mkcertExe = $mkcertCmd.Source
    } elseif (Test-Path (Join-Path $RootDir "deploy\https\may-chu\mkcert.exe")) {
        $mkcertExe = Join-Path $RootDir "deploy\https\may-chu\mkcert.exe"
    }
    if (-not $mkcertExe) {
        Write-Warning "Khong tim thay 'mkcert' trong PATH hoac deploy\https\may-chu\. Tu dong chuyen sang che do Private Military PKI (OpenSSL Air-Gap)..."
        $pkiScript = Join-Path $ScriptDir "setup-military-pki.ps1"
        if (Test-Path $pkiScript) {
            & $pkiScript -ServerIP $Domain -Hostname $Hostname
            exit $LASTEXITCODE
        }
        Write-Error "Khong tim thay 'mkcert' va khong co setup-military-pki.ps1."
        exit 1
    }

    Write-Host "[1/3] Cai dat CA noi bo vao Windows Certificate Store..." -ForegroundColor Gray
    & $mkcertExe -install

    $certFile = Join-Path $CertsDir "cert.pem"
    $keyFile  = Join-Path $CertsDir "private-key.pem"

    $sanList = @($Domain, $Hostname, "tqsqk7.cntt", "localhost", "127.0.0.1", "::1") | Select-Object -Unique
    Write-Host "[2/3] Sinh chung chi SAN: $($sanList -join ', ')..." -ForegroundColor Gray
    & $mkcertExe -cert-file $certFile -key-file $keyFile @sanList

    $caRoot = (& $mkcertExe -CAROOT).Trim()
    $rootCaSrc = Join-Path $caRoot "rootCA.pem"
    if (Test-Path $rootCaSrc) {
        $dstRoot = Join-Path $CertsDir "rootCA.pem"
        Copy-Item $rootCaSrc $dstRoot -Force
        if (Test-Path $FpDir) {
            Copy-Item $rootCaSrc (Join-Path $FpDir "rootCA.pem") -Force
        }
        # Xuat san ho so Apple Configuration Profile (.mobileconfig) cho iPad Air M4 (khong can OpenSSL)
        $pemRaw = Get-Content $dstRoot -Raw -Encoding ASCII
        $b64 = ($pemRaw -replace '-----BEGIN CERTIFICATE-----','' -replace '-----END CERTIFICATE-----','' -replace '\s+','')
        $uuid1 = [guid]::NewGuid().ToString().ToUpper()
        $uuid2 = [guid]::NewGuid().ToString().ToUpper()
        $mobilePath = Join-Path $CertsDir "QK7-DataHub-RootCA.mobileconfig"
        $mobileXml = @"
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>PayloadContent</key>
    <array>
        <dict>
            <key>PayloadCertificateFileName</key>
            <string>QK7-DataHub-RootCA.cer</string>
            <key>PayloadContent</key>
            <data>
$b64
            </data>
            <key>PayloadDescription</key>
            <string>Chung chi Goc Bao Mat Noi Bo - Trung Tam Du Lieu So QK7 ($Hostname)</string>
            <key>PayloadDisplayName</key>
            <string>QK7 DataHub Root CA</string>
            <key>PayloadIdentifier</key>
            <string>vn.qk7.datahub.rootca.$uuid1</string>
            <key>PayloadType</key>
            <string>com.apple.security.root</string>
            <key>PayloadUUID</key>
            <string>$uuid1</string>
            <key>PayloadVersion</key>
            <integer>1</integer>
        </dict>
    </array>
    <key>PayloadDescription</key>
    <string>Ho so tin cay HTTPS noi bo cho Trung Tam Du Lieu So QK7 ($Hostname)</string>
    <key>PayloadDisplayName</key>
    <string>QK7 DataHub  Chung Chi Bao Mat ($Hostname)</string>
    <key>PayloadIdentifier</key>
    <string>vn.qk7.datahub.profile.$uuid2</string>
    <key>PayloadOrganization</key>
    <string>Truong Quan Su Quan Khu 7</string>
    <key>PayloadType</key>
    <string>Configuration</string>
    <key>PayloadUUID</key>
    <string>$uuid2</string>
    <key>PayloadVersion</key>
    <integer>1</integer>
</dict>
</plist>
"@
        $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
        [System.IO.File]::WriteAllText($mobilePath, $mobileXml, $utf8NoBom)
        Write-Host "[3/3] da dong bo rootCA.pem vao backend\certs\, fingerprint\ va xuat QK7-DataHub-RootCA.mobileconfig cho iPad Air M4." -ForegroundColor Gray
    }

    Write-Host ""
    Write-Host " Tao chung chi thanh cong!" -ForegroundColor Green
    Write-Host "   Cert:    $certFile" -ForegroundColor Cyan
    Write-Host "   Key:     $keyFile" -ForegroundColor Cyan
    Write-Host "   Root CA: $rootCaSrc" -ForegroundColor Yellow
} elseif ($Mode -eq "certbot") {
    Write-Host "  Chay certbot standalone cho $Hostname..." -ForegroundColor Gray
    & certbot certonly --standalone -d $Hostname --non-interactive --agree-tos -m "admin@$Hostname"
    Copy-Item "C:\Certbot\live\$Hostname\fullchain.pem" (Join-Path $CertsDir "cert.pem") -Force
    Copy-Item "C:\Certbot\live\$Hostname\privkey.pem" (Join-Path $CertsDir "private-key.pem") -Force
    Write-Host " Cap chung chi Let's Encrypt thanh cong!" -ForegroundColor Green
} else {
    Write-Error "Che do khong hop le: $Mode. Dung mkcert, military-pki hoac certbot."
    exit 1
}
