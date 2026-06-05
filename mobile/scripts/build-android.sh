#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ANDROID_DIR="$(dirname "$SCRIPT_DIR")/android"

echo "=========================================="
echo "Vondic Mobile - Android Build"
echo "=========================================="

if [ ! -d "$ANDROID_DIR" ]; then
    echo "Error: android/ directory not found."
    echo "Run ./scripts/bootstrap-native.sh first!"
    exit 1
fi

if ! command -v java &> /dev/null; then
    echo "Error: Java not found. Install JDK 17:"
    echo "  sudo apt install openjdk-17-jdk   (Ubuntu/Debian)"
    echo "  brew install openjdk@17            (macOS)"
    exit 1
fi

JAVA_VERSION=$(java -version 2>&1 | awk -F '"' '/version/ {print $2}')
echo "Java version: $JAVA_VERSION"

cd "$ANDROID_DIR"

# Check for signing config
if grep -q "MYAPP_UPLOAD_STORE_FILE" "gradle.properties"; then
    echo ""
    echo "Building RELEASE APK (signed)..."
    ./gradlew assembleRelease
    echo ""
    echo "✅ Release APK built:"
    echo "   app/build/outputs/apk/release/app-release.apk"
else
    echo ""
    echo "Building DEBUG APK (no signing required)..."
    ./gradlew assembleDebug
    echo ""
    echo "✅ Debug APK built:"
    echo "   app/build/outputs/apk/debug/app-debug.apk"
fi

echo ""
echo "To install on a connected device:"
echo "  adb install app/build/outputs/apk/debug/app-debug.apk"
