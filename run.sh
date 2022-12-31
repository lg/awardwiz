#!/bin/bash

# If this script is started with PORT defined, we're assuming we're in production server mode

# Start a web server on port 8282 so we can view the browser
Xvfb :0 -screen 0 1280x900x16 -listen tcp -ac &
if [ -z "${PORT}" ]; then
  x11vnc -forever -shared -nopw -quiet 2>/dev/null >/dev/null &
  websockify --daemon --web /usr/share/novnc 8282 localhost:5900 2>/dev/null
  fluxbox 2>/dev/null &
fi

mkdir -p ./tmp
echo -e "maxmemory 128mb\\n daemonize yes\\n dir ./tmp" | redis-server -

if [ -z "${PORT}" ]; then
  node --unhandled-rejections=strict --trace-uncaught --trace-warnings dist/main-debug.js
else
  node --unhandled-rejections=strict --trace-uncaught --trace-warnings dist/main-server.js
fi

exec redis-cli shutdown
