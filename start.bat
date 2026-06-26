@echo off
cd /d "%~dp0"
if exist "venv\Scripts\python.exe" (
  venv\Scripts\python.exe dev.py %*
) else (
  python dev.py %*
)
