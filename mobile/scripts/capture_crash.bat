@echo off
REM Capture Android logcat around a crash for the Vondic app on Windows.
REM Usage:
REM   1. Enable USB debugging on the phone and connect it to the computer.
REM   2. Run this file.
REM   3. Reproduce the crash in the app.
REM   4. Return to this window and press any key.
REM   5. Send the generated crash.log file.

echo Checking device...
adb devices

echo Clearing logcat buffer...
adb logcat -c

echo.
echo ***********************************************
echo Reproduce the crash in the app now.
echo After the app crashes, return here and press any key.
echo ***********************************************
pause >nul

echo Dumping logs to crash.log...
adb logcat -d | findstr "AndroidRuntime FATAL DEBUG ReactNativeJS vondic helloworld" > crash.log

echo Saved to crash.log
pause
