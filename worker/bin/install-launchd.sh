#!/usr/bin/env bash
# Install and load the Coolshi worker as a launchd agent.
set -euo pipefail

if [[ "$(uname)" != "Darwin" ]]; then
  echo "This script only runs on macOS." >&2
  exit 1
fi

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEMPLATE="$HERE/launchd/com.coolshi.worker.plist"
TARGET_DIR="$HOME/Library/LaunchAgents"
TARGET="$TARGET_DIR/com.coolshi.worker.plist"

mkdir -p "$TARGET_DIR"

sed "s|{{USER}}|$USER|g" "$TEMPLATE" > "$TARGET"
echo "Wrote $TARGET"

launchctl unload "$TARGET" 2>/dev/null || true
launchctl load "$TARGET"
launchctl start com.coolshi.worker

echo
echo "Launchd agent loaded. Verify:"
echo "  launchctl list | grep coolshi"
echo "  tail -f $HERE/logs/worker.log"
