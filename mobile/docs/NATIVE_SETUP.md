# Native Setup & Build Guide

This guide covers all native changes required for **iOS** and **Android** to support OAuth deeplinks, push notifications (FCM/APNs), and incoming call handling.

---

## 1. Initial Project Bootstrap

If you are starting from scratch:

```bash
npx react-native@0.73.1 init VondicMobile --template react-native-template-typescript
cd VondicMobile
```

Then copy our `mobile/src/` into the project root and overwrite `package.json`, `babel.config.js`, `tsconfig.json`, etc.

Install pods & dependencies:

```bash
npm install
# iOS
cd ios && pod install && cd ..
# Android
# No extra step needed after npm install
```

---

## 2. OAuth Deeplinks

### Android

**File:** `android/app/src/main/AndroidManifest.xml`

Inside `<activity android:name=".MainActivity" ...>`, add this `<intent-filter>`:

```xml
<intent-filter android:autoVerify="true">
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data
        android:scheme="vondic"
        android:host="oauth"
        android:pathPrefix="/callback" />
</intent-filter>
```

**File:** `android/app/src/main/java/com/vondicmobile/MainActivity.java` (or `.kt`)

Ensure `onCreate` and `onNewIntent` pass the intent to React Native:

```java
import android.content.Intent;
import android.os.Bundle;

@Override
protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    // For cold-start deeplinks
    if (getIntent() != null) {
        setIntent(getIntent());
    }
}

@Override
public void onNewIntent(Intent intent) {
    super.onNewIntent(intent);
    setIntent(intent);
}
```

### iOS

**File:** `ios/VondicMobile/Info.plist`

Add URL scheme:

```xml
<key>CFBundleURLTypes</key>
<array>
    <dict>
        <key>CFBundleURLName</key>
        <string>com.vondic.mobile</string>
        <key>CFBundleURLSchemes</key>
        <array>
            <string>vondic</string>
        </array>
    </dict>
</array>
```

**File:** `ios/VondicMobile/AppDelegate.mm`

Add import and handler:

```objc
#import <React/RCTLinkingManager.h>

// Inside @implementation AppDelegate

- (BOOL)application:(UIApplication *)application
            openURL:(NSURL *)url
            options:(NSDictionary<UIApplicationOpenURLOptionsKey,id> *)options
{
  return [RCTLinkingManager application:application openURL:url options:options];
}

// For iOS 8.x and older (if needed)
- (BOOL)application:(UIApplication *)application
    openURL:(NSURL *)url
    sourceApplication:(NSString *)sourceApplication
    annotation:(id)annotation
{
  return [RCTLinkingManager application:application openURL:url
                      sourceApplication:sourceApplication annotation:annotation];
}
```

---

## 3. Push Notifications (FCM + APNs)

### Step 3.1 Install Firebase packages

Already included in `package.json`:

```bash
npm install @react-native-firebase/app @react-native-firebase/messaging
```

### Step 3.2 Android Firebase Setup

1. Go to [Firebase Console](https://console.firebase.google.com/) → Project Settings → Add Android app
2. Download `google-services.json` and place it at:
   ```
   android/app/google-services.json
   ```

**File:** `android/build.gradle` (project-level)

Add in `dependencies` section:

```gradle
classpath 'com.google.gms:google-services:4.4.0'
```

**File:** `android/app/build.gradle`

At the very bottom, add:

```gradle
apply plugin: 'com.google.gms.google-services'
```

**File:** `android/app/src/main/AndroidManifest.xml`

Inside `<application>`, add the messaging service:

```xml
<service
    android:name="io.invertase.firebase.messaging.ReactNativeFirebaseMessagingService"
    android:exported="false">
    <intent-filter>
        <action android:name="com.google.firebase.MESSAGING_EVENT" />
    </intent-filter>
</service>

<!-- Notification channel for calls -->
<service android:name="io.wazo.callkeep.VoiceConnectionService"
    android:label="Vondic"
    android:permission="android.permission.BIND_TELECOM_CONNECTION_SERVICE"
    android:exported="true">
    <intent-filter>
        <action android:name="android.telecom.ConnectionService" />
    </intent-filter>
</service>

<receiver android:name="io.wazo.callkeep.RNCallKeepBroadcastReceiver" android:exported="false">
    <intent-filter>
        <action android:name="android.intent.action.PHONE_STATE" />
    </intent-filter>
</receiver>
```

Add permissions before `<application>`:

```xml
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
<uses-permission android:name="android.permission.READ_PHONE_STATE" />
<uses-permission android:name="android.permission.CALL_PHONE" />
<uses-permission android:name="android.permission.MANAGE_OWN_CALLS" />
```

### Step 3.3 iOS Firebase / APNs Setup

1. In Firebase Console → Project Settings → Add iOS app
2. Download `GoogleService-Info.plist` and add it to `ios/VondicMobile/` in Xcode (check "Copy items if needed")

**File:** `ios/VondicMobile/AppDelegate.mm`

Add at the top:

```objc
#import <Firebase.h>
```

In `didFinishLaunchingWithOptions`, at the very beginning:

```objc
[FIRApp configure];
[FIRMessaging messaging].delegate = self;
```

Add push notification delegate methods:

```objc
// Request push permission
- (void)application:(UIApplication *)application didRegisterForRemoteNotificationsWithDeviceToken:(NSData *)deviceToken {
  [FIRMessaging messaging].APNSToken = deviceToken;
  [RNCPushNotificationIOS didRegisterForRemoteNotificationsWithDeviceToken:deviceToken];
}

- (void)application:(UIApplication *)application didFailToRegisterForRemoteNotificationsWithError:(NSError *)error {
  NSLog(@"Push registration failed: %@", error);
}

// Required for notification handling
- (void)application:(UIApplication *)application didReceiveRemoteNotification:(NSDictionary *)userInfo fetchCompletionHandler:(void (^)(UIBackgroundFetchResult))completionHandler {
  completionHandler(UIBackgroundFetchResultNoData);
}
```

**File:** `ios/VondicMobile/Info.plist`

Add background modes for VoIP:

```xml
<key>UIBackgroundModes</key>
<array>
    <string>fetch</string>
    <string>remote-notification</string>
    <string>voip</string>
</array>
```

**File:** `ios/VondicMobile/VondicMobile.entitlements` (create if missing)

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>aps-environment</key>
    <string>production</string>
</dict>
</plist>
```

> For development builds use `<string>development</string>` instead.

### Step 3.4 Re-install pods

```bash
cd ios && pod install && cd ..
```

---

## 4. react-native-callkeep (Incoming Call UI)

### Android Extra Setup

**File:** `android/app/src/main/res/values/strings.xml`

Make sure `app_name` exists:

```xml
<string name="app_name">Vondic</string>
```

**File:** `android/app/src/main/AndroidManifest.xml`

The service and receiver are already added in Section 3.2 above.

### iOS Extra Setup

CallKeep should work after `pod install` without extra native changes. Ensure `PushKit` token forwarding is implemented if you want faster VoIP pushes:

**File:** `ios/VondicMobile/AppDelegate.mm`

```objc
#import <PushKit/PushKit.h>

// Implement PKPushRegistryDelegate if you use VoIP pushes
```

For simplicity, we use FCM data-messages to trigger CallKit (no PushKit required).

---

## 5. Build Instructions

### Android

#### Debug APK

```bash
npx react-native run-android
```

#### Release APK

```bash
cd android
./gradlew assembleRelease
```

Output: `android/app/build/outputs/apk/release/app-release.apk`

#### Release AAB (Google Play)

```bash
cd android
./gradlew bundleRelease
```

Output: `android/app/build/outputs/bundle/release/app-release.aab`

**Signing:** Create `android/app/my-upload-key.keystore` and configure `android/gradle.properties`:

```properties
MYAPP_UPLOAD_STORE_FILE=my-upload-key.keystore
MYAPP_UPLOAD_KEY_ALIAS=my-key-alias
MYAPP_UPLOAD_STORE_PASSWORD=*****
MYAPP_UPLOAD_KEY_PASSWORD=*****
```

In `android/app/build.gradle`:

```gradle
android {
    signingConfigs {
        release {
            storeFile file(MYAPP_UPLOAD_STORE_FILE)
            storePassword MYAPP_UPLOAD_STORE_PASSWORD
            keyAlias MYAPP_UPLOAD_KEY_ALIAS
            keyPassword MYAPP_UPLOAD_KEY_PASSWORD
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled true
            proguardFiles getDefaultProguardFile("proguard-android.txt"), "proguard-rules.pro"
        }
    }
}
```

### iOS

#### Debug on Simulator / Device

```bash
npx react-native run-ios
# Specific device
npx react-native run-ios --device "iPhone 15"
```

#### Release Archive (TestFlight / App Store)

1. Open `ios/VondicMobile.xcworkspace` in Xcode
2. Select **Any iOS Device (arm64)** as target
3. Product → Archive
4. In Organizer → Distribute App → App Store Connect → Upload

**Required Provisioning Profiles:**
- iOS Distribution certificate
- App Store provisioning profile with Push Notifications enabled
- If using VoIP: enable **Push Notifications** and **Background Modes → Voice over IP** in App ID capabilities

---

## 6. Environment Variables

Copy `.env.example` to `.env` and fill in your production URLs before building release:

```bash
cp .env.example .env
```

> For CI/CD, inject env variables via build scripts rather than committing `.env`.

---

## 7. Common Issues

### Android: `Duplicate class` with Firebase

Ensure `android/build.gradle` uses compatible Firebase BOM:

```gradle
ext {
    firebaseMessagingVersion = "23.4.0"
}
```

### iOS: `ld: framework not found Firebase`

Run `cd ios && pod deintegrate && pod install`.

### iOS: CallKit not showing incoming call

- Verify `aps-environment` entitlement is set
- Ensure `UIBackgroundModes` includes `voip`
- Check that APNs cert is uploaded to Firebase Console (if using FCM for iOS)

### Android: `ConnectionService` not working

- Ensure `MANAGE_OWN_CALLS` permission is declared
- Go to Android Settings → Apps → Vondic → Permissions → Phone → Allow
- Some OEMs (Xiaomi, Huawei) require additional auto-start permissions
