package crypto

import (
	"crypto/aes"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/binary"
	"encoding/hex"
	"errors"
	"strings"
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

func TokenLookupKey(token string) string {
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
