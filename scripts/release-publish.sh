#!/usr/bin/env bash
set -euo pipefail

pnpm --filter @nicepkg/vsync run build
pnpm ci:publish
pnpm changeset tag
