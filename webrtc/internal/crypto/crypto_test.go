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

func TestTokenLookupKey(t *testing.T) {
	token := "bf319d3bf45460e63ab7e505e632e227.bu0SLp1Ri8kPcwWp5DzywzNRVF7xtx0Ijgpw2iRvThN1qJLxinFYqQ"
	lookup := TokenLookupKey(token)
	if lookup != "bf319d3bf45460e63ab7e505e632e227" {
		t.Fatalf("Expected prefix 'bf319d3bf45460e63ab7e505e632e227', got: %s", lookup)
	}

	plain := "plaintoken"
	if TokenLookupKey(plain) != plain {
		t.Fatalf("Expected %s, got: %s", plain, TokenLookupKey(plain))
	}
}

func TestVerifyArgon2id(t *testing.T) {
	password := "my_secret_token"
	pythonHash := "$argon2id$v=19$m=65536,t=2,p=4$YX856lFaa-NZ2dfPQhptNA==$dHPUZzDoOS2vw1TaCt4IeE_mpPH8tgfa9L2HTHbkkO8="

	if !VerifyArgon2id(password, pythonHash) {
		t.Fatalf("VerifyArgon2id failed to verify Python-generated hash")
	}

	if VerifyArgon2id("wrong_token", pythonHash) {
		t.Fatalf("VerifyArgon2id should fail on wrong password")
	}
}

