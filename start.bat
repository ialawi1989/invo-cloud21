@echo off
echo 🚀 Starting Angular Customizer...
echo.

REM Check and install dependencies
if not exist "dashboard\node_modules" (
    echo 📦 Installing Dashboard dependencies...
    cd dashboard
    call npm install
    cd ..
)

if not exist "website\node_modules" (
    echo 📦 Installing Website dependencies...
    cd website
    call npm install
    cd ..
)

echo.
echo 🎨 Starting Dashboard on http://localhost:4200
echo 🌐 Starting Website on http://localhost:4300
echo.
echo Press Ctrl+C to stop servers
echo.

REM Start both apps
start "Dashboard" cmd /c "cd dashboard && npm start"
start "Website" cmd /c "cd website && npm start"

echo Servers started in separate windows.
pause
