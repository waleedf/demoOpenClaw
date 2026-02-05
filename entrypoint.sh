#!/bin/bash
set -e

# Ensure directories exist with correct permissions
mkdir -p /data/.openclaw /data/workspace/skills /data/.openclaw/credentials

# Always overwrite config to ensure it's up to date
cp /app/openclaw.json /data/.openclaw/openclaw.json

chown -R openclaw:openclaw /data

# Start OpenClaw gateway directly as openclaw user
cd /data
exec gosu openclaw node /usr/local/lib/node_modules/openclaw/dist/entry.js gateway start --port 18789 --bind lan
