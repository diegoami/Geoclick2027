#!/usr/bin/env bash
# Downloads and caches the Natural Earth datasets (public domain, 1:10m
# resolution) used to build the demo maps: admin-1 states/provinces (the
# polygon target maps), lakes (context/water fill - without it, a state
# whose border runs along a lake, e.g. Michigan on the Great Lakes,
# renders as an unexplained gap next to its neighbors rather than a
# recognizable coastline), and populated places (the point target maps -
# towns/cities, see build-points-map.ts and MAPS.md's "Point-target
# design" section).
#
# The five physical datasets below are the Terrain layer (FT-33,
# docs/PLAN_V0.8.md): ocean and rivers so a coastline reads at all - until
# v0.8.0 the sea was the same sand colour as the land - plus Natural
# Earth's *named* physical features, which are the point of the exercise.
# A region is easier to remember against something ("behind the Alps", "on
# the Black Sea") than on its own, and the same named features feed the
# derived half of the fact box (FT-34), so these two features share one
# download.
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
fetch ne_10m_populated_places \
	"https://naturalearth.s3.amazonaws.com/10m_cultural/ne_10m_populated_places.zip"

# --- Terrain layer (FT-33) ---
fetch ne_10m_ocean \
	"https://naturalearth.s3.amazonaws.com/10m_physical/ne_10m_ocean.zip"
fetch ne_10m_rivers_lake_centerlines \
	"https://naturalearth.s3.amazonaws.com/10m_physical/ne_10m_rivers_lake_centerlines.zip"
fetch ne_10m_geography_regions_polys \
	"https://naturalearth.s3.amazonaws.com/10m_physical/ne_10m_geography_regions_polys.zip"
fetch ne_10m_geography_marine_polys \
	"https://naturalearth.s3.amazonaws.com/10m_physical/ne_10m_geography_marine_polys.zip"
# Named peaks with their elevation. Not drawn by the Terrain layer - it is
# the fact builder (FT-34) that reads this one; cached here so there is one
# place that knows where source data comes from.
fetch ne_10m_geography_regions_elevation_points \
	"https://naturalearth.s3.amazonaws.com/10m_physical/ne_10m_geography_regions_elevation_points.zip"
