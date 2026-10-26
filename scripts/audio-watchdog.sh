#!/bin/bash
# Keeps the voice batch running: if it exits or crashes, start it again after 30 s.
cd /dev-server
while true; do
  if ! pgrep -f "bun scripts/audio-batch.ts" > /dev/null; then
    echo "$(date -u +%FT%TZ) starting audio batch" >> /tmp/audio-watchdog.log
    WORKERS=6 bun scripts/audio-batch.ts --loop >> /tmp/audio-batch.out 2>&1
    echo "$(date -u +%FT%TZ) audio batch exited ($?)" >> /tmp/audio-watchdog.log
  fi
  sleep 30
done
