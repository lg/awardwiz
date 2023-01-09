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

mkdir -p ./tmp
if [ -z "${REDIS_URL}" ]; then
  if which redis-server > /dev/null; then
    echo -e "maxmemory 128mb\\n daemonize yes\\n dir ./tmp" | redis-server -
  fi
fi

if [ -n "${PORT}" ]; then
  node --enable-source-maps --unhandled-rejections=strict --trace-uncaught --trace-warnings dist/main-server.js
else
  echo "* debug mode *"
  node --enable-source-maps --unhandled-rejections=strict --trace-uncaught --trace-warnings dist/main-debug.js
fi

# redis-cli shutdown
