package socket

import (
	"fmt"
	"log"

	"github.com/google/uuid"
	socketio "github.com/zishang520/socket.io/v2/socket"
)

func (sm *ServerManager) bindCallHandlers(client *socketio.Socket) {
	sid := string(client.Id())

	// ─── 1-to-1 WebRTC Calls ─────────────────────────────────────────────

	client.On("call_user", func(datas ...any) {
		if len(datas) == 0 {
			return
		}
		payload := parsePayloadMap(datas[0])
		targetUserID, _ := payload["target_user_id"].(string)
		offer := payload["offer"]
		isVideo, _ := payload["is_video"].(bool)
		callerName, _ := payload["caller_name"].(string)
		callerAvatar, _ := payload["caller_avatar"].(string)

		callerUserIDVal, _ := sm.socketUsers.Load(sid)
		callerUserID, _ := callerUserIDVal.(string)

		if callerName == "" {
			if uVal, ok := sm.userNames.Load(sid); ok {
				callerName, _ = uVal.(string)
			}
		}

		callData := map[string]interface{}{
			"caller_socket_id":  sid,
			"caller_user_id":    callerUserID,
			"caller_name":       callerName,
			"caller_avatar":     callerAvatar,
			"caller_avatar_url": callerAvatar,
			"is_video":          isVideo,
			"offer":             offer,
		}

		targetSID, isOnline := sm.GetUserSocketID(targetUserID)
		if isOnline {
			log.Printf("[Call] Forwarding incoming_call from %s (%s) to %s (%s)", callerUserID, sid, targetUserID, targetSID)
			sm.IO.To(socketio.Room(targetSID)).Emit("incoming_call", callData)
		} else {
			log.Printf("[Call] Target user %s is offline. Triggering push call notification.", targetUserID)
			// Send push notification via RabbitMQ push_queue
			sm.notifier.PushCallUser(targetUserID, map[string]interface{}{
				"caller_id":       callerUserID,
				"caller_username": callerName,
				"is_video":        isVideo,
			})
			client.Emit("call_rejected", map[string]interface{}{
				"reason": "Пользователь не в сети (отправлен вызов)",
			})
		}
	})

	client.On("call_answer", func(datas ...any) {
		if len(datas) == 0 {
			return
		}
		payload := parsePayloadMap(datas[0])
		targetSID, _ := payload["caller_socket_id"].(string)
		if targetSID == "" {
			targetSID, _ = payload["target_socket_id"].(string)
		}
		targetUserID, _ := payload["target_user_id"].(string)
		answer := payload["answer"]

		if targetSID == "" && targetUserID != "" {
			targetSID, _ = sm.GetUserSocketID(targetUserID)
		}

		if targetSID != "" {
			sm.IO.To(socketio.Room(targetSID)).Emit("call_accepted", map[string]interface{}{
				"sender_socket_id":    sid,
				"responder_socket_id": sid,
				"answer":              answer,
			})
			if answer != nil {
				sm.IO.To(socketio.Room(targetSID)).Emit("call_answer", map[string]interface{}{
					"socket_id": sid,
					"answer":    answer,
				})
			}
		}
	})

	client.On("call_reject", func(datas ...any) {
		if len(datas) == 0 {
			return
		}
		payload := parsePayloadMap(datas[0])
		targetSID, _ := payload["caller_socket_id"].(string)
		if targetSID == "" {
			targetSID, _ = payload["target_socket_id"].(string)
		}
		targetUserID, _ := payload["target_user_id"].(string)
		reason, _ := payload["reason"].(string)
		if reason == "" {
			reason = "busy"
		}

		if targetSID == "" && targetUserID != "" {
			targetSID, _ = sm.GetUserSocketID(targetUserID)
		}

		if targetSID != "" {
			sm.IO.To(socketio.Room(targetSID)).Emit("call_rejected", map[string]interface{}{
				"sender_socket_id":    sid,
				"responder_socket_id": sid,
				"reason":              reason,
			})
		}
	})

	client.On("call_end", func(datas ...any) {
		if len(datas) == 0 {
			return
		}
		payload := parsePayloadMap(datas[0])
		targetSID, _ := payload["target_socket_id"].(string)
		targetUserID, _ := payload["target_user_id"].(string)

		if targetSID == "" && targetUserID != "" {
			targetSID, _ = sm.GetUserSocketID(targetUserID)
		}

		if targetSID != "" {
			sm.IO.To(socketio.Room(targetSID)).Emit("call_ended", map[string]interface{}{
				"sender_socket_id": sid,
			})
		}
	})

	client.On("offer", func(datas ...any) {
		if len(datas) == 0 {
			return
		}
		payload := parsePayloadMap(datas[0])
		targetSID, _ := payload["target_socket_id"].(string)
		offer := payload["offer"]
		if targetSID != "" && offer != nil {
			sm.IO.To(socketio.Room(targetSID)).Emit("offer", map[string]interface{}{
				"sender_socket_id": sid,
				"offer":            offer,
			})
		}
	})

	client.On("answer", func(datas ...any) {
		if len(datas) == 0 {
			return
		}
		payload := parsePayloadMap(datas[0])
		targetSID, _ := payload["target_socket_id"].(string)
		answer := payload["answer"]
		if targetSID != "" && answer != nil {
			sm.IO.To(socketio.Room(targetSID)).Emit("answer", map[string]interface{}{
				"sender_socket_id": sid,
				"answer":           answer,
			})
		}
	})

	client.On("ice_candidate", func(datas ...any) {
		if len(datas) == 0 {
			return
		}
		payload := parsePayloadMap(datas[0])
		targetSID, _ := payload["target_socket_id"].(string)
		targetUserID, _ := payload["target_user_id"].(string)
		candidate := payload["candidate"]

		if targetSID == "" && targetUserID != "" {
			targetSID, _ = sm.GetUserSocketID(targetUserID)
		}

		if targetSID != "" && candidate != nil {
			sm.IO.To(socketio.Room(targetSID)).Emit("ice_candidate", map[string]interface{}{
				"sender_socket_id": sid,
				"candidate":        candidate,
			})
		}
	})

	// ─── Group Calls ─────────────────────────────────────────────────────

	client.On("call_group", func(datas ...any) {
		if len(datas) == 0 {
			return
		}
		payload := parsePayloadMap(datas[0])
		groupID, _ := payload["group_id"].(string)
		isVideo, _ := payload["is_video"].(bool)
		callID := uuid.New().String()

		callerUserIDVal, _ := sm.socketUsers.Load(sid)
		callerUserID, _ := callerUserIDVal.(string)
		callerNameVal, _ := sm.userNames.Load(sid)
		callerName, _ := callerNameVal.(string)

		groupRoom := fmt.Sprintf("group_%s", groupID)
		client.Join(socketio.Room(groupRoom))

		sm.groupCallsMutex.Lock()
		sm.groupCalls[callID] = map[string]interface{}{
			"group_id":         groupID,
			"caller_user_id":   callerUserID,
			"caller_username":  callerName,
			"is_video":         isVideo,
			"joined":           []string{callerUserID},
			"participant_sids": []string{sid},
		}
		sm.groupCallsMutex.Unlock()

		sm.IO.To(socketio.Room(groupRoom)).Emit("incoming_group_call", map[string]interface{}{
			"call_id":         callID,
			"group_id":        groupID,
			"caller_user_id":  callerUserID,
			"caller_username": callerName,
			"is_video":        isVideo,
		})
	})

	client.On("group_call_answer", func(datas ...any) {
		if len(datas) == 0 {
			return
		}
		payload := parsePayloadMap(datas[0])
		callID, _ := payload["call_id"].(string)
		groupID, _ := payload["group_id"].(string)

		callerUserIDVal, _ := sm.socketUsers.Load(sid)
		callerUserID, _ := callerUserIDVal.(string)

		groupRoom := fmt.Sprintf("group_%s", groupID)
		client.Join(socketio.Room(groupRoom))

		sm.groupCallsMutex.Lock()
		if call, exists := sm.groupCalls[callID]; exists {
			joined, _ := call["joined"].([]string)
			joined = append(joined, callerUserID)
			call["joined"] = joined

			sids, _ := call["participant_sids"].([]string)
			sids = append(sids, sid)
			call["participant_sids"] = sids
		}
		sm.groupCallsMutex.Unlock()

		sm.IO.To(socketio.Room(groupRoom)).Emit("group_call_participant_joined", map[string]interface{}{
			"call_id":   callID,
			"group_id":  groupID,
			"user_id":   callerUserID,
			"socket_id": sid,
		})
	})

	client.On("group_call_end", func(datas ...any) {
		if len(datas) == 0 {
			return
		}
		payload := parsePayloadMap(datas[0])
		callID, _ := payload["call_id"].(string)
		groupID, _ := payload["group_id"].(string)

		sm.groupCallsMutex.Lock()
		delete(sm.groupCalls, callID)
		sm.groupCallsMutex.Unlock()

		groupRoom := fmt.Sprintf("group_%s", groupID)
		sm.IO.To(socketio.Room(groupRoom)).Emit("group_call_ended", map[string]interface{}{
			"call_id":  callID,
			"group_id": groupID,
		})
	})

	client.On("get_active_group_call", func(datas ...any) {
		if len(datas) == 0 {
			return
		}
		payload := parsePayloadMap(datas[0])
		groupID, _ := payload["group_id"].(string)

		sm.groupCallsMutex.RLock()
		var foundCall map[string]interface{}
		var foundID string
		for id, call := range sm.groupCalls {
			if call["group_id"] == groupID {
				foundCall = call
				foundID = id
				break
			}
		}
		sm.groupCallsMutex.RUnlock()

		if foundCall != nil {
			client.Emit("active_group_call", map[string]interface{}{
				"call_id":         foundID,
				"group_id":        groupID,
				"caller_user_id":  foundCall["caller_user_id"],
				"caller_username": foundCall["caller_username"],
				"is_video":        foundCall["is_video"],
				"participants":    foundCall["joined"],
			})
		}
	})

	// ─── Voice Channels ──────────────────────────────────────────────────

	client.On("join_voice_channel", func(datas ...any) {
		if len(datas) == 0 {
			return
		}
		payload := parsePayloadMap(datas[0])
		channelID, _ := payload["channel_id"].(string)
		if channelID == "" {
			return
		}

		uIDVal, _ := sm.socketUsers.Load(sid)
		userID, _ := uIDVal.(string)
		uNameVal, _ := sm.userNames.Load(sid)
		username, _ := uNameVal.(string)

		voiceRoom := fmt.Sprintf("voice_%s", channelID)
		client.Join(socketio.Room(voiceRoom))

		newUserPayload := map[string]interface{}{
			"channel_id": channelID,
			"user_id":    userID,
			"socket_id":  sid,
			"username":   username,
		}

		// 1. Notify joining user of their own arrival
		client.Emit("voice_channel_participant_joined", newUserPayload)
		client.Emit("voice_channel_joined", newUserPayload)

		sm.voiceChannelsMutex.Lock()
		if sm.voiceChannelCalls[channelID] == nil {
			sm.voiceChannelCalls[channelID] = make(map[string]map[string]interface{})
		}

		// 2. Cross-notify existing participants
		for existingSID, existingInfo := range sm.voiceChannelsCallsCopy(channelID) {
			if existingSID == sid {
				continue
			}
			// Notify existing participant about new user
			sm.IO.To(socketio.Room(existingSID)).Emit("voice_channel_participant_joined", newUserPayload)
			// Notify new user about existing participant
			client.Emit("voice_channel_participant_joined", existingInfo)
		}

		sm.voiceChannelCalls[channelID][sid] = map[string]interface{}{
			"channel_id": channelID,
			"socket_id":  sid,
			"user_id":    userID,
			"username":   username,
		}
		sm.voiceChannelsMutex.Unlock()
	})

	client.On("leave_voice_channel", func(datas ...any) {
		if len(datas) == 0 {
			return
		}
		payload := parsePayloadMap(datas[0])
		channelID, _ := payload["channel_id"].(string)
		if channelID == "" {
			return
		}

		uIDVal, _ := sm.socketUsers.Load(sid)
		userID, _ := uIDVal.(string)
		uNameVal, _ := sm.userNames.Load(sid)
		username, _ := uNameVal.(string)

		voiceRoom := fmt.Sprintf("voice_%s", channelID)
		client.Leave(socketio.Room(voiceRoom))

		sm.voiceChannelsMutex.Lock()
		if parts, ok := sm.voiceChannelCalls[channelID]; ok {
			delete(parts, sid)
			if len(parts) == 0 {
				delete(sm.voiceChannelCalls, channelID)
			}
		}
		sm.voiceChannelsMutex.Unlock()

		leftPayload := map[string]interface{}{
			"channel_id": channelID,
			"user_id":    userID,
			"username":   username,
			"socket_id":  sid,
		}
		sm.IO.To(socketio.Room(voiceRoom)).Emit("voice_channel_participant_left", leftPayload)
		sm.IO.To(socketio.Room(voiceRoom)).Emit("voice_channel_left", leftPayload)
	})

	// ─── Video & Screen Share State Handlers ─────────────────────────────

	client.On("video_state_changed", func(datas ...any) {
		if len(datas) == 0 {
			return
		}
		payload := parsePayloadMap(datas[0])
		uIDVal, _ := sm.socketUsers.Load(sid)
		userID, _ := uIDVal.(string)

		socketID := sid
		if s, ok := payload["sender_socket_id"].(string); ok && s != "" {
			socketID = s
		}
		hasVideo, _ := payload["has_video"].(bool)

		out := map[string]interface{}{
			"from_socket_id": socketID,
			"user_id":        userID,
			"has_video":      hasVideo,
		}

		if targetSID, ok := payload["target_socket_id"].(string); ok && targetSID != "" {
			sm.IO.To(socketio.Room(targetSID)).Emit("video_state_changed", out)
		}
		if channelID, ok := payload["channel_id"].(string); ok && channelID != "" {
			voiceRoom := fmt.Sprintf("voice_%s", channelID)
			client.To(socketio.Room(voiceRoom)).Emit("video_state_changed", out)
		}
		if groupID, ok := payload["group_id"].(string); ok && groupID != "" {
			groupRoom := fmt.Sprintf("group_%s", groupID)
			client.To(socketio.Room(groupRoom)).Emit("video_state_changed", out)
		}
	})

	client.On("screen_share_state_changed", func(datas ...any) {
		if len(datas) == 0 {
			return
		}
		payload := parsePayloadMap(datas[0])
		uIDVal, _ := sm.socketUsers.Load(sid)
		userID, _ := uIDVal.(string)

		socketID := sid
		if s, ok := payload["sender_socket_id"].(string); ok && s != "" {
			socketID = s
		}
		isSharing, _ := payload["is_sharing"].(bool)

		out := map[string]interface{}{
			"from_socket_id": socketID,
			"user_id":        userID,
			"is_sharing":     isSharing,
		}

		if targetSID, ok := payload["target_socket_id"].(string); ok && targetSID != "" {
			sm.IO.To(socketio.Room(targetSID)).Emit("screen_share_state_changed", out)
		}
		if channelID, ok := payload["channel_id"].(string); ok && channelID != "" {
			voiceRoom := fmt.Sprintf("voice_%s", channelID)
			client.To(socketio.Room(voiceRoom)).Emit("screen_share_state_changed", out)
		}
		if groupID, ok := payload["group_id"].(string); ok && groupID != "" {
			groupRoom := fmt.Sprintf("group_%s", groupID)
			client.To(socketio.Room(groupRoom)).Emit("screen_share_state_changed", out)
		}
	})
}

func (sm *ServerManager) voiceChannelsCallsCopy(channelID string) map[string]map[string]interface{} {
	cp := make(map[string]map[string]interface{})
	if parts, ok := sm.voiceChannelCalls[channelID]; ok {
		for k, v := range parts {
			cp[k] = v
		}
	}
	return cp
}
