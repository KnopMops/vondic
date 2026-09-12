#!/usr/bin/env bash
# ==============================================================================
# Vondic WebRTC / Coturn 10,000+ Concurrent Voice Connections Tuning Script
# ==============================================================================
# Этот скрипт оптимизирует сетевой стек Linux ядра и лимиты дескрипторов
# для хост-сервера, на котором развернут Coturn (STUN/TURN) и WebRTC.
#
# Запуск от root:
#   sudo bash scripts/tune-turn-10k.sh
# ==============================================================================

set -euo pipefail

if [[ $EUID -ne 0 ]]; then
   echo "[-] Ошибка: Этот скрипт должен быть запущен с правами суперпользователя (root)!" 1>&2
   exit 1
fi

echo "[*] Начинаем тюнинг системы для 10,000+ одновременных WebRTC TURN соединений..."

SYSCTL_CONF="/etc/sysctl.d/99-vondic-turn.conf"
cat << 'EOF' > "$SYSCTL_CONF"
# --- Vondic High-Load UDP/WebRTC Tunings ---
# Максимальный размер буферов приема и отправки сокетов (32 MB)
net.core.rmem_max = 33554432
net.core.wmem_max = 33554432

# Дефолтный размер буферов (256 KB)
net.core.rmem_default = 262144
net.core.wmem_default = 262144

# Минимальные буферы для UDP
net.ipv4.udp_rmem_min = 16384
net.ipv4.udp_wmem_min = 16384

# Длина очереди входящих пакетов сетевой карты (PPS)
net.core.netdev_max_backlog = 100000

# Максимальное количество открытых файлов в системе
fs.file-max = 2097152

# Расширение диапазона эфемерных портов
net.ipv4.ip_local_port_range = 1024 65535

# Таблицы conntrack (для предотвращения переполнения при большом числе соединений)
net.netfilter.nf_conntrack_max = 1048576
net.netfilter.nf_conntrack_udp_timeout = 30
net.netfilter.nf_conntrack_udp_timeout_stream = 60

# Быстрая утилизация TIME_WAIT
net.ipv4.tcp_tw_reuse = 1
net.ipv4.tcp_fin_timeout = 15
EOF

echo "[+] Файл $SYSCTL_CONF успешно создан."

# Применение параметров sysctl
echo "[*] Применяем параметры sysctl..."
sysctl --system > /dev/null 2>&1 || sysctl -p "$SYSCTL_CONF"
echo "[+] Параметры ядра успешно применены."

# Настройка системных лимитов (ulimits)
# Coturn при установке через apt обычно запускается от пользователя 'turnserver' или 'coturn'
LIMITS_CONF="/etc/security/limits.d/99-vondic-turn.conf"
cat << 'EOF' > "$LIMITS_CONF"
* soft nofile 1048576
* hard nofile 1048576
* soft nproc 524288
* hard nproc 524288
root soft nofile 1048576
root hard nofile 1048576
turnserver soft nofile 1048576
turnserver hard nofile 1048576
turnserver soft nproc 524288
turnserver hard nproc 524288
coturn soft nofile 1048576
coturn hard nofile 1048576
coturn soft nproc 524288
coturn hard nproc 524288
EOF

echo "[+] Файл лимитов $LIMITS_CONF создан (1,048,576 дескрипторов файлов)."

# Настройка systemd limits для нативного сервиса Coturn (coturn.service / turnserver.service)
for SVC in coturn turnserver docker; do
    SVC_DIR="/etc/systemd/system/${SVC}.service.d"
    mkdir -p "$SVC_DIR"
    cat << 'EOF' > "$SVC_DIR/limits.conf"
[Service]
LimitNOFILE=1048576
LimitNPROC=524288
TasksMax=infinity
EOF
    echo "[+] Лимиты systemd для ${SVC}.service сохранены ($SVC_DIR/limits.conf)."
done

# Включение демона Coturn в /etc/default/coturn (для Debian / Ubuntu)
if [ -f "/etc/default/coturn" ]; then
    sed -i 's/#*TURNSERVER_ENABLED=.*/TURNSERVER_ENABLED=1/' /etc/default/coturn || true
    echo "[+] Включен TURNSERVER_ENABLED=1 в /etc/default/coturn."
fi

# Создание оптимизированного конфига /etc/turnserver.conf.recommended
RECOMMENDED_CONF="/etc/turnserver.conf.recommended"
cat << 'EOF' > "$RECOMMENDED_CONF"
# ==============================================================================
# Vondic Coturn 10,000+ Concurrent Voice Calls High-Load Configuration
# Размещение: /etc/turnserver.conf
# ==============================================================================

# Порт и интерфейсы
listening-port=3478
listening-ip=0.0.0.0

# ------------------------------------------------------------------------------
# ВАЖНО ДЛЯ NAT И СЕТИ:
# Если сервер находится за NAT (проброс портов на роутере), раскомментируйте external-ip:
# Формат: external-ip=ПУБЛИЧНЫЙ_IP/ЛОКАЛЬНЫЙ_IP (например: 203.0.113.5/192.168.140.11)
# Coturn принимает ТОЛЬКО IP-адреса, доменные имена указывать нельзя!
# ------------------------------------------------------------------------------
# external-ip=203.0.113.5/192.168.140.11

# Диапазон UDP портов для медиа-реле (убедитесь, что он проброшен на роутере!)
min-port=49152
max-port=65535

# Аутентификация и Realm
realm=call.vondic.ru
user=vondic:Dim4566212Len
lt-cred-mech
fingerprint

# Оптимизация производительности для 10,000+ голосовых потоков
bps-capacity=0
max-bps=0
no-tcp-relay
stale-nonce=600
max-allocate-timeout=60
mobility
no-cli
no-tls
no-dtls
no-multicast-peers

# Логирование
simple-log
log-file=/var/log/turnserver.log
verbose
EOF

echo "[+] Рекомендованный конфиг сохранен в $RECOMMENDED_CONF"

# Если /etc/turnserver.conf не существует или пуст, копируем
if [ ! -s "/etc/turnserver.conf" ]; then
    cp "$RECOMMENDED_CONF" "/etc/turnserver.conf"
    echo "[+] Скопирован в /etc/turnserver.conf"
fi

echo ""
echo "=============================================================================="
echo "[SUCCESS] Сервер оптимизирован для 10,000+ потоков WebRTC (нативный Coturn)!"
echo "Команды для применения и проверки:"
echo " 1. Применить лимиты systemd:"
echo "    sudo systemctl daemon-reload"
echo ""
echo " 2. Перезапустить сервис Coturn:"
echo "    sudo systemctl restart coturn || sudo systemctl restart turnserver"
echo ""
echo " 3. Проверить статус:"
echo "    sudo systemctl status coturn"
echo ""
echo " 4. Проверить лимит дескрипторов запущенного процесса:"
echo "    cat /proc/\$(pgrep turnserver | head -n1)/limits | grep 'Max open files'"
echo "    (должно быть 1048576)"
echo "=============================================================================="
