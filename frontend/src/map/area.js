// Polygon area helpers, and the "Area" readout shown in the drawing toolbar.

import { area } from "@turf/area";

const SQUARE_METERS_PER_HECTARE = 10000;

// Area of one GeoJSON polygon, in hectares
export function getAreaHectares(feature) {
	return area(feature) / SQUARE_METERS_PER_HECTARE;
}

// A number of hectares as readable text, for example "1,265.95"
export function formatHectares(hectares) {
	return hectares.toLocaleString(undefined, {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	});
}

// Builds the readout. Call update() with the selected polygons to refresh it.
export function createAreaReadout() {
	const element = document.createElement("div");
	element.className = "area-readout";

	function update(polygons) {
		if (polygons.length === 0) {
			element.textContent =
				"Click a polygon to see its area. Shift-click to select several.";
			element.classList.remove("has-area");
			return;
		}

		const totalHectares = polygons.reduce(
			(total, polygon) => total + getAreaHectares(polygon),
			0,
		);
		const formatted = formatHectares(totalHectares);

		element.textContent =
			polygons.length === 1
				? `Area: ${formatted} ha`
				: `${polygons.length} polygons: ${formatted} ha`;
		element.classList.add("has-area");
	}

	update([]);

	return { element, update };
}
