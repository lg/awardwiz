#!/bin/bash

# Start a web server on port 8080 so we can view the browser
Xvfb :0 -screen 0 1280x900x16 -listen tcp -ac &
x11vnc -forever -shared -nopw -quiet 2>/dev/null >/dev/null &
websockify --daemon --web /usr/share/novnc 8080 localhost:5900 2>/dev/null
fluxbox 2>/dev/null &

echo -e "maxmemory 1gb\\n daemonize yes\\n dir ./tmp" | redis-server -

node --unhandled-rejections=strict --trace-uncaught --trace-warnings dist/main.js
exec redis-cli shutdown
