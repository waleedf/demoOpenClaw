#!/bin/bash
set -e

# Ensure directories exist with correct permissions
mkdir -p /data/.openclaw /data/workspace/skills /data/.openclaw/credentials

# Copy config if it doesn't exist
if [ ! -f /data/.openclaw/openclaw.json ]; then
  cp /app/openclaw.json /data/.openclaw/openclaw.json
fi

chown -R openclaw:openclaw /data

# Start OpenClaw gateway directly as openclaw user
cd /data
exec gosu openclaw node /usr/local/lib/node_modules/openclaw/dist/entry.js gateway start --port 18789 --bind lan
