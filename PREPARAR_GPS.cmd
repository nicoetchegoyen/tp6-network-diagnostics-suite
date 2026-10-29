@echo off
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\set-demo-location.ps1"
if errorlevel 1 pause
