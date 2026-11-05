"""Download OpenStreetMap layers for the Raipur study boundary.

Run from anywhere:  python ml/preprocessing/fetch_osm.py

Needs data/boundaries/raipur_boundary.geojson (see fetch_boundary.py). Writes
one GeoPackage per layer to data/raw/osm/, in EPSG:4326. Downloads are cached in
data/raw/osm/cache/, so rerunning after a failure does not start again.
"""

import time
from pathlib import Path

import geopandas as gpd
import osmnx as ox
from osmnx._errors import ResponseStatusCodeError
from requests.exceptions import RequestException

ROOT = Path(__file__).resolve().parents[2]
BOUNDARY = ROOT / "data/boundaries/raipur_boundary.geojson"
OUTPUT_DIR = ROOT / "data/raw/osm"

MAX_ATTEMPTS = 6
FIRST_WAIT_SECONDS = 60

# Each layer: the OSM tags to request, the geometry types to keep and the columns to keep
LAYERS = {
    "rail": {
        "tags": {"railway": "rail"},
        "geometry": ["LineString", "MultiLineString"],
        "columns": ["name", "railway"],
    },
    "hospitals": {
        "tags": {"amenity": "hospital"},
        "geometry": ["Point", "Polygon", "MultiPolygon"],
        "columns": ["name", "amenity"],
    },
    "schools": {
        "tags": {"amenity": "school"},
        "geometry": ["Point", "Polygon", "MultiPolygon"],
        "columns": ["name", "amenity"],
    },
    "buildings": {
        "tags": {"building": True},
        "geometry": ["Polygon", "MultiPolygon"],
        "columns": ["building"],
    },
}


def with_retries(download, name):
    """Run a download, waiting longer after each failure, as Overpass asks.

    The public server is often busy, so failures are expected here.
    """
    wait_seconds = FIRST_WAIT_SECONDS
    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            return download()
        except (ResponseStatusCodeError, RequestException) as error:
            if attempt == MAX_ATTEMPTS:
                raise
            print(
                f"{name}: attempt {attempt} failed ({type(error).__name__}), "
                f"waiting {wait_seconds} s",
                flush=True,
            )
            time.sleep(wait_seconds)
            wait_seconds *= 2


def save(gdf, name):
    path = OUTPUT_DIR / f"{name}.gpkg"
    gdf.to_file(path, driver="GPKG")
    print(f"{name}: {len(gdf):,} features -> {path.name}", flush=True)


def fetch_roads(boundary):
    graph = ox.graph_from_polygon(boundary, network_type="drive")
    roads = ox.graph_to_gdfs(graph, nodes=False).reset_index()
    roads = roads[["u", "v", "highway", "name", "length", "geometry"]].copy()

    # A road made of several OSM ways can hold a list of values, which a
    # GeoPackage cannot store
    for column in ["highway", "name"]:
        roads[column] = roads[column].apply(
            lambda value: ";".join(map(str, value)) if isinstance(value, list) else value
        )
    return roads


def fetch_layer(boundary, tags, geometry, columns):
    features = ox.features_from_polygon(boundary, tags=tags).reset_index()
    features = features[features.geometry.geom_type.isin(geometry)]
    keep = ["element", "id"] + [c for c in columns if c in features.columns] + ["geometry"]
    return features[keep]


def main():
    ox.settings.http_user_agent = "UrbanInfra-ML-student-project/0.1"
    ox.settings.cache_folder = str(OUTPUT_DIR / "cache")
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    boundary = gpd.read_file(BOUNDARY).geometry.iloc[0]

    save(with_retries(lambda: fetch_roads(boundary), "roads"), "roads")
    for name, layer in LAYERS.items():
        save(with_retries(lambda: fetch_layer(boundary, **layer), name), name)


if __name__ == "__main__":
    main()
