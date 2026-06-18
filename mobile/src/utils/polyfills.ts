/**
 * React Native/Hermes polyfills that must load before any crypto/E2EE code runs.
 */

// 1. Secure randomness for @noble/curves and our Web Crypto polyfill.
import 'react-native-get-random-values';

// 2. TextEncoder/TextDecoder — Hermes does not provide these in release builds.
import 'text-encoding';

// 3. base64 encode/decode — Hermes does not provide btoa/atob.
import {encode as btoa, decode as atob} from 'base-64';

if (typeof global.btoa !== 'function') {
  (global as any).btoa = btoa;
}
if (typeof global.atob !== 'function') {
  (global as any).atob = atob;
}

// 4. Sanity-check that everything is wired before the app mounts.
try {
  const sample = new Uint8Array([1, 2, 3, 4]);
  const encoded = global.btoa(String.fromCharCode(...sample));
  const decoded = global.atob(encoded);
  const roundTrip = new Uint8Array(decoded.length);
  for (let i = 0; i < decoded.length; i++) {
    roundTrip[i] = decoded.charCodeAt(i);
  }
  if (roundTrip.length !== sample.length || roundTrip.some((v, i) => v !== sample[i])) {
    console.warn('[polyfills] btoa/atob round-trip failed');
  }
} catch (e) {
  console.warn('[polyfills] btoa/atob sanity check failed:', e);
}
