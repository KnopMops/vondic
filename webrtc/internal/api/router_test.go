package api

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"vondic/webrtc/internal/config"
	"vondic/webrtc/internal/db"
	"vondic/webrtc/internal/notify"
	"vondic/webrtc/internal/socket"
)

func setupTestRouter() *Router {
	cfg := &config.Config{
		Port:               5000,
		CORSAllowedOrigins: []string{"http://localhost:3000", "http://127.0.0.1:3000"},
	}

	repo := &db.Repository{}
	notifier := &notify.Notifier{}
	sm := socket.NewServerManager(repo, notifier)
	return NewRouter(cfg, repo, sm)
}

func TestHealthEndpoints(t *testing.T) {
	rt := setupTestRouter()

	endpoints := []string{"/", "/health", "/healthz"}
	for _, ep := range endpoints {
		req := httptest.NewRequest(http.MethodGet, ep, nil)
		rec := httptest.NewRecorder()

		rt.GetHandler().ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("Endpoint %s returned status %d, expected 200", ep, rec.Code)
		}
	}
}

func TestInternalVoiceChannelsActive(t *testing.T) {
	rt := setupTestRouter()

	req := httptest.NewRequest(http.MethodGet, "/internal/voice-channels/active", nil)
	rec := httptest.NewRecorder()

	rt.GetHandler().ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("Expected 200 OK, got: %d", rec.Code)
	}

	var resp map[string]interface{}
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("Failed to decode JSON: %v", err)
	}

	if _, ok := resp["channels"]; !ok {
		t.Fatalf("Expected 'channels' key in response")
	}
}

func TestInternalCallsActive(t *testing.T) {
	rt := setupTestRouter()

	req := httptest.NewRequest(http.MethodGet, "/internal/calls/active", nil)
	rec := httptest.NewRecorder()

	rt.GetHandler().ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("Expected 200 OK, got: %d", rec.Code)
	}

	var resp map[string]interface{}
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("Failed to decode JSON: %v", err)
	}

	if _, ok := resp["calls"]; !ok {
		t.Fatalf("Expected 'calls' key in response")
	}
}

func TestInternalEmitEndpoint(t *testing.T) {
	rt := setupTestRouter()

	body := map[string]interface{}{
		"event": "test_event",
		"payload": map[string]string{
			"hello": "world",
		},
	}
	bodyBytes, _ := json.Marshal(body)

	req := httptest.NewRequest(http.MethodPost, "/internal/emit", bytes.NewReader(bodyBytes))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	rt.GetHandler().ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("Expected 200 OK, got: %d", rec.Code)
	}

	var resp map[string]interface{}
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("Failed to decode JSON: %v", err)
	}

	if resp["status"] != "emitted" {
		t.Fatalf("Expected status 'emitted', got %v", resp["status"])
	}
}
