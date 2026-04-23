#!/bin/sh
# JARVIS Network — container entrypoint
#
# Boot sequence:
#   1. Verify required env
#   2. Initialize data directory
#   3. Print binary hash (v0 verifiability)
#   4. Start the bot

set -e

# ============ Env verification ============
if [ -z "$TELEGRAM_BOT_TOKEN" ]; then
  echo "[entrypoint] FATAL: TELEGRAM_BOT_TOKEN not set"
  exit 1
fi

if [ -z "$ANTHROPIC_API_KEY" ] && [ "$LLM_PROVIDER" = "anthropic" ]; then
  echo "[entrypoint] FATAL: ANTHROPIC_API_KEY required when LLM_PROVIDER=anthropic"
  exit 1
fi

if [ -z "$TELEGRAM_OWNER_ID" ]; then
  echo "[entrypoint] WARN: TELEGRAM_OWNER_ID not set — admin commands will be disabled"
fi

if [ -z "$PAYMENT_USDC_ADDRESS" ]; then
  echo "[entrypoint] WARN: PAYMENT_USDC_ADDRESS not set — /subscribe will show placeholder"
fi

# ============ Data directory ============
DATA_DIR="${DATA_DIR:-/app/data}"
mkdir -p "$DATA_DIR"
echo "[entrypoint] DATA_DIR: $DATA_DIR"

# ============ Binary hash (v0 verifiability) ============
if [ -f /app/.verifiability/binary-hash.txt ]; then
  echo "[entrypoint] Binary hash: $(cat /app/.verifiability/binary-hash.txt)"
fi

# ============ Start ============
echo "[entrypoint] Starting JARVIS Network bot..."
exec node --expose-gc --max-old-space-size=450 src/index.js
