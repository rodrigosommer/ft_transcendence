#!/usr/bin/env sh
# Issues the self-signed certificate the edge proxy serves.
# Regenerating is harmless: browsers will simply ask to trust it again.
set -e
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CERT_DIR="$ROOT/infra/nginx/certs"

# The certificate has to name every address the site is reached by. A browser
# on another machine does not offer to continue past a name mismatch the way it
# does past an unknown issuer, so an address missing from here is an address
# that cannot be used at all. They are read from the configured origins, which
# means the certificate follows PUBLIC_ORIGIN instead of having to be kept in
# step with it by hand.
san_for() {
  host=$(printf '%s' "$1" | sed -e 's|^[a-zA-Z][a-zA-Z0-9+.-]*://||' -e 's|/.*$||' -e 's|:[0-9]*$||')
  [ -z "$host" ] && return 0
  if printf '%s' "$host" | grep -qE '^[0-9]+(\.[0-9]+){3}$'; then
    printf 'IP:%s' "$host"
  else
    printf 'DNS:%s' "$host"
  fi
}

SANS="DNS:localhost,DNS:wkb.local,IP:127.0.0.1"

if [ -f "$ROOT/.env" ]; then
  ORIGINS=$(sed -n -e 's/^PUBLIC_ORIGIN=//p' -e 's/^PUBLIC_ORIGIN_ALIASES=//p' "$ROOT/.env" | tr ',' '\n')
  for origin in $ORIGINS; do
    entry=$(san_for "$origin")
    [ -n "$entry" ] && SANS="$SANS,$entry"
  done
fi

# Whatever address this machine has on the network it can reach out on, so a
# clean clone on someone else's machine covers their address without being told.
LAN_IP=$(ip -4 route get 1.1.1.1 2>/dev/null | awk '{for (i=1;i<NF;i++) if ($i=="src") print $(i+1)}' | head -1)
[ -n "$LAN_IP" ] && SANS="$SANS,IP:$LAN_IP"

# Anything else the operator wants named, e.g. CERT_EXTRA_SAN='DNS:pc.42.lu'
[ -n "$CERT_EXTRA_SAN" ] && SANS="$SANS,$CERT_EXTRA_SAN"

# Drop duplicates, keeping the first occurrence, so the extension stays tidy.
SANS=$(printf '%s' "$SANS" | tr ',' '\n' | awk '!seen[$0]++' | paste -sd ',' -)

# Reissue when the set of names changes, not only when the file is missing:
# a certificate that no longer covers PUBLIC_ORIGIN is worse than no shortcut.
if [ -f "$CERT_DIR/wkb.crt" ] && [ -f "$CERT_DIR/wkb.key" ] && [ -f "$CERT_DIR/wkb.san" ] &&
   [ "$(cat "$CERT_DIR/wkb.san")" = "$SANS" ]; then
  echo "  certificate already covers $SANS, skipping"
  exit 0
fi

mkdir -p "$CERT_DIR"

# Through the wrapper: an installed openssl is not always one that runs.
ssl() { sh "$ROOT/tools/scripts/openssl.sh" "$@"; }

if ! ssl version >/dev/null; then
  echo "  cannot issue a certificate without a working openssl." >&2
  exit 1
fi

# SAN entries matter: Chrome rejects certificates that only carry a CN.
ssl req -x509 -nodes -newkey rsa:2048 \
  -keyout "$CERT_DIR/wkb.key" \
  -out    "$CERT_DIR/wkb.crt" \
  -days 825 \
  -subj "/C=LU/ST=Luxembourg/L=Luxembourg/O=42 Luxembourg/OU=ft_transcendence/CN=localhost" \
  -addext "subjectAltName=$SANS" \
  >/dev/null 2>&1

printf '%s' "$SANS" > "$CERT_DIR/wkb.san"
chmod 644 "$CERT_DIR/wkb.crt" "$CERT_DIR/wkb.san"
chmod 600 "$CERT_DIR/wkb.key"
echo "  self-signed certificate issued for $SANS (valid 825 days)"
