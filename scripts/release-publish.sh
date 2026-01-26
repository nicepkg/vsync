#!/usr/bin/env bash
set -euo pipefail

cp README.md cli/README.md
cp README_cn.md cli/README_cn.md

pnpm --filter @nicepkg/vsync run build
pnpm ci:publish
pnpm changeset tag
