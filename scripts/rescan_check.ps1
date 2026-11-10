# ==============================================================================
# scripts/rescan_check.ps1 — PowerShell Script kiểm tra nhanh Security Headers
# ==============================================================================
param(
    [string]$TargetHost = "https://127.0.0.1:8000"
)

# Bỏ qua xác thực SSL cho PowerShell WebRequest
[System.Net.ServicePointManager]::ServerCertificateValidationCallback = {$true}
[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.SecurityProtocolType]::Tls12

$endpoints = @(
    "/login",
    "/portal",
    "/lectures",
    "/materials",
    "/library",
    "/403",
    "/404",
    "/500"
)

Write-Host "================================================================================================================" -ForegroundColor Cyan
Write-Host "                     QK7 DATAHUB — BẢNG ĐỐI CHIẾU KIỂM TOÁN SECURITY HEADERS (OWASP)                            " -ForegroundColor Green
Write-Host " Mục tiêu: $TargetHost" -ForegroundColor Yellow
Write-Host "================================================================================================================" -ForegroundColor Cyan

$fmt = "{0,-12} | {1,-6} | {2,-10} | {3,-10} | {4,-12} | {5,-8} | {6,-8} | {7,-8} | {8,-8}"
[string]::Format($fmt, "Endpoint", "Status", "HSTS", "CSP-Nonce", "Permissions", "COOP", "CORP", "X-Type", "X-Frame")

Write-Host "----------------------------------------------------------------------------------------------------------------" -ForegroundColor Gray

$totalMissing = 0

foreach ($ep in $endpoints) {
    $url = "$TargetHost$ep"
    $status = "ERR"
    $headers = @{}

    try {
        $req = [System.Net.HttpWebRequest]::Create($url)
        $req.Method = "HEAD"
        $req.ServerCertificateValidationCallback = {$true}
        $req.Timeout = 10000
        $res = $req.GetResponse()
        $status = [int]$res.StatusCode
        foreach ($key in $res.Headers.AllKeys) {
            $headers[$key.ToLower()] = $res.Headers[$key]
        }
        $res.Close()
    } catch [System.Net.WebException] {
        if ($_.Response) {
            $status = [int]$_.Response.StatusCode
            foreach ($key in $_.Response.Headers.AllKeys) {
                $headers[$key.ToLower()] = $_.Response.Headers[$key]
            }
        }
    } catch {
        $status = "ERR"
    }

    # 1. HSTS
    $hsts = if ($headers["strict-transport-security"] -and $headers["strict-transport-security"].Contains("max-age=31536000")) { "OK" } else { $totalMissing++; "MISSING" }
    
    # 2. CSP
    $cspVal = $headers["content-security-policy"]
    $csp = if ($cspVal -and $cspVal.Contains("nonce-") -and (-not $cspVal.Contains("unsafe-inline")) -and (-not $cspVal.Contains("unsafe-eval"))) { "NONCE" } else { $totalMissing++; "MISSING" }

    # 3. Permissions-Policy
    $perm = if ($headers["permissions-policy"] -and $headers["permissions-policy"].Contains("camera=()")) { "OK" } else { $totalMissing++; "MISSING" }

    # 4. COOP
    $coop = if ($headers["cross-origin-opener-policy"] -eq "same-origin") { "OK" } else { $totalMissing++; "MISSING" }

    # 5. CORP
    $corp = if ($headers["cross-origin-resource-policy"] -eq "same-origin") { "OK" } else { $totalMissing++; "MISSING" }

    # 6. X-Type
    $xtype = if ($headers["x-content-type-options"] -eq "nosniff") { "OK" } else { $totalMissing++; "MISSING" }

    # 7. X-Frame
    $xframe = if ($headers["x-frame-options"] -eq "DENY") { "OK" } else { $totalMissing++; "MISSING" }

    $line = [string]::Format($fmt, $ep, $status, $hsts, $csp, $perm, $coop, $corp, $xtype, $xframe)
    if ($line.Contains("MISSING")) {
        Write-Host $line -ForegroundColor Red
    } else {
        Write-Host $line -ForegroundColor Green
    }
}

Write-Host "----------------------------------------------------------------------------------------------------------------" -ForegroundColor Gray
if ($totalMissing -eq 0) {
    Write-Host "✅ KẾT QUẢ: 100% SECURITY HEADERS ĐÃ ĐẠT CHUẨN TRÊN TOÀN BỘ 8/8 ENDPOINT (0 MISSING)!" -ForegroundColor Green
    exit 0
} else {
    Write-Host "❌ KẾT QUẢ: CÒN $totalMissing VỊ TRÍ THIẾU TIÊU ĐỀ AN NINH!" -ForegroundColor Red
    exit 1
}

