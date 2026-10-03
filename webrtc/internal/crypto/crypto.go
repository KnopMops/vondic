package crypto

import (
	"crypto/aes"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/binary"
	"encoding/hex"
	"errors"
	"strconv"
	"strings"

	"golang.org/x/crypto/argon2"
)

type CryptoService struct {
	mtKey []byte
	mtIV  []byte
}

func NewCryptoService(encryptionKey string) *CryptoService {
	key, iv := deriveMTProtoKeyIV(encryptionKey)
	return &CryptoService{
		mtKey: key,
		mtIV:  iv,
	}
}

func deriveMTProtoKeyIV(keyValue string) ([]byte, []byte) {
	keyBytes := []byte(keyValue)
	if decoded, err := base64.URLEncoding.DecodeString(keyValue); err == nil && len(decoded) >= 32 {
		keyBytes = decoded
	} else if decoded, err := base64.RawURLEncoding.DecodeString(keyValue); err == nil && len(decoded) >= 32 {
		keyBytes = decoded
	}

	hKey := sha256.Sum256(append(keyBytes, []byte("key")...))
	hIV := sha256.Sum256(append(keyBytes, []byte("iv")...))

	return hKey[:], hIV[:]
}

func (c *CryptoService) EncryptPayload(value string) string {
	if value == "" {
		return ""
	}
	if strings.HasPrefix(value, "e2e:") || strings.HasPrefix(value, "encproxy:") {
		return value
	}
	enc, err := c.mtprotoEncrypt([]byte(value))
	if err != nil {
		return value
	}
	return enc
}

func (c *CryptoService) DecryptPayload(value string) string {
	if value == "" {
		return ""
	}
	if strings.HasPrefix(value, "e2e:") || strings.HasPrefix(value, "encproxy:") {
		return value
	}
	if strings.HasPrefix(value, "mt:") {
		dec, err := c.mtprotoDecrypt(value)
		if err == nil && dec != nil {
			return string(dec)
		}
	}
	return value
}

func (c *CryptoService) mtprotoEncrypt(data []byte) (string, error) {
	block, err := aes.NewCipher(c.mtKey)
	if err != nil {
		return "", err
	}

	msgLen := uint32(len(data))
	lenBytes := make([]byte, 4)
	binary.BigEndian.PutUint32(lenBytes, msgLen)

	payload := append(lenBytes, data...)
	padLen := (16 - (len(payload) % 16)) % 16
	if padLen == 0 {
		padLen = 16
	}

	padding := make([]byte, padLen)
	if _, err := rand.Read(padding); err != nil {
		for i := range padding {
			padding[i] = byte(padLen)
		}
	}
	payload = append(payload, padding...)

	iv1 := make([]byte, 16)
	iv2 := make([]byte, 16)
	copy(iv1, c.mtIV[:16])
	copy(iv2, c.mtIV[16:32])

	prevC := iv1
	prevP := iv2

	out := make([]byte, 0, len(payload))
	encBlock := make([]byte, 16)
	xored := make([]byte, 16)
	cBlock := make([]byte, 16)

	for i := 0; i < len(payload); i += 16 {
		b := payload[i : i+16]
		for j := 0; j < 16; j++ {
			xored[j] = b[j] ^ prevC[j]
		}
		block.Encrypt(encBlock, xored)
		for j := 0; j < 16; j++ {
			cBlock[j] = encBlock[j] ^ prevP[j]
		}
		out = append(out, cBlock...)
		prevC = make([]byte, 16)
		copy(prevC, cBlock)
		prevP = b
	}

	encoded := base64.URLEncoding.EncodeToString(out)
	return "mt:" + encoded, nil
}

func (c *CryptoService) mtprotoDecrypt(ciphertext string) ([]byte, error) {
	if !strings.HasPrefix(ciphertext, "mt:") {
		return nil, errors.New("invalid prefix")
	}

	b64 := ciphertext[3:]
	raw, err := base64.URLEncoding.DecodeString(b64)
	if err != nil {
		raw, err = base64.RawURLEncoding.DecodeString(b64)
		if err != nil {
			return nil, err
		}
	}

	if len(raw)%16 != 0 || len(raw) < 16 {
		return nil, errors.New("invalid ciphertext block size")
	}

	block, err := aes.NewCipher(c.mtKey)
	if err != nil {
		return nil, err
	}

	iv1 := make([]byte, 16)
	iv2 := make([]byte, 16)
	copy(iv1, c.mtIV[:16])
	copy(iv2, c.mtIV[16:32])

	prevC := iv1
	prevP := iv2

	out := make([]byte, 0, len(raw))
	decBlock := make([]byte, 16)
	xored := make([]byte, 16)
	pBlock := make([]byte, 16)

	for i := 0; i < len(raw); i += 16 {
		cB := raw[i : i+16]
		for j := 0; j < 16; j++ {
			xored[j] = cB[j] ^ prevP[j]
		}
		block.Decrypt(decBlock, xored)
		for j := 0; j < 16; j++ {
			pBlock[j] = decBlock[j] ^ prevC[j]
		}
		out = append(out, pBlock...)
		prevC = cB
		prevP = make([]byte, 16)
		copy(prevP, pBlock)
	}

	if len(out) < 4 {
		return nil, errors.New("output too short")
	}

	msgLen := binary.BigEndian.Uint32(out[:4])
	if int(4+msgLen) > len(out) {
		return nil, errors.New("message length out of bounds")
	}

	return out[4 : 4+msgLen], nil
}

func HashToken(token string) string {
	if token == "" {
		return ""
	}
	hash := sha256.Sum256([]byte(token))
	return hex.EncodeToString(hash[:])
}

// TokenLookupKey returns the session lookup key for a token.
// The Python auth service generates tokens as: <32-hex-chars>.<urlsafe-secret>
// and stores the first 32-hex segment before '.' as access_token_lookup in user_sessions.
func TokenLookupKey(token string) string {
	if token == "" {
		return ""
	}
	if strings.Contains(token, ".") {
		parts := strings.SplitN(token, ".", 2)
		if len(parts[0]) > 0 {
			return parts[0]
		}
	}
	return token
}

// LegacySha256LookupKey returns the first 16 chars of SHA256 of the token for legacy sessions.
func LegacySha256LookupKey(token string) string {
	if token == "" {
		return ""
	}
	hash := sha256.Sum256([]byte(token))
	hexStr := hex.EncodeToString(hash[:])
	if len(hexStr) >= 16 {
		return hexStr[:16]
	}
	return hexStr
}

// VerifyArgon2id verifies a password against an Argon2id hash string formatted as:
// $argon2id$v=19$m=65536,t=2,p=4$<salt>$<expected>
func VerifyArgon2id(password, hashStr string) bool {
	if password == "" || hashStr == "" {
		return false
	}
	if !strings.HasPrefix(hashStr, "$argon2id$") {
		return false
	}
	parts := strings.Split(hashStr, "$")
	// Expected parts: ["", "argon2id", "v=19", "m=65536,t=2,p=4", b64Salt, b64Hash]
	if len(parts) < 6 {
		return false
	}

	params := make(map[string]int)
	for _, item := range strings.Split(parts[3], ",") {
		kv := strings.Split(item, "=")
		if len(kv) == 2 {
			val, err := strconv.Atoi(kv[1])
			if err == nil {
				params[kv[0]] = val
			}
		}
	}

	m, okM := params["m"]
	if !okM || m <= 0 {
		m = 65536
	}
	t, okT := params["t"]
	if !okT || t <= 0 {
		t = 2
	}
	p, okP := params["p"]
	if !okP || p <= 0 {
		p = 4
	}

	salt, err := decodeBase64Flexible(parts[4])
	if err != nil {
		return false
	}
	expected, err := decodeBase64Flexible(parts[5])
	if err != nil {
		return false
	}

	derived := argon2.IDKey([]byte(password), salt, uint32(t), uint32(m), uint8(p), uint32(len(expected)))
	return subtle.ConstantTimeCompare(derived, expected) == 1
}

func decodeBase64Flexible(s string) ([]byte, error) {
	if data, err := base64.URLEncoding.DecodeString(s); err == nil {
		return data, nil
	}
	if data, err := base64.RawURLEncoding.DecodeString(s); err == nil {
		return data, nil
	}
	if data, err := base64.StdEncoding.DecodeString(s); err == nil {
		return data, nil
	}
	return base64.RawStdEncoding.DecodeString(s)
}

