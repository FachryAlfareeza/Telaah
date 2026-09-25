@echo off
cd /d "%~dp0"
if not exist "node_modules\vite\bin\vite.js" (
  echo Please install dependencies first using npm install.
  pause
  exit /b 1
)
node node_modules\vite\bin\vite.js --host 127.0.0.1
