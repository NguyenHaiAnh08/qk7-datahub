@echo off
chcp 65001 >nul
title QK7 DataHub - Bao cao hieu nang
node "%~dp0perf-report.js" %*
echo.
pause
