# ==============================================================================
# scripts/switch-ip.ps1  DOI DIA CHI IP MAY CHU QK7 DATAHUB BANG 1 DONG LENH
# ==============================================================================
# Tac dung: Khi chuyen may chu tu 192.168.1.229 sang BAT KY IP nao khac (vd 192.168.1.150),
# script tu dong dong bo 100% 7 tang cau hinh de truy cap thang:
#     https://trungtamdulieuso.tqsqk7.edu  (khong can :8000, khong can Internet)
#
# Cach dung:
#   1) Chi dinh IP bat ky:
#        powershell -ExecutionPolicy Bypass -File scripts\switch-ip.ps1 -NewIP 192.168.1.150
#   2) Tu dong do IP mang LAN cua may moi (khong can go IP):
#        powershell -ExecutionPolicy Bypass -File scripts\switch-ip.ps1
#   3) doi ca IP lan ten mien noi bo / chon che do PKI Quan Doi:
#        powershell -ExecutionPolicy Bypass -File scripts\switch-ip.ps1 -NewIP 10.20.30.40 -Hostname trungtamdulieuso.tqsqk7.edu -CertMode military-pki
#   4) Chay thu khong ghi file (kiem tra truoc):
#        powershell -ExecutionPolicy Bypass -File scripts\switch-ip.ps1 -NewIP 192.168.1.150 -DryRun
# ==============================================================================
param(
    [string]$NewIP = "",
    [string]$Hostname = "trungtamdulieuso.tqsqk7.edu",
    [ValidateSet("auto", "mkcert", "military-pki")]
    [string]$CertMode = "auto",
    [int]$HttpsPublicPort = 443,
    [int]$HttpRedirectPort = 80,
    [int]$BackendPort = 8000,
    [switch]$SkipCert,
    [switch]$SkipHosts,
    [switch]$SkipFirewall,
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir   = Split-Path -Parent $ScriptDir

#  Helper: Kiem tra quyen Administrator 
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

#  BUOC 1: Xac dinh & tham dinh dia chi IP moi 
if ([string]::IsNullOrWhiteSpace($NewIP)) {
    # Uu tien card mang co Default Gateway (card LAN thuc te)
    $gwIface = Get-NetRoute -DestinationPrefix "0.0.0.0/0" -ErrorAction SilentlyContinue |
        Sort-Object RouteMetric | Select-Object -First 1 -ExpandProperty ifIndex

    if ($gwIface) {
        $NewIP = Get-NetIPAddress -InterfaceIndex $gwIface -AddressFamily IPv4 -ErrorAction SilentlyContinue |
            Where-Object { $_.IPAddress -ne "127.0.0.1" -and $_.IPAddress -notlike "169.254.*" } |
            Select-Object -First 1 -ExpandProperty IPAddress
    }

    if ([string]::IsNullOrWhiteSpace($NewIP)) {
        $NewIP = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
            Where-Object {
                $_.IPAddress -ne "127.0.0.1" -and
                $_.IPAddress -notlike "169.254.*" -and
                $_.InterfaceAlias -notmatch "Loopback|Bluetooth|vEthernet|Docker|WSL|VPN|Virtual"
            } | Select-Object -First 1 -ExpandProperty IPAddress
    }

    if ([string]::IsNullOrWhiteSpace($NewIP)) {
        Write-Error "Khong the tu dong do dia chi IP LAN hop le. Hay truyen thu cong: -NewIP <dia_chi_IP>"
        exit 1
    }
    Write-Host "[AUTO-DETECT] Phat hien IP LAN cua may chu nay: $NewIP" -ForegroundColor Cyan
}

$parsedIp = $null
if (-not [System.Net.IPAddress]::TryParse($NewIP, [ref]$parsedIp) -or $parsedIp.AddressFamily -ne [System.Net.Sockets.AddressFamily]::InterNetwork) {
    Write-Error "dia chi IP '$NewIP' khong phai IPv4 hop le (vi du: 192.168.1.150 hoac 10.10.20.5)."
    exit 1
}

Write-Host ""
Write-Host "=========================================================================" -ForegroundColor Cyan
Write-Host "  QK7 DATAHUB - CHUYEN DOI IP & KICH HOAT TEN MIEN NOI BO 1 DONG LENH" -ForegroundColor Green
Write-Host "=========================================================================" -ForegroundColor Cyan
Write-Host "  IP May chu moi : $NewIP" -ForegroundColor Yellow
Write-Host "  Ten mien chuan : https://$Hostname" -ForegroundColor Yellow
Write-Host "  Cong phuc vu   : HTTPS :$HttpsPublicPort (chinh) | HTTP :$HttpRedirectPort (redirect) | API :$BackendPort" -ForegroundColor Gray
Write-Host "  Che do Cert    : $CertMode" -ForegroundColor Gray
Write-Host "  Quyen Admin    : $(if ($isAdmin) { 'CO (day du)' } else { 'KHONG (hosts/Firewall can Admin)' })" -ForegroundColor $(if ($isAdmin) { 'Green' } else { 'Yellow' })
if ($DryRun) { Write-Host "  CHE DO THU     : DRY-RUN (Khong ghi thay doi len o dia)" -ForegroundColor Magenta }
Write-Host "=========================================================================" -ForegroundColor Cyan
Write-Host ""

#  Helper: Cap nhat file .env chuan (khong lam trung key, giu nguyen secrets) 
function Update-EnvFile {
    param(
        [string]$FilePath,
        [hashtable]$Updates,
        [string]$AppendToAdminIp = ""
    )
    if (-not (Test-Path $FilePath)) {
        Write-Host "   [Bo qua] Khong ton tai: $FilePath" -ForegroundColor DarkGray
        return
    }

    $lines = Get-Content -Path $FilePath -Encoding UTF8
    $seenKeys = @{}
    $newLines = New-Object System.Collections.Generic.List[string]

    foreach ($line in $lines) {
        if ($line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$') {
            $key = $Matches[1]
            $val = $Matches[2]

            if ($key -eq "ADMIN_ALLOWED_IP" -and -not [string]::IsNullOrWhiteSpace($AppendToAdminIp)) {
                if ($seenKeys.ContainsKey($key)) { continue }
                $seenKeys[$key] = $true
                $existingIps = $val.Split(",") | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne "" }
                $merged = New-Object System.Collections.Generic.List[string]
                foreach ($e in $existingIps) { if (-not $merged.Contains($e)) { $merged.Add($e) } }
                foreach ($mustHave in @("127.0.0.1", "::1", "::ffff:127.0.0.1", $AppendToAdminIp)) {
                    if (-not $merged.Contains($mustHave)) { $merged.Add($mustHave) }
                }
                $newLines.Add("ADMIN_ALLOWED_IP=$($merged -join ',')")
                continue
            }

            if ($Updates.ContainsKey($key)) {
                if ($seenKeys.ContainsKey($key)) {
                    # Loai bo dong trung lap (vi du file .env cu co ca USE_HTTPS=false va USE_HTTPS=true)
                    continue
                }
                $seenKeys[$key] = $true
                $newLines.Add("$key=$($Updates[$key])")
                continue
            }
        }
        $newLines.Add($line)
    }

    # Bo sung cac key con thieu vao cuoi file
    foreach ($k in $Updates.Keys) {
        if (-not $seenKeys.ContainsKey($k)) {
            $newLines.Add("$k=$($Updates[$k])")
        }
    }

    if ($DryRun) {
        Write-Host "   [DRY-RUN] Se cap nhat $FilePath (SERVER_IP=$NewIP, SERVER_DOMAIN=$Hostname, ADMIN_ALLOWED_IP+=$AppendToAdminIp)" -ForegroundColor Magenta
    } else {
        $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
        [System.IO.File]::WriteAllLines($FilePath, $newLines, $utf8NoBom)
        Write-Host "   [OK] da dong bo: $FilePath" -ForegroundColor Green
    }
}

#  BUOC 2: dong bo .env goc va backend/.env 
Write-Host "[1/7] Dong bo bien moi truong (.env goc & backend\.env)..." -ForegroundColor White
$envUpdates = @{
    "SERVER_IP"          = $NewIP
    "SERVER_DOMAIN"      = $Hostname
    "USE_HTTPS"          = "true"
    "PUBLIC_HTTPS_PORT"  = "$HttpsPublicPort"
    "HTTP_REDIRECT_PORT" = "$HttpRedirectPort"
    "SSL_KEY_PATH"       = "./certs/private-key.pem"
    "SSL_CERT_PATH"      = "./certs/cert.pem"
}
Update-EnvFile -FilePath (Join-Path $RootDir ".env") -Updates $envUpdates
Update-EnvFile -FilePath (Join-Path $RootDir "backend\.env") -Updates $envUpdates -AppendToAdminIp $NewIP

#  BUOC 3: Cap lai chung chi SSL/TLS cho IP moi + Ten mien 
Write-Host "[2/7] Cap lai chung chi SSL/TLS (SAN: $Hostname + $NewIP)..." -ForegroundColor White
if ($SkipCert) {
    Write-Host "   [Bo qua] Theo co -SkipCert" -ForegroundColor DarkGray
} elseif ($DryRun) {
    Write-Host "   [DRY-RUN] Se chay scripts\gen_cert.ps1 -Domain $NewIP -Hostname $Hostname" -ForegroundColor Magenta
} else {
    $resolvedCertMode = $CertMode
    if ($resolvedCertMode -eq "auto") {
        $existingMilPki = Join-Path $RootDir "backend\certs\military-pki\root-ca\certs\root-ca.cert.pem"
        $bundledMkcert  = Join-Path $RootDir "deploy\https\may-chu\mkcert.exe"
        if (Test-Path $existingMilPki) {
            $resolvedCertMode = "military-pki"
        } elseif ((Get-Command mkcert -ErrorAction SilentlyContinue) -or (Test-Path $bundledMkcert)) {
            $resolvedCertMode = "mkcert"
        } else {
            $resolvedCertMode = "military-pki"
        }
    }
    & (Join-Path $ScriptDir "gen_cert.ps1") -Mode $resolvedCertMode -Domain $NewIP -Hostname $Hostname
}

#  BUOC 4: Cap nhat file hosts Windows & xoa cache DNS 
Write-Host "[3/7] Cap nhat file hosts cuc bo & lam moi bo dem DNS..." -ForegroundColor White
$hostsPath = "C:\Windows\System32\drivers\etc\hosts"
if ($SkipHosts) {
    Write-Host "   [Bo qua] Theo co -SkipHosts" -ForegroundColor DarkGray
} elseif ($DryRun) {
    Write-Host "   [DRY-RUN] Se cap nhat $hostsPath -> $NewIP  $Hostname" -ForegroundColor Magenta
} elseif (-not $isAdmin) {
    Write-Warning "   Can chay PowerShell voi quyen Administrator de sua $hostsPath. Hay chay lai bang scripts\doi-ip.bat (tu dong xin quyen Admin)."
} else {
    $hostLines = Get-Content -Path $hostsPath -ErrorAction Stop
    $escapedHost = [regex]::Escape($Hostname)
    $filtered = $hostLines | Where-Object {
        $_ -notmatch "\b$escapedHost\b" -and $_ -notmatch "\btrungtamdulieuso\.tqs\.com\b" -and $_ -notmatch "\btqsqk7\.cntt\b"
    }
    $updatedHosts = @($filtered) + @(
        "$NewIP`t$Hostname",
        "$NewIP`ttqsqk7.cntt"
    )
    Set-Content -Path $hostsPath -Value $updatedHosts -Encoding ASCII
    & ipconfig /flushdns | Out-Null
    Write-Host "   [OK] da cap nhat $hostsPath ($NewIP -> $Hostname) va flush DNS cache." -ForegroundColor Green
}

#  BUOC 5: dong bo cau hinh Tram Van Tay ZKTeco (config\client.info & fingerprint\.env) 
Write-Host "[4/7] Dong bo cau hinh Tram Quet Van Tay ZKTeco..." -ForegroundColor White
if ($DryRun) {
    Write-Host "   [DRY-RUN] Se cap nhat config\client.info & fingerprint\.env -> wss://$Hostname/ws/fingerprint" -ForegroundColor Magenta
} else {
    $oldNonInt = $env:QK7_NON_INTERACTIVE
    $env:QK7_NON_INTERACTIVE = "1"
    try {
        $genClientBat = Join-Path $ScriptDir "generate-client-config.bat"
        if (Test-Path $genClientBat) {
            cmd /c "`"$genClientBat`"" | Out-Null
            Write-Host "   [OK] da sinh lai config\client.info (wss://$Hostname/ws/fingerprint)" -ForegroundColor Green
        }
    } finally {
        $env:QK7_NON_INTERACTIVE = $oldNonInt
    }

    $fpEnv = Join-Path $RootDir "fingerprint\.env"
    if (Test-Path $fpEnv) {
        $wsTarget = if ($HttpsPublicPort -eq 443) { "wss://$Hostname/ws/fingerprint" } else { "wss://$Hostname`:$BackendPort/ws/fingerprint" }
        Update-EnvFile -FilePath $fpEnv -Updates @{ "BACKEND_WS_URL" = $wsTarget }
    }
}

#  BUOC 6: Cap nhat Ha tang Quan Doi Tu Chu (DNS Zone + HAProxy Backend) 
Write-Host "[5/7] Dong bo Ha tang Quan Doi Tu Chu (Air-Gapped DNS Zone & Proxy)..." -ForegroundColor White
if ($DryRun) {
    Write-Host "   [DRY-RUN] Se cap nhat config\military-infra\dns\tqsqk7.edu.zone & haproxy-ha.cfg -> $NewIP" -ForegroundColor Magenta
} else {
    $dnsScript = Join-Path $ScriptDir "setup-military-dns.ps1"
    if (Test-Path $dnsScript) {
        & $dnsScript -ServerIP $NewIP -Hostname $Hostname
    }
    $haproxyCfg = Join-Path $RootDir "config\military-infra\proxy\haproxy-ha.cfg"
    if (Test-Path $haproxyCfg) {
        $hp = Get-Content $haproxyCfg -Raw -Encoding UTF8
        $hp = $hp -replace '(?m)^(\s*server\s+gw1\s+)\d{1,3}(?:\.\d{1,3}){3}(:\d+)', "`${1}$NewIP`${2}"
        $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
        [System.IO.File]::WriteAllText($haproxyCfg, $hp, $utf8NoBom)
        Write-Host "   [OK] da cap nhat gw1 trong config\military-infra\proxy\haproxy-ha.cfg -> $NewIP" -ForegroundColor Green
    }
}

#  BUOC 7: Mo Firewall Windows dung cong duoc phep (443, 80, 8000  khoa chat 8001/8002/9001) 
Write-Host "[6/7] Cau hinh tuong lua Windows (Chi mo cong 443, 80, $BackendPort)..." -ForegroundColor White
if ($SkipFirewall) {
    Write-Host "   [Bo qua] Theo co -SkipFirewall" -ForegroundColor DarkGray
} elseif ($DryRun) {
    Write-Host "   [DRY-RUN] Se mo Inbound TCP ports 443, 80, $BackendPort (giu kin 8001, 8002, 9001)" -ForegroundColor Magenta
} elseif (-not $isAdmin) {
    Write-Warning "   Can quyen Administrator de tao rule Windows Firewall."
} else {
    $rules = @(
        @{ Name = "QK7 HTTPS 443";            Port = $HttpsPublicPort;  Proto = "TCP" },
        @{ Name = "QK7 HTTP Redirect 80";     Port = $HttpRedirectPort; Proto = "TCP" },
        @{ Name = "QK7 Backend $BackendPort"; Port = $BackendPort;      Proto = "TCP" },
        @{ Name = "QK7 Internal DNS 53 UDP";  Port = 53;                Proto = "UDP" },
        @{ Name = "QK7 Internal DNS 53 TCP";  Port = 53;                Proto = "TCP" }
    )
    foreach ($r in $rules) {
        if ($r.Port -le 0) { continue }
        $existing = Get-NetFirewallRule -DisplayName $r.Name -ErrorAction SilentlyContinue
        if (-not $existing) {
            New-NetFirewallRule -DisplayName $r.Name -Direction Inbound -LocalPort $r.Port -Protocol $r.Proto -Action Allow -Profile Any | Out-Null
            Write-Host "   [OK] da tao Firewall rule: $($r.Name) ($($r.Proto) $($r.Port))" -ForegroundColor Green
        } else {
            Write-Host "   [OK] Firewall rule da ton tai: $($r.Name) ($($r.Proto) $($r.Port))" -ForegroundColor DarkGreen
        }
    }
}

#  BUOC 8: Tom tat ket qua 
Write-Host "[7/7] Hoan tat kiem chuan cau hinh!" -ForegroundColor White
Write-Host ""
Write-Host "=========================================================================" -ForegroundColor Green
Write-Host "  [OK] CHUYEN DOI SANG IP $NewIP THANH CONG!" -ForegroundColor Green
Write-Host "=========================================================================" -ForegroundColor Green
Write-Host "  1. Khoi dong he thong:                scripts\s.bat" -ForegroundColor Cyan
Write-Host "  2. Bat DNS Noi bo (Phuong an 2):      scripts\start-dns.bat" -ForegroundColor Cyan
Write-Host "     (Dat Primary DNS tren Router Wi-Fi = $NewIP de PC & iPad tu nhan ten mien)" -ForegroundColor Gray
Write-Host "  3. Cong cai chung chi iPad & PC moi:  http://$Hostname/ca" -ForegroundColor Yellow
Write-Host "  4. Truy cap truc tiep (khong :8000):  https://$Hostname" -ForegroundColor Yellow
Write-Host "  5. Hoac truy cap qua IP du phong:     https://$NewIP" -ForegroundColor Gray
Write-Host "  6. Tren mang Quan Doi 1.000.000+ may (AD DNS), chay 1 dong lenh DNS:" -ForegroundColor White
Write-Host "     dnscmd /RecordDelete tqsqk7.edu trungtamdulieuso A /f && dnscmd /RecordAdd tqsqk7.edu trungtamdulieuso 30 A $NewIP" -ForegroundColor Yellow
Write-Host "=========================================================================" -ForegroundColor Green
