#!/usr/bin/env bash
set -euo pipefail

pnpm --filter vibe-sync run build
pnpm ci:publish
pnpm changeset tag
