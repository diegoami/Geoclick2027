#!/usr/bin/env bash
# Downloads and caches the Natural Earth admin-1 states/provinces dataset
# (public domain, 1:10m resolution) used to build all admin-1-level demo
# maps (Italy regions, Germany states, USA states, ...).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DATA_DIR="$SCRIPT_DIR/../source/ne_10m_admin_1_states_provinces"
URL="https://naturalearth.s3.amazonaws.com/10m_cultural/ne_10m_admin_1_states_provinces.zip"
SHP="$DATA_DIR/ne_10m_admin_1_states_provinces.shp"

if [ -f "$SHP" ]; then
	echo "Already downloaded: $SHP"
	exit 0
fi

mkdir -p "$DATA_DIR"
TMP_ZIP="$(mktemp --suffix=.zip)"
trap 'rm -f "$TMP_ZIP"' EXIT

echo "Downloading $URL"
curl -sL -o "$TMP_ZIP" "$URL"
unzip -o -q "$TMP_ZIP" -d "$DATA_DIR"
echo "Extracted to $DATA_DIR"
