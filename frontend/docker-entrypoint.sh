#!/bin/sh
set -eu

# Optional DNS override inside container.
# Example:
#   FRONTEND_DNS_OVERRIDE_IP=192.168.120.200
# This will pin common Vondic domains to the given IP via /etc/hosts.

if [ "${FRONTEND_DNS_OVERRIDE_IP:-}" != "" ]; then
  ip="$FRONTEND_DNS_OVERRIDE_IP"

  # keep idempotent: remove old entries for these hosts
  tmp="$(mktemp)"
  # shellcheck disable=SC2002
  cat /etc/hosts \
    | grep -vE '(\s|^)(api\.vondic\.knopusmedia\.ru|webrtc\.vondic\.knopusmedia\.ru|in\.api\.vondic\.knopusmedia\.ru|in\.webrtc\.vondic\.knopusmedia\.ru)(\s|$)' \
    > "$tmp" || true
  cat "$tmp" > /etc/hosts
  rm -f "$tmp"

  {
    echo "$ip api.vondic.knopusmedia.ru"
    echo "$ip webrtc.vondic.knopusmedia.ru"
    echo "$ip in.api.vondic.knopusmedia.ru"
    echo "$ip in.webrtc.vondic.knopusmedia.ru"
  } >> /etc/hosts
fi

exec "$@"

