/**
 * Web Crypto API polyfill for React Native using pure JS (@noble/curves + @noble/ciphers).
 * Replaces react-native-quick-crypto which crashes on Android.
 */
import {p256} from '@noble/curves/p256';
import {sha256} from '@noble/hashes/sha256';
import {gcm as aesGcm} from '@noble/ciphers/aes';

export interface CryptoKey {
  type: 'private' | 'public' | 'secret';
  algorithm: {name: string; namedCurve?: string; length?: number};
  usages: string[];
  _raw: Uint8Array;
}

export interface CryptoKeyPair {
  privateKey: CryptoKey;
  publicKey: CryptoKey;
}

let insecureWarned = false;

function getRandomValues<T extends Uint8Array>(arr: T): T {
  const globalCrypto =
    typeof globalThis === 'object' && globalThis != null
      ? (globalThis as any).crypto
      : undefined;

  if (globalCrypto && typeof globalCrypto.getRandomValues === 'function') {
    // Make sure we don't call back into this polyfill and recurse.
    if (globalCrypto.getRandomValues !== getRandomValues) {
      return globalCrypto.getRandomValues(arr);
    }
  }

  if (!insecureWarned) {
    console.warn(
      '[webcrypto-polyfill] Secure RNG not available, falling back to Math.random()',
    );
    insecureWarned = true;
  }

  for (let i = 0, r = 0; i < arr.length; i++) {
    if ((i & 0x03) === 0) {
      r = Math.floor(Math.random() * 0x100000000);
    }
    arr[i] = (r >>> ((i & 0x03) << 3)) & 0xff;
  }
  return arr;
}

const subtlePolyfill = {
  async generateKey(
    algorithm: {name: string; namedCurve?: string; length?: number},
    _extractable: boolean,
    keyUsages: string[],
  ): Promise<CryptoKeyPair | CryptoKey> {
    if (algorithm.name === 'ECDH' && algorithm.namedCurve === 'P-256') {
      const privateKeyBytes = getRandomValues(new Uint8Array(32));
      const publicKeyBytes = p256.getPublicKey(privateKeyBytes, false); // uncompressed 65 bytes
      return {
        privateKey: {
          type: 'private',
          algorithm,
          usages: keyUsages,
          _raw: privateKeyBytes,
        },
        publicKey: {
          type: 'public',
          algorithm,
          usages: [],
          _raw: publicKeyBytes,
        },
      };
    }
    if (algorithm.name === 'AES-GCM' && algorithm.length === 256) {
      return {
        type: 'secret',
        algorithm,
        usages: keyUsages,
        _raw: getRandomValues(new Uint8Array(32)),
      };
    }
    throw new Error('Only ECDH P-256 and AES-GCM-256 are supported');
  },

  async exportKey(format: string, key: CryptoKey): Promise<ArrayBuffer> {
    if (format !== 'raw') throw new Error('Only raw format supported');
    return key._raw.slice().buffer;
  },

  async importKey(
    format: string,
    keyData: ArrayBuffer | Uint8Array,
    algorithm: {name: string; namedCurve?: string; length?: number},
    _extractable: boolean,
    keyUsages: string[],
  ): Promise<CryptoKey> {
    if (format !== 'raw') throw new Error('Only raw format supported');
    const raw = keyData instanceof Uint8Array ? keyData : new Uint8Array(keyData);
    if (algorithm.name === 'ECDH' && algorithm.namedCurve === 'P-256') {
      return {
        type: 'public',
        algorithm,
        usages: keyUsages,
        _raw: raw,
      };
    }
    if (algorithm.name === 'AES-GCM' && algorithm.length === 256) {
      return {
        type: 'secret',
        algorithm,
        usages: keyUsages,
        _raw: raw,
      };
    }
    throw new Error('Only ECDH P-256 and AES-GCM-256 are supported');
  },

  async deriveBits(
    algorithm: {name: string; public: CryptoKey},
    baseKey: CryptoKey,
    _length: number,
  ): Promise<ArrayBuffer> {
    if (algorithm.name !== 'ECDH') throw new Error('Only ECDH is supported');
    const privateKey = baseKey._raw;
    const publicKey = algorithm.public._raw;
    const shared = p256.getSharedSecret(privateKey, publicKey);
    const xCoord = shared.slice(1, 33);
    return xCoord.buffer.slice(xCoord.byteOffset, xCoord.byteOffset + xCoord.byteLength);
  },

  async encrypt(
    algorithm: {name: string; iv: Uint8Array},
    key: CryptoKey,
    data: ArrayBuffer | Uint8Array,
  ): Promise<ArrayBuffer> {
    if (algorithm.name !== 'AES-GCM') throw new Error('Only AES-GCM is supported');
    const plaintext = new Uint8Array(data);
    const cipher = aesGcm(key._raw, algorithm.iv);
    const encrypted = cipher.encrypt(plaintext);
    return encrypted.buffer.slice(encrypted.byteOffset, encrypted.byteOffset + encrypted.byteLength);
  },

  async decrypt(
    algorithm: {name: string; iv: Uint8Array},
    key: CryptoKey,
    data: ArrayBuffer | Uint8Array,
  ): Promise<ArrayBuffer> {
    if (algorithm.name !== 'AES-GCM') throw new Error('Only AES-GCM is supported');
    const ciphertext = new Uint8Array(data);
    const cipher = aesGcm(key._raw, algorithm.iv);
    const decrypted = cipher.decrypt(ciphertext);
    return decrypted.buffer.slice(decrypted.byteOffset, decrypted.byteOffset + decrypted.byteLength);
  },

  async digest(algorithm: string, data: ArrayBuffer | Uint8Array): Promise<ArrayBuffer> {
    if (algorithm !== 'SHA-256') throw new Error('Only SHA-256 is supported');
    const hash = sha256(new Uint8Array(data));
    return hash.buffer.slice(hash.byteOffset, hash.byteOffset + hash.byteLength);
  },
};

export const cryptoPolyfill = {
  getRandomValues,
};

export {subtlePolyfill as subtle};
