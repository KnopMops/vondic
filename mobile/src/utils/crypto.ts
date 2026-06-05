/**
 * AES-256-IGE encryption (Telegram-like MTProto style)
 * Pure JS implementation for React Native compatibility.
 * Full compatibility with desktop/web Vondic clients.
 *
 * NOTE: react-native-quick-crypto causes native crashes on Android.
 * We use @noble/curves (pure JS) for Web Crypto API operations.
 */

import {cryptoPolyfill, subtle} from './webcrypto-polyfill';

export const crypto = cryptoPolyfill;
export {subtle};

export const base64FromBytes = (bytes: Uint8Array) => {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

export const bytesFromBase64 = (base64: string) => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

const xorBlock = (a: Uint8Array, b: Uint8Array) => {
  const out = new Uint8Array(16);
  for (let i = 0; i < 16; i++) {
    out[i] = a[i] ^ b[i];
  }
  return out;
};

const sBox = new Uint8Array([
  99, 124, 119, 123, 242, 107, 111, 197, 48, 1, 103, 43, 254, 215, 171, 118,
  202, 130, 201, 125, 250, 89, 71, 240, 173, 212, 162, 175, 156, 164, 114, 192,
  183, 253, 147, 38, 54, 63, 247, 204, 52, 165, 229, 241, 113, 216, 49, 21, 4,
  199, 35, 195, 24, 150, 5, 154, 7, 18, 128, 226, 235, 39, 178, 117, 9, 131, 44,
  26, 27, 110, 90, 160, 82, 59, 214, 179, 41, 227, 47, 132, 83, 209, 0, 237, 32,
  252, 177, 91, 106, 203, 190, 57, 74, 76, 88, 207, 208, 239, 170, 251, 67, 77,
  51, 133, 69, 249, 2, 127, 80, 60, 159, 168, 81, 163, 64, 143, 146, 157, 56,
  245, 188, 182, 218, 33, 16, 255, 243, 210, 205, 12, 19, 236, 95, 151, 68, 23,
  196, 167, 126, 61, 100, 93, 25, 115, 96, 129, 79, 220, 34, 42, 144, 136, 70,
  238, 184, 20, 222, 94, 11, 219, 224, 50, 58, 10, 73, 6, 36, 92, 194, 211, 172,
  98, 145, 149, 228, 121, 231, 200, 55, 109, 141, 213, 78, 169, 108, 86, 244,
  234, 101, 122, 174, 8, 186, 120, 37, 46, 28, 166, 180, 198, 232, 221, 116, 31,
  75, 189, 139, 138, 112, 62, 181, 102, 72, 3, 246, 14, 97, 53, 87, 185, 134,
  193, 29, 158, 225, 248, 152, 17, 105, 217, 142, 148, 155, 30, 135, 233, 206,
  85, 40, 223, 140, 161, 137, 13, 191, 230, 66, 104, 65, 153, 45, 15, 176, 84,
  187, 22,
]);

const invSBox = new Uint8Array([
  82, 9, 106, 213, 48, 54, 165, 56, 191, 64, 163, 158, 129, 243, 215, 251, 124,
  227, 57, 130, 155, 47, 255, 135, 52, 142, 67, 68, 196, 222, 233, 203, 84, 123,
  148, 50, 166, 194, 35, 61, 238, 76, 149, 11, 66, 250, 195, 78, 8, 46, 161,
  102, 40, 217, 36, 178, 118, 91, 162, 73, 109, 139, 209, 37, 114, 248, 246,
  100, 134, 104, 152, 22, 212, 164, 92, 204, 93, 101, 182, 146, 108, 112, 72,
  80, 253, 237, 185, 218, 94, 21, 70, 87, 167, 141, 157, 132, 144, 216, 171, 0,
  140, 188, 211, 10, 247, 228, 88, 5, 184, 179, 69, 6, 208, 44, 30, 143, 202,
  63, 15, 2, 193, 175, 189, 3, 1, 19, 138, 107, 58, 145, 17, 65, 79, 103, 220,
  234, 151, 242, 207, 206, 240, 180, 230, 115, 150, 172, 116, 34, 231, 173, 53,
  133, 226, 249, 55, 232, 28, 117, 223, 110, 71, 241, 26, 113, 29, 41, 197, 137,
  111, 183, 98, 14, 170, 24, 190, 27, 252, 86, 62, 75, 198, 210, 121, 32, 154,
  219, 192, 254, 120, 205, 90, 244, 31, 221, 168, 51, 136, 7, 199, 49, 177, 18,
  16, 89, 39, 128, 236, 95, 96, 81, 127, 169, 25, 181, 74, 13, 45, 229, 122,
  159, 147, 201, 156, 239, 160, 224, 59, 77, 174, 42, 245, 176, 200, 235, 187,
  60, 131, 83, 153, 97, 23, 43, 4, 126, 186, 119, 214, 38, 225, 105, 20, 99, 85,
  33, 12, 125,
]);

const rcon = new Uint8Array([
  0, 1, 2, 4, 8, 16, 32, 64, 128, 27, 54, 108, 216, 171, 77, 154,
]);

const subWord = (word: Uint8Array) => {
  const out = new Uint8Array(4);
  for (let i = 0; i < 4; i++) {
    out[i] = sBox[word[i]];
  }
  return out;
};

const rotWord = (word: Uint8Array) => {
  return new Uint8Array([word[1], word[2], word[3], word[0]]);
};

const keyExpansion = (key: Uint8Array) => {
  const Nk = 8;
  const Nb = 4;
  const Nr = 14;
  const w = new Uint8Array(Nb * (Nr + 1) * 4);
  for (let i = 0; i < 32; i++) {
    w[i] = key[i];
  }
  let temp = new Uint8Array(4);
  for (let i = Nk; i < Nb * (Nr + 1); i++) {
    temp = w.slice((i - 1) * 4, i * 4);
    if (i % Nk === 0) {
      temp = subWord(rotWord(temp));
      temp[0] ^= rcon[i / Nk];
    } else if (i % Nk === 4) {
      temp = subWord(temp);
    }
    for (let j = 0; j < 4; j++) {
      w[i * 4 + j] = w[(i - Nk) * 4 + j] ^ temp[j];
    }
  }
  return w;
};

const addRoundKey = (state: Uint8Array, roundKey: Uint8Array) => {
  for (let i = 0; i < 16; i++) {
    state[i] ^= roundKey[i];
  }
};

const subBytes = (state: Uint8Array) => {
  for (let i = 0; i < 16; i++) {
    state[i] = sBox[state[i]];
  }
};

const invSubBytes = (state: Uint8Array) => {
  for (let i = 0; i < 16; i++) {
    state[i] = invSBox[state[i]];
  }
};

const shiftRows = (state: Uint8Array) => {
  const t = state.slice();
  state[1] = t[5];
  state[5] = t[9];
  state[9] = t[13];
  state[13] = t[1];
  state[2] = t[10];
  state[6] = t[14];
  state[10] = t[2];
  state[14] = t[6];
  state[3] = t[15];
  state[7] = t[3];
  state[11] = t[7];
  state[15] = t[11];
};

const invShiftRows = (state: Uint8Array) => {
  const t = state.slice();
  state[1] = t[13];
  state[5] = t[1];
  state[9] = t[5];
  state[13] = t[9];
  state[2] = t[10];
  state[6] = t[14];
  state[10] = t[2];
  state[14] = t[6];
  state[3] = t[7];
  state[7] = t[11];
  state[11] = t[15];
  state[15] = t[3];
};

const xtime = (x: number) => ((x << 1) ^ (x & 0x80 ? 0x1b : 0)) & 0xff;

const mixColumns = (state: Uint8Array) => {
  for (let c = 0; c < 4; c++) {
    const i = c * 4;
    const a0 = state[i];
    const a1 = state[i + 1];
    const a2 = state[i + 2];
    const a3 = state[i + 3];
    const t = a0 ^ a1 ^ a2 ^ a3;
    const u = a0;
    state[i] ^= t ^ xtime(a0 ^ a1);
    state[i + 1] ^= t ^ xtime(a1 ^ a2);
    state[i + 2] ^= t ^ xtime(a2 ^ a3);
    state[i + 3] ^= t ^ xtime(a3 ^ u);
  }
};

const mul = (a: number, b: number) => {
  let res = 0;
  let aa = a;
  let bb = b;
  for (let i = 0; i < 8; i++) {
    if (bb & 1) res ^= aa;
    const hi = aa & 0x80;
    aa = (aa << 1) & 0xff;
    if (hi) aa ^= 0x1b;
    bb >>= 1;
  }
  return res;
};

const invMixColumns = (state: Uint8Array) => {
  for (let c = 0; c < 4; c++) {
    const i = c * 4;
    const a0 = state[i];
    const a1 = state[i + 1];
    const a2 = state[i + 2];
    const a3 = state[i + 3];
    state[i] = mul(a0, 14) ^ mul(a1, 11) ^ mul(a2, 13) ^ mul(a3, 9);
    state[i + 1] = mul(a0, 9) ^ mul(a1, 14) ^ mul(a2, 11) ^ mul(a3, 13);
    state[i + 2] = mul(a0, 13) ^ mul(a1, 9) ^ mul(a2, 14) ^ mul(a3, 11);
    state[i + 3] = mul(a0, 11) ^ mul(a1, 13) ^ mul(a2, 9) ^ mul(a3, 14);
  }
};

const aesEncryptBlock = (block: Uint8Array, expandedKey: Uint8Array) => {
  const state = block.slice();
  addRoundKey(state, expandedKey.slice(0, 16));
  for (let round = 1; round < 14; round++) {
    subBytes(state);
    shiftRows(state);
    mixColumns(state);
    addRoundKey(state, expandedKey.slice(round * 16, round * 16 + 16));
  }
  subBytes(state);
  shiftRows(state);
  addRoundKey(state, expandedKey.slice(224, 240));
  return state;
};

const aesDecryptBlock = (block: Uint8Array, expandedKey: Uint8Array) => {
  const state = block.slice();
  addRoundKey(state, expandedKey.slice(224, 240));
  for (let round = 13; round > 0; round--) {
    invShiftRows(state);
    invSubBytes(state);
    addRoundKey(state, expandedKey.slice(round * 16, round * 16 + 16));
    invMixColumns(state);
  }
  invShiftRows(state);
  invSubBytes(state);
  addRoundKey(state, expandedKey.slice(0, 16));
  return state;
};

export const aesIgeEncrypt = (data: Uint8Array, key: Uint8Array, iv: Uint8Array) => {
  const expanded = keyExpansion(key);
  let prevC = iv.slice(0, 16);
  let prevP = iv.slice(16, 32);
  const out = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i += 16) {
    const block = data.slice(i, i + 16);
    const xored = xorBlock(block, prevC);
    const enc = aesEncryptBlock(xored, expanded);
    const cBlock = xorBlock(enc, prevP);
    out.set(cBlock, i);
    prevC = cBlock;
    prevP = block;
  }
  return out;
};

export const aesIgeDecrypt = (data: Uint8Array, key: Uint8Array, iv: Uint8Array) => {
  const expanded = keyExpansion(key);
  let prevC = iv.slice(0, 16);
  let prevP = iv.slice(16, 32);
  const out = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i += 16) {
    const cBlock = data.slice(i, i + 16);
    const xored = xorBlock(cBlock, prevP);
    const dec = aesDecryptBlock(xored, expanded);
    const pBlock = xorBlock(dec, prevC);
    out.set(pBlock, i);
    prevC = cBlock;
    prevP = pBlock;
  }
  return out;
};

export const mtEncrypt = (plain: string, key: Uint8Array) => {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(plain);
  const lengthBytes = new Uint8Array(4);
  const view = new DataView(lengthBytes.buffer);
  view.setUint32(0, bytes.length, false);
  const payload = new Uint8Array(4 + bytes.length);
  payload.set(lengthBytes, 0);
  payload.set(bytes, 4);
  let padLen = (16 - (payload.length % 16)) % 16;
  if (padLen === 0) padLen = 16;
  const padding = new Uint8Array(padLen);
  crypto.getRandomValues(padding);
  const full = new Uint8Array(payload.length + padLen);
  full.set(payload, 0);
  full.set(padding, payload.length);
  const iv = new Uint8Array(32);
  crypto.getRandomValues(iv);
  const encrypted = aesIgeEncrypt(full, key, iv);
  const out = new Uint8Array(iv.length + encrypted.length);
  out.set(iv, 0);
  out.set(encrypted, iv.length);
  return `e2e:${base64FromBytes(out)}`;
};

export const mtDecrypt = (ciphertext: string, key: Uint8Array) => {
  if (!ciphertext.startsWith('e2e:')) return ciphertext;
  const raw = bytesFromBase64(ciphertext.slice(4));
  if (raw.length < 48) return null;
  const iv = raw.slice(0, 32);
  const data = raw.slice(32);
  const decrypted = aesIgeDecrypt(data, key, iv);
  if (decrypted.length < 4) return null;
  const view = new DataView(
    decrypted.buffer,
    decrypted.byteOffset,
    decrypted.byteLength,
  );
  const len = view.getUint32(0, false);
  const body = decrypted.slice(4, 4 + len);
  const decoder = new TextDecoder();
  return decoder.decode(body);
};
