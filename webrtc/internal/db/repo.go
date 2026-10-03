package db

import (
	"encoding/json"
	"errors"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"gorm.io/gorm"

	"vondic/webrtc/internal/crypto"
)

type Repository struct {
	db     *gorm.DB
	crypto *crypto.CryptoService
	secret []byte
}

func NewRepository(database *Database, cryptoSvc *crypto.CryptoService, secretKey string) *Repository {
	return &Repository{
		db:     database.DB,
		crypto: cryptoSvc,
		secret: []byte(secretKey),
	}
}

// AuthenticateToken verifies JWT or session token in DB and returns the User
func (r *Repository) AuthenticateToken(token string) (*User, error) {
	if token == "" {
		return nil, errors.New("empty token")
	}

	// 1. Try parsing as JWT
	claims := jwt.MapClaims{}
	parsedToken, err := jwt.ParseWithClaims(token, claims, func(t *jwt.Token) (interface{}, error) {
		return r.secret, nil
	})
	if err == nil && parsedToken.Valid {
		var uid string
		if sub, ok := claims["sub"].(string); ok && sub != "" {
			uid = sub
		} else if u, ok := claims["user_id"].(string); ok && u != "" {
			uid = u
		}
		if uid != "" {
			var user User
			if err := r.db.Where("id = ?", uid).First(&user).Error; err == nil {
				return &user, nil
			}
		}
	}

	// 2. Try looking up in user_sessions via lookup hash
	lookupKey := crypto.TokenLookupKey(token)
	var session UserSession
	if err := r.db.Where("access_token_lookup = ?", lookupKey).First(&session).Error; err == nil {
		if session.ExpiresAt == nil || session.ExpiresAt.After(time.Now()) {
			var user User
			if err := r.db.Where("id = ?", session.UserID).First(&user).Error; err == nil {
				return &user, nil
			}
		}
	}

	// 3. Fallback: check users table directly
	var user User
	if err := r.db.Where("id = ? OR access_token = ? OR access_token_lookup = ?", token, token, lookupKey).First(&user).Error; err == nil {
		return &user, nil
	}

	return nil, errors.New("invalid or expired token")
}

func (r *Repository) GetUser(userID string) (*User, error) {
	var user User
	err := r.db.Where("id = ?", userID).First(&user).Error
	if err != nil {
		return nil, err
	}
	return &user, nil
}

func (r *Repository) UpdateUserStatus(userID, status string, socketID *string) error {
	now := time.Now()
	updates := map[string]interface{}{
		"status":    status,
		"last_seen": now,
	}
	if socketID != nil {
		updates["socket_id"] = *socketID
	}
	return r.db.Model(&User{}).Where("id = ?", userID).Updates(updates).Error
}

func (r *Repository) GetOnlineUsersCount() (int64, error) {
	var count int64
	err := r.db.Model(&User{}).Where("status = ?", "online").Count(&count).Error
	return count, err
}

func (r *Repository) GetUserSocketID(userID string) (string, error) {
	var user User
	err := r.db.Select("socket_id").Where("id = ?", userID).First(&user).Error
	if err != nil {
		return "", err
	}
	if user.SocketID == nil {
		return "", errors.New("no socket_id")
	}
	return *user.SocketID, nil
}

func (r *Repository) SetUserSocketID(userID, socketID string) error {
	return r.db.Model(&User{}).Where("id = ?", userID).Update("socket_id", socketID).Error
}

func (r *Repository) ClearUserSocketID(socketID string) error {
	return r.db.Model(&User{}).Where("socket_id = ?", socketID).Update("socket_id", nil).Error
}

func (r *Repository) GetMessagesHistory(viewerID, targetID string, limit, offset int) ([]map[string]interface{}, error) {
	if limit <= 0 {
		limit = 50
	}
	var clearedAt *time.Time
	var clear ChatClear
	if err := r.db.Where("user_id = ? AND peer_id = ? AND chat_type = ?", viewerID, targetID, "dm").First(&clear).Error; err == nil {
		clearedAt = &clear.ClearedAt
	}

	query := r.db.Model(&Message{}).Where(
		"((sender_id = ? AND target_id = ?) OR (sender_id = ? AND target_id = ?))",
		viewerID, targetID, targetID, viewerID,
	)
	if clearedAt != nil {
		query = query.Where("created_at > ?", *clearedAt)
	}

	var msgs []Message
	if err := query.Order("created_at desc").Limit(limit).Offset(offset).Find(&msgs).Error; err != nil {
		return nil, err
	}

	return r.formatMessages(msgs), nil
}

func (r *Repository) SetChatCleared(userID, peerID, chatType string) error {
	now := time.Now()
	var clear ChatClear
	if err := r.db.Where("user_id = ? AND peer_id = ? AND chat_type = ?", userID, peerID, chatType).First(&clear).Error; err == nil {
		clear.ClearedAt = now
		return r.db.Save(&clear).Error
	}
	clear = ChatClear{
		UserID:    userID,
		PeerID:    peerID,
		ChatType:  chatType,
		ClearedAt: now,
	}
	return r.db.Create(&clear).Error
}

func (r *Repository) DeleteMessagesHistory(viewerID, targetID, scope string) (int64, error) {
	if scope == "for_me" {
		_ = r.SetChatCleared(viewerID, targetID, "dm")
		return 0, nil
	}
	res := r.db.Where(
		"((sender_id = ? AND target_id = ?) OR (sender_id = ? AND target_id = ?))",
		viewerID, targetID, targetID, viewerID,
	).Delete(&Message{})
	return res.RowsAffected, res.Error
}

func (r *Repository) GetChannelHistory(channelID string, limit, offset int) ([]map[string]interface{}, error) {
	if limit <= 0 {
		limit = 50
	}
	var msgs []Message
	if err := r.db.Where("channel_id = ?", channelID).Order("created_at desc").Limit(limit).Offset(offset).Find(&msgs).Error; err != nil {
		return nil, err
	}
	return r.formatMessages(msgs), nil
}

func (r *Repository) DeleteChannelHistory(channelID string) (int64, error) {
	res := r.db.Where("channel_id = ?", channelID).Delete(&Message{})
	return res.RowsAffected, res.Error
}

func (r *Repository) GetGroupHistory(groupID string, limit, offset int) ([]map[string]interface{}, error) {
	if limit <= 0 {
		limit = 50
	}
	var msgs []Message
	if err := r.db.Where("group_id = ?", groupID).Order("created_at desc").Limit(limit).Offset(offset).Find(&msgs).Error; err != nil {
		return nil, err
	}
	return r.formatMessages(msgs), nil
}

func (r *Repository) DeleteGroupHistory(groupID string) (int64, error) {
	res := r.db.Where("group_id = ?", groupID).Delete(&Message{})
	return res.RowsAffected, res.Error
}

func (r *Repository) SearchMessages(viewerID, targetID, query string) ([]map[string]interface{}, error) {
	q := "%" + strings.ToLower(query) + "%"
	var msgs []Message
	err := r.db.Where(
		"((sender_id = ? AND target_id = ?) OR (sender_id = ? AND target_id = ?)) AND LOWER(content) LIKE ?",
		viewerID, targetID, targetID, viewerID, q,
	).Order("created_at desc").Limit(50).Find(&msgs).Error
	if err != nil {
		return nil, err
	}
	return r.formatMessages(msgs), nil
}

func (r *Repository) SearchChats(viewerID, query string) ([]map[string]interface{}, error) {
	q := "%" + strings.ToLower(query) + "%"
	var users []User
	err := r.db.Where("LOWER(username) LIKE ? AND id != ?", q, viewerID).Limit(20).Find(&users).Error
	if err != nil {
		return nil, err
	}
	result := make([]map[string]interface{}, 0, len(users))
	for _, u := range users {
		item := map[string]interface{}{
			"id":         u.ID,
			"username":   u.Username,
			"avatar_url": u.AvatarURL,
			"status":     u.Status,
		}
		result = append(result, item)
	}
	return result, nil
}

func (r *Repository) SaveMessage(msg *Message) error {
	if msg.ID == "" {
		msg.ID = uuid.New().String()
	}
	now := time.Now().UTC()
	if msg.CreatedAt == nil {
		msg.CreatedAt = &now
	}
	msg.UpdatedAt = &now

	// Encrypt content with MTProto if not E2E/EncProxy
	msg.Content = r.crypto.EncryptPayload(msg.Content)

	return r.db.Create(msg).Error
}

func (r *Repository) DeleteMessage(msgID, senderID string) (bool, error) {
	var msg Message
	if err := r.db.Where("id = ?", msgID).First(&msg).Error; err != nil {
		return false, err
	}
	if msg.SenderID != senderID {
		return false, errors.New("forbidden")
	}
	isDel := true
	return true, r.db.Model(&msg).Update("is_deleted", isDel).Error
}

func (r *Repository) EditMessage(msgID, senderID, newContent string) error {
	var msg Message
	if err := r.db.Where("id = ?", msgID).First(&msg).Error; err != nil {
		return err
	}
	if msg.SenderID != senderID {
		return errors.New("forbidden")
	}
	enc := r.crypto.EncryptPayload(newContent)
	isEdited := true
	now := time.Now().UTC()
	return r.db.Model(&msg).Updates(map[string]interface{}{
		"content":    enc,
		"is_edited":  isEdited,
		"updated_at": now,
	}).Error
}

func (r *Repository) MarkMessagesRead(msgIDs []string, readerID string) error {
	if len(msgIDs) == 0 {
		return nil
	}
	return r.db.Model(&Message{}).Where("id IN ? AND target_id = ?", msgIDs, readerID).Update("is_read", 1).Error
}

func (r *Repository) SavePinnedMessage(msgID, pinnedBy string, isPinned bool) error {
	var p *string
	if isPinned {
		p = &pinnedBy
	}
	return r.db.Model(&Message{}).Where("id = ?", msgID).Update("pinned_by", p).Error
}

func (r *Repository) SaveReaction(msgID, emoji, userID string) (map[string][]string, error) {
	var msg Message
	if err := r.db.Select("id", "reactions").Where("id = ?", msgID).First(&msg).Error; err != nil {
		return nil, err
	}

	reactions := make(map[string][]string)
	if msg.Reactions != nil && *msg.Reactions != "" {
		_ = json.Unmarshal([]byte(*msg.Reactions), &reactions)
	}

	// Toggle reaction
	currentUsers := reactions[emoji]
	found := false
	var updatedUsers []string
	for _, u := range currentUsers {
		if u == userID {
			found = true
		} else {
			updatedUsers = append(updatedUsers, u)
		}
	}
	if !found {
		updatedUsers = append(updatedUsers, userID)
	}

	if len(updatedUsers) > 0 {
		reactions[emoji] = updatedUsers
	} else {
		delete(reactions, emoji)
	}

	bytes, _ := json.Marshal(reactions)
	reactionsStr := string(bytes)
	err := r.db.Model(&Message{}).Where("id = ?", msgID).Update("reactions", reactionsStr).Error
	return reactions, err
}

func (r *Repository) GetChannelParticipants(channelID string) ([]string, error) {
	var parts []ChannelParticipant
	err := r.db.Where("channel_id = ?", channelID).Find(&parts).Error
	if err != nil {
		return nil, err
	}
	var res []string
	for _, p := range parts {
		res = append(res, p.UserID)
	}
	return res, nil
}

func (r *Repository) GetChannelOwner(channelID string) (string, error) {
	var ch Channel
	err := r.db.Where("id = ?", channelID).First(&ch).Error
	if err != nil {
		return "", err
	}
	return ch.OwnerID, nil
}

func (r *Repository) GetGroupMembers(groupID string) ([]string, error) {
	var parts []GroupParticipant
	err := r.db.Where("group_id = ?", groupID).Find(&parts).Error
	if err != nil {
		return nil, err
	}
	var res []string
	for _, p := range parts {
		res = append(res, p.UserID)
	}
	return res, nil
}

func (r *Repository) GetUserDevices(userID string) ([]Device, error) {
	var devices []Device
	err := r.db.Where("user_id = ?", userID).Find(&devices).Error
	return devices, err
}

func (r *Repository) formatMessages(msgs []Message) []map[string]interface{} {
	result := make([]map[string]interface{}, 0, len(msgs))
	for _, m := range msgs {
		content := r.crypto.DecryptPayload(m.Content)
		var attachments interface{} = nil
		isEncProxy := false
		var extra interface{} = nil

		if m.Attachments != nil && *m.Attachments != "" {
			var parsed interface{}
			raw := *m.Attachments
			// try decrypting attachments if encrypted
			decryptedAtt := r.crypto.DecryptPayload(raw)
			if err := json.Unmarshal([]byte(decryptedAtt), &parsed); err == nil {
				attachments = parsed
			} else if err := json.Unmarshal([]byte(raw), &parsed); err == nil {
				attachments = parsed
			} else {
				attachments = raw
			}

			if list, ok := attachments.([]interface{}); ok {
				for _, item := range list {
					if dict, ok := item.(map[string]interface{}); ok {
						if dict["type"] == "encproxy" || dict["is_encproxy"] == true {
							isEncProxy = true
							if ext, hasExt := dict["extra"]; hasExt {
								extra = ext
							}
						}
					}
				}
			}
		}

		if strings.HasPrefix(content, "encproxy:") {
			isEncProxy = true
		}

		var reactions interface{} = nil
		if m.Reactions != nil && *m.Reactions != "" {
			var rMap interface{}
			if err := json.Unmarshal([]byte(*m.Reactions), &rMap); err == nil {
				reactions = rMap
			}
		}

		var ts string
		if m.CreatedAt != nil {
			ts = m.CreatedAt.Format(time.RFC3339)
		}

		item := map[string]interface{}{
			"id":             m.ID,
			"sender_id":      m.SenderID,
			"target_id":      m.TargetID,
			"channel_id":     m.ChannelID,
			"group_id":       m.GroupID,
			"reply_to":       m.ReplyToID,
			"content":        content,
			"attachments":    attachments,
			"type":           m.Type,
			"timestamp":      ts,
			"created_at":     ts,
			"is_read":        m.IsRead,
			"is_deleted":     m.IsDeleted,
			"pinned_by":      m.PinnedBy,
			"reactions":      reactions,
			"is_edited":      m.IsEdited,
			"forwarded_from": m.ForwardedFromID,
			"is_encproxy":    isEncProxy,
			"extra":          extra,
		}
		result = append(result, item)
	}
	return result
}
