#!/usr/bin/env bash
# Downloads and caches the Natural Earth datasets (public domain, 1:10m
# resolution) used to build the demo maps: admin-1 states/provinces (the
# target polygons) and lakes (context/water fill - without it, a state
# whose border runs along a lake, e.g. Michigan on the Great Lakes,
# renders as an unexplained gap next to its neighbors rather than a
# recognizable coastline).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_DIR="$SCRIPT_DIR/../source"

fetch() {
	local name="$1" url="$2"
	local data_dir="$SOURCE_DIR/$name"
	local shp="$data_dir/$name.shp"

	if [ -f "$shp" ]; then
		echo "Already downloaded: $shp"
		return 0
	fi

	mkdir -p "$data_dir"
	local tmp_zip
	tmp_zip="$(mktemp --suffix=.zip)"
	trap 'rm -f "$tmp_zip"' RETURN

	echo "Downloading $url"
	curl -sL -o "$tmp_zip" "$url"
	unzip -o -q "$tmp_zip" -d "$data_dir"
	echo "Extracted to $data_dir"
}

fetch ne_10m_admin_1_states_provinces \
	"https://naturalearth.s3.amazonaws.com/10m_cultural/ne_10m_admin_1_states_provinces.zip"
fetch ne_10m_lakes \
	"https://naturalearth.s3.amazonaws.com/10m_physical/ne_10m_lakes.zip"
