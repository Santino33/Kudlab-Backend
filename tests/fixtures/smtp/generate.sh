#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
# All keys generated here are public test fixtures, NEVER production credentials.
work=$(mktemp -d /tmp/opencode/smtp-certs.XXXXXX)
trap 'rm -f "$work/ca-key.pem" "$work/server.csr" "$work/extensions"; rmdir "$work"' EXIT
openssl req -x509 -newkey rsa:2048 -nodes -sha256 -days 3650 \
  -keyout "$work/ca-key.pem" -out ca.pem -subj '/CN=Kudlab TEST ONLY SMTP CA'
openssl req -new -newkey rsa:2048 -nodes -sha256 \
  -keyout server-key.pem -out "$work/server.csr" -subj '/CN=localhost'
cat > "$work/extensions" <<'EOF'
basicConstraints=CA:FALSE
keyUsage=digitalSignature,keyEncipherment
extendedKeyUsage=serverAuth
subjectAltName=DNS:localhost
EOF
openssl x509 -req -in "$work/server.csr" -CA ca.pem -CAkey "$work/ca-key.pem" \
  -set_serial 1 -out server-cert.pem -days 3650 -sha256 -extfile "$work/extensions"
openssl verify -CAfile ca.pem -verify_hostname localhost server-cert.pem
