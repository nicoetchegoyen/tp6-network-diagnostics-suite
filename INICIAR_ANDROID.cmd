@echo off
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\start-android-demo.ps1"
if errorlevel 1 pause
