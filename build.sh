#!/bin/sh
# Copies app/ to dist/ with the git sha stamped in (R6).
set -e
SHA=$(git rev-parse HEAD)
rm -rf dist && cp -R app dist
sed -i.bak "s/__BUILD_SHA__/$SHA/g" dist/index.html && rm dist/index.html.bak
echo "$SHA"
