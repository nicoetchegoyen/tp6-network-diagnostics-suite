@echo off
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\emulator-network.ps1" -Mode Online
if errorlevel 1 pause
