# Deploy

## v0 — Self-hosted single-shard (beta customers)

Minimum viable deployment for first beta customers.

### Prerequisites

- Node.js 20+
- A Telegram bot (create via [@BotFather](https://t.me/BotFather))
- Anthropic API key (or OpenAI, per `.env` config)
- 1–2 GB RAM, 10 GB disk
- Optional: git repo for archive mirror (required for community-auditable ground truth)

---

### Quick start

1. Clone the private repo (coordinate access with operator):
   ```bash
   git clone <repo-url> jarvis
   cd jarvis
   ```
2. Copy env template:
   ```bash
   cp deploy/.env.template .env
   ```
3. Fill in required values (see `.env.template` comments):
   - `TELEGRAM_BOT_TOKEN`
   - `ANTHROPIC_API_KEY`
   - `DATA_DIR` (defaults to `./data`; will be created)
4. Copy the codebase from the VibeSwap parent repo (see `src/README.md`).
5. Install dependencies:
   ```bash
   npm install
   ```
6. Run:
   ```bash
   node src/index.js
   ```

---

### Production (Docker, v1)

`docker-compose.yml` ships with v1. For v0 beta, run under a process supervisor (`pm2`, `systemd`, or similar) with auto-restart enabled.

Example `systemd` unit:

```ini
[Unit]
Description=JARVIS Network Shard
After=network.target

[Service]
Type=simple
User=jarvis
WorkingDirectory=/opt/jarvis
EnvironmentFile=/opt/jarvis/.env
ExecStart=/usr/bin/node src/index.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

---

### Archive mirror setup

If you want the archive to be community-auditable (required for federation in v3):

1. Create a git repo for the archive (public or private — private-for-beta is fine).
2. Clone it into `$DATA_DIR/archive/`:
   ```bash
   cd $DATA_DIR
   git clone <archive-repo-url> archive
   ```
3. Enable the mirror in `.env`:
   ```bash
   ARCHIVE_MIRROR_ENABLED=true
   ARCHIVE_MIRROR_INTERVAL_MS=900000  # 15 min
   ```
4. Ensure the process has git push access (deploy key or SSH agent forwarded).

---

### Verifiability commitments (v0)

At first-customer onboarding, record the binary hash per the Verifiable Claims Roadmap in `README.md`:

```bash
# Hash the running bundle
find src -name '*.js' -type f | sort | xargs sha256sum | sha256sum | awk '{print $1}' > .verifiability/binary-hash.txt
git add .verifiability/binary-hash.txt
git tag -a v0-binary-hash -m "Binary hash at first customer onboarding"
git push --tags
```

Publish the hash publicly (README, Twitter/X, on-chain commit) so future reveals prove no backsliding.

---

### Troubleshooting

- **`LLM_PROVIDER not configured`** — check `.env`. Must be one of `anthropic`, `openai`, or `self-hosted`.
- **Archive grows too fast** — `DATA_DIR` disk usage is ~1 MB per 10K messages; plan storage accordingly. Consider the archive mirror to offload to git.
- **`Webhook 403`** — Telegram webhook URL must be HTTPS. Use `ngrok` for local dev; a real domain (Cloudflare Tunnel, Caddy, etc.) for prod.
- **Out-of-memory during triage** — unlikely but possible if a chat generates extreme burst activity. Reduce Haiku triage batch size in config or cap `MAX_CONTEXT_MESSAGES`.

---

### Upgrade path

- **v0 → v1**: add Postgres for metering + credits ledger. Deploy `docker-compose up` variant.
- **v1 → v2**: add crypto payment listener. Requires on-chain wallet + blockchain-node access.
- **v2 → v3**: attestation-gated federation. Requires TEE-capable hardware for operator nodes.

Each upgrade is additive; no breaking migrations between phases.
