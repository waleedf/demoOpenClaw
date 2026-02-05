# OpenClaw Railway Deployment
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

# Create openclaw user and directories
RUN useradd -m -s /bin/bash openclaw \
  && mkdir -p /data/.openclaw /data/workspace/skills \
  && chown -R openclaw:openclaw /data

# Copy OpenClaw configuration
COPY --chown=openclaw:openclaw openclaw-config.json /data/.openclaw/openclaw.json

# Copy crypto-trader skill
WORKDIR /data/workspace/skills
COPY --chown=openclaw:openclaw skills/crypto-trader ./crypto-trader

# Install skill dependencies
WORKDIR /data/workspace/skills/crypto-trader
RUN npm install --production

# Set environment variables
ENV OPENCLAW_STATE_DIR=/data/.openclaw
ENV OPENCLAW_WORKSPACE_DIR=/data/workspace
ENV PORT=8080
ENV INTERNAL_GATEWAY_PORT=18789

# Expose ports
EXPOSE 8080 18789

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s \
  CMD curl -f http://localhost:18789/health || exit 1

# Switch to openclaw user
USER openclaw
WORKDIR /data

# Start OpenClaw gateway directly via Node (bypass systemctl)
CMD ["node", "/usr/local/lib/node_modules/openclaw/dist/entry.js", "gateway", "start", "--port", "18789", "--bind", "lan", "--allow-unconfigured"]
