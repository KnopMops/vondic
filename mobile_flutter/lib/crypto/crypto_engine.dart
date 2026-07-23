import 'dart:convert';
import 'dart:math';
import 'dart:typed_data';
import 'package:pointycastle/export.dart';
import 'package:pointycastle/api.dart' as pc;
import 'package:pointycastle/ecc/api.dart';

class CryptoEngine {
  // Secure Random generator
  static final Random _secureRandom = Random.secure();

  static Uint8List getRandomBytes(int length) {
    final bytes = Uint8List(length);
    for (int i = 0; i < length; i++) {
      bytes[i] = _secureRandom.nextInt(256);
    }
    return bytes;
  }

  // XOR utility
  static Uint8List _xor(Uint8List a, Uint8List b) {
    final out = Uint8List(16);
    for (int i = 0; i < 16; i++) {
      out[i] = a[i] ^ b[i];
    }
    return out;
  }

  // --- AES-256-IGE ---

  static Uint8List aesIgeEncrypt(Uint8List plaintext, Uint8List key, Uint8List iv) {
    if (plaintext.length % 16 != 0) {
      throw ArgumentError('Plaintext length must be a multiple of 16');
    }
    final cipher = AESEngine()..init(true, KeyParameter(key));
    final out = Uint8List(plaintext.length);

    Uint8List prevC = iv.sublist(0, 16);
    Uint8List prevP = iv.sublist(16, 32);

    for (int i = 0; i < plaintext.length; i += 16) {
      final block = plaintext.sublist(i, i + 16);
      final xored = _xor(block, prevC);
      final enc = Uint8List(16);
      cipher.processBlock(xored, 0, enc, 0);
      final cBlock = _xor(enc, prevP);

      out.setRange(i, i + 16, cBlock);
      prevC = cBlock;
      prevP = block;
    }
    return out;
  }

  static Uint8List aesIgeDecrypt(Uint8List ciphertext, Uint8List key, Uint8List iv) {
    if (ciphertext.length % 16 != 0) {
      throw ArgumentError('Ciphertext length must be a multiple of 16');
    }
    final cipher = AESEngine()..init(false, KeyParameter(key));
    final out = Uint8List(ciphertext.length);

    Uint8List prevC = iv.sublist(0, 16);
    Uint8List prevP = iv.sublist(16, 32);

    for (int i = 0; i < ciphertext.length; i += 16) {
      final cBlock = ciphertext.sublist(i, i + 16);
      final xored = _xor(cBlock, prevP);
      final dec = Uint8List(16);
      cipher.processBlock(xored, 0, dec, 0);
      final pBlock = _xor(dec, prevC);

      out.setRange(i, i + 16, pBlock);
      prevC = cBlock;
      prevP = pBlock;
    }
    return out;
  }

  // --- MTProto style message encryption/decryption (mtEncrypt/mtDecrypt) ---

  static String mtEncrypt(String plainText, Uint8List key) {
    final plainBytes = utf8.encode(plainText);
    
    // Create payload = 4 bytes length + plain text bytes
    final payload = Uint8List(4 + plainBytes.length);
    final view = ByteData.view(payload.buffer);
    view.setUint32(0, plainBytes.length, Endian.big);
    payload.setRange(4, payload.length, plainBytes);

    // Padding (multiple of 16)
    int padLen = (16 - (payload.length % 16)) % 16;
    if (padLen == 0) padLen = 16;
    final padding = getRandomBytes(padLen);

    final full = Uint8List(payload.length + padLen);
    full.setRange(0, payload.length, payload);
    full.setRange(payload.length, full.length, padding);

    // Encrypt with AES-IGE
    final iv = getRandomBytes(32);
    final encrypted = aesIgeEncrypt(full, key, iv);

    // Output is "e2e:" + base64(iv + encrypted)
    final out = Uint8List(iv.length + encrypted.length);
    out.setRange(0, iv.length, iv);
    out.setRange(iv.length, out.length, encrypted);

    return 'e2e:${base64.encode(out)}';
  }

  static String? mtDecrypt(String ciphertext, Uint8List key) {
    if (!ciphertext.startsWith('e2e:')) return ciphertext;
    
    final raw = base64.decode(ciphertext.substring(4));
    if (raw.length < 48) return null; // 32 bytes IV + 16 bytes min payload

    final iv = raw.sublist(0, 32);
    final encryptedData = raw.sublist(32);

    final decrypted = aesIgeDecrypt(encryptedData, key, iv);
    if (decrypted.length < 4) return null;

    final view = ByteData.view(decrypted.buffer, decrypted.offsetInBytes, decrypted.length);
    final len = view.getUint32(0, Endian.big);

    if (len <= 0 || len > 1000000 || 4 + len > decrypted.length) {
      return null;
    }

    final body = decrypted.sublist(4, 4 + len);
    try {
      final text = utf8.decode(body);
      if (text.startsWith('e2e:') || text.startsWith('mt:')) return null;
      return text;
    } catch (_) {
      return null;
    }
  }

  // --- AES-256-GCM ---

  static Uint8List aesGcmEncrypt(Uint8List plaintext, Uint8List key, Uint8List iv) {
    final cipher = GCMBlockCipher(AESEngine())
      ..init(true, AEADParameters(KeyParameter(key), 128, iv, Uint8List(0)));
    return cipher.process(plaintext);
  }

  static Uint8List? aesGcmDecrypt(Uint8List ciphertext, Uint8List key, Uint8List iv) {
    try {
      final cipher = GCMBlockCipher(AESEngine())
        ..init(false, AEADParameters(KeyParameter(key), 128, iv, Uint8List(0)));
      return cipher.process(ciphertext);
    } catch (_) {
      return null;
    }
  }

  // SHA-256
  static Uint8List sha256(Uint8List data) {
    final digest = SHA256Digest();
    return digest.process(data);
  }

  // --- ECDH P-256 ---

  static ECDomainParameters get _p256Params => ECCurve_secp256r1();

  static pc.AsymmetricKeyPair<ECPublicKey, ECPrivateKey> generateEcdhKeyPair() {
    final keyParams = ECKeyGeneratorParameters(_p256Params);
    
    // SecureRandom initialization using pointycastle SecureRandom wrapper
    final secureRandom = FortunaRandom();
    final seed = getRandomBytes(32);
    secureRandom.seed(pc.KeyParameter(seed));

    final generator = ECKeyGenerator()..init(ParametersWithRandom(keyParams, secureRandom));
    final pair = generator.generateKeyPair();
    return pc.AsymmetricKeyPair<ECPublicKey, ECPrivateKey>(
      pair.publicKey as ECPublicKey,
      pair.privateKey as ECPrivateKey,
    );
  }

  static Uint8List getRawPublicKey(ECPublicKey publicKey) {
    final q = publicKey.Q!;
    final xBytes = _bigIntToBytes(q.x!.toBigInteger()!, 32);
    final yBytes = _bigIntToBytes(q.y!.toBigInteger()!, 32);
    
    final pubKeyBytes = Uint8List(65);
    pubKeyBytes[0] = 0x04; // Uncompressed indicator
    pubKeyBytes.setRange(1, 33, xBytes);
    pubKeyBytes.setRange(33, 65, yBytes);
    return pubKeyBytes;
  }

  static ECPublicKey decodePublicKey(Uint8List pubKeyBytes) {
    final point = _p256Params.curve.decodePoint(pubKeyBytes);
    return ECPublicKey(point, _p256Params);
  }

  static Uint8List deriveSharedSecret(ECPrivateKey privateKey, ECPublicKey remotePublicKey) {
    final s = remotePublicKey.Q! * privateKey.d;
    return _bigIntToBytes(s!.x!.toBigInteger()!, 32);
  }

  // Helpers
  static Uint8List _bigIntToBytes(BigInt number, int length) {
    final bytes = Uint8List(length);
    var temp = number;
    for (var i = length - 1; i >= 0; i--) {
      bytes[i] = (temp & BigInt.from(0xff)).toInt();
      temp = temp >> 8;
    }
    return bytes;
  }

  static ECPrivateKey decodePrivateKey(Uint8List dBytes) {
    final d = _bytesToBigInt(dBytes);
    return ECPrivateKey(d, _p256Params);
  }

  static BigInt _bytesToBigInt(Uint8List bytes) {
    var result = BigInt.zero;
    for (var i = 0; i < bytes.length; i++) {
      result = (result << 8) | BigInt.from(bytes[i]);
    }
    return result;
  }
}
