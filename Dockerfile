# JARVIS Network — Container image
# Inspired by vibeswap/jarvis-bot/Dockerfile; scoped to the JARVIS Network production build.

FROM node:20-slim

# System deps: git (for archive mirror), certs, fonts (for sticker gen)
RUN apt-get update && apt-get install -y --no-install-recommends \
      git ca-certificates \
      fonts-noto-core fonts-noto-mono fontconfig \
  && rm -rf /var/lib/apt/lists/* \
  && fc-cache -fv

WORKDIR /app

# Install dependencies first (layer caching)
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev || npm install --omit=dev

# Copy source code
COPY src/ ./src/

# Data directory (mounted as persistent volume in production)
RUN mkdir -p /app/data

# Verifiability: record binary hash at build time
# Stored at /app/.verifiability/binary-hash.txt for runtime self-reporting.
RUN mkdir -p /app/.verifiability \
  && find src -name '*.js' -type f | sort | xargs sha256sum | sha256sum | awk '{print $1}' > /app/.verifiability/binary-hash.txt \
  && cat /app/.verifiability/binary-hash.txt

# Copy entrypoint if it exists
COPY entrypoint.sh* ./
RUN test -f entrypoint.sh && chmod +x entrypoint.sh || true

# Health check endpoint
EXPOSE 8080

# Default entrypoint: run the bot
CMD ["node", "--expose-gc", "--max-old-space-size=450", "src/index.js"]
