@echo off
setlocal
cd /d "%~dp0"
if exist "%ProgramFiles%\nodejs\node.exe" set "PATH=%ProgramFiles%\nodejs;%PATH%"
where node.exe >nul 2>nul
if errorlevel 1 (
  echo Node.js is required. Install Node.js and try again.
  pause
  exit /b 1
)
if not exist "node_modules\next\dist\bin\next" (
  echo Installing MOONS dependencies...
  call npm.cmd ci --no-audit --no-fund
  if errorlevel 1 (
    echo Installation failed. Check the network and try again.
    pause
    exit /b 1
  )
)
node.exe "scripts\start-moons.cjs"
if errorlevel 1 pause
endlocal