package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/prometheus/client_golang/prometheus/promhttp"

	"vondic/webrtc/internal/config"
	"vondic/webrtc/internal/db"
	"vondic/webrtc/internal/socket"
)

type Router struct {
	cfg    *config.Config
	repo   *db.Repository
	sm     *socket.ServerManager
	mux    *chi.Mux
}

func NewRouter(cfg *config.Config, repo *db.Repository, sm *socket.ServerManager) *Router {
	r := &Router{
		cfg:  cfg,
		repo: repo,
		sm:   sm,
		mux:  chi.NewRouter(),
	}
	r.setupRoutes()
	return r
}

func (rt *Router) GetHandler() http.Handler {
	return rt.mux
}

func (rt *Router) setupRoutes() {
	// 1. Middleware
	rt.mux.Use(middleware.RequestID)
	rt.mux.Use(middleware.RealIP)
	rt.mux.Use(middleware.Logger)
	rt.mux.Use(middleware.Recoverer)

	// 2. CORS
	rt.mux.Use(cors.Handler(cors.Options{
		AllowedOrigins:   rt.cfg.CORSAllowedOrigins,
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token", "Origin"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	// 3. Socket.IO handler mounted on /socket.io/
	rt.mux.Handle("/socket.io/*", rt.sm.IO.ServeHandler(nil))
	rt.mux.Handle("/socket.io", rt.sm.IO.ServeHandler(nil))

	// 4. Public & Monitoring routes
	rt.mux.Get("/", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/plain; charset=utf-8")
		_, _ = w.Write([]byte("Сервер сигнализации WebRTC запущен (Go)."))
	})

	rt.mux.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "healthy"})
	})

	rt.mux.Get("/healthz", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "healthy"})
	})

	rt.mux.Get("/metrics", promhttp.Handler().ServeHTTP)

	rt.mux.Get("/api/online-users", func(w http.ResponseWriter, r *http.Request) {
		count, _ := rt.repo.GetOnlineUsersCount()
		writeJSON(w, http.StatusOK, map[string]interface{}{"count": count})
	})

	rt.mux.Get("/get_socket_id/{user_id}", func(w http.ResponseWriter, r *http.Request) {
		userID := chi.URLParam(r, "user_id")
		if sid, ok := rt.sm.GetUserSocketID(userID); ok {
			writeJSON(w, http.StatusOK, map[string]string{"socket_id": sid})
			return
		}
		writeJSON(w, http.StatusNotFound, map[string]string{"detail": "Пользователь не найден или не в сети"})
	})

	rt.mux.Post("/set_socket_id", func(w http.ResponseWriter, r *http.Request) {
		var body map[string]string
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid JSON"})
			return
		}
		userID := body["user_id"]
		socketID := body["socket_id"]
		if userID == "" || socketID == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Missing user_id or socket_id"})
			return
		}
		_ = rt.repo.SetUserSocketID(userID, socketID)
		writeJSON(w, http.StatusOK, map[string]interface{}{"ok": true, "user_id": userID, "socket_id": socketID})
	})

	// 5. History & Search Routes (Invoked by Next.js API proxy)
	rt.mux.Post("/messages/history", rt.handleGetMessagesHistory)
	rt.mux.Delete("/messages/history", rt.handleDeleteMessagesHistory)

	rt.mux.Post("/channels/history", rt.handleGetChannelHistory)
	rt.mux.Delete("/channels/history", rt.handleDeleteChannelHistory)

	rt.mux.Delete("/groups/history", rt.handleDeleteGroupHistory)

	rt.mux.Post("/chats/search", rt.handleSearchChats)
	rt.mux.Post("/messages/search", rt.handleSearchMessages)

	// 6. Internal API routes (Invoked by FastAPI backend)
	rt.mux.Post("/internal/broadcast_message", rt.handleInternalBroadcastMessage)
	rt.mux.Post("/internal/emit", rt.handleInternalEmit)

	rt.mux.Get("/internal/voice-channels/active", func(w http.ResponseWriter, r *http.Request) {
		channels := rt.sm.GetActiveVoiceChannels()
		writeJSON(w, http.StatusOK, map[string]interface{}{"channels": channels})
	})

	rt.mux.Get("/internal/voice-channels/{channel_id}/participants", func(w http.ResponseWriter, r *http.Request) {
		channelID := chi.URLParam(r, "channel_id")
		parts := rt.sm.GetVoiceChannelParticipants(channelID)
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"channel_id":   channelID,
			"participants": parts,
		})
	})

	rt.mux.Get("/internal/calls/active", func(w http.ResponseWriter, r *http.Request) {
		calls := rt.sm.GetActiveCalls()
		writeJSON(w, http.StatusOK, map[string]interface{}{"calls": calls})
	})

	rt.mux.Get("/internal/calls/{call_id}", func(w http.ResponseWriter, r *http.Request) {
		callID := chi.URLParam(r, "call_id")
		if call, ok := rt.sm.GetActiveCall(callID); ok {
			writeJSON(w, http.StatusOK, call)
			return
		}
		writeJSON(w, http.StatusNotFound, map[string]string{"detail": "Call not found"})
	})
}

// ─── Handlers ────────────────────────────────────────────────────────

func (rt *Router) authenticateRequest(r *http.Request, body map[string]interface{}) (*db.User, error) {
	var token string
	if authH := r.Header.Get("Authorization"); authH != "" {
		if len(authH) > 7 && (authH[:7] == "Bearer " || authH[:7] == "bearer ") {
			token = authH[7:]
		}
	}
	if token == "" && body != nil {
		if t, ok := body["token"].(string); ok && t != "" {
			token = t
		} else if t, ok := body["access_token"].(string); ok && t != "" {
			token = t
		}
	}
	return rt.repo.AuthenticateToken(token)
}

func (rt *Router) handleGetMessagesHistory(w http.ResponseWriter, r *http.Request) {
	var body map[string]interface{}
	_ = json.NewDecoder(r.Body).Decode(&body)

	user, err := rt.authenticateRequest(r, body)
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "Unauthorized"})
		return
	}

	targetID, _ := body["target_id"].(string)
	if targetID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Missing target_id"})
		return
	}

	limit := getIntField(body, "limit", 50)
	offset := getIntField(body, "offset", 0)

	msgs, err := rt.repo.GetMessagesHistory(user.ID, targetID, limit, offset)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Database error"})
		return
	}
	writeJSON(w, http.StatusOK, msgs)
}

func (rt *Router) handleDeleteMessagesHistory(w http.ResponseWriter, r *http.Request) {
	var body map[string]interface{}
	_ = json.NewDecoder(r.Body).Decode(&body)

	user, err := rt.authenticateRequest(r, body)
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "Unauthorized"})
		return
	}

	targetID, _ := body["target_id"].(string)
	if targetID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Missing target_id"})
		return
	}

	scope, _ := body["scope"].(string)
	if scope == "" {
		scope = "for_all"
	}

	deleted, err := rt.repo.DeleteMessagesHistory(user.ID, targetID, scope)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Database error"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"deleted": deleted, "ok": true})
}

func (rt *Router) handleGetChannelHistory(w http.ResponseWriter, r *http.Request) {
	var body map[string]interface{}
	_ = json.NewDecoder(r.Body).Decode(&body)

	_, err := rt.authenticateRequest(r, body)
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "Unauthorized"})
		return
	}

	channelID, _ := body["channel_id"].(string)
	if channelID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Missing channel_id"})
		return
	}

	limit := getIntField(body, "limit", 50)
	offset := getIntField(body, "offset", 0)

	msgs, err := rt.repo.GetChannelHistory(channelID, limit, offset)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Database error"})
		return
	}
	writeJSON(w, http.StatusOK, msgs)
}

func (rt *Router) handleDeleteChannelHistory(w http.ResponseWriter, r *http.Request) {
	var body map[string]interface{}
	_ = json.NewDecoder(r.Body).Decode(&body)

	_, err := rt.authenticateRequest(r, body)
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "Unauthorized"})
		return
	}

	channelID, _ := body["channel_id"].(string)
	if channelID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Missing channel_id"})
		return
	}

	deleted, err := rt.repo.DeleteChannelHistory(channelID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Database error"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"deleted": deleted, "ok": true})
}

func (rt *Router) handleDeleteGroupHistory(w http.ResponseWriter, r *http.Request) {
	var body map[string]interface{}
	_ = json.NewDecoder(r.Body).Decode(&body)

	_, err := rt.authenticateRequest(r, body)
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "Unauthorized"})
		return
	}

	groupID, _ := body["group_id"].(string)
	if groupID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Missing group_id"})
		return
	}

	deleted, err := rt.repo.DeleteGroupHistory(groupID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Database error"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"deleted": deleted, "ok": true})
}

func (rt *Router) handleSearchChats(w http.ResponseWriter, r *http.Request) {
	var body map[string]interface{}
	_ = json.NewDecoder(r.Body).Decode(&body)

	user, err := rt.authenticateRequest(r, body)
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "Unauthorized"})
		return
	}

	query, _ := body["query"].(string)
	chats, err := rt.repo.SearchChats(user.ID, query)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Database error"})
		return
	}
	writeJSON(w, http.StatusOK, chats)
}

func (rt *Router) handleSearchMessages(w http.ResponseWriter, r *http.Request) {
	var body map[string]interface{}
	_ = json.NewDecoder(r.Body).Decode(&body)

	user, err := rt.authenticateRequest(r, body)
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "Unauthorized"})
		return
	}

	targetID, _ := body["target_id"].(string)
	query, _ := body["query"].(string)

	msgs, err := rt.repo.SearchMessages(user.ID, targetID, query)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Database error"})
		return
	}
	writeJSON(w, http.StatusOK, msgs)
}

func (rt *Router) handleInternalBroadcastMessage(w http.ResponseWriter, r *http.Request) {
	var data map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&data); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid JSON"})
		return
	}

	payload, _ := data["payload"].(map[string]interface{})
	if payload == nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"detail": "Отсутствует payload"})
		return
	}

	targetID, _ := data["target_id"].(string)
	channelID, _ := data["channel_id"].(string)
	groupID, _ := data["group_id"].(string)

	if channelID != "" {
		rt.sm.EmitToRoom(fmt.Sprintf("channel_%s", channelID), "receive_message", payload)
		parts, _ := rt.repo.GetChannelParticipants(channelID)
		if len(parts) == 0 {
			if ownerID, err := rt.repo.GetChannelOwner(channelID); err == nil && ownerID != "" {
				parts = []string{ownerID}
			}
		}
		for _, pid := range parts {
			rt.sm.EmitToUser(pid, "receive_message", payload)
		}
	} else if groupID != "" {
		rt.sm.EmitToRoom(fmt.Sprintf("group_%s", groupID), "receive_message", payload)
		parts, _ := rt.repo.GetGroupMembers(groupID)
		for _, pid := range parts {
			rt.sm.EmitToUser(pid, "receive_message", payload)
		}
	} else if targetID != "" {
		rt.sm.EmitToUser(targetID, "receive_message", payload)
	} else {
		writeJSON(w, http.StatusBadRequest, map[string]string{"detail": "Отсутствует group_id, channel_id или target_id"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{"status": "success", "ok": true})
}

func (rt *Router) handleInternalEmit(w http.ResponseWriter, r *http.Request) {
	var data map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&data); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid JSON"})
		return
	}

	event, _ := data["event"].(string)
	payload := data["payload"]
	room, _ := data["room"].(string)

	if event == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"detail": "event required"})
		return
	}

	if room != "" {
		rt.sm.EmitToRoom(room, event, payload)
		rt.sm.EmitToUser(room, event, payload)
	} else {
		rt.sm.IO.Emit(event, payload)
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{"status": "emitted", "event": event, "room": room, "ok": true})
}

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(data)
}

func getIntField(m map[string]interface{}, key string, def int) int {
	if val, ok := m[key]; ok {
		switch v := val.(type) {
		case float64:
			return int(v)
		case int:
			return v
		case string:
			if i, err := strconv.Atoi(v); err == nil {
				return i
			}
		}
	}
	return def
}
