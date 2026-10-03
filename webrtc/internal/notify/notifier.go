package notify

import (
	"context"
	"encoding/json"
	"log"
	"sync"
	"time"

	amqp "github.com/rabbitmq/amqp091-go"
)

type Notifier struct {
	rabbitURL string
	conn      *amqp.Connection
	ch        *amqp.Channel
	mu        sync.Mutex
}

func NewNotifier(rabbitURL string) *Notifier {
	n := &Notifier{rabbitURL: rabbitURL}
	n.connect()
	return n
}

func (n *Notifier) connect() {
	n.mu.Lock()
	defer n.mu.Unlock()

	if n.conn != nil && !n.conn.IsClosed() {
		return
	}

	conn, err := amqp.Dial(n.rabbitURL)
	if err != nil {
		log.Printf("[Notifier] RabbitMQ connection failed: %v", err)
		return
	}

	ch, err := conn.Channel()
	if err != nil {
		conn.Close()
		log.Printf("[Notifier] RabbitMQ channel open failed: %v", err)
		return
	}

	_, err = ch.QueueDeclare(
		"push_queue", // name
		true,         // durable
		false,        // delete when unused
		false,        // exclusive
		false,        // no-wait
		nil,          // arguments
	)
	if err != nil {
		ch.Close()
		conn.Close()
		log.Printf("[Notifier] RabbitMQ queue declare failed: %v", err)
		return
	}

	n.conn = conn
	n.ch = ch
	log.Println("[Notifier] Connected to RabbitMQ push_queue successfully")
}

func (n *Notifier) PushNotifyUser(userID, title, body string, data map[string]interface{}) bool {
	payload := map[string]interface{}{
		"type":    "notification",
		"user_id": userID,
		"title":   title,
		"body":    body,
		"data":    data,
	}
	return n.publish("push_queue", payload)
}

func (n *Notifier) PushCallUser(userID string, callData map[string]interface{}) bool {
	payload := map[string]interface{}{
		"type":      "call",
		"user_id":   userID,
		"call_data": callData,
	}
	return n.publish("push_queue", payload)
}

func (n *Notifier) publish(queueName string, payload map[string]interface{}) bool {
	n.mu.Lock()
	defer n.mu.Unlock()

	if n.ch == nil || (n.conn != nil && n.conn.IsClosed()) {
		n.mu.Unlock()
		n.connect()
		n.mu.Lock()
	}

	if n.ch == nil {
		return false
	}

	bytes, err := json.Marshal(payload)
	if err != nil {
		return false
	}

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	err = n.ch.PublishWithContext(
		ctx,
		"",        // exchange
		queueName, // routing key
		false,     // mandatory
		false,     // immediate
		amqp.Publishing{
			DeliveryMode: amqp.Persistent,
			ContentType:  "application/json",
			Body:         bytes,
		},
	)
	if err != nil {
		log.Printf("[Notifier] RabbitMQ publish to '%s' failed: %v", queueName, err)
		return false
	}

	return true
}

func (n *Notifier) Close() {
	n.mu.Lock()
	defer n.mu.Unlock()
	if n.ch != nil {
		_ = n.ch.Close()
	}
	if n.conn != nil {
		_ = n.conn.Close()
	}
}
