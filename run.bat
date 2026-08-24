@echo off
cd /d "%~dp0"
set "PATH=%LOCALAPPDATA%\pnpm;%PATH%"
echo Starting Q-Runner dev server...
call pnpm dev
