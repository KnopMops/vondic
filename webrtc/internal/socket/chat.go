package socket

import (
	"encoding/json"
	"fmt"
	"log"
	"time"

	"github.com/google/uuid"
	socketio "github.com/zishang520/socket.io/v2/socket"

	"vondic/webrtc/internal/db"
)

func (sm *ServerManager) bindChatHandlers(client *socketio.Socket) {
	sid := string(client.Id())

	client.On("send_message", func(datas ...any) {
		if len(datas) == 0 {
			return
		}
		payload := parsePayloadMap(datas[0])

		senderIDVal, ok := sm.socketUsers.Load(sid)
		if !ok || senderIDVal == nil {
			client.Emit("error", map[string]string{"message": "Unauthorized"})
			return
		}
		senderID := senderIDVal.(string)

		content, _ := payload["content"].(string)
		msgType, _ := payload["type"].(string)
		if msgType == "" {
			msgType = "text"
		}

		targetUserID, _ := payload["target_user_id"].(string)
		channelID, _ := payload["channel_id"].(string)
		groupID, _ := payload["group_id"].(string)
		replyTo, _ := payload["reply_to"].(string)

		// Check encproxy flags
		isEncProxy, _ := payload["is_encproxy"].(bool)
		extra, _ := payload["extra"].(map[string]interface{})
		attachmentsRaw := payload["attachments"]

		var attachments []interface{}
		if attachmentsRaw != nil {
			if list, ok := attachmentsRaw.([]interface{}); ok {
				attachments = list
			} else if s, ok := attachmentsRaw.(string); ok && s != "" {
				var parsed []interface{}
				if err := json.Unmarshal([]byte(s), &parsed); err == nil {
					attachments = parsed
				}
			}
		}

		if isEncProxy || extra != nil {
			isEncProxy = true
			if extra == nil {
				extra = map[string]interface{}{"encproxy": true}
			}
			attachments = append(attachments, map[string]interface{}{
				"type":        "encproxy",
				"is_encproxy": true,
				"extra":       extra,
			})
		}

		if content == "" && len(attachments) == 0 {
			client.Emit("error", map[string]string{"message": "Content or attachments required"})
			return
		}

		msgID, _ := payload["id"].(string)
		if msgID == "" {
			msgID = uuid.New().String()
		}

		var attString *string
		if len(attachments) > 0 {
			b, _ := json.Marshal(attachments)
			str := string(b)
			attString = &str
		}

		now := time.Now().UTC()
		var targetPtr *string
		if targetUserID != "" {
			targetPtr = &targetUserID
		}
		var channelPtr *string
		if channelID != "" {
			channelPtr = &channelID
		}
		var groupPtr *string
		if groupID != "" {
			groupPtr = &groupID
		}
		var replyPtr *string
		if replyTo != "" {
			replyPtr = &replyTo
		}

		msg := &db.Message{
			ID:          msgID,
			SenderID:    senderID,
			TargetID:    targetPtr,
			ChannelID:   channelPtr,
			GroupID:     groupPtr,
			ReplyToID:   replyPtr,
			Content:     content,
			Attachments: attString,
			Type:        &msgType,
			CreatedAt:   &now,
		}

		if err := sm.repo.SaveMessage(msg); err != nil {
			log.Printf("[Chat] SaveMessage error: %v", err)
			client.Emit("error", map[string]string{"message": "Failed to save message"})
			return
		}

		fullPayload := map[string]interface{}{
			"id":          msgID,
			"sender_id":   senderID,
			"content":     content,
			"type":        msgType,
			"attachments": attachments,
			"reply_to":    replyTo,
			"timestamp":   now.Format(time.RFC3339),
			"is_read":     0,
			"is_encproxy": isEncProxy,
			"extra":       extra,
		}

		// 1. Confirm to sender
		sentPayload := map[string]interface{}{}
		for k, v := range fullPayload {
			sentPayload[k] = v
		}
		sentPayload["status"] = "sent"
		if targetUserID != "" {
			sentPayload["target_id"] = targetUserID
			sentPayload["target_user_id"] = targetUserID
		}
		if channelID != "" {
			sentPayload["channel_id"] = channelID
		}
		if groupID != "" {
			sentPayload["group_id"] = groupID
		}
		client.Emit("message_sent", sentPayload)

		// 2. Deliver to recipients
		if channelID != "" {
			fullPayload["channel_id"] = channelID
			sm.IO.To(socketio.Room(fmt.Sprintf("channel_%s", channelID))).Emit("receive_message", fullPayload)
		} else if groupID != "" {
			fullPayload["group_id"] = groupID
			sm.IO.To(socketio.Room(fmt.Sprintf("group_%s", groupID))).Emit("receive_message", fullPayload)
		} else if targetUserID != "" {
			fullPayload["target_id"] = targetUserID
			fullPayload["target_user_id"] = targetUserID
			targetSID, isOnline := sm.GetUserSocketID(targetUserID)
			if isOnline {
				sm.IO.To(socketio.Room(targetSID)).Emit("receive_message", fullPayload)
			} else {
				// Offline push notification
				senderName := "Новое сообщение"
				if uVal, ok := sm.userNames.Load(sid); ok {
					senderName = uVal.(string)
				}
				bodyText := content
				if isEncProxy {
					bodyText = "🔒 Зашифрованное сообщение"
				} else if len(bodyText) > 60 {
					bodyText = bodyText[:60] + "..."
				}
				sm.notifier.PushNotifyUser(targetUserID, senderName, bodyText, map[string]interface{}{
					"message_id": msgID,
					"sender_id":  senderID,
				})
			}
		}
	})

	client.On("delete_message", func(datas ...any) {
		if len(datas) == 0 {
			return
		}
		payload := parsePayloadMap(datas[0])
		msgID, _ := payload["message_id"].(string)
		if msgID == "" {
			msgID, _ = payload["id"].(string)
		}
		senderIDVal, _ := sm.socketUsers.Load(sid)
		senderID, _ := senderIDVal.(string)

		deleted, err := sm.repo.DeleteMessage(msgID, senderID)
		if err != nil || !deleted {
			return
		}

		delPayload := map[string]interface{}{
			"message_id": msgID,
			"id":         msgID,
			"is_deleted": true,
		}

		if chID, _ := payload["channel_id"].(string); chID != "" {
			delPayload["channel_id"] = chID
			sm.IO.To(socketio.Room(fmt.Sprintf("channel_%s", chID))).Emit("message_deleted", delPayload)
		} else if grID, _ := payload["group_id"].(string); grID != "" {
			delPayload["group_id"] = grID
			sm.IO.To(socketio.Room(fmt.Sprintf("group_%s", grID))).Emit("message_deleted", delPayload)
		} else if targetID, _ := payload["target_id"].(string); targetID != "" {
			delPayload["target_id"] = targetID
			if targetSID, ok := sm.GetUserSocketID(targetID); ok {
				sm.IO.To(socketio.Room(targetSID)).Emit("message_deleted", delPayload)
			}
			client.Emit("message_deleted", delPayload)
		} else {
			client.Emit("message_deleted", delPayload)
		}
	})

	client.On("edit_message", func(datas ...any) {
		if len(datas) == 0 {
			return
		}
		payload := parsePayloadMap(datas[0])
		msgID, _ := payload["message_id"].(string)
		if msgID == "" {
			msgID, _ = payload["id"].(string)
		}
		content, _ := payload["content"].(string)
		senderIDVal, _ := sm.socketUsers.Load(sid)
		senderID, _ := senderIDVal.(string)

		if err := sm.repo.EditMessage(msgID, senderID, content); err != nil {
			return
		}

		editPayload := map[string]interface{}{
			"message_id": msgID,
			"id":         msgID,
			"content":    content,
			"is_edited":  true,
		}

		if chID, _ := payload["channel_id"].(string); chID != "" {
			editPayload["channel_id"] = chID
			sm.IO.To(socketio.Room(fmt.Sprintf("channel_%s", chID))).Emit("message_edited", editPayload)
		} else if grID, _ := payload["group_id"].(string); grID != "" {
			editPayload["group_id"] = grID
			sm.IO.To(socketio.Room(fmt.Sprintf("group_%s", grID))).Emit("message_edited", editPayload)
		} else if targetID, _ := payload["target_id"].(string); targetID != "" {
			editPayload["target_id"] = targetID
			if targetSID, ok := sm.GetUserSocketID(targetID); ok {
				sm.IO.To(socketio.Room(targetSID)).Emit("message_edited", editPayload)
			}
			client.Emit("message_edited", editPayload)
		} else {
			client.Emit("message_edited", editPayload)
		}
	})

	client.On("react_message", func(datas ...any) {
		if len(datas) == 0 {
			return
		}
		payload := parsePayloadMap(datas[0])
		msgID, _ := payload["message_id"].(string)
		emoji, _ := payload["emoji"].(string)
		senderIDVal, _ := sm.socketUsers.Load(sid)
		senderID, _ := senderIDVal.(string)

		reactions, err := sm.repo.SaveReaction(msgID, emoji, senderID)
		if err != nil {
			return
		}

		reactPayload := map[string]interface{}{
			"message_id": msgID,
			"reactions":  reactions,
		}

		if chID, _ := payload["channel_id"].(string); chID != "" {
			sm.IO.To(socketio.Room(fmt.Sprintf("channel_%s", chID))).Emit("message_reaction_update", reactPayload)
		} else if grID, _ := payload["group_id"].(string); grID != "" {
			sm.IO.To(socketio.Room(fmt.Sprintf("group_%s", grID))).Emit("message_reaction_update", reactPayload)
		} else if targetID, _ := payload["target_id"].(string); targetID != "" {
			if targetSID, ok := sm.GetUserSocketID(targetID); ok {
				sm.IO.To(socketio.Room(targetSID)).Emit("message_reaction_update", reactPayload)
			}
			client.Emit("message_reaction_update", reactPayload)
		}
	})

	client.On("pin_message", func(datas ...any) {
		if len(datas) == 0 {
			return
		}
		payload := parsePayloadMap(datas[0])
		msgID, _ := payload["message_id"].(string)
		isPinned, _ := payload["is_pinned"].(bool)
		senderIDVal, _ := sm.socketUsers.Load(sid)
		senderID, _ := senderIDVal.(string)

		if err := sm.repo.SavePinnedMessage(msgID, senderID, isPinned); err != nil {
			return
		}

		pinPayload := map[string]interface{}{
			"message_id": msgID,
			"pinned_by":  senderID,
			"is_pinned":  isPinned,
		}

		if chID, _ := payload["channel_id"].(string); chID != "" {
			sm.IO.To(socketio.Room(fmt.Sprintf("channel_%s", chID))).Emit("message_pinned", pinPayload)
		} else if grID, _ := payload["group_id"].(string); grID != "" {
			sm.IO.To(socketio.Room(fmt.Sprintf("group_%s", grID))).Emit("message_pinned", pinPayload)
		} else if targetID, _ := payload["target_id"].(string); targetID != "" {
			if targetSID, ok := sm.GetUserSocketID(targetID); ok {
				sm.IO.To(socketio.Room(targetSID)).Emit("message_pinned", pinPayload)
			}
			client.Emit("message_pinned", pinPayload)
		}
	})

	client.On("typing", func(datas ...any) {
		if len(datas) == 0 {
			return
		}
		payload := parsePayloadMap(datas[0])
		senderIDVal, _ := sm.socketUsers.Load(sid)
		senderID, _ := senderIDVal.(string)

		typePayload := map[string]interface{}{
			"sender_id": senderID,
			"user_id":   senderID,
		}

		if targetID, _ := payload["target_user_id"].(string); targetID != "" {
			if targetSID, ok := sm.GetUserSocketID(targetID); ok {
				sm.IO.To(socketio.Room(targetSID)).Emit("typing", typePayload)
			}
		} else if chID, _ := payload["channel_id"].(string); chID != "" {
			sm.IO.To(socketio.Room(fmt.Sprintf("channel_%s", chID))).Emit("typing", typePayload)
		} else if grID, _ := payload["group_id"].(string); grID != "" {
			sm.IO.To(socketio.Room(fmt.Sprintf("group_%s", grID))).Emit("typing", typePayload)
		}
	})

	client.On("stop_typing", func(datas ...any) {
		if len(datas) == 0 {
			return
		}
		payload := parsePayloadMap(datas[0])
		senderIDVal, _ := sm.socketUsers.Load(sid)
		senderID, _ := senderIDVal.(string)

		typePayload := map[string]interface{}{
			"sender_id": senderID,
			"user_id":   senderID,
		}

		if targetID, _ := payload["target_user_id"].(string); targetID != "" {
			if targetSID, ok := sm.GetUserSocketID(targetID); ok {
				sm.IO.To(socketio.Room(targetSID)).Emit("stop_typing", typePayload)
			}
		} else if chID, _ := payload["channel_id"].(string); chID != "" {
			sm.IO.To(socketio.Room(fmt.Sprintf("channel_%s", chID))).Emit("stop_typing", typePayload)
		} else if grID, _ := payload["group_id"].(string); grID != "" {
			sm.IO.To(socketio.Room(fmt.Sprintf("group_%s", grID))).Emit("stop_typing", typePayload)
		}
	})

	client.On("message_read", func(datas ...any) {
		if len(datas) == 0 {
			return
		}
		payload := parsePayloadMap(datas[0])
		senderIDVal, _ := sm.socketUsers.Load(sid)
		senderID, _ := senderIDVal.(string)

		var ids []string
		if list, ok := payload["message_ids"].([]interface{}); ok {
			for _, item := range list {
				if s, ok := item.(string); ok {
					ids = append(ids, s)
				}
			}
		}

		_ = sm.repo.MarkMessagesRead(ids, senderID)

		readPayload := map[string]interface{}{
			"message_ids": ids,
			"reader_id":   senderID,
		}

		targetID, _ := payload["target_user_id"].(string)
		if targetID == "" {
			targetID, _ = payload["target_sender_id"].(string)
		}
		if targetID != "" {
			if targetSID, ok := sm.GetUserSocketID(targetID); ok {
				sm.IO.To(socketio.Room(targetSID)).Emit("messages_read_update", readPayload)
			}
			sm.IO.To(socketio.Room(targetID)).Emit("messages_read_update", readPayload)
		}
	})

	client.On("get_history", func(datas ...any) {
		if len(datas) == 0 {
			return
		}
		payload := parsePayloadMap(datas[0])
		senderIDVal, _ := sm.socketUsers.Load(sid)
		senderID, _ := senderIDVal.(string)

		targetID, _ := payload["target_id"].(string)
		limit := 50
		offset := 0
		if l, ok := payload["limit"].(float64); ok && l > 0 {
			limit = int(l)
		}
		if o, ok := payload["offset"].(float64); ok && o >= 0 {
			offset = int(o)
		}

		history, err := sm.repo.GetMessagesHistory(senderID, targetID, limit, offset)
		if err != nil {
			client.Emit("history", []interface{}{})
			return
		}
		client.Emit("history", history)
	})

	client.On("get_group_history", func(datas ...any) {
		if len(datas) == 0 {
			return
		}
		payload := parsePayloadMap(datas[0])
		groupID, _ := payload["group_id"].(string)
		limit := 50
		offset := 0
		if l, ok := payload["limit"].(float64); ok && l > 0 {
			limit = int(l)
		}
		if o, ok := payload["offset"].(float64); ok && o >= 0 {
			offset = int(o)
		}

		history, err := sm.repo.GetGroupHistory(groupID, limit, offset)
		if err != nil {
			client.Emit("group_history", []interface{}{})
			return
		}
		client.Emit("group_history", history)
	})
}
