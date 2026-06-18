#!/bin/bash
# Capture Android logcat around a crash for the Vondic app.
# Usage:
#   1. Enable USB debugging on the phone and connect it to the computer.
#   2. Run: ./scripts/capture_crash.sh
#   3. Reproduce the crash in the app.
#   4. Press Ctrl+C in the terminal.
#   5. Send the generated crash.log file.

set -e

echo "Checking device..."
adb devices

echo "Clearing logcat buffer..."
adb logcat -c

echo "Recording logs. Reproduce the crash and then press Ctrl+C."
adb logcat | grep -E "AndroidRuntime|FATAL|DEBUG|ReactNativeJS|vondic|helloworld" > crash.log

echo "Saved to crash.log"
