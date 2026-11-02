#!/bin/sh
# Builds the site and snapshots every item's gallery preview in light, dark and
# reduced motion. Outside CI it runs in the pinned Playwright image on
# linux/amd64, as CI does, so the snapshots match. Extra arguments go to
# `playwright test`, such as --update-snapshots or a grep for one item.
set -eu
IMAGE=mcr.microsoft.com/playwright:v1.63.0-noble
root=$(cd "$(dirname "$0")/../../.." && pwd)

if [ "${VECTOYS_VISUAL_IN_CONTAINER:-}" = 1 ]; then
  cd "$root"
  bun run build
  bun run --cwd apps/site build
  cd apps/site/visual
  exec bunx playwright test "$@"
fi

# A copy of the repository without its installs and builds, so the Mac's
# node_modules never meet Linux. The snapshots and the report come back.
exec docker run --rm --platform linux/amd64 --ipc=host \
  -v "$root:/src" -w /work -e VECTOYS_VISUAL_IN_CONTAINER=1 -e HOST_IDS="$(id -u):$(id -g)" \
  "$IMAGE" sh -c '
    tar -C /src --exclude=node_modules --exclude=dist --exclude=.git --exclude=apps/site/visual/report --exclude=apps/site/visual/results -cf - . | tar -xf -
    npm install --global --silent bun@1.3.14
    bun install --frozen-lockfile
    status=0
    sh apps/site/visual/run.sh "$@" || status=$?
    for dir in snapshots report; do
      rm -rf "/src/apps/site/visual/${dir:?}"
      if [ -d "apps/site/visual/$dir" ]; then cp -R "apps/site/visual/$dir" /src/apps/site/visual/ && chown -R "$HOST_IDS" "/src/apps/site/visual/$dir"; fi
    done
    exit $status
  ' sh "$@"
