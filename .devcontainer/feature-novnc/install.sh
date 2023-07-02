#!/bin/sh
set -e

echo "Activating feature 'novnc'"

######################
## FROM https://github.com/devcontainers/features/blob/main/src/desktop-lite/install.sh

apt_get_update() {
  if [ "$(find /var/lib/apt/lists/* | wc -l)" = "0" ]; then
    echo "Running apt-get update..."
    apt-get update -y
  fi
}

# Checks if packages are installed and installs them if not
check_packages() {
  if ! dpkg -s "$@" >/dev/null 2>&1; then
    apt_get_update
    apt-get -y install --no-install-recommends "$@"
  fi
}

######################

check_packages xvfb x11vnc novnc fluxbox

cat > /usr/local/bin/start-novnc \
<< EOF
#!/bin/sh
echo "Starting Xvfb on DISPLAY :0.0 (2560x1440x16)"
Xvfb :0 -screen 0 2560x1440x16 -listen tcp -ac &

echo "Starting x11vnc on port 5900"
x11vnc -forever -shared -nopw -quiet 2>/dev/null >/dev/null &

echo "Starting novnc on port 8282"
websockify --daemon --web /usr/share/novnc 8282 localhost:5900 2>/dev/null

echo "Starting fluxbox"
fluxbox 2>/dev/null &
EOF

chmod +x /usr/local/bin/start-novnc