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
# Countries, for the maps of a continent and of a part of Europe (#39):
# the targets of a Countries map, the continent of a Capitals map, and the
# land around both.
fetch ne_10m_admin_0_countries \
	"https://naturalearth.s3.amazonaws.com/10m_cultural/ne_10m_admin_0_countries.zip"

# --- Terrain layer (FT-33) ---
fetch ne_10m_ocean \
	"https://naturalearth.s3.amazonaws.com/10m_physical/ne_10m_ocean.zip"
fetch ne_10m_rivers_lake_centerlines \
	"https://naturalearth.s3.amazonaws.com/10m_physical/ne_10m_rivers_lake_centerlines.zip"
fetch ne_10m_geography_regions_polys \
	"https://naturalearth.s3.amazonaws.com/10m_physical/ne_10m_geography_regions_polys.zip"
fetch ne_10m_geography_marine_polys \
	"https://naturalearth.s3.amazonaws.com/10m_physical/ne_10m_geography_marine_polys.zip"
# Named peaks with their elevation (FT-37). 711 worldwide, and the famous
# volcanoes are among them even though Natural Earth does not flag them as
# such: Vesuvio, Monte Etna, Fuji, Nevado del Ruiz.
fetch ne_10m_geography_regions_elevation_points \
	"https://naturalearth.s3.amazonaws.com/10m_physical/ne_10m_geography_regions_elevation_points.zip"
# Six lines and 30 KB (FT-37): Equator, both Tropics, both Polar Circles and
# the Date Line. Nothing to curate - they are the same everywhere - and for
# a dozen countries they are the hook: Manaus is on the Equator, Cairo just
# north of the Tropic of Cancer, Rovaniemi on the Arctic Circle.
fetch ne_10m_geographic_lines \
	"https://naturalearth.s3.amazonaws.com/10m_physical/ne_10m_geographic_lines.zip"

# --- Admin-2 from geoBoundaries (#39, batch D) ---
#
# Natural Earth stops at admin-1 for Germany, the Netherlands and Poland.
# These are geoBoundaries' copies of each country's own register (Poland's:
# OpenStreetMap's), pinned to one release commit so a rebuild reads the same
# shapes. Not public domain: Germany's Kreise are © GeoBasis-DE / BKG under
# dl-de/by-2-0 (attribution), the Dutch municipalities CC0, Poland's powiats
# © OpenStreetMap contributors under ODbL - DECISIONS.md, "Admin-2 from
# geoBoundaries".
GEOBOUNDARIES="https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen"
fetch_geojson() {
	local name="$1" url="$2"
	local out="$SOURCE_DIR/geoboundaries/$name.geojson"
	if [ -f "$out" ]; then
		echo "Already downloaded: $out"
		return 0
	fi
	mkdir -p "$SOURCE_DIR/geoboundaries"
	echo "Downloading $url"
	curl -sL -o "$out" "$url"
}
fetch_geojson DEU-ADM3 "$GEOBOUNDARIES/DEU/ADM3/geoBoundaries-DEU-ADM3_simplified.geojson"
fetch_geojson NLD-ADM2 "$GEOBOUNDARIES/NLD/ADM2/geoBoundaries-NLD-ADM2_simplified.geojson"
fetch_geojson POL-ADM2 "$GEOBOUNDARIES/POL/ADM2/geoBoundaries-POL-ADM2_simplified.geojson"
