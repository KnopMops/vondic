# Vondic Mobile

React Native 0.73+ mobile application for Vondic messenger.

## Stack

- React Native 0.73 (no Expo)
- TypeScript
- Redux Toolkit + Zustand
- React Navigation (Native Stack + Bottom Tabs)
- Socket.IO client
- react-native-webrtc (calls)
- react-native-quick-crypto (Web Crypto API polyfill)
- react-native-incall-manager (audio routing)
- react-native-inappbrowser-reborn (OAuth)
- react-native-config (env variables)
- @react-native-firebase/messaging + react-native-callkeep (push calls)

## Quick Start

```bash
cd mobile
npm install

# iOS
cd ios && pod install && cd ..
npx react-native run-ios

# Android
npx react-native run-android
```

## Environment Variables

Variables use the **same names** as desktop (`.env.desktop`):

```bash
cp .env.example .env
# Fill in VONDIC_OAUTH_CLIENT_ID, VONDIC_OAUTH_CLIENT_SECRET, TURN credentials, etc.
```

| Variable | Source | Description |
|----------|--------|-------------|
| `VONDIC_BACKEND_URL` | Desktop `.env.desktop` | Backend API URL |
| `VONDIC_OAUTH_CLIENT_ID` | Desktop `.env.desktop` | OAuth client ID |
| `VONDIC_OAUTH_CLIENT_SECRET` | Desktop `.env.desktop` | OAuth client secret |
| `VONDIC_OAUTH_REDIRECT_URI` | Desktop `.env.desktop` | Mobile deeplink (`vondic://oauth/callback`) |
| `NEXT_PUBLIC_TURN_URL` | Desktop `.env.desktop` | External TURN server |
| `NEXT_PUBLIC_TURN_URLS` | Desktop `.env.desktop` | Comma-separated TURN URLs |
| `NEXT_PUBLIC_TURN_USERNAME` | Desktop `.env.desktop` | TURN username |
| `NEXT_PUBLIC_TURN_PASSWORD` | Desktop `.env.desktop` | TURN password |
| `NEXT_PUBLIC_INTERNAL_TURN_HOST` | Desktop `.env.desktop` | Internal TURN host (default: `192.168.120.248`) |
| `NEXT_PUBLIC_FORCE_RELAY` | Desktop `.env.desktop` | Force TURN relay (`true`/`false`) |

## OAuth Flow (same as Desktop)

1. `LoginScreen` opens `/oauth/authorize?client_id=...&redirect_uri=vondic://oauth/callback&response_type=code&state=...` via **InAppBrowser**
2. User authorizes in Vondic OAuth page
3. Backend redirects to `vondic://oauth/callback?code=...&state=...`
4. `useDeepLinks()` catches the deeplink, verifies `state`, exchanges `code` for tokens via `/oauth/token`
5. Tokens saved to Keychain, user state updated in Redux

## Native Setup

See **[docs/NATIVE_SETUP.md](docs/NATIVE_SETUP.md)** for:
- Deeplink configuration (`vondic://oauth/callback`)
- Firebase / APNs push setup
- CallKit / ConnectionService incoming call UI
- Release signing & build instructions

## Architecture

```
src/
  api/           # API client with auto-refresh tokens
  components/    # UI components
  screens/       # React Navigation screens
  navigation/    # Stack/Tab navigators + deep link handling
  hooks/         # Chat, Channels, Groups, Communities, DeepLinks
  services/      # Socket, WebRTC, CallManager, Push
  store/         # Redux store + Zustand callStore
  utils/         # Crypto (AES-256-IGE), E2EE key sync
  types/         # TypeScript interfaces
  constants/     # Config (env vars via react-native-config)
```

## E2EE Compatibility

Mobile uses the **exact same** AES-256-IGE implementation as desktop/web:
- `src/utils/crypto.ts` — pure JS AES-256-IGE (`mtEncrypt` / `mtDecrypt`)
- Key exchange via ECDH P-256 over Socket.IO
- Keys backed up to server encrypted with AES-GCM
- `AsyncStorage` replaces `localStorage` for key persistence

## WebRTC / Calls

- `react-native-webrtc` provides `RTCPeerConnection`, `MediaStream`, `RTCView`
- `react-native-incall-manager` handles audio routing (speaker/earpiece)
- **TURN configuration** reads from the same env variables as desktop (`NEXT_PUBLIC_TURN_*`)
- Call signaling uses the same Socket.IO events as desktop
- Incoming calls trigger **CallKit (iOS)** or **ConnectionService (Android)** via `react-native-callkeep`
- Push notification data messages wake the app even when killed

## Push Notifications

- **Messages:** FCM/APNs standard notification
- **Incoming Calls:** Data-only push → `PushService` displays native call UI via CallKit/ConnectionService
- Token is registered on backend at `/api/v1/devices/register`

## License

Proprietary — Vondic Team
