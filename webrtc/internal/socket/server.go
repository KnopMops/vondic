package socket

import (
	"encoding/json"
	"fmt"
	"log"
	"sync"

	socketio "github.com/zishang520/socket.io/v2/socket"

	"vondic/webrtc/internal/db"
	"vondic/webrtc/internal/notify"
)

type ServerManager struct {
	IO       *socketio.Server
	repo     *db.Repository
	notifier *notify.Notifier

	// Concurrency-safe mappings
	userSockets sync.Map // map[userID]map[socketID]*socketio.Socket
	socketUsers sync.Map // map[socketID]string (userID)
	userNames   sync.Map // map[socketID]string (username)

	// Calls state
	groupCallsMutex sync.RWMutex
	groupCalls      map[string]map[string]interface{}

	voiceChannelsMutex sync.RWMutex
	voiceChannelCalls  map[string]map[string]map[string]interface{}
}

func NewServerManager(repo *db.Repository, notifier *notify.Notifier) *ServerManager {
	io := socketio.NewServer(nil, nil)

	sm := &ServerManager{
		IO:                io,
		repo:              repo,
		notifier:          notifier,
		groupCalls:        make(map[string]map[string]interface{}),
		voiceChannelCalls: make(map[string]map[string]map[string]interface{}),
	}

	sm.setupEvents()
	return sm
}

func (sm *ServerManager) setupEvents() {
	sm.IO.On("connection", func(clients ...any) {
		client := clients[0].(*socketio.Socket)
		sid := string(client.Id())
		log.Printf("[Socket.IO] New connection: %s", sid)

		// 1. Try authenticating from Handshake (query/auth/headers)
		user := sm.extractUserFromHandshake(client)
		if user != nil {
			sm.registerUserConnection(client, user.ID, *user.Username)
		}

		// 2. Inbound event: "authenticate" (used by Flutter and fallback)
		client.On("authenticate", func(datas ...any) {
			if len(datas) == 0 {
				return
			}
			token := sm.extractTokenFromPayload(datas[0])
			if token == "" {
				return
			}
			u, err := sm.repo.AuthenticateToken(token)
			if err != nil {
				client.Emit("error", map[string]string{"message": "Authentication failed"})
				return
			}
			uname := ""
			if u.Username != nil {
				uname = *u.Username
			}
			sm.registerUserConnection(client, u.ID, uname)
		})

		// 3. Bind all Signaling / Call / Chat handlers
		sm.bindCallHandlers(client)
		sm.bindChatHandlers(client)
		sm.bindEncProxyHandlers(client)
		sm.bindPresenceHandlers(client)

		// Disconnect handler
		client.On("disconnect", func(reason ...any) {
			sm.handleDisconnect(client)
		})
	})
}

func (sm *ServerManager) extractUserFromHandshake(client *socketio.Socket) *db.User {
	hs := client.Handshake()
	if hs == nil {
		return nil
	}

	var token string
	// Check query
	if q, ok := hs.Query["token"]; ok && len(q) > 0 {
		token = q[0]
	} else if q, ok := hs.Query["access_token"]; ok && len(q) > 0 {
		token = q[0]
	}

	// Check auth object
	if token == "" && hs.Auth != nil {
		token = sm.extractTokenFromPayload(hs.Auth)
	}

	// Check headers
	if token == "" && hs.Headers != nil {
		if authH, ok := hs.Headers["authorization"]; ok && len(authH) > 0 {
			token = stringsTrimBearer(authH[0])
		}
	}

	if token == "" {
		return nil
	}

	user, err := sm.repo.AuthenticateToken(token)
	if err != nil {
		return nil
	}
	return user
}

func (sm *ServerManager) extractTokenFromPayload(data any) string {
	if s, ok := data.(string); ok {
		return s
	}
	if m, ok := data.(map[string]any); ok {
		if t, ok := m["token"].(string); ok && t != "" {
			return t
		}
		if t, ok := m["access_token"].(string); ok && t != "" {
			return t
		}
	}
	return ""
}

func stringsTrimBearer(val string) string {
	if len(val) > 7 && (val[:7] == "Bearer " || val[:7] == "bearer ") {
		return val[7:]
	}
	return val
}

func (sm *ServerManager) registerUserConnection(client *socketio.Socket, userID, username string) {
	sid := string(client.Id())
	sm.socketUsers.Store(sid, userID)
	sm.userNames.Store(sid, username)

	// Add to userSockets map
	actual, _ := sm.userSockets.LoadOrStore(userID, &sync.Map{})
	socketsMap := actual.(*sync.Map)
	socketsMap.Store(sid, client)

	// Join individual rooms
	client.Join(socketio.Room(userID))
	client.Join(socketio.Room(fmt.Sprintf("user_%s", userID)))

	// Update DB presence
	_ = sm.repo.UpdateUserStatus(userID, "online", &sid)

	// Notify client of success
	client.Emit("connection_success", map[string]interface{}{
		"user_id":   userID,
		"username":  username,
		"socket_id": sid,
		"status":    "connected",
	})

	// Broadcast user status changed to all
	sm.IO.Emit("user_status_changed", map[string]interface{}{
		"user_id": userID,
		"status":  "online",
	})

	log.Printf("[Socket.IO] Authenticated user %s (@%s) on socket %s", userID, username, sid)
}

func (sm *ServerManager) handleDisconnect(client *socketio.Socket) {
	sid := string(client.Id())
	val, ok := sm.socketUsers.LoadAndDelete(sid)
	sm.userNames.Delete(sid)

	if !ok {
		return
	}
	userID := val.(string)

	if actual, ok := sm.userSockets.Load(userID); ok {
		socketsMap := actual.(*sync.Map)
		socketsMap.Delete(sid)

		// Check if user has other active connections
		hasOther := false
		socketsMap.Range(func(key, value any) bool {
			hasOther = true
			return false
		})

		if !hasOther {
			sm.userSockets.Delete(userID)
			_ = sm.repo.UpdateUserStatus(userID, "offline", nil)
			sm.IO.Emit("user_status_changed", map[string]interface{}{
				"user_id": userID,
				"status":  "offline",
			})
		}
	}

	// Clean up from voice channels
	sm.leaveAllVoiceChannels(sid, userID)

	log.Printf("[Socket.IO] Disconnected: %s (user: %s)", sid, userID)
}

func (sm *ServerManager) GetUserSocketID(userID string) (string, bool) {
	if actual, ok := sm.userSockets.Load(userID); ok {
		socketsMap := actual.(*sync.Map)
		var sid string
		found := false
		socketsMap.Range(func(key, value any) bool {
			sid = key.(string)
			found = true
			return false
		})
		if found {
			return sid, true
		}
	}
	return "", false
}

func (sm *ServerManager) EmitToUser(userID, event string, payload any) bool {
	sm.IO.To(socketio.Room(userID)).To(socketio.Room(fmt.Sprintf("user_%s", userID))).Emit(event, payload)
	return true
}

func (sm *ServerManager) EmitToRoom(room, event string, payload any) bool {
	sm.IO.To(socketio.Room(room)).Emit(event, payload)
	return true
}

func (sm *ServerManager) GetOnlineUsers() []string {
	var users []string
	sm.userSockets.Range(func(key, value any) bool {
		users = append(users, key.(string))
		return true
	})
	return users
}

func (sm *ServerManager) GetActiveCalls() []map[string]interface{} {
	sm.groupCallsMutex.RLock()
	defer sm.groupCallsMutex.RUnlock()

	var result []map[string]interface{}
	for id, call := range sm.groupCalls {
		c := map[string]interface{}{
			"call_id": id,
		}
		for k, v := range call {
			c[k] = v
		}
		result = append(result, c)
	}
	return result
}

func (sm *ServerManager) GetActiveCall(callID string) (map[string]interface{}, bool) {
	sm.groupCallsMutex.RLock()
	defer sm.groupCallsMutex.RUnlock()
	call, ok := sm.groupCalls[callID]
	return call, ok
}

func (sm *ServerManager) GetActiveVoiceChannels() []map[string]interface{} {
	sm.voiceChannelsMutex.RLock()
	defer sm.voiceChannelsMutex.RUnlock()

	var result []map[string]interface{}
	for chID, participants := range sm.voiceChannelCalls {
		var partsList []map[string]interface{}
		for _, p := range participants {
			partsList = append(partsList, p)
		}
		result = append(result, map[string]interface{}{
			"channel_id":        chID,
			"participants":      partsList,
			"participant_count": len(partsList),
		})
	}
	return result
}

func (sm *ServerManager) GetVoiceChannelParticipants(channelID string) []map[string]interface{} {
	sm.voiceChannelsMutex.RLock()
	defer sm.voiceChannelsMutex.RUnlock()

	var partsList []map[string]interface{}
	if parts, ok := sm.voiceChannelCalls[channelID]; ok {
		for _, p := range parts {
			partsList = append(partsList, p)
		}
	}
	return partsList
}

func (sm *ServerManager) leaveAllVoiceChannels(sid, userID string) {
	sm.voiceChannelsMutex.Lock()
	defer sm.voiceChannelsMutex.Unlock()

	for chID, parts := range sm.voiceChannelCalls {
		if _, exists := parts[sid]; exists {
			delete(parts, sid)
			sm.IO.To(socketio.Room(fmt.Sprintf("voice_%s", chID))).Emit("voice_channel_left", map[string]interface{}{
				"channel_id": chID,
				"user_id":    userID,
				"socket_id":  sid,
			})
			if len(parts) == 0 {
				delete(sm.voiceChannelCalls, chID)
			}
		}
	}
}

func parsePayloadMap(data any) map[string]interface{} {
	if m, ok := data.(map[string]interface{}); ok {
		return m
	}
	if b, ok := data.([]byte); ok {
		var m map[string]interface{}
		if err := json.Unmarshal(b, &m); err == nil {
			return m
		}
	}
	if s, ok := data.(string); ok {
		var m map[string]interface{}
		if err := json.Unmarshal([]byte(s), &m); err == nil {
			return m
		}
	}
	return make(map[string]interface{})
}
