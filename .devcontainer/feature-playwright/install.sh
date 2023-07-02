#!/bin/sh
set -e

echo "Activating feature 'playwright' on version $VERSION"
env

npm -g install "playwright@$VERSION"
npx playwright install-deps
