#!/bin/bash

# Angular Customizer - Start Script
# Starts the admin portal (invo-portal2) and the storefront (website).
#
# The legacy `dashboard/` prototype is deliberately NOT started: the builder it
# hosted now lives in invo-portal2 at /page-builder. Deleting that folder
# requires no change here.

echo "Starting Invo Cloud..."
echo ""

if [ ! -d "invo-portal2/node_modules" ]; then
    echo "Installing portal dependencies..."
    (cd invo-portal2 && npm install)
fi

if [ ! -d "website/node_modules" ]; then
    echo "Installing website dependencies..."
    (cd website && npm install)
fi

echo ""
echo "  Portal      http://localhost:4700"
echo "  Storefront  http://localhost:4600"
echo ""
echo "Both bind 0.0.0.0, so they are reachable from other devices on the LAN."
echo "Press Ctrl+C to stop both servers."
echo ""

# Subshells, so a failed cd cannot leave the next command in the wrong directory.
(cd invo-portal2 && npm start) &
PORTAL_PID=$!

(cd website && npm start) &
WEBSITE_PID=$!

# Stop both when this script is interrupted, rather than orphaning one.
trap 'kill $PORTAL_PID $WEBSITE_PID 2>/dev/null' INT TERM

wait $PORTAL_PID $WEBSITE_PID
