"""Export the Raipur rasters from Google Earth Engine to Google Drive.

Run from anywhere:
    python ml/preprocessing/export_gee.py --dry-run   (only shows the plan)
    python ml/preprocessing/export_gee.py             (starts the exports)

Files appear in the Drive folder named below. Download them to data/raw/gee/.
Rerunning skips exports that are still running, so it does not start duplicates.

Every raster uses EPSG:32644, on a grid snapped to whole multiples of its pixel
size, so 10 m pixels line up with each other and with the 100 m GHSL pixels.
See docs/data_sources.md for why each dataset and date was chosen.
"""

import argparse
import math
from pathlib import Path

import ee
import geopandas as gpd

PROJECT = "urbaninfra-ml"
DRIVE_FOLDER = "UrbanInfra_ML_exports"
CRS = "EPSG:32644"  # UTM zone 44N, the native CRS of Sentinel-2 over Raipur

BOUNDARY = Path(__file__).resolve().parents[2] / "data/boundaries/raipur_boundary.geojson"

NO_DATA = -9999

# Same year as the WorldCover labels, so land-cover training pairs imagery with
# labels of the same period. Each end date is exclusive.
SEASONS = {
    "premonsoon": ("2021-03-01", "2021-06-01"),
    "monsoon": ("2021-06-01", "2021-10-01"),
    "postmonsoon": ("2021-10-01", "2022-03-01"),
}
S2_BANDS = ["B2", "B3", "B4", "B8", "B11"]
MAX_SCENE_CLOUD_PERCENT = 60

# Sentinel-2 scene classification values to remove:
# cloud shadow, medium and high probability cloud, thin cirrus, snow
S2_BAD_PIXEL_CLASSES = [3, 8, 9, 10, 11]

# 2025 and 2030 are left out because GHSL projects them rather than observing them
GHSL_EPOCHS = ["2000", "2005", "2010", "2015", "2020"]


def snapped_bounds(pixel_size):
    """Study area bounds in metres, expanded outwards to whole pixels."""
    west, south, east, north = gpd.read_file(BOUNDARY).to_crs(CRS).total_bounds
    return (
        math.floor(west / pixel_size) * pixel_size,
        math.floor(south / pixel_size) * pixel_size,
        math.ceil(east / pixel_size) * pixel_size,
        math.ceil(north / pixel_size) * pixel_size,
    )


def grid(pixel_size):
    """Export settings for a grid with the given pixel size."""
    west, south, east, north = snapped_bounds(pixel_size)
    return {
        "crs": CRS,
        "crsTransform": [pixel_size, 0, west, 0, -pixel_size, north],
        "region": ee.Geometry.Rectangle([west, south, east, north], CRS, False),
    }


def mask_bad_pixels(image):
    scene_class = image.select("SCL")
    is_bad = scene_class.remap(S2_BAD_PIXEL_CLASSES, [1] * len(S2_BAD_PIXEL_CLASSES), 0)
    return image.updateMask(is_bad.Not())


def sentinel2_composite(start, end, region):
    """Median of the cloud-free pixels, plus how many observations each pixel had."""
    scenes = (
        ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
        .filterBounds(region)
        .filterDate(start, end)
        .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", MAX_SCENE_CLOUD_PERCENT))
        .map(mask_bad_pixels)
        .select(S2_BANDS)
    )
    median = scenes.median().toInt16()
    valid_obs = scenes.select("B4").count().unmask(0).rename("valid_obs").toInt16()
    return median.addBands(valid_obs).unmask(NO_DATA), scenes.size()


def ghsl_epochs(collection, band):
    """One band per epoch, for example built_2020."""
    images = [
        ee.Image(f"{collection}/{epoch}").select(band).rename(f"{band}_{epoch}")
        for epoch in GHSL_EPOCHS
    ]
    return ee.Image.cat(images).toFloat()


def build_exports():
    """Every export as: name -> (image, grid settings)."""
    grid_10m = grid(10)
    grid_100m = grid(100)

    exports = {}
    scene_counts = {}
    for season, (start, end) in SEASONS.items():
        name = f"s2_2021_{season}"
        image, scene_count = sentinel2_composite(start, end, grid_10m["region"])
        exports[name] = (image, grid_10m)
        scene_counts[name] = scene_count

    # Categories must never be blended, so WorldCover keeps nearest-neighbour
    exports["worldcover_2021"] = (
        ee.ImageCollection("ESA/WorldCover/v200").first().select("Map").toUint8(),
        grid_10m,
    )

    # Elevation varies smoothly, so bilinear suits the step from 30 m to 10 m
    exports["dem_copernicus"] = (
        ee.ImageCollection("COPERNICUS/DEM/GLO30_2024_1")
        .filterBounds(grid_10m["region"])
        .select("DEM")
        .map(lambda image: image.resample("bilinear"))
        .mosaic()
        .toFloat(),
        grid_10m,
    )

    # GHSL stays at its own 100 m. Population is a count per pixel, so it cannot
    # simply be copied onto a 10 m grid.
    exports["ghsl_built"] = (
        ghsl_epochs("JRC/GHSL/P2023A/GHS_BUILT_S", "built_surface"),
        grid_100m,
    )
    exports["ghsl_pop"] = (
        ghsl_epochs("JRC/GHSL/P2023A/GHS_POP", "population_count"),
        grid_100m,
    )
    return exports, scene_counts


def describe(name, image, settings, scene_count):
    pixel, _, west, _, _, north = settings["crsTransform"]
    _, south, east, _ = snapped_bounds(pixel)
    width, height = (east - west) // pixel, (north - south) // pixel
    bands = image.bandNames().getInfo()
    print(f"{name}: {pixel} m, {width} x {height} pixels, bands {bands}", end="")
    if scene_count is not None:
        print(f", {scene_count.getInfo()} scenes", end="")
    print()


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--dry-run", action="store_true", help="show the plan only")
    args = parser.parse_args()

    ee.Initialize(project=PROJECT)
    exports, scene_counts = build_exports()

    active = {
        task["description"]
        for task in ee.data.getTaskList()
        if task["state"] in ("READY", "RUNNING")
    }

    for name, (image, settings) in exports.items():
        if args.dry_run:
            describe(name, image, settings, scene_counts.get(name))
            continue
        if name in active:
            print(f"{name}: already running, skipped")
            continue

        task = ee.batch.Export.image.toDrive(
            image=image,
            description=name,
            folder=DRIVE_FOLDER,
            fileNamePrefix=name,
            maxPixels=1e9,
            fileFormat="GeoTIFF",
            formatOptions={"noData": NO_DATA} if name.startswith("s2_") else None,
            **settings,
        )
        task.start()
        print(f"{name}: started")


if __name__ == "__main__":
    main()
