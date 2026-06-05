#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MOBILE_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_NAME="VondicMobile"
PACKAGE_NAME="com.vondicmobile"
RN_VERSION="0.73.1"

TEMP_DIR=$(mktemp -d)
trap 'rm -rf "$TEMP_DIR"' EXIT

echo "=========================================="
echo "Bootstrapping native Android/iOS projects"
echo "=========================================="

if ! command -v node &> /dev/null; then
    echo "Error: Node.js is required"
    exit 1
fi

if [ -d "$MOBILE_DIR/android/app" ] || [ -d "$MOBILE_DIR/ios/${PROJECT_NAME}.xcodeproj" ]; then
    echo "Warning: native projects already exist!"
    read -p "Overwrite android/ and ios/? [y/N] " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Aborted."
        exit 0
    fi
    rm -rf "$MOBILE_DIR/android" "$MOBILE_DIR/ios"
fi

echo ""
echo "Step 1/4: Creating temporary RN ${RN_VERSION} project..."
echo "(this may take a few minutes)"
cd "$TEMP_DIR"

# Init without template (RN 0.71+ has TS by default) and without install
npx react-native@${RN_VERSION} init "${PROJECT_NAME}" --skip-install --skip-git-init

echo ""
echo "Step 2/4: Copying native projects..."
if [ ! -d "${TEMP_DIR}/${PROJECT_NAME}/android" ]; then
    echo "Error: android/ directory was not created. RN init may have failed."
    exit 1
fi
cp -r "${TEMP_DIR}/${PROJECT_NAME}/android" "$MOBILE_DIR/"
cp -r "${TEMP_DIR}/${PROJECT_NAME}/ios" "$MOBILE_DIR/"

echo ""
echo "Step 3/4: Patching Android project..."

# Patch settings.gradle rootProject name
sed -i.bak "s/rootProject.name = '.*'/rootProject.name = 'vondic-mobile'/" "$MOBILE_DIR/android/settings.gradle"
rm -f "$MOBILE_DIR/android/settings.gradle.bak"

APP_BUILD_GRADLE="$MOBILE_DIR/android/app/build.gradle"

# Replace namespace and applicationId
sed -i.bak "s/namespace \"com\.vondicmobile\"/namespace \"${PACKAGE_NAME}\"/" "$APP_BUILD_GRADLE"
sed -i.bak "s/applicationId \"com\.vondicmobile\"/applicationId \"${PACKAGE_NAME}\"/" "$APP_BUILD_GRADLE"
rm -f "$APP_BUILD_GRADLE.bak"

# Add react-native-config dotenv.gradle
if ! grep -q "react-native-config/dotenv.gradle" "$APP_BUILD_GRADLE"; then
    sed -i.bak '/apply from: "..\/..\/node_modules\/@react-native\/gradle-plugin\/react.gradle"/i \
apply from: project(":react-native-config").projectDir.getPath() + "/dotenv.gradle"' "$APP_BUILD_GRADLE"
    rm -f "$APP_BUILD_GRADLE.bak"
fi

# Add google-services plugin at bottom
if ! grep -q "com.google.gms.google-services" "$APP_BUILD_GRADLE"; then
    echo "" >> "$APP_BUILD_GRADLE"
    echo "apply plugin: 'com.google.gms.google-services'" >> "$APP_BUILD_GRADLE"
fi

# Add google-services classpath to project build.gradle
PROJECT_BUILD_GRADLE="$MOBILE_DIR/android/build.gradle"
if ! grep -q "com.google.gms:google-services" "$PROJECT_BUILD_GRADLE"; then
    sed -i.bak "/classpath(\"com.facebook.react:react-native-gradle-plugin\")/a \\        classpath 'com.google.gms:google-services:4.4.0'" "$PROJECT_BUILD_GRADLE"
    rm -f "$PROJECT_BUILD_GRADLE.bak"
fi

# Patch AndroidManifest.xml
MANIFEST="$MOBILE_DIR/android/app/src/main/AndroidManifest.xml"

if ! grep -q "android.permission.INTERNET" "$MANIFEST"; then
    sed -i.bak 's/<application/    <uses-permission android:name="android.permission.INTERNET" />\n    <uses-permission android:name="android.permission.CAMERA" />\n    <uses-permission android:name="android.permission.RECORD_AUDIO" />\n    <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />\n    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />\n    <uses-permission android:name="android.permission.BLUETOOTH" />\n    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />\n    <uses-permission android:name="android.permission.READ_PHONE_STATE" />\n    <uses-permission android:name="android.permission.CALL_PHONE" />\n    <uses-permission android:name="android.permission.MANAGE_OWN_CALLS" />\n    <application/' "$MANIFEST"
    rm -f "$MANIFEST.bak"
fi

if ! grep -q "vondic://oauth/callback" "$MANIFEST"; then
    sed -i.bak 's|</activity>|            <intent-filter android:autoVerify="true">\n                <action android:name="android.intent.action.VIEW" />\n                <category android:name="android.intent.category.DEFAULT" />\n                <category android:name="android.intent.category.BROWSABLE" />\n                <data android:scheme="vondic" android:host="oauth" android:pathPrefix="/callback" />\n            </intent-filter>\n        </activity>|' "$MANIFEST"
    rm -f "$MANIFEST.bak"
fi

echo ""
echo "Step 4/4: Patching iOS project..."

INFO_PLIST="$MOBILE_DIR/ios/${PROJECT_NAME}/Info.plist"
if [ -f "$INFO_PLIST" ] && ! grep -q "vondic" "$INFO_PLIST"; then
    sed -i.bak '/<\/dict>/i\
\t<key>CFBundleURLTypes</key>\
\t<array>\
\t\t<dict>\
\t\t\t<key>CFBundleURLName</key>\
\t\t\t<string>'${PACKAGE_NAME}'</string>\
\t\t\t<key>CFBundleURLSchemes</key>\
\t\t\t<array>\
\t\t\t\t<string>vondic</string>\
\t\t\t</array>\
\t\t</dict>\
\t</array>' "$INFO_PLIST"
    rm -f "$INFO_PLIST.bak"
fi

APPDELEGATE="$MOBILE_DIR/ios/${PROJECT_NAME}/AppDelegate.mm"
if [ -f "$APPDELEGATE" ] && ! grep -q "RCTLinkingManager" "$APPDELEGATE"; then
    sed -i.bak '1i\
#import <React/RCTLinkingManager.h>\
' "$APPDELEGATE"
    rm -f "$APPDELEGATE.bak"
    
    sed -i.bak '/@end/i\
- (BOOL)application:(UIApplication *)application openURL:(NSURL *)url options:(NSDictionary<UIApplicationOpenURLOptionsKey,id> *)options {\
  return [RCTLinkingManager application:application openURL:url options:options];\
}\
' "$APPDELEGATE"
    rm -f "$APPDELEGATE.bak"
fi

echo ""
echo "=========================================="
echo "Done! Native projects created."
echo "=========================================="
echo ""
echo "Next steps:"
echo "  1. cd mobile && npm install"
echo "  2. (Optional) Place google-services.json in mobile/android/app/"
echo "  3. ./scripts/build-android.sh"
echo ""
