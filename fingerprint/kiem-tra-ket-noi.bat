@echo off
chcp 65001 >nul
title QK7 - Kiem tra ket noi May con -> May chu
powershell -NoProfile -ExecutionPolicy Bypass -Command "[Console]::OutputEncoding=[Text.Encoding]::UTF8; iex ((Get-Content -Raw -Encoding UTF8 '%~f0') -split ('#P'+'S#'))[1]"
echo.
pause
exit /b
#PS#
$ErrorActionPreference = 'Continue'
$serverDefault = '192.168.1.229'
$port = 8000
$installDir = Join-Path $env:LOCALAPPDATA 'QK7Agent'

# Doc dia chi may chu tu .env canh exe (neu co), neu khong thi hoi
$srv = $null
$envFile = Join-Path $installDir '.env'
if (Test-Path $envFile) {
    $m = Select-String -Path $envFile -Pattern '^\s*BACKEND_WS_URL\s*=\s*wss?://([^:/]+)(?::(\d+))?' | Select-Object -First 1
    if ($m) { $srv = $m.Matches[0].Groups[1].Value; if ($m.Matches[0].Groups[2].Value) { $port = [int]$m.Matches[0].Groups[2].Value } }
}
if (-not $srv) {
    $in = Read-Host "Nhap IP/ten mien May chu [Enter = $serverDefault]"
    $srv = if ($in) { $in.Trim() } else { $serverDefault }
}

$fail = New-Object System.Collections.ArrayList
function Ok($t)   { Write-Host "  [OK]   $t" -ForegroundColor Green }
function Warn($t) { Write-Host "  [CHU Y] $t" -ForegroundColor Yellow }
function Bad($t, $fix) { Write-Host "  [LOI]  $t" -ForegroundColor Red; if ($fix) { Write-Host "         -> $fix" -ForegroundColor Cyan }; [void]$fail.Add($t) }
function Step($t) { Write-Host ""; Write-Host "== $t" -ForegroundColor White }

Write-Host "KIEM TRA KET NOI QK7  |  May chu: $srv`:$port  |  May nay: $env:COMPUTERNAME" -ForegroundColor White

Step '1. Dia chi mang cua may nay'
$ips = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.IPAddress -ne '127.0.0.1' }
foreach ($i in $ips) { Write-Host "  $($i.IPAddress)/$($i.PrefixLength)  ($($i.InterfaceAlias))" }
$lan = $ips | Where-Object { $_.IPAddress -notlike '169.254.*' }
if (-not $lan) { Bad 'May khong co dia chi IP hop le (chi co 169.254.x.x)' 'Cam day mang / ket noi Wi-Fi / kiem tra DHCP cua router' }
else {
    $sameNet = $false
    $a = $srv.Split('.')
    foreach ($i in $lan) { $b = $i.IPAddress.Split('.'); if ($a.Count -eq 4 -and $b[0] -eq $a[0] -and $b[1] -eq $a[1] -and $b[2] -eq $a[2]) { $sameNet = $true } }
    if ($sameNet) { Ok 'Cung dai mang voi May chu' } else { Warn 'Khong cung dai mang /24 voi May chu (co the khac VLAN/Wi-Fi khach/VPN). Neu ping that bai o buoc 2, day la nguyen nhan.' }
}
$prof = Get-NetConnectionProfile -ErrorAction SilentlyContinue
foreach ($p in $prof) { if ($p.NetworkCategory -eq 'Public') { Warn "Mang '$($p.Name)' dang la PUBLIC - tuong lua co the chan hon. Doi sang Private neu day la mang noi bo." } }
if (Get-Process -Name 'openvpn','wireguard','vpnui','ZeroTier One' -ErrorAction SilentlyContinue) { Warn 'Phat hien phan mem VPN dang chay - co the lam lech duong di toi May chu.' }

Step '2. Ping May chu'
if (Test-Connection -ComputerName $srv -Count 2 -Quiet -ErrorAction SilentlyContinue) { Ok "Ping $srv thanh cong" }
else { Warn "Ping $srv khong tra loi (co the do tuong lua chan ICMP - xem buoc 3 de biet chac)" }

Step "3. Cong $port cua May chu"
$tcpOk = $false
try {
    $c = New-Object Net.Sockets.TcpClient
    $iar = $c.BeginConnect($srv, $port, $null, $null)
    if ($iar.AsyncWaitHandle.WaitOne(5000)) { $c.EndConnect($iar); $tcpOk = $true; Ok "Mo duoc ket noi TCP toi $srv`:$port" }
    else { Bad "Het thoi gian cho (timeout) khi noi $srv`:$port" "Tuong lua cua MAY CHU dang chan cong $port, hoac khac mang. Tren May chu chay (PowerShell quan tri): New-NetFirewallRule -DisplayName 'QK7 Backend 8000' -Direction Inbound -Protocol TCP -LocalPort $port -Action Allow -Profile Any" }
    $c.Close()
} catch {
    Bad "Bi tu choi ket noi toi $srv`:$port ($($_.Exception.InnerException.Message))" "Backend tren May chu CHUA CHAY (hoac dang nghe cong khac). Tren May chu: netstat -ano | findstr :$port"
}

if ($tcpOk) {
    Step '4. HTTPS / chung chi / dong ho'
    $global:qk7SslErr = $null
    try {
        $tcp = New-Object Net.Sockets.TcpClient($srv, $port)
        $ssl = New-Object Net.Security.SslStream($tcp.GetStream(), $false, { param($s, $c, $ch, $e) $global:qk7SslErr = $e; return $true })
        $ssl.AuthenticateAsClient($srv)
        Ok "Bat tay TLS thanh cong ($($ssl.SslProtocol))"
        $x = New-Object Security.Cryptography.X509Certificates.X509Certificate2($ssl.RemoteCertificate)
        Write-Host "  Chung chi cap boi: $($x.Issuer)"
        Write-Host "  Han dung: $($x.NotBefore.ToString('yyyy-MM-dd')) -> $($x.NotAfter.ToString('yyyy-MM-dd'))"
        if ($x.Issuer -notmatch 'mkcert') {
            Bad "Chung chi nhan duoc KHONG phai cua May chu (cap boi: $($x.Issuer)) - co phan mem/thiet bi dang chen giua va ky lai HTTPS (diet virus quet HTTPS, proxy, tuong lua cong ty...)" "Trong phan mem diet virus (Kaspersky/ESET/Avast/Bitdefender...) TAT quet HTTPS hoac them $srv vao danh sach ngoai le/khong quet. Day la nguyen nhan hay gap khien agent/web loi chung chi tren MOT SO may."
        }
        $san = ($x.Extensions | Where-Object { $_.Oid.Value -eq '2.5.29.17' } | ForEach-Object { $_.Format($false) }) -join ' '
        Write-Host "  Ten trong chung chi: $san"
        if ($san -match [regex]::Escape($srv)) { Ok "Chung chi co ghi '$srv'" } else { Bad "Chung chi KHONG co '$srv'" "Tren May chu cap lai: mkcert.exe -cert-file certs\cert.pem -key-file certs\private-key.pem localhost 127.0.0.1 ::1 $srv ; roi khoi dong lai backend" }
        if ((Get-Date) -gt $x.NotAfter -or (Get-Date) -lt $x.NotBefore) { Bad 'Chung chi het han hoac chua den han theo dong ho may nay' 'Chinh ngay gio may nay cho dung (hoac cap lai chung chi)' }
        if ($global:qk7SslErr -eq 'None') { Ok 'Windows TIN chung chi cua May chu' }
        else {
            Bad "Windows KHONG tin chung chi May chu ($($global:qk7SslErr))" "Chay lai QK7AgentSetup.exe va bam YES o hop thoai cai chung chi; hoac xoa file $installDir\.ca_installed roi mo lai agent. (Agent van co the chay vi no tu nap rootCA, nhung TRINH DUYET thi can tin)"
        }

        $w = New-Object IO.StreamWriter($ssl); $w.NewLine = "`r`n"
        $w.Write("GET /api/fingerprint/agents-online HTTP/1.1`r`nHost: $srv`r`nConnection: close`r`n`r`n"); $w.Flush()
        $r = New-Object IO.StreamReader($ssl); $resp = $r.ReadToEnd()
        if ($resp -match 'HTTP/1.1 200') { Ok 'Backend tra loi API binh thuong' } else { Bad 'Backend tra loi bat thuong' ($resp -split "`r`n")[0] }
        if ($resp -match 'Date:\s*(.+)') {
            $srvTime = [DateTime]::Parse($Matches[1].Trim()).ToUniversalTime()
            $diff = [math]::Abs(($srvTime - (Get-Date).ToUniversalTime()).TotalMinutes)
            if ($diff -gt 5) { Bad ("Dong ho may nay lech May chu khoang {0:N0} phut" -f $diff) 'Dong bo gio: Settings > Time & language > Sync now' } else { Ok 'Dong ho khop voi May chu' }
        }
        $ids = [regex]::Matches($resp, 'DEV-[0-9a-f-]{36}') | ForEach-Object { $_.Value } | Select-Object -Unique
        Write-Host "  Agent dang online tren May chu: $(if ($ids) { $ids -join ', ' } else { '(chua co)' })"
        $tcp.Close()
    } catch {
        $msg = $_.Exception.Message; if ($_.Exception.InnerException) { $msg = $_.Exception.InnerException.Message }
        if ($msg -match 'WRONG_VERSION|unexpected|record|The handshake') { Bad "May chu tra loi KHONG phai TLS ($msg)" "Backend dang chay HTTP: dat USE_HTTPS=true trong backend\.env roi khoi dong lai" }
        else { Bad "Loi TLS: $msg" $null }
    }
}

Step '5. Agent tren may nay'
$exe = Join-Path $installDir 'QK7FingerprintAgent.exe'
if (Test-Path $exe) { Ok "Da cai agent: $exe" } else { Warn "Chua thay agent tai $installDir (chua cai bo cai, hoac dang chay ban khac)" }
$proc = Get-Process QK7FingerprintAgent -ErrorAction SilentlyContinue
if ($proc) { Ok 'Agent dang chay' } else { Warn 'Agent KHONG chay - mo shortcut "QK7 Fingerprint Agent" tren Desktop' }
if (Test-Path $envFile) {
    $u = (Select-String -Path $envFile -Pattern '^\s*BACKEND_WS_URL' | Select-Object -First 1).Line
    Warn "Co file .env ghi de cau hinh: $u  (xoa file nay neu dia chi sai)"
}
$dev = Join-Path $installDir 'device_id.txt'
if (Test-Path $dev) { Write-Host "  device_id: $((Get-Content $dev -Raw).Trim())" }
try {
    $tcp2 = New-Object Net.Sockets.TcpClient; $iar = $tcp2.BeginConnect('127.0.0.1', 9001, $null, $null)
    if ($iar.AsyncWaitHandle.WaitOne(2000)) { $tcp2.EndConnect($iar); Ok 'Cong 9001 (agent noi bo) dang mo' } else { Warn 'Cong 9001 khong mo - agent chua khoi dong xong hoac chua cam dau doc' }
    $tcp2.Close()
} catch { Warn 'Cong 9001 khong mo - agent chua chay hoac loi SDK (kiem tra driver ZKTeco va cap USB)' }
$zk = Get-PnpDevice -ErrorAction SilentlyContinue | Where-Object { $_.FriendlyName -match 'ZK9500|ZKTeco|Live ?20|Biometric' } | Select-Object -First 1
if ($zk) { if ($zk.Status -eq 'OK') { Ok "Dau doc: $($zk.FriendlyName) (OK)" } else { Bad "Dau doc '$($zk.FriendlyName)' trang thai: $($zk.Status)" 'Cam lai USB / cai driver ZKTeco' } }
else { Warn 'Khong thay thiet bi ZK9500 - chua cam USB hoac chua cai driver ZKTeco' }

Write-Host ""
Write-Host "================ KET LUAN ================" -ForegroundColor White
if ($fail.Count -eq 0) { Write-Host 'Khong phat hien loi chan ket noi. Neu agent van loi, chup man hinh cua so agent gui ky thuat.' -ForegroundColor Green }
else { Write-Host "Phat hien $($fail.Count) van de (dong [LOI] o tren, kem huong xu ly mau xanh):" -ForegroundColor Red; $fail | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red } }
