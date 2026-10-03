package crypto

import (
	"strings"
	"testing"
)

func TestCryptoService_EncryptDecryptPayload(t *testing.T) {
	key := "test-secret-encryption-key-32-bytes!"
	svc := NewCryptoService(key)

	plainText := "Hello, Vondic WebRTC in Golang! 🚀"
	encrypted := svc.EncryptPayload(plainText)
	if encrypted == "" || encrypted == plainText {
		t.Fatalf("Expected encrypted ciphertext, got: %s", encrypted)
	}

	if !strings.HasPrefix(encrypted, "mt:") {
		t.Fatalf("Expected 'mt:' prefix, got: %s", encrypted)
	}

	decrypted := svc.DecryptPayload(encrypted)
	if decrypted != plainText {
		t.Fatalf("Decrypted text does not match. Expected %q, got %q", plainText, decrypted)
	}
}

func TestCryptoService_Passthrough(t *testing.T) {
	key := "test-secret-encryption-key-32-bytes!"
	svc := NewCryptoService(key)

	e2e := "e2e:base64payloadhere"
	if svc.EncryptPayload(e2e) != e2e {
		t.Fatalf("e2e payload should pass through untouched")
	}
	if svc.DecryptPayload(e2e) != e2e {
		t.Fatalf("e2e payload should pass through untouched")
	}

	encproxy := "encproxy:something"
	if svc.EncryptPayload(encproxy) != encproxy {
		t.Fatalf("encproxy payload should pass through untouched")
	}
}

func TestHashToken(t *testing.T) {
	token := "some-user-session-token"
	hash1 := HashToken(token)
	hash2 := HashToken(token)

	if hash1 != hash2 {
		t.Fatalf("HashToken must be deterministic: %s != %s", hash1, hash2)
	}
	if len(hash1) != 64 {
		t.Fatalf("Expected SHA256 hex string (64 chars), got %d chars", len(hash1))
	}
}
