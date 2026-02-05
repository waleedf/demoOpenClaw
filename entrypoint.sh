#!/bin/bash
set -e

# Setup directories
mkdir -p /data/.openclaw /data/workspace/skills /data/.openclaw/credentials

# Create absolute minimal config
cat > /data/.openclaw/openclaw.json << 'EOF'
{
  "gateway": {
    "mode": "local"
  },
  "channels": {
    "telegram": {
      "enabled": true
    }
  }
}
EOF

chown -R openclaw:openclaw /data

# Start gateway as openclaw user with explicit settings
cd /data
exec gosu openclaw env \
  ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY}" \
  TELEGRAM_BOT_TOKEN="${TELEGRAM_BOT_TOKEN}" \
  ANTHROPIC_MODEL="${ANTHROPIC_MODEL}" \
  node /usr/local/lib/node_modules/openclaw/dist/entry.js gateway start \
  --port 18789 \
  --bind lan \
  --allow-unconfigured
