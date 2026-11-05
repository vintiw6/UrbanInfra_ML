# Data Sources

One entry per dataset: source, download date, resolution, CRS, license and processing.

## Study boundary

| Field | Value |
| --- | --- |
| File | `data/boundaries/raipur_boundary.geojson` |
| Area | Raipur Tahsil, Raipur District, Chhattisgarh (about 654 km²) |
| Source | OpenStreetMap, [relation 9903142](https://www.openstreetmap.org/relation/9903142), via Nominatim and OSMnx |
| Downloaded | 2026-11-05 |
| Resolution | Vector |
| CRS | EPSG:4326 for storage; EPSG:32644 (UTM 44N) for area and distance |
| License | [ODbL 1.0](https://www.openstreetmap.org/copyright), © OpenStreetMap contributors |
| Processing | None. Regenerate with `python ml/preprocessing/fetch_boundary.py` |

### Why this boundary

- **Municipal Corporation boundary not used.** OpenStreetMap has no Raipur Municipal Corporation relation. Its smallest administrative areas here are tahsils. A government source could replace it if one is found.
- **Includes land around the city.** The tahsil contains the urban area and surrounding farmland, which the urban growth model needs, because a tight city limit would leave little land for growth to happen on.
- **Manageable size.** Its bounding box is about 12 million pixels per layer at 10 m, compared with about 52 million for Raipur District (2,898 km²).

### Limitations

- **Nava Raipur (Atal Nagar) is outside the boundary**, although the airport is inside. Growth in this planned city will not be modelled, so results describe Raipur's growth only.
- **The boundary is administrative, not a measured urban extent.** The western edge is a tahsil line, so any urban area continuing beyond it towards Durg and Bhilai is cut off.
- **Accuracy is not verified.** This is a volunteer-mapped boundary and has not been compared with an official map.
- **It can change.** OpenStreetMap is edited over time, so rerunning the script may give a slightly different result.
