@echo off
title 3D Desktop Pet Gulpin Setup & Launch
setlocal enabledelayedexpansion

cd /d "%~dp0"

echo ===================================================
echo   3D Desktop Pet (Gulpin) - Automated Launcher
echo ===================================================
echo.

:: 1. Check if system Node.js is already installed
where node >nul 2>nul
if %errorlevel% equ 0 (
    echo [INFO] Found pre-installed Node.js on your system.
    set "NODE_CMD=node"
    set "NPM_CMD=npm"
    goto :INSTALL_DEPS
)

:: 2. Check if local portable Node.js is already downloaded and unpacked
if exist ".node-portable\node.exe" (
    echo [INFO] Found local portable Node.js runtime.
    set PATH=%CD%\.node-portable;%PATH%
    set "NODE_CMD=node"
    set "NPM_CMD=npm"
    goto :INSTALL_DEPS
)

:: 3. Download and bootstrap portable Node.js
echo [SETUP] Node.js is not installed. Bootstrapping portable environment...
echo [SETUP] Downloading official Node.js portable runtime (approx. 30MB)...
echo [SETUP] Please wait a moment, this is a one-time automated setup.
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command "^
    $url = 'https://nodejs.org/dist/v20.12.2/node-v20.12.2-win-x64.zip';^
    $zip = Join-Path -Path $pwd -ChildPath 'node.zip';^
    $dest = Join-Path -Path $pwd -ChildPath '.node-portable';^
    Write-Host 'Downloading Node.js portable zip...' -ForegroundColor Cyan;^
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12;^
    Invoke-WebRequest -Uri $url -OutFile $zip;^
    Write-Host 'Extracting runtime to local directory...' -ForegroundColor Cyan;^
    Expand-Archive -Path $zip -DestinationPath $dest -Force;^
    Remove-Item $zip -Force;^
    Write-Host 'Organizing folders...' -ForegroundColor Cyan;^
    $subDir = Join-Path $dest 'node-v20.12.2-win-x64';^
    if (Test-Path $subDir) {^
        Get-ChildItem -Path $subDir | Move-Item -Destination $dest -Force;^
        Remove-Item $subDir -Force;^
    }^
    Write-Host 'Local Node.js setup complete!' -ForegroundColor Green;"

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Failed to download or extract portable Node.js.
    echo Please check your internet connection and try running this script again.
    echo.
    pause
    exit /b %errorlevel%
)

:: Put portable Node.js on the current CMD session PATH
set PATH=%CD%\.node-portable;%PATH%
set "NODE_CMD=node"
set "NPM_CMD=npm"

:INSTALL_DEPS
:: 4. Check if project dependencies (node_modules) are installed
if not exist "node_modules\" (
    echo.
    echo [SETUP] First-time setup: Installing 3D desktop pet dependencies...
    echo [SETUP] (Electron & Three.js are being installed in the background)
    echo [SETUP] This may take up to a minute depending on your internet connection...
    echo.
    
    call npm install --no-audit --no-fund --loglevel=error
    
    if %errorlevel% neq 0 (
        echo.
        echo [ERROR] Failed to install dependencies.
        echo Please ensure you are connected to the internet and run this script again.
        echo.
        pause
        exit /b %errorlevel%
    )
    echo [SETUP] Dependencies successfully installed!
)

:: 5. Launch the 3D Desktop Pet
echo.
echo ===================================================
echo   Launching 3D Desktop Pet! Enjoy the companionship!
echo ===================================================
echo.

start "" npm start

exit /b 0
