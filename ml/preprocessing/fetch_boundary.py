"""Download the Raipur study boundary from OpenStreetMap.

Run from anywhere:  python ml/preprocessing/fetch_boundary.py

Writes data/boundaries/raipur_boundary.geojson. See docs/data_sources.md for
why this boundary was chosen and what it leaves out.
"""

from datetime import date
from pathlib import Path

import osmnx as ox

# OpenStreetMap relation for Raipur Tahsil
OSM_RELATION = "R9903142"

# Stored in EPSG:4326. Areas and distances must use this metric CRS instead.
METRIC_CRS = 32644  # UTM zone 44N

OUTPUT = Path(__file__).resolve().parents[2] / "data/boundaries/raipur_boundary.geojson"


def main():
    ox.settings.http_user_agent = "UrbanInfra-ML-student-project/0.1"

    boundary = ox.geocoder.geocode_to_gdf(OSM_RELATION, by_osmid=True)
    if boundary.crs.to_epsg() != 4326:
        raise ValueError(f"Expected EPSG:4326, got {boundary.crs}")
    if not boundary.geometry.iloc[0].is_valid:
        raise ValueError("The downloaded boundary is not a valid polygon")

    area_km2 = boundary.to_crs(METRIC_CRS).area.iloc[0] / 1e6

    # Keep only the fields that describe this boundary
    boundary = boundary[["geometry"]].assign(
        name="Raipur Tahsil",
        source="OpenStreetMap",
        osm_relation=OSM_RELATION,
        license="ODbL 1.0",
        downloaded=date.today().isoformat(),
        area_km2=round(area_km2, 1),
    )

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    boundary.to_file(OUTPUT, driver="GeoJSON")
    print(f"Saved {OUTPUT} ({area_km2:,.1f} km2)")


if __name__ == "__main__":
    main()
