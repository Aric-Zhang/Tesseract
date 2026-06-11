@echo off
setlocal

set "ROOT=%~dp0"
cd /d "%ROOT%"

where npm >nul 2>nul
if errorlevel 1 (
  echo [error] npm was not found. Please install Node.js first.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo Installing workspace dependencies...
  call npm install
  if errorlevel 1 (
    echo.
    echo [error] npm install failed.
    pause
    exit /b 1
  )
)

echo Starting Wallpaper Tesseract from the latest source files...
echo The browser will open automatically. Keep this window open while using the page.
echo Press Ctrl+C in this window to stop the dev server.
echo.

call npm run dev -w wallpaper-tesseract -- --open
if errorlevel 1 (
  echo.
  echo [error] Dev server exited with an error.
  pause
  exit /b 1
)

endlocal
