#!/usr/bin/env sh
set -eu

cd "$(dirname "$0")/.."

version="$(tr -d '[:space:]' < VERSION)"
if [ -z "$version" ]; then
  echo "VERSION 文件为空" >&2
  exit 1
fi

commit="$(git rev-parse --short HEAD 2>/dev/null || printf unknown)"
build_date="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

pnpm --dir web install --frozen-lockfile
pnpm --dir web build
mkdir -p build
go build \
  -trimpath \
  -ldflags "-s -w -X main.version=${version} -X main.commit=${commit} -X main.buildDate=${build_date}" \
  -o build/chouqian \
  .
