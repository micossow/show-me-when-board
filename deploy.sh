#!/bin/sh
# Builds dist/ from HEAD and publishes it (plus recordings/, if any) to the gh-pages branch.
set -e
SHA=$(./build.sh)
TMP=$(mktemp -d)
git worktree add -q "$TMP" gh-pages 2>/dev/null || git worktree add -q --orphan -b gh-pages "$TMP"
find "$TMP" -mindepth 1 -maxdepth 1 ! -name .git ! -name recordings -exec rm -rf {} +
cp -R dist/. "$TMP"/
touch "$TMP/.nojekyll"
[ -d recordings ] && mkdir -p "$TMP/recordings" && cp recordings/*.webm "$TMP/recordings/" 2>/dev/null || true
cd "$TMP" && git add -A && git -c user.name=cr-MichalOssowski -c user.email=michalo2882@gmail.com commit -qm "deploy $SHA" || true
cd - >/dev/null && git worktree remove "$TMP"
echo "$SHA"
