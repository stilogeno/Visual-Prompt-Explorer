#!/bin/bash
# macOS Automator script to start Supabase on boot
# This script should be added to macOS Login Items
# Run: sudo chmod +x scripts/start-local-supabase.sh
# Then add to: System Settings > General > Login Items

# Check if Supabase is already running
if npx supabase status 2>/dev/null; then
    echo "Supabase is already running"
    exit 0
fi

# Start Supabase
echo "Starting Supabase..."
npx supabase start

# Check if it started successfully
sleep 5
if npx supabase status 2>/dev/null; then
    echo "Supabase started successfully"
    exit 0
else
    echo "Supabase failed to start, retrying..."
    npx supabase restart
    exit 0
fi