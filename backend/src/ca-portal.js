// ==============================================================================
// backend/src/ca-portal.js — Cổng Tự Phục Vụ Cài Đặt Chứng Chỉ Gốc Nội Bộ (/ca)
// ==============================================================================
// Mục đích (Phương Án 2 — Cấp Đơn Vị / Trường Quân Sự & iPad Air M4):
//   - Cho phép mọi máy tính Windows & iPad Air M4 mới kết nối mạng LAN/Wi-Fi truy cập
//     http://trungtamdulieuso.tqs.com/ca (hoặc http://<SERVER_IP>/ca) TRƯỚC KHI tin cậy
//     HTTPS để tải về chứng chỉ gốc CÔNG KHAI (Root CA) và hồ sơ .mobileconfig.
//   - TUYỆT ĐỐI CHỈ phục vụ chứng chỉ gốc công khai (rootCA.pem), xác minh không bao giờ
//     chứa Private Key trước khi gửi ra mạng.
//   - Không sử dụng bất kỳ tài nguyên Internet ngoài nào (100% Air-Gapped).
// ==============================================================================
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const CERTS_DIR = path.resolve(__dirname, '..', 'certs');
const ROOT_CA_PEM_PATH = path.join(CERTS_DIR, 'rootCA.pem');

/**
 * Đọc và kiểm định nghiêm ngặt tệp chứng chỉ gốc CÔNG KHAI (rootCA.pem).
 * Tuyệt đối chặn nếu tệp chứa bất kỳ chuỗi PRIVATE KEY nào.
 */
function readPublicRootCaPem() {
  if (!fs.existsSync(ROOT_CA_PEM_PATH)) return null;
  const content = fs.readFileSync(ROOT_CA_PEM_PATH, 'utf8');
  if (/PRIVATE\s+KEY/i.test(content)) {
    throw new Error('SECURITY_BLOCK: Phát hiện khóa bí mật trong đường dẫn Root CA công khai');
  }
  const match = content.match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/);
  if (!match) return null;
  return match[0].trim() + '\n';
}

function extractDerBase64FromPem(pem) {
  return pem
    .replace(/-----BEGIN CERTIFICATE-----/g, '')
    .replace(/-----END CERTIFICATE-----/g, '')
    .replace(/\s+/g, '');
}

function getCertSha256Fingerprint(pem) {
  const der = Buffer.from(extractDerBase64FromPem(pem), 'base64');
  const hex = crypto.createHash('sha256').update(der).digest('hex').toUpperCase();
  return hex.match(/.{1,2}/g).join(':');
}

function deterministicUuid(seed) {
  const h = crypto.createHash('sha256').update(seed).digest('hex').toUpperCase();
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

function buildIpadMobileConfig(pem, hostname, serverIp) {
  const b64 = extractDerBase64FromPem(pem);
  const wrappedB64 = b64.match(/.{1,64}/g).join('\n');
  const fp = getCertSha256Fingerprint(pem);
  const certUuid = deterministicUuid('qk7-cert-' + fp);
  const dnsUuid  = deterministicUuid('qk7-dns-' + fp + '-' + (serverIp || ''));
  const profUuid = deterministicUuid('qk7-prof-' + fp + '-' + (serverIp || ''));
  const cleanIp  = (serverIp && serverIp !== '127.0.0.1' && serverIp !== 'localhost') ? serverIp : '192.168.1.229';
  const parts    = hostname.split('.');
  const baseZone = parts.length >= 2 ? parts.slice(-2).join('.') : hostname;

  return `<?xml version="1.0" encoding="UTF-8"?>
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
${wrappedB64}
            </data>
            <key>PayloadDescription</key>
            <string>Chung chi Goc Bao Mat Noi Bo - Trung Tam Du Lieu So QK7 (${hostname})</string>
            <key>PayloadDisplayName</key>
            <string>QK7 DataHub Root CA</string>
            <key>PayloadIdentifier</key>
            <string>vn.qk7.datahub.rootca.${certUuid}</string>
            <key>PayloadType</key>
            <string>com.apple.security.root</string>
            <key>PayloadUUID</key>
            <string>${certUuid}</string>
            <key>PayloadVersion</key>
            <integer>1</integer>
        </dict>
        <dict>
            <key>DNSSettings</key>
            <dict>
                <key>DNSProtocol</key>
                <string>HTTPS</string>
                <key>ServerAddresses</key>
                <array>
                    <string>${cleanIp}</string>
                </array>
                <key>ServerURL</key>
                <string>https://${cleanIp}/dns-query</string>
            </dict>
            <key>OnDemandRules</key>
            <array>
                <dict>
                    <key>Action</key>
                    <string>EvaluateConnection</string>
                    <key>ActionParameters</key>
                    <array>
                        <dict>
                            <key>DomainAction</key>
                            <string>ConnectIfNeeded</string>
                            <key>Domains</key>
                            <array>
                                <string>${hostname}</string>
                                <string>${baseZone}</string>
                                <string>tqsqk7.cntt</string>
                            </array>
                        </dict>
                    </array>
                </dict>
            </array>
            <key>PayloadDescription</key>
            <string>Tu dong phan giai ten mien noi bo ${hostname} (${cleanIp})</string>
            <key>PayloadDisplayName</key>
            <string>QK7 DataHub Split-DNS (${hostname})</string>
            <key>PayloadIdentifier</key>
            <string>vn.qk7.datahub.dns.${dnsUuid}</string>
            <key>PayloadType</key>
            <string>com.apple.dnsSettings.managed</string>
            <key>PayloadUUID</key>
            <string>${dnsUuid}</string>
            <key>PayloadVersion</key>
            <integer>1</integer>
        </dict>
    </array>
    <key>PayloadDescription</key>
    <string>Ho so tin cay HTTPS + Tu dong nhan ten mien noi bo ${hostname} (${cleanIp}).</string>
    <key>PayloadDisplayName</key>
    <string>QK7 DataHub — Chung Chi &amp; Ten Mien Noi Bo (${hostname})</string>
    <key>PayloadIdentifier</key>
    <string>vn.qk7.datahub.profile.${profUuid}</string>
    <key>PayloadOrganization</key>
    <string>Truong Quan Su Quan Khu 7</string>
    <key>PayloadType</key>
    <string>Configuration</string>
    <key>PayloadUUID</key>
    <string>${profUuid}</string>
    <key>PayloadVersion</key>
    <integer>1</integer>
</dict>
</plist>
`;
}

/**
 * Cơ chế chốt chặn tuyệt đối chống sinh tệp rác 0 byte (vd: "192.168.1.229)") trong file .bat:
 * Loại bỏ mọi ký tự chuyển hướng (> hoặc <) trên các dòng title/echo trước khi xuất cho máy con.
 */
function sanitizeBatLines(lines) {
  return lines.map((line) => {
    if (/^\s*(title|echo)\b/i.test(line)) {
      return line.replace(/[<>]/g, '');
    }
    return line;
  });
}

const PS_MARKER = '#QK7PS#';

function buildWindowsInstallerBat(hostname, serverIp, requestHost, pem) {
  const cleanIp = (serverIp && serverIp !== '127.0.0.1' && serverIp !== 'localhost')
    ? serverIp
    : (requestHost && /^\d+\.\d+\.\d+\.\d+$/.test(requestHost) ? requestHost : '192.168.1.229');
  // Chỉ nhận tên miền hợp lệ để không thể chèn ký tự phá chuỗi PowerShell/cmd
  const safeDomain = /^[a-zA-Z0-9.-]+$/.test(hostname) ? hostname : 'trungtamdulieuso.tqsqk7.edu';
  hostname = safeDomain;

  // Chứng chỉ gốc được NHÚNG THẲNG vào file (không tải lại qua HTTP thường → không bị tráo giữa đường),
  // kèm mã SHA-256 để script tự kiểm tra trước khi nạp vào kho tin cậy của máy.
  const certB64 = extractDerBase64FromPem(pem);
  const fpHex = getCertSha256Fingerprint(pem).replace(/:/g, '');
  const fpPretty = getCertSha256Fingerprint(pem);

  // Kịch bản PowerShell đặt ở CUỐI file .bat (sau dấu PS_MARKER), được chính file đọc lại và chạy.
  // Không dùng -EncodedCommand vì dòng lệnh dài quá giới hạn 8191 ký tự của cmd.exe.
  const psScript = [
    "$ErrorActionPreference = 'Stop'",
    `$srvIp = '${cleanIp}'`,
    `$dom = '${hostname}'`,
    `$certB64 = '${certB64}'`,
    `$expectedFp = '${fpHex}'`,
    // Tự động dọn sạch tệp rác 0 byte dạng "192.168.1.229)" nếu máy con từng chạy bản cũ
    "$scanDirs = @((Get-Location).Path, $env:QK7_BAT_DIR) | Where-Object { $_ -and (Test-Path $_) } | Select-Object -Unique",
    "foreach ($d in $scanDirs) {",
    "  Get-ChildItem -Path $d -File -ErrorAction SilentlyContinue | Where-Object { $_.Length -eq 0 -and $_.Name -match '^\\d{1,3}(\\.\\d{1,3}){3}\\)$' } | Remove-Item -Force -ErrorAction SilentlyContinue",
    "}",
    "$tmpCa = Join-Path $env:TEMP 'QK7-DataHub-RootCA.crt'",
    "Write-Host '[1/3] Dang kiem tra va nap chung chi goc Root CA (nhung san trong file)...' -ForegroundColor Cyan",
    "$caBytes = [Convert]::FromBase64String($certB64)",
    "$sha = [System.Security.Cryptography.SHA256]::Create()",
    "$actualFp = ($sha.ComputeHash($caBytes) | ForEach-Object { $_.ToString('X2') }) -join ''",
    "if ($actualFp -ne $expectedFp) { Write-Host '      [LOI] Chung chi trong file bi sai lech ma SHA-256 - KHONG cai. Hay tai lai file tu Quan tri vien.' -ForegroundColor Red; exit 3 }",
    "$caObj = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2(,$caBytes)",
    "$bc = $caObj.Extensions | Where-Object { $_.Oid.Value -eq '2.5.29.19' } | Select-Object -First 1",
    "if (-not $bc -or -not $bc.CertificateAuthority) { Write-Host '      [LOI] Tep khong phai chung chi goc (CA) - KHONG cai.' -ForegroundColor Red; exit 3 }",
    "Write-Host \"      Chu the  : $($caObj.Subject)\"",
    `Write-Host '      SHA-256 : ${fpPretty}' -ForegroundColor Yellow`,
    "Write-Host '      -> Doi chieu ma SHA-256 nay voi ma Quan tri vien cong bo (trang /ca) truoc khi tin cay.' -ForegroundColor Yellow",
    "[System.IO.File]::WriteAllBytes($tmpCa, $caBytes)",
    "Import-Certificate -FilePath $tmpCa -CertStoreLocation Cert:\\LocalMachine\\Root | Out-Null",
    "Remove-Item $tmpCa -Force -ErrorAction SilentlyContinue",
    "Write-Host '      [OK] Da nap chung chi QK7 DataHub Root CA vao Windows!' -ForegroundColor Green",
    "Write-Host \"[2/3] Dang cap nhat ten mien ($dom = $srvIp)...\" -ForegroundColor Cyan",
    "$hostsPath = Join-Path $env:SystemRoot 'System32\\drivers\\etc\\hosts'",
    "$rawLines = @(Get-Content -Path $hostsPath -ErrorAction SilentlyContinue)",
    "$cleanLines = New-Object System.Collections.Generic.List[string]",
    "foreach ($ln in $rawLines) {",
    "  if ($ln -match 'trungtamdulieuso\\.tqs\\.com|trungtamdulieuso\\.tqsqk7\\.edu|tqsqk7\\.cntt') { continue }",
    "  $cleanLines.Add($ln)",
    "}",
    "$cleanLines.Add(\"$srvIp  $dom\")",
    "$cleanLines.Add(\"$srvIp  tqsqk7.cntt\")",
    "$hostsWritten = $false",
    "try {",
    "  & attrib -r -h -s $hostsPath 2>$null | Out-Null",
    "  [System.IO.File]::WriteAllLines($hostsPath, $cleanLines, (New-Object System.Text.ASCIIEncoding))",
    "  $hostsWritten = $true",
    "} catch {",
    "  try {",
    "    & icacls $hostsPath /grant '*S-1-5-32-544:(M)' 2>$null | Out-Null",
    "    & attrib -r -h -s $hostsPath 2>$null | Out-Null",
    "    Set-Content -Path $hostsPath -Value $cleanLines -Encoding ASCII -Force",
    "    $hostsWritten = $true",
    "  } catch {",
    "    Write-Host '      [CANH BAO] File hosts dang bi khoa (thuong do phan mem diet virus/bao ve hosts).' -ForegroundColor Yellow",
    "  }",
    "}",
    "if ($hostsWritten) {",
    "  Write-Host \"      [OK] Da ghi $dom = $srvIp vao file hosts!\" -ForegroundColor Green",
    "} else {",
    "  Write-Host \"      [DU PHONG] Dang kiem tra May chu DNS noi bo tai ${srvIp}:53 ...\" -ForegroundColor Cyan",
    "  $dnsReady = $false",
    "  try {",
    "    $tcp = New-Object System.Net.Sockets.TcpClient",
    "    $iar = $tcp.BeginConnect($srvIp, 53, $null, $null)",
    "    if ($iar.AsyncWaitHandle.WaitOne(1500)) { $tcp.EndConnect($iar); $dnsReady = $true }",
    "    $tcp.Close()",
    "  } catch {}",
    "  if ($dnsReady) {",
    "    $route = Get-NetRoute -DestinationPrefix '0.0.0.0/0' -ErrorAction SilentlyContinue | Sort-Object RouteMetric | Select-Object -First 1",
    "    if ($route) {",
    "      $gw = $route.NextHop",
    "      $dnsList = if ($gw -and $gw -ne $srvIp -and $gw -ne '0.0.0.0') { @($srvIp, $gw) } else { @($srvIp) }",
    "      Set-DnsClientServerAddress -InterfaceIndex $route.ifIndex -ServerAddresses $dnsList",
    "      Write-Host \"      [OK] Da chuyen sang DNS Noi Bo ($($dnsList -join ', ')) - khong can sua file hosts!\" -ForegroundColor Green",
    "    }",
    "  } else {",
    "    Write-Host ''",
    "    Write-Host '      [KHAC PHUC] File hosts bi phan mem diet virus (BKAV/Kaspersky/Defender/MiAV) khoa:' -ForegroundColor Red",
    "    Write-Host \"        - Cach 1 (Khuyen dung): Tren may chu $srvIp chay scripts\\start-dns.bat roi chay lai file nay.\" -ForegroundColor Yellow",
    "    Write-Host '        - Cach 2: Tam tat tinh nang Bao ve file hosts trong phan mem diet virus roi chay lai.' -ForegroundColor Yellow",
    "    exit 2",
    "  }",
    "}",
    "& ipconfig /flushdns | Out-Null",
    "Write-Host \"[3/3] Dang xac minh phan giai ten mien $dom...\" -ForegroundColor Cyan",
    "$resolved = @()",
    "try { $resolved = @([System.Net.Dns]::GetHostAddresses($dom) | ForEach-Object { $_.IPAddressToString }) } catch {}",
    "if ($resolved -contains $srvIp) {",
    "  Write-Host \"      [OK] Xac minh thanh cong: $dom = $srvIp\" -ForegroundColor Green",
    "} else {",
    "  Write-Warning \"      [CANH BAO] Chua phan giai duoc $dom = $srvIp (hien tai: $($resolved -join ', ')).\"",
    "}",
  ].join('\r\n');

  // Lệnh ngắn: đọc chính file .bat, lấy phần sau dấu PS_MARKER rồi chạy. Chuỗi marker trong lệnh
  // được tách đôi ('#QK7'+'PS#') để IndexOf không khớp nhầm vào chính dòng lệnh này.
  const half = Math.floor(PS_MARKER.length / 2);
  const runPs = 'powershell -NoProfile -ExecutionPolicy Bypass -Command "$s=[IO.File]::ReadAllText($env:QK7_BAT_FILE);'
    + ` $m='${PS_MARKER.slice(0, half)}'+'${PS_MARKER.slice(half)}'; $i=$s.IndexOf($m);`
    + ' if ($i -lt 0) { exit 9 }; iex $s.Substring($i + $m.Length)"';

  const lines = sanitizeBatLines([
    '@echo off',
    `title QK7 DataHub - Cai Dat 1-Click May Con (${hostname} - ${cleanIp})`,
    'set "QK7_BAT_DIR=%~dp0"',
    'set "QK7_BAT_FILE=%~f0"',
    'net session >nul 2>&1',
    'if %errorlevel% neq 0 (',
    '    echo [ADMIN] Dang xin quyen Administrator de nap chung chi bao mat va ten mien noi bo...',
    '    powershell -NoProfile -Command "Start-Process -FilePath \'%~f0\' -Verb RunAs"',
    '    exit /b',
    ')',
    'echo ====================================================================',
    'echo   QK7 DATAHUB - CAI DAT TU DONG MAY CON',
    `echo   Ten mien : https://${hostname}`,
    `echo   May chu  : ${cleanIp}`,
    'echo ====================================================================',
    'echo.',
    runPs,
    'if %errorlevel% neq 0 (',
    '    echo.',
    '    echo [LOI] Qua trinh cai dat chua hoan tat. Xem dong huong dan mau vang/do o tren.',
    '    pause',
    '    exit /b 1',
    ')',
    'echo.',
    `echo [HOAN TAT] Dang mo trinh duyet truy cap https://${hostname} ...`,
    'echo (Luu y: Neu trinh duyet dang mo san, hay dong het tab cu roi mo lai!)',
    `start "" "https://${hostname}"`,
    'pause',
    'exit /b 0',
  ]);
  // cmd.exe dừng ở "exit /b 0" nên không bao giờ đọc tới phần PowerShell bên dưới
  return lines.join('\r\n') + '\r\n' + PS_MARKER + '\r\n' + psScript + '\r\n';
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildPortalHtml({ hostname, serverIp, fingerprint, hasCert, cspNonce }) {
  const safeHost = escapeHtml(hostname);
  const safeIp = escapeHtml(serverIp);
  const safeFp = escapeHtml(fingerprint || 'Chưa khởi tạo chứng chỉ rootCA.pem trên máy chủ');
  const httpsUrl = `https://${safeHost}`;
  const styleAttr = cspNonce ? ` nonce="${escapeHtml(cspNonce)}"` : '';

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Cổng Chứng Chỉ Bảo Mật Nội Bộ — ${safeHost}</title>
  <style${styleAttr}>
    :root {
      --army-green: #166534;
      --army-green-dark: #14532d;
      --gold: #fbbf24;
      --crimson: #b91c1c;
      --bg: #0f172a;
      --surface: #1e293b;
      --border: #334155;
      --text: #f8fafc;
      --muted: #94a3b8;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      background: radial-gradient(circle at top, #14532d 0%, var(--bg) 55%);
      color: var(--text);
      min-height: 100vh;
      padding: 24px 16px 48px;
      line-height: 1.55;
    }
    .wrap { max-width: 820px; margin: 0 auto; }
    .hero {
      background: linear-gradient(135deg, rgba(22,101,52,0.92), rgba(15,23,42,0.95));
      border: 1px solid rgba(251,191,36,0.35);
      border-radius: 18px;
      padding: 24px;
      margin-bottom: 20px;
      box-shadow: 0 20px 45px rgba(0,0,0,0.35);
    }
    .badge {
      display: inline-block;
      background: rgba(251,191,36,0.16);
      color: var(--gold);
      border: 1px solid rgba(251,191,36,0.45);
      border-radius: 999px;
      padding: 4px 12px;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      margin-bottom: 12px;
    }
    h1 { font-size: 24px; font-weight: 800; margin-bottom: 8px; }
    .sub { color: #cbd5e1; font-size: 15px; }
    .meta {
      margin-top: 14px;
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      font-size: 13px;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-variant-numeric: tabular-nums;
    }
    .pill {
      background: rgba(15,23,42,0.7);
      border: 1px solid var(--border);
      padding: 6px 10px;
      border-radius: 8px;
      color: #e2e8f0;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 16px;
      margin-bottom: 20px;
    }
    .card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 20px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .card h2 { font-size: 18px; margin-bottom: 8px; color: var(--gold); }
    .card p { font-size: 14px; color: #cbd5e1; margin-bottom: 14px; }
    .steps {
      list-style: none;
      margin: 0 0 18px 0;
      font-size: 13.5px;
      color: #e2e8f0;
    }
    .steps li {
      padding: 6px 0 6px 26px;
      position: relative;
      border-bottom: 1px dashed rgba(148,163,184,0.18);
    }
    .steps li:last-child { border-bottom: none; }
    .steps li::before {
      content: attr(data-n);
      position: absolute;
      left: 0;
      top: 7px;
      width: 19px;
      height: 19px;
      border-radius: 50%;
      background: var(--army-green);
      color: var(--gold);
      font-size: 11px;
      font-weight: 800;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .btn {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 48px;
      padding: 12px 16px;
      border-radius: 12px;
      font-weight: 700;
      font-size: 15px;
      text-decoration: none;
      text-align: center;
      transition: transform 0.15s ease, opacity 0.15s ease;
    }
    .btn:active { transform: scale(0.98); }
    .btn-primary { background: linear-gradient(135deg, #16a34a, #166534); color: #fff; border: 1px solid #22c55e; }
    .btn-gold { background: linear-gradient(135deg, #f59e0b, #d97706); color: #0f172a; }
    .btn-outline {
      margin-top: 8px;
      background: transparent;
      color: #cbd5e1;
      border: 1px solid var(--border);
      min-height: 44px;
      font-size: 13.5px;
    }
    .cta-box {
      background: rgba(22,101,52,0.28);
      border: 1px solid rgba(34,197,94,0.45);
      border-radius: 16px;
      padding: 20px;
      text-align: center;
    }
    .cta-box p { font-size: 14px; color: #cbd5e1; margin-bottom: 12px; }
    .fp {
      margin-top: 16px;
      padding: 12px;
      background: rgba(15,23,42,0.75);
      border: 1px solid var(--border);
      border-radius: 10px;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-variant-numeric: tabular-nums;
      font-size: 11.5px;
      color: var(--muted);
      word-break: break-all;
    }
    .warn {
      background: rgba(185,28,28,0.25);
      border: 1px solid rgba(239,68,68,0.5);
      color: #fecaca;
      padding: 14px;
      border-radius: 12px;
      margin-bottom: 16px;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="hero">
      <div class="badge">Mạng Nội Bộ Quân Khu 7 • 100% Air-Gapped</div>
      <h1>Cổng Cài Đặt Chứng Chỉ Bảo Mật HTTPS</h1>
      <p class="sub">
        Cài đặt 1 lần duy nhất Chứng chỉ Gốc (Root CA) công khai trên <strong>iPad Air M4</strong> hoặc <strong>Máy tính Windows</strong> để truy cập an toàn vào Trung Tâm Dữ Liệu Số với ổ khóa xanh HTTPS mà không cần Internet.
      </p>
      <div class="meta">
        <div class="pill">Tên miền: ${safeHost}</div>
        <div class="pill">Máy chủ: ${safeIp}</div>
        <div class="pill">Chuẩn mã hóa: TLS 1.2 / 1.3</div>
      </div>
    </div>

    ${hasCert ? '' : '<div class="warn"><strong>Chưa tìm thấy tệp chứng chỉ gốc (backend/certs/rootCA.pem) trên máy chủ.</strong> Quản trị viên cần chạy lệnh <code>scripts\\doi-ip.bat</code> trên máy chủ để khởi tạo chứng chỉ.</div>'}

    <div class="grid">
      <div class="card">
        <div>
          <h2>📱 Dành cho iPad Air M4 (iPadOS)</h2>
          <p>Dùng trình duyệt <strong>Safari</strong> trên iPad, chạm nút bên dưới để nạp hồ sơ chứng chỉ:</p>
          <ul class="steps">
            <li data-n="1">Chạm nút <strong>Tải Hồ Sơ iPad</strong> bên dưới &rarr; chọn <strong>Cho phép (Allow)</strong>.</li>
            <li data-n="2">Mở <strong>Cài đặt (Settings)</strong> &rarr; <strong>Đã tải về hồ sơ</strong> &rarr; bấm <strong>Cài đặt</strong>.</li>
            <li data-n="3">Vào <strong>Cài đặt chung</strong> &rarr; <strong>Giới thiệu</strong> &rarr; <strong>Cài đặt tin cậy chứng chỉ</strong> &rarr; <strong>Bật xanh</strong> chứng chỉ QK7 DataHub.</li>
          </ul>
        </div>
        <div>
          <a class="btn btn-primary" href="/ca/ipad.mobileconfig">Tải Hồ Sơ Chứng Chỉ iPad (.mobileconfig)</a>
          <a class="btn btn-outline" href="/ca/rootCA.crt">Tải tệp chứng chỉ gốc (.crt)</a>
        </div>
      </div>

      <div class="card">
        <div>
          <h2>💻 Dành cho Máy tính Windows PC</h2>
          <p>Chạy bộ cài tự động 1 chạm để nạp chứng chỉ vào Windows Trusted Root Store:</p>
          <ul class="steps">
            <li data-n="1">Bấm nút <strong>Tải Bộ Cài 1-Click</strong> bên dưới.</li>
            <li data-n="2">Mở file <code>cai-dat-chung-chi-qk7.bat</code> và chọn <strong>Yes</strong> (Admin).</li>
            <li data-n="3">Hệ thống tự động nạp chứng chỉ, làm mới DNS và mở thẳng trang chủ.</li>
          </ul>
        </div>
        <div>
          <a class="btn btn-gold" href="/ca/cai-dat-windows.bat">Tải Bộ Cài 1-Click Windows (.bat)</a>
          <a class="btn btn-outline" href="/ca/rootCA.pem">Tải tệp gốc cho Linux / Trạm Vân Tay (.pem)</a>
        </div>
      </div>
    </div>

    <div class="cta-box">
      <p>Sau khi hoàn tất bước cài đặt chứng chỉ ở trên, chạm nút sau để đăng nhập hệ thống:</p>
      <a class="btn btn-primary" href="${httpsUrl}">🔒 Truy cập ${httpsUrl}</a>
      <div class="fp">
        <strong>Mã băm kiểm chứng SHA-256 Root CA:</strong><br />${safeFp}
      </div>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Xử lý các đường dẫn công khai /ca/* cho cả máy chủ HTTP cổng 80 lẫn Express HTTPS.
 * Trả về true nếu đã xử lý phản hồi, false nếu không thuộc phạm vi /ca.
 */
function handleCaPortalRequest(req, res, { serverDomain, serverIp } = {}) {
  const rawUrl = (req.url || '/').split('?')[0];
  if (rawUrl !== '/ca' && !rawUrl.startsWith('/ca/')) {
    return false;
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Method Not Allowed');
    return true;
  }

  const hostname = (serverDomain || 'trungtamdulieuso.tqsqk7.edu').trim();
  const ip = (serverIp || '127.0.0.1').trim();
  const reqHostHeader = String(req.headers.host || hostname).split(':')[0].replace(/[^a-zA-Z0-9.-]/g, '');

  const baseHeaders = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Cache-Control': 'no-store',
  };

  let pem = null;
  try {
    pem = readPublicRootCaPem();
  } catch (err) {
    console.error('[CA-PORTAL]', err.message);
    res.writeHead(500, { ...baseHeaders, 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Lỗi kiểm định chứng chỉ công khai trên máy chủ.');
    return true;
  }

  if (rawUrl === '/ca' || rawUrl === '/ca/') {
    const html = buildPortalHtml({
      hostname,
      serverIp: ip,
      fingerprint: pem ? getCertSha256Fingerprint(pem) : null,
      hasCert: Boolean(pem),
      cspNonce: res.locals && res.locals.cspNonce ? res.locals.cspNonce : '',
    });
    res.writeHead(200, { ...baseHeaders, 'Content-Type': 'text/html; charset=utf-8' });
    res.end(req.method === 'HEAD' ? undefined : html);
    return true;
  }

  if (!pem) {
    res.writeHead(404, { ...baseHeaders, 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Chưa có tệp chứng chỉ gốc công khai (backend/certs/rootCA.pem). Hãy chạy scripts\\doi-ip.bat trên máy chủ.');
    return true;
  }

  if (rawUrl === '/ca/cai-dat-windows.bat') {
    const bat = buildWindowsInstallerBat(hostname, ip, reqHostHeader, pem);
    res.writeHead(200, {
      ...baseHeaders,
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': 'attachment; filename="cai-dat-chung-chi-qk7.bat"',
    });
    res.end(req.method === 'HEAD' ? undefined : bat);
    return true;
  }

  if (rawUrl === '/ca/ipad.mobileconfig') {
    const xml = buildIpadMobileConfig(pem, hostname, ip);
    res.writeHead(200, {
      ...baseHeaders,
      'Content-Type': 'application/x-apple-aspen-config; charset=utf-8',
      'Content-Disposition': 'attachment; filename="QK7-DataHub-RootCA.mobileconfig"',
    });
    res.end(req.method === 'HEAD' ? undefined : xml);
    return true;
  }

  if (rawUrl === '/ca/rootCA.pem' || rawUrl === '/ca/rootCA.crt') {
    const filename = rawUrl.endsWith('.crt') ? 'QK7-DataHub-RootCA.crt' : 'rootCA.pem';
    res.writeHead(200, {
      ...baseHeaders,
      'Content-Type': 'application/x-x509-ca-cert',
      'Content-Disposition': `attachment; filename="${filename}"`,
    });
    res.end(req.method === 'HEAD' ? undefined : pem);
    return true;
  }

  res.writeHead(404, { ...baseHeaders, 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not Found');
  return true;
}

/**
 * Xử lý truy vấn RFC 8484 DNS-over-HTTPS (/dns-query) cho iPad Air M4 Split-DNS
 * (giúp iPad tự phân giải trungtamdulieuso.tqsqk7.edu sang SERVER_IP trong mạng nội bộ).
 */
function answerDohPacket(buf, hostname, serverIp) {
  if (!Buffer.isBuffer(buf) || buf.length < 12) return null;
  const qdcount = buf.readUInt16BE(4);
  if (qdcount < 1) return null;
  let offset = 12;
  const labels = [];
  while (offset < buf.length && labels.length < 64) {
    const len = buf[offset];
    if (len === 0) { offset += 1; break; }
    if ((len & 0xc0) === 0xc0) { offset += 2; break; }
    offset += 1;
    if (offset + len > buf.length) return null;
    labels.push(buf.subarray(offset, offset + len).toString('ascii'));
    offset += len;
  }
  if (offset + 4 > buf.length) return null;
  const qtype = buf.readUInt16BE(offset);
  const rawQuestion = buf.subarray(12, offset + 4);
  const qname = labels.join('.').toLowerCase();

  const cleanHost = (hostname || 'trungtamdulieuso.tqsqk7.edu').toLowerCase();
  const parts = cleanHost.split('.');
  const baseZone = parts.length >= 2 ? parts.slice(-2).join('.') : cleanHost;
  const isAuth = qname === cleanHost || qname === baseZone || qname.endsWith('.' + baseZone) || qname === 'tqsqk7.cntt';

  const header = Buffer.alloc(12);
  header.writeUInt16BE(buf.readUInt16BE(0), 0);
  const rd = buf.readUInt16BE(2) & 0x0100;
  const rcode = isAuth ? 0 : 3;
  const wantA = isAuth && (qtype === 1 || qtype === 255);
  header.writeUInt16BE(0x8480 | rd | rcode, 2);
  header.writeUInt16BE(1, 4);
  header.writeUInt16BE(wantA ? 1 : 0, 6);

  if (!wantA) return Buffer.concat([header, rawQuestion]);

  const cleanIp = (serverIp && /^\d+\.\d+\.\d+\.\d+$/.test(serverIp) && serverIp !== '127.0.0.1') ? serverIp : '192.168.1.229';
  const ipBytes = cleanIp.split('.').map(n => parseInt(n, 10) & 0xff);
  const ans = Buffer.alloc(16);
  ans.writeUInt16BE(0xc00c, 0);
  ans.writeUInt16BE(1, 2);
  ans.writeUInt16BE(1, 4);
  ans.writeUInt32BE(30, 6);
  ans.writeUInt16BE(4, 10);
  ans[12] = ipBytes[0]; ans[13] = ipBytes[1]; ans[14] = ipBytes[2]; ans[15] = ipBytes[3];
  return Buffer.concat([header, rawQuestion, ans]);
}

const DOH_MAX_BYTES = 4096;

function handleDohRequest(req, res, { serverDomain, serverIp } = {}) {
  const parsedUrl = new URL(req.url || '/', 'http://localhost');
  if (parsedUrl.pathname !== '/dns-query') return false;

  const sendDns = (pkt) => {
    const reply = answerDohPacket(pkt, serverDomain, serverIp);
    if (!reply) {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end('Bad DNS Request');
      return;
    }
    res.writeHead(200, {
      'Content-Type': 'application/dns-message',
      'Content-Length': reply.length,
      'Cache-Control': 'max-age=30',
    });
    res.end(reply);
  };

  if (req.method === 'GET') {
    const b64url = parsedUrl.searchParams.get('dns') || '';
    if (!b64url) {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end('Missing dns query param');
      return true;
    }
    // base64url của 4 KB ≈ 5.5 KB ký tự
    if (b64url.length > Math.ceil(DOH_MAX_BYTES * 4 / 3) + 4) {
      res.writeHead(413, { 'Content-Type': 'text/plain' });
      res.end('DNS query too large');
      return true;
    }
    const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
    sendDns(Buffer.from(b64, 'base64'));
    return true;
  }

  if (req.method === 'POST') {
    // Gói hỏi DNS thực tế 50–512 byte; chặn cứng 4 KB để không ai gửi dữ liệu khổng lồ làm cạn RAM (endpoint công khai)
    const declared = parseInt(req.headers['content-length'] || '0', 10);
    if (declared > DOH_MAX_BYTES) {
      res.writeHead(413, { 'Content-Type': 'text/plain', Connection: 'close' });
      res.end('DNS query too large');
      req.destroy();
      return true;
    }
    const chunks = [];
    let size = 0;
    let aborted = false;
    req.on('data', (c) => {
      if (aborted) return;
      size += c.length;
      if (size > DOH_MAX_BYTES) {
        aborted = true;
        chunks.length = 0;
        res.writeHead(413, { 'Content-Type': 'text/plain', Connection: 'close' });
        res.end('DNS query too large');
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => { if (!aborted) sendDns(Buffer.concat(chunks)); });
    req.on('error', () => {});
    return true;
  }

  res.writeHead(405);
  res.end();
  return true;
}

module.exports = {
  handleCaPortalRequest,
  handleDohRequest,
  buildIpadMobileConfig,
};
