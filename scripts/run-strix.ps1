# ==============================================================================
# QK7 DataHub — Strix Pentest Launcher
# ==============================================================================

if ($env:GEMINI_API_KEY) {
    if (-not $env:STRIX_LLM) {
        $env:STRIX_LLM = "gemini/gemini-flash-latest"
    }
    Write-Host "[+] Sử dụng Gemini Provider với model: $env:STRIX_LLM" -ForegroundColor Green
} elseif ($env:OPENAI_API_KEY) {
    $env:LLM_API_KEY = $env:OPENAI_API_KEY
    if (-not $env:STRIX_LLM) {
        $env:STRIX_LLM = "openai/gpt-4o"
    }
    Write-Host "[+] Sử dụng OpenAI Provider với model: $env:STRIX_LLM" -ForegroundColor Green
} else {
    Write-Host "[!] Vui lòng thiết lập `$env:GEMINI_API_KEY hoặc `$env:OPENAI_API_KEY trước khi chạy." -ForegroundColor Red
    exit 1
}

$scriptsPath = "C:\Users\PC\AppData\Local\Packages\PythonSoftwareFoundation.Python.3.12_qbz5n2kfra8p0\LocalCache\local-packages\Python312\Scripts"
if ($env:PATH -notlike "*$scriptsPath*") {
    $env:PATH = "$scriptsPath;$env:PATH"
}

Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host "                  QK7 DATAHUB — KHỞI CHẠY STRIX AI PENTEST                       " -ForegroundColor Yellow
Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host "Target             : https://host.docker.internal:8000"
Write-Host "Instruction File   : ./strix-pentest-instructions.md"
Write-Host "Model              : $env:STRIX_LLM"
Write-Host "Max Budget (USD)   : 15`n"

strix -n -t https://host.docker.internal:8000 --instruction-file ./strix-pentest-instructions.md -m deep --max-budget 15
