#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VERSION="$(tr -d '\r\n ' < "$ROOT/VERSION")"
[[ -n "$VERSION" && "$VERSION" != *[!A-Za-z0-9._-]* ]] || { echo "Invalid VERSION" >&2; exit 1; }
PARENT="$(dirname "$ROOT")"
PACKAGE_NAME="BlueGate-Platform-v${VERSION}"
OUTPUT_DIR="${OUTPUT_DIR:-$PARENT}"
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT
cp -a "$ROOT" "$STAGE/$PACKAGE_NAME"
rm -rf "$STAGE/$PACKAGE_NAME/.git"
find "$STAGE/$PACKAGE_NAME" -type f -name '*.zip' -delete
rm -f "$OUTPUT_DIR/$PACKAGE_NAME.zip"
(cd "$STAGE" && zip -qr "$OUTPUT_DIR/$PACKAGE_NAME.zip" "$PACKAGE_NAME")
rm -rf "$OUTPUT_DIR/$PACKAGE_NAME"
cp -a "$STAGE/$PACKAGE_NAME" "$OUTPUT_DIR/$PACKAGE_NAME"
echo "Created: $OUTPUT_DIR/$PACKAGE_NAME"
echo "Created: $OUTPUT_DIR/$PACKAGE_NAME.zip"
