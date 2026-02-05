# OpenClaw Railway Deployment (using wrapper server approach)
FROM node:22-bookworm

# Install system dependencies
RUN apt-get update \
  && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    git \
    procps \
    python3 \
    build-essential \
  && rm -rf /var/lib/apt/lists/*

# Install OpenClaw globally
RUN npm install -g openclaw@latest

# Set up wrapper server
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile --prod

# Copy wrapper server source
COPY src ./src

# Create openclaw user and directories
RUN useradd -m -s /bin/bash openclaw \
  && chown -R openclaw:openclaw /app \
  && mkdir -p /data/.openclaw /data/workspace/skills \
  && chown -R openclaw:openclaw /data

# Copy crypto-trader skill
COPY --chown=openclaw:openclaw skills/crypto-trader /data/workspace/skills/crypto-trader

# Install skill dependencies
WORKDIR /data/workspace/skills/crypto-trader
RUN npm install --production

# Back to app directory
WORKDIR /app

# Environment variables
ENV PORT=8080
ENV OPENCLAW_ENTRY=/usr/local/lib/node_modules/openclaw/dist/entry.js
ENV OPENCLAW_STATE_DIR=/data/.openclaw
ENV OPENCLAW_WORKSPACE_DIR=/data/workspace
ENV ANTHROPIC_MODEL=claude-3-5-haiku-20241022

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s \
  CMD curl -f http://localhost:8080/setup/healthz || exit 1

# Switch to openclaw user and start wrapper server
USER openclaw
CMD ["node", "src/server.js"]
