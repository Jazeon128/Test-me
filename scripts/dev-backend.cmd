@echo off
rem Start in backend so main.py and the virtual environment resolve.
rem Existing document file paths are relative to backend too.
cd /d "%~dp0..\backend"
if errorlevel 1 exit /b %errorlevel%
.venv\Scripts\python.exe main.py
exit /b %errorlevel%
