package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"vondic/webrtc/internal/api"
	"vondic/webrtc/internal/config"
	"vondic/webrtc/internal/crypto"
	"vondic/webrtc/internal/db"
	"vondic/webrtc/internal/notify"
	"vondic/webrtc/internal/socket"
)

func main() {
	log.Println("[Main] Starting Vondic WebRTC & Real-time Server (Go)...")

	cfg, err := config.LoadConfig()
	if err != nil {
		log.Fatalf("[Main] Failed to load config: %v", err)
	}

	cryptoSvc := crypto.NewCryptoService(cfg.MessageEncryptionKey)
	log.Println("[Main] Cryptographic service initialized")

	var repo *db.Repository
	if cfg.DatabaseURL != "" {
		database, err := db.NewDatabase(cfg.DatabaseURL, cfg.Debug)
		if err != nil {
			log.Printf("[Main] Warning: PostgreSQL connection failed: %v", err)
		} else {
			repo = db.NewRepository(database, cryptoSvc, cfg.SecretKey)
		}
	} else {
		log.Println("[Main] Warning: DATABASE_URL not set")
	}

	notifier := notify.NewNotifier(cfg.RabbitMQURL)

	sm := socket.NewServerManager(repo, notifier)
	log.Println("[Main] Socket.IO Engine.IO v4 server initialized")

	router := api.NewRouter(cfg, repo, sm)
	log.Println("[Main] HTTP REST API router initialized")

	addr := fmt.Sprintf("%s:%d", cfg.Host, cfg.Port)
	srv := &http.Server{
		Addr:         addr,
		Handler:      router.GetHandler(),
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	go func() {
		log.Printf("[Main] Server listening on http://%s", addr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("[Main] Listen error: %v", err)
		}
	}()

	// Graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("[Main] Shutting down server gracefully...")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Printf("[Main] Server shutdown forced: %v", err)
	}
	notifier.Close()
	log.Println("[Main] Server stopped cleanly")
}
