# ==============================================================================
# scripts/setup-military-pki.ps1
# Khoi tao Ha tang Khoa Cong Khai Quan su 2 Tang (2-Tier Private Military PKI)
#   Tang 1: Offline Root CA       (QK7 Military Root CA  RSA 4096, 20 nam)
#   Tang 2: Online Issuing CA     (TQS Military Issuing CA  RSA 4096, 10 nam)
#   Tang 3: Leaf Server TLS Cert  (trungtamdulieuso.tqs.com + IP SAN  397 ngay)
#
# Tu dong xuat goi phan phoi cho 1.000.000+ thiet bi (100% Khong can Internet):
#   1. backend/certs/rootCA.pem                       (Windows / Linux / Python)
#   2. backend/certs/QK7-Military-Root-CA.mobileconfig (iPad Air M4 / MDM Profile)
#   3. backend/certs/install-root-ca-client.ps1       (Windows AD GPO / Tram PC)
# ==============================================================================
param(
    [string]$ServerIP = "",
    [string]$Hostname = "trungtamdulieuso.tqsqk7.edu",
    [switch]$ForceRegenerateCA
)

$ErrorActionPreference = "Stop"
$ScriptDir   = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir     = Split-Path -Parent $ScriptDir
$CertsDir    = Join-Path $RootDir "backend\certs"
$PkiDir      = Join-Path $CertsDir "military-pki"
$TemplateDir = Join-Path $RootDir "config\military-infra\pki"
$FpDir       = Join-Path $RootDir "fingerprint"

if ([string]::IsNullOrWhiteSpace($ServerIP)) {
    $detected = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
        Where-Object {
            $_.IPAddress -ne "127.0.0.1" -and
            $_.IPAddress -notlike "169.254.*" -and
            $_.InterfaceAlias -notmatch "Loopback|Bluetooth|vEthernet|Docker|WSL|VPN|Virtual"
        } | Select-Object -First 1 -ExpandProperty IPAddress
    $ServerIP = if ($detected) { $detected } else { "127.0.0.1" }
}

function Find-OpenSSL {
    $cmd = Get-Command openssl -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    $candidates = @(
        "C:\Program Files\Git\usr\bin\openssl.exe",
        "C:\Program Files\Git\mingw64\bin\openssl.exe",
        "C:\Program Files\OpenSSL-Win64\bin\openssl.exe",
        "C:\OpenSSL-Win64\bin\openssl.exe"
    )
    foreach ($c in $candidates) {
        if (Test-Path $c) { return $c }
    }
    return $null
}

$openssl = Find-OpenSSL
if (-not $openssl) {
    Write-Error "Khong tim thay OpenSSL (cai Git for Windows hoac OpenSSL-Win64 de khoi tao 2-Tier Military PKI)."
    exit 1
}

Write-Host "=======================================================================" -ForegroundColor Cyan
Write-Host "  QK7 DataHub  Khoi Tao 2-Tier Private Military PKI (100% Air-Gapped)" -ForegroundColor Green
Write-Host "  OpenSSL: $openssl" -ForegroundColor Gray
Write-Host "  Target:  https://$Hostname (IP: $ServerIP)" -ForegroundColor Yellow
Write-Host "=======================================================================" -ForegroundColor Cyan

# Tao cau truc thu muc PKI trong backend\certs\military-pki (da nam trong .gitignore)
$rootCaDir    = Join-Path $PkiDir "root-ca"
$issuingCaDir = Join-Path $PkiDir "issuing-ca"
$leafDir      = Join-Path $PkiDir "leaf"

foreach ($d in @(
    $CertsDir, $PkiDir, $leafDir,
    "$rootCaDir\certs", "$rootCaDir\crl", "$rootCaDir\newcerts", "$rootCaDir\private",
    "$issuingCaDir\certs", "$issuingCaDir\crl", "$issuingCaDir\newcerts", "$issuingCaDir\private", "$issuingCaDir\csr"
)) {
    if (-not (Test-Path $d)) { New-Item -ItemType Directory -Path $d -Force | Out-Null }
}

$rootKey  = "$rootCaDir\private\root-ca.key.pem"
$rootCert = "$rootCaDir\certs\root-ca.cert.pem"
$issKey   = "$issuingCaDir\private\issuing-ca.key.pem"
$issCsr   = "$issuingCaDir\csr\issuing-ca.csr.pem"
$issCert  = "$issuingCaDir\certs\issuing-ca.cert.pem"
$chainPem = "$issuingCaDir\certs\ca-chain.cert.pem"

Push-Location $PkiDir
try {
    #  TANG 1: OFFLINE ROOT CA (20 nam) 
    if ($ForceRegenerateCA -or -not (Test-Path $rootCert) -or -not (Test-Path $rootKey)) {
        Write-Host "[1/5] Khoi tao Tang 1: Offline Root CA (RSA 4096, 20 nam)..." -ForegroundColor Yellow
        "" | Set-Content "$rootCaDir\index.txt" -NoNewline -Encoding ASCII
        "1000" | Set-Content "$rootCaDir\serial" -Encoding ASCII

        & $openssl genrsa -out $rootKey 4096 2>$null
        & $openssl req -config "$TemplateDir\root-ca.cnf" `
            -key $rootKey -new -x509 -days 7300 -sha384 `
            -extensions v3_ca -out $rootCert
    } else {
        Write-Host "[1/5] Giu nguyen Offline Root CA hien co (de khong mat tin cay tren cac may da cai)." -ForegroundColor Green
    }

    #  TANG 2: ONLINE ISSUING CA (10 nam) 
    if ($ForceRegenerateCA -or -not (Test-Path $issCert) -or -not (Test-Path $issKey)) {
        Write-Host "[2/5] Khoi tao Tang 2: Online Intermediate Issuing CA (RSA 4096, 10 nam)..." -ForegroundColor Yellow
        "" | Set-Content "$issuingCaDir\index.txt" -NoNewline -Encoding ASCII
        "2000" | Set-Content "$issuingCaDir\serial" -Encoding ASCII
        "1000" | Set-Content "$issuingCaDir\crlnumber" -Encoding ASCII

        & $openssl genrsa -out $issKey 4096 2>$null
        & $openssl req -config "$TemplateDir\issuing-ca.cnf" `
            -new -sha256 -key $issKey -out $issCsr
        & $openssl ca -batch -config "$TemplateDir\root-ca.cnf" `
            -extensions v3_intermediate_ca -days 3650 -notext -md sha384 `
            -in $issCsr -out $issCert 2>$null

        # Chuoi CA Chain (Issuing + Root)
        (Get-Content $issCert -Raw) + (Get-Content $rootCert -Raw) | Set-Content $chainPem -NoNewline -Encoding ASCII
    } else {
        Write-Host "[2/5] Giu nguyen Online Intermediate Issuing CA hien co." -ForegroundColor Green
    }

    #  TANG 3: LEAF SERVER TLS CERT (trungtamdulieuso.tqs.com + IP SAN) 
    Write-Host "[3/5] Cap chung chi Leaf TLS cho $Hostname va IP $ServerIP..." -ForegroundColor Yellow
    $sanCfg   = Join-Path $leafDir "server-san.rendered.cnf"
    $leafKey  = Join-Path $leafDir "server.key.pem"
    $leafCsr  = Join-Path $leafDir "server.csr.pem"
    $leafCert = Join-Path $leafDir "server.cert.pem"

    $tpl = Get-Content "$TemplateDir\server-san.cnf" -Raw
    $tpl = $tpl.Replace("__SERVER_DOMAIN__", $Hostname).Replace("__SERVER_IP__", $ServerIP)
    Set-Content $sanCfg $tpl -Encoding ASCII

    & $openssl genrsa -out $leafKey 2048 2>$null
    & $openssl req -config $sanCfg -new -sha256 -key $leafKey -out $leafCsr
    & $openssl x509 -req -in $leafCsr `
        -CA $issCert -CAkey $issKey -CAcreateserial `
        -out $leafCert -days 397 -sha256 `
        -extfile $sanCfg -extensions req_ext 2>$null

    # Xuat Fullchain chuan cho Express Gateway / Nginx (Leaf + Issuing CA)
    $outCert = Join-Path $CertsDir "cert.pem"
    $outKey  = Join-Path $CertsDir "private-key.pem"
    $outRoot = Join-Path $CertsDir "rootCA.pem"

    (Get-Content $leafCert -Raw) + (Get-Content $issCert -Raw) | Set-Content $outCert -NoNewline -Encoding ASCII
    Copy-Item $leafKey $outKey -Force
    Copy-Item $rootCert $outRoot -Force
    if (Test-Path $FpDir) {
        Copy-Item $rootCert (Join-Path $FpDir "rootCA.pem") -Force
    }

    #  XUAT GOI PHAN PHOI CHO 1.000.000+ THIET BI (WINDOWS GPO + IPAD MDM) 
    Write-Host "[4/5] Xuat Apple Configuration Profile (.mobileconfig) cho iPad Air M4..." -ForegroundColor Yellow
    $rootDer = Join-Path $leafDir "rootCA.der"
    & $openssl x509 -in $rootCert -outform DER -out $rootDer
    $b64Der  = [Convert]::ToBase64String([IO.File]::ReadAllBytes($rootDer))
    $uuid1   = [guid]::NewGuid().ToString().ToUpper()
    $uuid2   = [guid]::NewGuid().ToString().ToUpper()
    $mobileConfigPath = Join-Path $CertsDir "QK7-Military-Root-CA.mobileconfig"

    $mobileConfigXml = @"
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>PayloadContent</key>
    <array>
        <dict>
            <key>PayloadCertificateFileName</key>
            <string>QK7-Military-Root-CA.cer</string>
            <key>PayloadContent</key>
            <data>
$b64Der
            </data>
            <key>PayloadDescription</key>
            <string>Chung chi Goc PKI Noi Bo - Trung Tam Du Lieu So QK7 ($Hostname)</string>
            <key>PayloadDisplayName</key>
            <string>QK7 Military Root CA</string>
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
    <string>Cai dat chung chi tin cay noi bo cho He thong Trung Tam Du Lieu So Quan Khu 7 (Khong can Internet)</string>
    <key>PayloadDisplayName</key>
    <string>QK7 DataHub  Chung Chi Bao Mat Quan Su</string>
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
    [System.IO.File]::WriteAllText($mobileConfigPath, $mobileConfigXml, $utf8NoBom)

    # Tao script cai Root CA 1 cham cho may con Windows / GPO Startup Script
    $clientInstallScript = Join-Path $CertsDir "install-root-ca-client.ps1"
    $clientInstallBody = @"
# Chay bang PowerShell (Administrator) hoac gan vao AD GPO Startup Script cho 1.000.000+ may Windows
`$caPath = Join-Path (Split-Path -Parent `$MyInvocation.MyCommand.Path) "rootCA.pem"
Import-Certificate -FilePath `$caPath -CertStoreLocation Cert:\LocalMachine\Root | Out-Null
Write-Host "[OK] Da nap QK7 Military Root CA vao Windows Trusted Root Store!" -ForegroundColor Green
"@
    [System.IO.File]::WriteAllText($clientInstallScript, $clientInstallBody, $utf8NoBom)

    # Nap Root CA vao may chu hien tai neu dang chay quyen Administrator
    Write-Host "[5/5] Kiem tra nap Root CA vao Windows LocalMachine Root Store..." -ForegroundColor Yellow
    $isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    if ($isAdmin) {
        Import-Certificate -FilePath $outRoot -CertStoreLocation Cert:\LocalMachine\Root | Out-Null
        Write-Host "       da nap QK7 Military Root CA vao Trusted Root Store cua may chu." -ForegroundColor Green
    } else {
        Write-Host "       Khong chay quyen Administrator  bo qua buoc tu nap vao LocalMachine\Root." -ForegroundColor Yellow
        Write-Host "         Chay lenh Admin sau de tin cay tren may nay:" -ForegroundColor Gray
        Write-Host "         Import-Certificate -FilePath `"$outRoot`" -CertStoreLocation Cert:\LocalMachine\Root" -ForegroundColor Cyan
    }

    Write-Host ""
    Write-Host " HOAN TAT 2-TIER MILITARY PKI!" -ForegroundColor Green
    Write-Host "   Fullchain Server Cert : $outCert" -ForegroundColor Cyan
    Write-Host "   Server Private Key    : $outKey" -ForegroundColor Cyan
    Write-Host "   Root CA (Win/Linux)   : $outRoot" -ForegroundColor Yellow
    Write-Host "   iPad Air M4 Profile   : $mobileConfigPath" -ForegroundColor Yellow
    Write-Host "   Windows GPO Script    : $clientInstallScript" -ForegroundColor Yellow
    Write-Host "   [BAO MAT] Cat giu tep $rootKey o kho ngoai tuyen (HSM/Ket sat) khi len Production!" -ForegroundColor Magenta
} finally {
    Pop-Location
}
