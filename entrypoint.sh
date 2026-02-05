#!/bin/bash
set -e

# Ensure directories exist with correct permissions
mkdir -p /data/.openclaw /data/workspace/skills
chown -R openclaw:openclaw /data

# Switch to openclaw user and run the server
exec su-exec openclaw node src/server.js
