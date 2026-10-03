package socket

import (
	"time"

	socketio "github.com/zishang520/socket.io/v2/socket"
)

func (sm *ServerManager) bindEncProxyHandlers(client *socketio.Socket) {
	sid := string(client.Id())

	client.On("encproxy_status_signal", func(datas ...any) {
		if len(datas) == 0 {
			return
		}
		payload := parsePayloadMap(datas[0])
		targetUserID, _ := payload["target_user_id"].(string)
		if targetUserID == "" {
			return
		}

		senderIDVal, _ := sm.socketUsers.Load(sid)
		senderID, _ := senderIDVal.(string)

		isActive, _ := payload["is_active"].(bool)
		status, _ := payload["status"].(string)
		if status == "" {
			status = "active"
		}
		extra, _ := payload["extra"].(map[string]interface{})

		usesEncProxy := isActive
		if uVal, ok := payload["uses_encproxy"].(bool); ok {
			usesEncProxy = uVal
		}
		forwardData := map[string]interface{}{
			"user_id":       senderID,
			"uses_encproxy": usesEncProxy,
			"is_encproxy":   isActive,
			"status":        status,
			"extra":         extra,
		}

		sm.EmitToUser(targetUserID, "encproxy_peer_status", forwardData)
	})

	client.On("encproxy_key_exchange", func(datas ...any) {
		if len(datas) == 0 {
			return
		}
		payload := parsePayloadMap(datas[0])
		targetUserID, _ := payload["target_user_id"].(string)
		if targetUserID == "" {
			return
		}

		senderIDVal, _ := sm.socketUsers.Load(sid)
		senderID, _ := senderIDVal.(string)
		senderNameVal, _ := sm.userNames.Load(sid)
		senderName, _ := senderNameVal.(string)

		if _, hasFrom := payload["from_user_id"]; !hasFrom {
			payload["from_user_id"] = senderID
		}
		if _, hasName := payload["from_username"]; !hasName {
			payload["from_username"] = senderName
		}

		sm.EmitToUser(targetUserID, "encproxy_key_exchange", payload)
	})

	client.On("e2e_key_exchange", func(datas ...any) {
		if len(datas) == 0 {
			return
		}
		payload := parsePayloadMap(datas[0])
		targetUserID, _ := payload["target_user_id"].(string)
		if targetUserID == "" {
			return
		}

		senderIDVal, _ := sm.socketUsers.Load(sid)
		senderID, _ := senderIDVal.(string)
		if _, hasFrom := payload["from_user_id"]; !hasFrom {
			payload["from_user_id"] = senderID
		}

		sm.EmitToUser(targetUserID, "e2e_key_exchange", payload)
	})

	// Social Feed Real-time updates
	client.On("post_create", func(datas ...any) {
		if len(datas) > 0 {
			sm.IO.Emit("post_created", datas[0])
		}
	})
	client.On("post_update", func(datas ...any) {
		if len(datas) > 0 {
			sm.IO.Emit("post_updated", datas[0])
		}
	})
	client.On("post_delete", func(datas ...any) {
		if len(datas) > 0 {
			sm.IO.Emit("post_deleted", datas[0])
		}
	})
	client.On("video_create", func(datas ...any) {
		if len(datas) > 0 {
			sm.IO.Emit("video_created", datas[0])
		}
	})
	client.On("video_update", func(datas ...any) {
		if len(datas) > 0 {
			sm.IO.Emit("video_updated", datas[0])
		}
	})
	client.On("video_state_changed", func(datas ...any) {
		if len(datas) > 0 {
			sm.IO.Emit("video_state_changed", datas[0])
		}
	})
	client.On("screen_share_state_changed", func(datas ...any) {
		if len(datas) > 0 {
			sm.IO.Emit("screen_share_state_changed", datas[0])
		}
	})
}

func (sm *ServerManager) bindPresenceHandlers(client *socketio.Socket) {
	client.On("ping_stability", func(datas ...any) {
		var ts any
		if len(datas) > 0 {
			payload := parsePayloadMap(datas[0])
			ts = payload["ts"]
		}
		client.Emit("pong_stability", map[string]interface{}{
			"ts":        ts,
			"server_ts": time.Now().UnixMilli(),
		})
	})

	client.On("get_online_users", func(datas ...any) {
		users := sm.GetOnlineUsers()
		client.Emit("online_users", users)
	})

	client.On("logout", func(datas ...any) {
		sm.handleDisconnect(client)
	})
}
