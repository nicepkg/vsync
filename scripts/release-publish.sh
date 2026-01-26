#!/usr/bin/env bash
set -euo pipefail

pnpm --filter vsync run build
pnpm ci:publish
pnpm changeset tag
