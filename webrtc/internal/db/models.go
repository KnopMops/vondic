package db

import (
	"time"
)

type User struct {
	ID                string     `gorm:"primaryKey;column:id" json:"id"`
	Username          *string    `gorm:"column:username" json:"username"`
	AvatarURL         *string    `gorm:"column:avatar_url" json:"avatar_url"`
	AccessToken       *string    `gorm:"column:access_token" json:"-"`
	AccessTokenLookup *string    `gorm:"column:access_token_lookup" json:"-"`
	SocketID          *string    `gorm:"column:socket_id" json:"socket_id"`
	Status            *string    `gorm:"column:status" json:"status"`
	LastSeen          *time.Time `gorm:"column:last_seen" json:"last_seen"`
	IsBlocked         *int       `gorm:"column:is_blocked" json:"is_blocked"`
	Role              *string    `gorm:"column:role" json:"role"`
}

func (User) TableName() string {
	return "users"
}

type UserSession struct {
	ID                 string     `gorm:"primaryKey;column:id"`
	UserID             string     `gorm:"column:user_id;index"`
	DeviceType         string     `gorm:"column:device_type"`
	AccessTokenLookup  string     `gorm:"column:access_token_lookup;uniqueIndex"`
	AccessTokenHash    string     `gorm:"column:access_token_hash"`
	RefreshTokenLookup string     `gorm:"column:refresh_token_lookup"`
	RefreshTokenHash   string     `gorm:"column:refresh_token_hash"`
	CreatedAt          *time.Time `gorm:"column:created_at"`
	LastActive         *time.Time `gorm:"column:last_active"`
	ExpiresAt          *time.Time `gorm:"column:expires_at"`
	IPAddress          *string    `gorm:"column:ip_address"`
}

func (UserSession) TableName() string {
	return "user_sessions"
}

type Device struct {
	ID         string     `gorm:"primaryKey;column:id"`
	UserID     string     `gorm:"column:user_id;index"`
	Token      string     `gorm:"column:token;uniqueIndex"`
	Platform   string     `gorm:"column:platform"`
	DeviceType string     `gorm:"column:device_type"`
	CreatedAt  *time.Time `gorm:"column:created_at"`
	UpdatedAt  *time.Time `gorm:"column:updated_at"`
}

func (Device) TableName() string {
	return "devices"
}

type Message struct {
	ID              string     `gorm:"primaryKey;column:id" json:"id"`
	SenderID        string     `gorm:"column:sender_id;index" json:"sender_id"`
	TargetID        *string    `gorm:"column:target_id;index" json:"target_id,omitempty"`
	ChannelID       *string    `gorm:"column:channel_id;index" json:"channel_id,omitempty"`
	GroupID         *string    `gorm:"column:group_id;index" json:"group_id,omitempty"`
	ReplyToID       *string    `gorm:"column:reply_to_id" json:"reply_to,omitempty"`
	Content         string     `gorm:"column:content" json:"content"`
	Attachments     *string    `gorm:"column:attachments;type:jsonb" json:"-"`
	Type            *string    `gorm:"column:type" json:"type"`
	CreatedAt       *time.Time `gorm:"column:created_at" json:"timestamp"`
	UpdatedAt       *time.Time `gorm:"column:updated_at" json:"updated_at,omitempty"`
	IsRead          *int       `gorm:"column:is_read" json:"is_read"`
	IsDeleted       *bool      `gorm:"column:is_deleted" json:"is_deleted"`
	PinnedBy        *string    `gorm:"column:pinned_by" json:"pinned_by,omitempty"`
	Reactions       *string    `gorm:"column:reactions;type:jsonb" json:"reactions,omitempty"`
	IsEdited        *bool      `gorm:"column:is_edited" json:"is_edited,omitempty"`
	ForwardedFromID *string    `gorm:"column:forwarded_from_id" json:"forwarded_from,omitempty"`
}

func (Message) TableName() string {
	return "messages"
}

type Channel struct {
	ID      string `gorm:"primaryKey;column:id"`
	OwnerID string `gorm:"column:owner_id"`
}

func (Channel) TableName() string {
	return "channels"
}

type Group struct {
	ID      string `gorm:"primaryKey;column:id"`
	OwnerID string `gorm:"column:owner_id"`
}

func (Group) TableName() string {
	return "groups"
}

type ChannelParticipant struct {
	ID        int    `gorm:"primaryKey;autoIncrement;column:id"`
	ChannelID string `gorm:"column:channel_id;index"`
	UserID    string `gorm:"column:user_id;index"`
}

func (ChannelParticipant) TableName() string {
	return "channel_participants"
}

type GroupParticipant struct {
	ID      int    `gorm:"primaryKey;autoIncrement;column:id"`
	GroupID string `gorm:"column:group_id;index"`
	UserID  string `gorm:"column:user_id;index"`
}

func (GroupParticipant) TableName() string {
	return "group_participants"
}

type ChatClear struct {
	UserID    string    `gorm:"primaryKey;column:user_id"`
	PeerID    string    `gorm:"primaryKey;column:peer_id"`
	ChatType  string    `gorm:"primaryKey;column:chat_type"`
	ClearedAt time.Time `gorm:"column:cleared_at"`
}

func (ChatClear) TableName() string {
	return "chat_clears"
}

type OAuthAccessToken struct {
	ID        int        `gorm:"primaryKey;column:id"`
	UserID    string     `gorm:"column:user_id;index"`
	Token     string     `gorm:"column:token;uniqueIndex"`
	ExpiresAt *time.Time `gorm:"column:expires_at"`
}

func (OAuthAccessToken) TableName() string {
	return "oauth_access_tokens"
}

