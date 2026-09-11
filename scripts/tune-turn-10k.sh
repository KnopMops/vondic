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
LIMITS_CONF="/etc/security/limits.d/99-vondic-turn.conf"
cat << 'EOF' > "$LIMITS_CONF"
* soft nofile 1048576
* hard nofile 1048576
* soft nproc 524288
* hard nproc 524288
root soft nofile 1048576
root hard nofile 1048576
EOF

echo "[+] Файл лимитов $LIMITS_CONF создан (1,048,576 дескрипторов файлов)."

# Настройка systemd limits для Docker
DOCKER_SERVICE_D="/etc/systemd/system/docker.service.d"
mkdir -p "$DOCKER_SERVICE_D"
cat << 'EOF' > "$DOCKER_SERVICE_D/limits.conf"
[Service]
LimitNOFILE=1048576
LimitNPROC=524288
EOF

echo "[+] Конфигурация лимитов для docker.service сохранена."

echo ""
echo "=============================================================================="
echo "[SUCCESS] Сервер оптимизирован для обработки 10,000+ голосовых потоков WebRTC!"
echo "Рекомендации:"
echo " 1. Убедитесь, что в docker-compose coturn запускается с 'network_mode: host'"
echo " 2. Диапазон портов в coturn: 49152-65535"
echo " 3. Перезапустите docker daemon: systemctl daemon-reload && systemctl restart docker"
echo "=============================================================================="
