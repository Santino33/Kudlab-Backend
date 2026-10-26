# SMTP fixtures — TEST ONLY

These public test certificates and server key contain no real credentials. Never deploy
them or trust this CA outside an isolated test process. The CA private key is discarded.
Only DNS `localhost` is certified, so hostname mismatch remains testable.

Regenerate with OpenSSL from the repository root:

```bash
bash tests/fixtures/smtp/generate.sh
openssl verify -CAfile tests/fixtures/smtp/ca.pem -verify_hostname localhost tests/fixtures/smtp/server-cert.pem
```

Tests may trust `ca.pem` explicitly in their transport or via `NODE_EXTRA_CA_CERTS`
set **before** starting a dedicated Node child. Production configuration has no TLS bypass.
Do not use `NODE_TLS_REJECT_UNAUTHORIZED=0` or `rejectUnauthorized: false`.

Certificates expire ten years after generation; regenerate if expired. The script uses
an isolated temporary directory under `/tmp/opencode` and removes only its own temporary
CA key/CSR. The checked-in server key is deliberately public and usable only for tests.
