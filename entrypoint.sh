#!/bin/bash
set -e

# Ensure directories exist with correct permissions
mkdir -p /data/.openclaw /data/workspace/skills

# Copy config if it doesn't exist
if [ ! -f /data/.openclaw/openclaw.json ]; then
  cp /app/openclaw.json /data/.openclaw/openclaw.json
fi

chown -R openclaw:openclaw /data

# Switch to openclaw user and run the server
exec gosu openclaw node src/server.js
