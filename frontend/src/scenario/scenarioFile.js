// Saving a scenario to a .json file, and reading one back.
//
// The file is a normal GeoJSON FeatureCollection, so other map tools can open
// it. The zone list is stored next to the polygons, as an extra "categories"
// field, because the polygons only store a zone id.

import { UNASSIGNED_CATEGORY } from "../zoning/categories.js";

const FILE_VERSION = 1;

// Download the given polygons and zones as a .json file
export function saveScenarioFile(polygons, categories) {
	const savedAt = new Date().toISOString();

	const scenario = {
		type: "FeatureCollection",
		version: FILE_VERSION,
		savedAt,
		categories,
		// Keep only what is needed to restore a polygon. This leaves out
		// temporary things like whether it is currently selected.
		features: polygons.map((polygon) => ({
			type: "Feature",
			id: polygon.id,
			geometry: polygon.geometry,
			properties: {
				mode: polygon.properties.mode,
				categoryId: polygon.properties.categoryId,
			},
		})),
	};

	const blob = new Blob([JSON.stringify(scenario, null, 2)], {
		type: "application/json",
	});
	const link = document.createElement("a");
	link.href = URL.createObjectURL(blob);
	link.download = `urbaninfra-scenario-${savedAt.slice(0, 10)}.json`;
	link.click();
	URL.revokeObjectURL(link.href);
}

// Check the text of a scenario file. Returns { categories, features }, ready
// to use. Throws an Error with a readable message if the file is not valid,
// so a bad file is rejected before anything on the map has changed.
export function parseScenarioFile(text) {
	let scenario;
	try {
		scenario = JSON.parse(text);
	} catch {
		throw new Error("This file is not valid JSON.");
	}

	if (
		scenario?.type !== "FeatureCollection" ||
		!Array.isArray(scenario.features) ||
		!Array.isArray(scenario.categories)
	) {
		throw new Error("This file is not an UrbanInfra scenario.");
	}
	if (scenario.version !== FILE_VERSION) {
		throw new Error(`Unsupported scenario version: ${scenario.version}.`);
	}

	const categories = parseCategories(scenario.categories);
	const zoneIds = new Set(categories.map((category) => category.id));

	const features = scenario.features.map((feature) => {
		if (feature?.geometry?.type !== "Polygon") {
			throw new Error("This scenario contains a shape that is not a polygon.");
		}

		const categoryId = feature.properties?.categoryId;

		return {
			type: "Feature",
			...(feature.id === undefined ? {} : { id: feature.id }),
			geometry: feature.geometry,
			properties: {
				mode: "polygon",
				categoryId: zoneIds.has(categoryId)
					? categoryId
					: UNASSIGNED_CATEGORY.id,
			},
		};
	});

	return { categories, features };
}

function parseCategories(rawCategories) {
	if (rawCategories.length === 0) {
		throw new Error("This scenario has no zones.");
	}

	const ids = new Set();
	const names = new Set();

	return rawCategories.map((category) => {
		const { id, name, color } = category ?? {};

		const isValid =
			typeof id === "string" &&
			id !== "" &&
			id !== UNASSIGNED_CATEGORY.id &&
			typeof name === "string" &&
			name.trim() !== "" &&
			typeof color === "string" &&
			/^#[0-9a-f]{6}$/i.test(color); // the only format colour pickers accept
		if (!isValid) {
			throw new Error("This scenario contains an invalid zone.");
		}

		const lowerName = name.trim().toLowerCase();
		if (ids.has(id) || names.has(lowerName)) {
			throw new Error(`This scenario contains the zone "${name}" twice.`);
		}
		ids.add(id);
		names.add(lowerName);

		return { id, name: name.trim(), color };
	});
}
