#!/bin/bash

Xvfb :0 -screen 0 1280x900x16 &
sleep 1
x11vnc -display :0 -bg -forever -nopw -listen localhost -xkb -quiet &
sleep 1

exec node --unhandled-rejections=strict "$@"
