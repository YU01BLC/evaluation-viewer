#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PUBLIC_DIR="$ROOT_DIR/public"
SOURCE_IN_PUBLIC="$PUBLIC_DIR/icon-source.png"

INPUT_SOURCE="${1:-}"

if [[ -n "$INPUT_SOURCE" ]]; then
  if [[ ! -f "$INPUT_SOURCE" ]]; then
    echo "Source image not found: $INPUT_SOURCE" >&2
    exit 1
  fi
  cp "$INPUT_SOURCE" "$SOURCE_IN_PUBLIC"
fi

if [[ ! -f "$SOURCE_IN_PUBLIC" ]]; then
  echo "Source image not found: $SOURCE_IN_PUBLIC" >&2
  echo "Usage: npm run icons:generate -- /absolute/path/to/evaluation-viewer-favicon.png" >&2
  exit 1
fi

mkdir -p "$PUBLIC_DIR"

# Canonical source for all platforms.
cp "$SOURCE_IN_PUBLIC" "$PUBLIC_DIR/favicon.png"

# Browser favicons.
sips -z 16 16 "$SOURCE_IN_PUBLIC" --out "$PUBLIC_DIR/favicon-16x16.png" >/dev/null
sips -z 32 32 "$SOURCE_IN_PUBLIC" --out "$PUBLIC_DIR/favicon-32x32.png" >/dev/null

# iOS home screen icon.
sips -z 180 180 "$SOURCE_IN_PUBLIC" --out "$PUBLIC_DIR/apple-touch-icon.png" >/dev/null

# Android/PWA icons.
sips -z 192 192 "$SOURCE_IN_PUBLIC" --out "$PUBLIC_DIR/icon-192.png" >/dev/null
sips -z 512 512 "$SOURCE_IN_PUBLIC" --out "$PUBLIC_DIR/icon-512.png" >/dev/null

# Keep legacy filenames in sync so no stale asset is used.
cp "$PUBLIC_DIR/icon-192.png" "$PUBLIC_DIR/android-chrome-192x192.png"
cp "$PUBLIC_DIR/icon-512.png" "$PUBLIC_DIR/android-chrome-512x512.png"
cp "$PUBLIC_DIR/icon-192.png" "$PUBLIC_DIR/android-home-192x192.png"
cp "$PUBLIC_DIR/icon-512.png" "$PUBLIC_DIR/android-home-512x512.png"
cp "$PUBLIC_DIR/icon-192.png" "$PUBLIC_DIR/android-maskable-192.png"
cp "$PUBLIC_DIR/icon-512.png" "$PUBLIC_DIR/android-maskable-512.png"
sips -z 1024 1024 "$SOURCE_IN_PUBLIC" --out "$PUBLIC_DIR/android-maskable-1024.png" >/dev/null

echo "Generated icons from: $SOURCE_IN_PUBLIC"
