#!/bin/bash

# Angular Customizer - Start Script
# This script starts both the Dashboard and Website applications

echo "🚀 Starting Angular Customizer..."
echo ""

# Check if node_modules exist
if [ ! -d "dashboard/node_modules" ]; then
    echo "📦 Installing Dashboard dependencies..."
    cd dashboard && npm install && cd ..
fi

if [ ! -d "website/node_modules" ]; then
    echo "📦 Installing Website dependencies..."
    cd website && npm install && cd ..
fi

echo ""
echo "🎨 Starting Dashboard on http://localhost:4200"
echo "🌐 Starting Website on http://localhost:4300"
echo ""
echo "Press Ctrl+C to stop both servers"
echo ""

# Start both apps in parallel
cd dashboard && npm start &
DASHBOARD_PID=$!

cd website && npm start &
WEBSITE_PID=$!

# Wait for both processes
wait $DASHBOARD_PID $WEBSITE_PID
