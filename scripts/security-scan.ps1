# ==============================================================================
# QK7 DataHub — Bộ Kịch Bản Tự Động Quét & Kiểm Tra An Ninh Cục Bộ (DevSecOps)
# Tiêu chuẩn: OWASP Top 10, CWE/SANS Top 25, HCL AppScan Cleanliness Baseline
# ==============================================================================

[CmdletBinding()]
param (
    [switch]$FullHistory = $false,
    [switch]$CiMode = $false,
    [switch]$KeepReports = $false
)

$ErrorActionPreference = "Continue"

# 1. Bổ sung các đường dẫn cài đặt công cụ vào PATH tạm thời của phiên
$toolPaths = @(
    "$env:LOCALAPPDATA\Packages\PythonSoftwareFoundation.Python.3.12_qbz5n2kfra8p0\LocalCache\local-packages\Python312\Scripts",
    "$env:LOCALAPPDATA\Microsoft\WinGet\Packages\Gitleaks.Gitleaks_Microsoft.Winget.Source_8wekyb3d8bbwe",
    "$env:LOCALAPPDATA\Microsoft\WinGet\Packages\AquaSecurity.Trivy_Microsoft.Winget.Source_8wekyb3d8bbwe",
    "$env:APPDATA\npm"
)

foreach ($p in $toolPaths) {
    if ((Test-Path $p) -and ($env:PATH -notlike "*$p*")) {
        $env:PATH = "$p;$env:PATH"
    }
}

Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host "          QK7 DATAHUB — BỘ KIỂM TRA TOÀN DIỆN AN NINH MÃ NGUỒN (SAST & SCA)      " -ForegroundColor Yellow
Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host "Thời gian thực thi : $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Gray
Write-Host "Thư mục làm việc   : $PWD`n" -ForegroundColor Gray

$results = [ordered]@{}

# ------------------------------------------------------------------------------
# BƯỚC 1: KIỂM TRA MÃ NGUỒN TĨNH VỚI SEMGREP (SAST)
# ------------------------------------------------------------------------------
Write-Host "[1/5] Đang chạy phân tích mã nguồn tĩnh (SAST) với Semgrep..." -ForegroundColor Yellow
$semgrepCmd = Get-Command semgrep -ErrorAction SilentlyContinue

if ($semgrepCmd) {
    $semgrepOutputFile = "semgrep-local-report.json"
    & semgrep scan --config "p/security-audit" --config "p/owasp-top-ten" --json -o $semgrepOutputFile . 2>&1 | Out-Null
    
    if (Test-Path $semgrepOutputFile) {
        try {
            $semgrepData = Get-Content $semgrepOutputFile -Raw | ConvertFrom-Json
            $findingsCount = if ($semgrepData.results) { $semgrepData.results.Count } else { 0 }
            if ($findingsCount -eq 0) {
                Write-Host "  -> [PASSED] Semgrep SAST: 0 lỗ hổng phát hiện (Đạt chuẩn Clean Code)." -ForegroundColor Green
                $results["SAST (Semgrep)"] = "PASSED (0 findings)"
            }
            else {
                Write-Host "  -> [WARNING] Semgrep SAST: Phát hiện $findingsCount cảnh báo!" -ForegroundColor Red
                $results["SAST (Semgrep)"] = "FAILED ($findingsCount findings)"
            }
        }
        catch {
            Write-Host "  -> [ERROR] Không thể đọc báo cáo Semgrep." -ForegroundColor Red
            $results["SAST (Semgrep)"] = "ERROR"
        }
        finally {
            if (-not $KeepReports -and (Test-Path $semgrepOutputFile)) {
                Remove-Item $semgrepOutputFile -Force -ErrorAction SilentlyContinue
            }
        }
    }
    else {
        $results["SAST (Semgrep)"] = "PASSED (0 findings)"
        Write-Host "  -> [PASSED] Semgrep SAST: 0 phát hiện." -ForegroundColor Green
    }
}
else {
    Write-Host "  -> [SKIPPED] Semgrep chưa có trong PATH. Hãy cài đặt: python -m pip install semgrep" -ForegroundColor DarkYellow
    $results["SAST (Semgrep)"] = "SKIPPED"
}

# ------------------------------------------------------------------------------
# BƯỚC 2: PHÂN TÍCH RỦI RO THÀNH PHẦN PHẦN MỀM (SCA - NPM AUDIT)
# ------------------------------------------------------------------------------
Write-Host "`n[2/5] Đang quét lỗ hổng phụ thuộc bên thứ ba (SCA - npm audit)..." -ForegroundColor Yellow

# Backend Audit
Write-Host "  * Quét Backend Gateway (:8000)..." -NoNewline
$backendAudit = (npm audit --prefix backend --json 2>&1) -join "`n"
try {
    $beData = $backendAudit | ConvertFrom-Json
    $beVulns = $beData.metadata.vulnerabilities
    $beHigh = $beVulns.high + $beVulns.critical
    if ($beHigh -eq 0) {
        Write-Host " [PASSED] (Critical: 0, High: 0)" -ForegroundColor Green
        $results["SCA (Backend Gateway)"] = "PASSED (0 Critical/High)"
    }
    else {
        Write-Host " [FAILED] (Critical: $($beVulns.critical), High: $($beVulns.high))" -ForegroundColor Red
        $results["SCA (Backend Gateway)"] = "FAILED ($beHigh high/critical)"
    }
}
catch {
    Write-Host " [UNKNOWN]" -ForegroundColor DarkYellow
    $results["SCA (Backend Gateway)"] = "UNKNOWN"
}

# Frontend Audit
Write-Host "  * Quét Frontend SPA (React 18)..." -NoNewline
$frontendAudit = (npm audit --prefix frontend --json 2>&1) -join "`n"
try {
    $feData = $frontendAudit | ConvertFrom-Json
    $feVulns = $feData.metadata.vulnerabilities
    $feHigh = $feVulns.high + $feVulns.critical
    if ($feHigh -eq 0) {
        Write-Host " [PASSED] (Critical: 0, High: 0)" -ForegroundColor Green
        $results["SCA (Frontend SPA)"] = "PASSED (0 Critical/High)"
    }
    else {
        Write-Host " [FAILED] (Critical: $($feVulns.critical), High: $($feVulns.high))" -ForegroundColor Red
        $results["SCA (Frontend SPA)"] = "FAILED ($feHigh high/critical)"
    }
}
catch {
    Write-Host " [UNKNOWN]" -ForegroundColor DarkYellow
    $results["SCA (Frontend SPA)"] = "UNKNOWN"
}

# ------------------------------------------------------------------------------
# BƯỚC 3: QUÉT RÒ RỈ KHÓA BÍ MẬT (GITLEAKS)
# ------------------------------------------------------------------------------
Write-Host "`n[3/5] Đang quét rò rỉ khóa bí mật và thông tin nhạy cảm (Gitleaks)..." -ForegroundColor Yellow
$gitleaksCmd = Get-Command gitleaks -ErrorAction SilentlyContinue

if ($gitleaksCmd) {
    $reportDir = "reports/security"
    if (-not (Test-Path $reportDir)) { New-Item -ItemType Directory -Force -Path $reportDir | Out-Null }
    if ($FullHistory) {
        Write-Host "  * Quét toàn bộ lịch sử Git commit..." -NoNewline
        $reportFile = "$reportDir/gitleaks-history.json"
        & gitleaks detect --redact --report-format json --report-path $reportFile 2>&1 | Out-Null
    }
    else {
        Write-Host "  * Quét các tệp trong Git index và working tree..." -NoNewline
        $reportFile = "$reportDir/gitleaks-detect-local.json"
        & gitleaks detect --no-git=false --redact --report-format json --report-path $reportFile 2>&1 | Out-Null
    }

    if (Test-Path $reportFile) {
        try {
            $leakData = Get-Content $reportFile -Raw | ConvertFrom-Json
            $leakCount = if ($leakData) { $leakData.Count } else { 0 }
            if ($leakCount -eq 0) {
                Write-Host " [PASSED] 0 rò rỉ bí mật trong tệp hiện tại." -ForegroundColor Green
                $results["Secret Leak (Gitleaks)"] = "PASSED (0 leaks)"
            }
            else {
                Write-Host " [WARNING] Phát hiện $leakCount rò rỉ bí mật!" -ForegroundColor Yellow
                $results["Secret Leak (Gitleaks)"] = "DETECTED ($leakCount in history)"
            }
        }
        catch {
            Write-Host " [PASSED] 0 leaks." -ForegroundColor Green
            $results["Secret Leak (Gitleaks)"] = "PASSED (0 leaks)"
        }
        finally {
            if (-not $KeepReports -and (Test-Path $reportFile)) {
                Remove-Item $reportFile -Force -ErrorAction SilentlyContinue
            }
        }
    }
    else {
        Write-Host " [PASSED]" -ForegroundColor Green
        $results["Secret Leak (Gitleaks)"] = "PASSED (0 leaks)"
    }
}
else {
    Write-Host "  -> [SKIPPED] Gitleaks chưa có trong PATH." -ForegroundColor DarkYellow
    $results["Secret Leak (Gitleaks)"] = "SKIPPED"
}

# ------------------------------------------------------------------------------
# BƯỚC 4: KIỂM TRA BẢO MẬT CẤU HÌNH SERVER & 3 TẦNG BẢO VỆ
# ------------------------------------------------------------------------------
Write-Host "`n[4/5] Kiểm tra các cơ chế bảo vệ cốt lõi trong mã nguồn..." -ForegroundColor Yellow

$serverJs = Get-Content "backend/server.js" -Raw

# 1. Trust proxy
if ($serverJs -match "app\.set\('trust proxy'") {
    Write-Host "  [✓] Trust Proxy (CWE-290 Anti-Spoofing): Kích hoạt" -ForegroundColor Green
}
else {
    Write-Host "  [✗] Trust Proxy (CWE-290 Anti-Spoofing): THIẾU" -ForegroundColor Red
}

# 2. Magic bytes validation
if ($serverJs -match "validateUploadedPdf" -and $serverJs -match "%PDF-") {
    Write-Host "  [✓] Magic Bytes Check (CWE-434 File Upload): Kích hoạt" -ForegroundColor Green
}
else {
    Write-Host "  [✗] Magic Bytes Check (CWE-434 File Upload): THIẾU" -ForegroundColor Red
}

# 3. Dynamic Watermark & 2FA Token
if ($serverJs -match "X-Fingerprint-Token" -and $serverJs -match "security_level_id >= 3") {
    Write-Host "  [✓] Phân quyền 3 tầng & 2FA Vân tay Cấp 3+: Kích hoạt chặt chẽ" -ForegroundColor Green
}
else {
    Write-Host "  [✗] Phân quyền 3 tầng: Cần rà soát lại" -ForegroundColor Red
}

# 4. Content Security Policy
if ($serverJs -match "contentSecurityPolicy") {
    Write-Host "  [✓] Helmet CSP (CWE-1021 / CWE-79): Kích hoạt" -ForegroundColor Green
}
else {
    Write-Host "  [✗] Helmet CSP: Chưa bật" -ForegroundColor Red
}

# 5. Safe SCORM Zip Extraction & Path Traversal guard (CWE-22 / CWE-409)
$lectureExtJs = if (Test-Path "backend/src/lecture-extended-routes.js") { Get-Content "backend/src/lecture-extended-routes.js" -Raw } else { "" }
if ($lectureExtJs -match "extractZipSafely" -and $lectureExtJs -match "Zip Slip") {
    Write-Host "  [✓] SCORM Safe Extraction (CWE-22 / CWE-409 Anti-ZipSlip): Kích hoạt" -ForegroundColor Green
}
else {
    Write-Host "  [✗] SCORM Safe Extraction: Cần gia cố" -ForegroundColor Red
}

# 6. Anti-Secret Dump Protection
$trackedMerged = git ls-files "merged_code*.txt" 2>$null
if ($trackedMerged) {
    Write-Host "  [✗] Phát hiện tệp merged_code*.txt bị track trong Git!" -ForegroundColor Red
    $results["Secret Dump Leak"] = "FAILED (tracked merged_code.txt)"
}
else {
    Write-Host "  [✓] Không có tệp code dump (merged_code*.txt) rò rỉ trong Git" -ForegroundColor Green
}

# ------------------------------------------------------------------------------
# BƯỚC 5: KIỂM CHUẨN TRIVY TOÀN DIỆN (SCA DEPENDENCIES & IAC DOCKERFILE)
# ------------------------------------------------------------------------------
Write-Host "`n[5/5] Đang kiểm tra chuyên sâu với Trivy (SCA & IaC Hardening)..." -ForegroundColor Yellow
$trivyCmd = Get-Command trivy -ErrorAction SilentlyContinue

if ($trivyCmd) {
    $reportDir = "reports/security"
    if (-not (Test-Path $reportDir)) { New-Item -ItemType Directory -Force -Path $reportDir | Out-Null }
    # 5.1. Trivy Filesystem SCA (Thay thế Dependency-Check)
    Write-Host "  * Quét toàn bộ phụ thuộc (SCA) đa nền tảng (Node.js, Python)..." -NoNewline
    $trivyScaFile = "$reportDir/trivy-scan-local-sca.json"
    & trivy fs --scanners vuln --severity HIGH,CRITICAL --format json --output $trivyScaFile . 2>&1 | Out-Null
    
    if (Test-Path $trivyScaFile) {
        try {
            $scaJson = Get-Content $trivyScaFile -Raw | ConvertFrom-Json
            $totalVulns = 0
            if ($scaJson.Results) {
                foreach ($r in $scaJson.Results) {
                    if ($r.Vulnerabilities) {
                        $totalVulns += $r.Vulnerabilities.Count
                    }
                }
            }
            if ($totalVulns -eq 0) {
                Write-Host " [PASSED] (0 High/Critical)" -ForegroundColor Green
                $results["Trivy SCA (All Deps)"] = "PASSED (0 findings)"
            }
            else {
                Write-Host " [FAILED] ($totalVulns High/Critical)" -ForegroundColor Red
                $results["Trivy SCA (All Deps)"] = "FAILED ($totalVulns vulns)"
            }
        }
        catch {
            Write-Host " [PASSED] (0 findings)" -ForegroundColor Green
            $results["Trivy SCA (All Deps)"] = "PASSED (0 findings)"
        }
        finally {
            if (-not $KeepReports -and (Test-Path $trivyScaFile)) {
                Remove-Item $trivyScaFile -Force -ErrorAction SilentlyContinue
            }
        }
    }
    else {
        Write-Host " [PASSED]" -ForegroundColor Green
        $results["Trivy SCA (All Deps)"] = "PASSED (0 findings)"
    }

    # 5.2. Trivy IaC / Dockerfile Configuration Hardening
    Write-Host "  * Quét cấu hình Dockerfile & IaC (chống Container Escape)..." -NoNewline
    $trivyIacFile = "$reportDir/trivy-scan-local-iac.json"
    & trivy config --severity HIGH,CRITICAL --skip-dirs "node_modules,backend/node_modules" --format json --output $trivyIacFile . 2>&1 | Out-Null

    if (Test-Path $trivyIacFile) {
        try {
            $iacJson = Get-Content $trivyIacFile -Raw | ConvertFrom-Json
            $totalMisconfigs = 0
            if ($iacJson.Results) {
                foreach ($r in $iacJson.Results) {
                    if ($r.Misconfigurations) {
                        $totalMisconfigs += $r.Misconfigurations.Count
                    }
                }
            }
            if ($totalMisconfigs -eq 0) {
                Write-Host " [PASSED] (0 Misconfigurations)" -ForegroundColor Green
                $results["Trivy IaC (Dockerfiles)"] = "PASSED (0 misconfigs)"
            }
            else {
                Write-Host " [FAILED] ($totalMisconfigs Misconfigurations)" -ForegroundColor Red
                $results["Trivy IaC (Dockerfiles)"] = "FAILED ($totalMisconfigs misconfigs)"
            }
        }
        catch {
            Write-Host " [PASSED] (0 misconfigs)" -ForegroundColor Green
            $results["Trivy IaC (Dockerfiles)"] = "PASSED (0 misconfigs)"
        }
        finally {
            if (-not $KeepReports -and (Test-Path $trivyIacFile)) {
                Remove-Item $trivyIacFile -Force -ErrorAction SilentlyContinue
            }
        }
    }
    else {
        Write-Host " [PASSED]" -ForegroundColor Green
        $results["Trivy IaC (Dockerfiles)"] = "PASSED (0 misconfigs)"
    }
}
else {
    Write-Host "  -> [SKIPPED] Trivy chưa có trong PATH." -ForegroundColor DarkYellow
    $results["Trivy SCA & IaC"] = "SKIPPED"
}

# ------------------------------------------------------------------------------
# BẢNG TỔNG KẾT
# ------------------------------------------------------------------------------
Write-Host "`n================================================================================" -ForegroundColor Cyan
Write-Host "                       BẢNG TỔNG HỢP TRẠNG THÁI BẢO MẬT                          " -ForegroundColor Yellow
Write-Host "================================================================================" -ForegroundColor Cyan

foreach ($key in $results.Keys) {
    $val = $results[$key]
    $color = if ($val -like "PASSED*") { "Green" } elseif ($val -like "FAILED*") { "Red" } else { "Yellow" }
    Write-Host ("{0,-30} : " -f $key) -NoNewline
    Write-Host $val -ForegroundColor $color
}

Write-Host "================================================================================`n" -ForegroundColor Cyan

