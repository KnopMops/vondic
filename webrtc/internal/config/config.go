package config

import (
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/joho/godotenv"
)

type Config struct {
	SecretKey            string
	DatabaseURL          string
	Host                 string
	Port                 int
	CORSAllowedOrigins   []string
	MessageEncryptionKey string
	RabbitMQURL          string
	FCMCredentialsPath   string
	BackendInternalURL   string
	Debug                bool
}

func LoadConfig() (*Config, error) {
	// Try loading from .env.webrtc or backend/.env.backend
	_ = godotenv.Load(".env.webrtc")
	_ = godotenv.Load(filepath.Join("..", "backend", ".env.backend"))
	_ = godotenv.Load(".env")

	port := 5000
	if p := os.Getenv("PORT"); p != "" {
		if val, err := strconv.Atoi(p); err == nil {
			port = val
		}
	}

	debug := true
	if d := strings.ToLower(os.Getenv("DEBUG")); d == "false" || d == "0" {
		debug = false
	}

	secretKey := os.Getenv("SECRET_KEY")
	if secretKey == "" {
		secretKey = "vondic-default-secret!"
	}

	msgEncKey := os.Getenv("MESSAGE_ENCRYPTION_KEY")
	if msgEncKey == "" {
		msgEncKey = "mPuUjRV-t-5eeaSrEFhVh4yZud-L7rv31SjYdXx9uIU="
	}

	backendURL := os.Getenv("BACKEND_INTERNAL_URL")
	if backendURL == "" {
		backendURL = "http://backend:5050"
	}

	fcmPath := os.Getenv("FCM_CREDENTIALS_PATH")
	if fcmPath == "" {
		fcmPath = "fcm-service-account.json"
	}

	dbURL := buildDatabaseURL()
	rabbitURL := buildRabbitMQURL()
	allowedOrigins := buildAllowedOrigins()

	return &Config{
		SecretKey:            secretKey,
		DatabaseURL:          dbURL,
		Host:                 getEnv("HOST", "0.0.0.0"),
		Port:                 port,
		CORSAllowedOrigins:   allowedOrigins,
		MessageEncryptionKey: msgEncKey,
		RabbitMQURL:          rabbitURL,
		FCMCredentialsPath:   fcmPath,
		BackendInternalURL:   backendURL,
		Debug:                debug,
	}, nil
}

func getEnv(key, defaultVal string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return defaultVal
}

func buildDatabaseURL() string {
	if explicit := os.Getenv("DATABASE_URL"); explicit != "" {
		return cleanPostgresURL(explicit)
	}
	if explicit := os.Getenv("POSTGRES_URL"); explicit != "" {
		return cleanPostgresURL(explicit)
	}

	host := os.Getenv("POSTGRES_HOST")
	if host == "" {
		return ""
	}
	user := getEnv("POSTGRES_USER", "postgres")
	password := os.Getenv("POSTGRES_PASSWORD")
	port := getEnv("POSTGRES_PORT", "5432")
	db := getEnv("POSTGRES_DB", "vondic")
	sslmode := getEnv("POSTGRES_SSLMODE", "disable")

	auth := user
	if password != "" {
		auth = fmt.Sprintf("%s:%s", user, url.QueryEscape(password))
	}

	return fmt.Sprintf("postgres://%s@%s:%s/%s?sslmode=%s", auth, host, port, db, sslmode)
}

func cleanPostgresURL(raw string) string {
	raw = strings.ReplaceAll(raw, "postgresql+psycopg2://", "postgres://")
	raw = strings.ReplaceAll(raw, "postgresql+asyncpg://", "postgres://")
	raw = strings.ReplaceAll(raw, "postgresql://", "postgres://")
	return raw
}

func buildRabbitMQURL() string {
	if explicit := os.Getenv("RABBITMQ_URL"); explicit != "" {
		return explicit
	}
	host := os.Getenv("RABBITMQ_HOST")
	if host == "" {
		host = "rabbitmq"
	}
	port := getEnv("RABBITMQ_PORT", "5672")
	user := getEnv("RABBITMQ_DEFAULT_USER", "guest")
	pass := getEnv("RABBITMQ_DEFAULT_PASS", "guest")
	return fmt.Sprintf("amqp://%s:%s@%s:%s/", user, pass, host, port)
}

func buildAllowedOrigins() []string {
	defaults := []string{
		"https://vondic.ru",
		"https://webrtc.vondic.ru",
		"https://www.vondic.ru",
		"https://vondic.knopusmedia.ru",
		"http://localhost:3000",
		"http://127.0.0.1:3000",
		"http://localhost:5000",
		"http://localhost:1420",
		"http://127.0.0.1:1420",
		"http://192.168.140.11",
		"tauri://localhost",
		"*",
	}

	raw := os.Getenv("CORS_ALLOWED_ORIGINS")
	if raw != "" {
		for _, o := range strings.Split(raw, ",") {
			trimmed := strings.TrimSpace(o)
			if trimmed != "" {
				defaults = append(defaults, trimmed)
			}
		}
	}
	if fUrl := os.Getenv("FRONTEND_URL"); fUrl != "" {
		defaults = append(defaults, strings.TrimSpace(fUrl))
	}

	// deduplicate
	seen := make(map[string]bool)
	var result []string
	for _, o := range defaults {
		if !seen[o] {
			seen[o] = true
			result = append(result, o)
		}
	}
	return result
}
