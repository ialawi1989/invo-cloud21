@echo off
REM Angular Customizer - Start Script
REM Starts the admin portal (invo-portal2) and the storefront (website).
REM
REM The legacy `dashboard/` prototype is deliberately NOT started: the builder
REM it hosted now lives in invo-portal2 at /page-builder. Deleting that folder
REM requires no change here.

echo Starting Invo Cloud...
echo.

if not exist "invo-portal2\node_modules" (
    echo Installing portal dependencies...
    cd invo-portal2
    call npm install
    cd ..
)

if not exist "website\node_modules" (
    echo Installing website dependencies...
    cd website
    call npm install
    cd ..
)

echo.
echo   Portal      http://localhost:4700
echo   Storefront  http://localhost:4600
echo.
echo Both bind 0.0.0.0, so they are reachable from other devices on the LAN.
echo Close the spawned windows to stop the servers.
echo.

start "Portal" cmd /c "cd invo-portal2 && npm start"
start "Storefront" cmd /c "cd website && npm start"

echo Servers started in separate windows.
pause
