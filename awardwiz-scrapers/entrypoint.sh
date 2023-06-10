#!/bin/bash
set -eo pipefail
shopt -s dotglob

if [ -n "${MOVE_BROWSERS_TO_PATH}" ]; then
  if ! [ "$(ls -A "$MOVE_BROWSERS_TO_PATH")" ]; then
    cp -r /ms-playwright/* "${MOVE_BROWSERS_TO_PATH}"
    export PLAYWRIGHT_BROWSERS_PATH="${MOVE_BROWSERS_TO_PATH}"
    rm -rf "/ms-playwright"
  fi
fi

rm -rf /tmp/*
Xvfb :0 -screen 0 2560x1440x16 -listen tcp -ac &

# Start a web server on port 8282 so we can view the browser
if which x11vnc > /dev/null; then
  x11vnc -forever -shared -nopw -quiet 2>/dev/null >/dev/null &
  websockify --daemon --web /usr/share/novnc 8282 localhost:5900 2>/dev/null
  fluxbox 2>/dev/null &
fi

trap 'exit 0;' INT TERM;

mkdir -p tmp
"$@"
