#!/bin/sh
set -e

echo "Activating feature 'playwright' on version $VERSION"
env

apt update
npm -g install "playwright@$VERSION"
npx playwright install-deps
