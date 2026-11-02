import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

import { setWorkerUrl } from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";

import {
	TerraDraw,
	TerraDrawPolygonMode,
	TerraDrawSelectMode,
} from "terra-draw";

import { TerraDrawMapLibreGLAdapter } from "terra-draw-maplibre-gl-adapter";

// Zoning categories and the zone dropdown
import {
	getCategoryColor,
	categoryExists,
	getDefaultCategoryId,
	onCategoriesChange,
	UNASSIGNED_CATEGORY,
} from "../zoning/categories.js";
import { createZoningSelect } from "../zoning/zoningSelect.js";

// Configure MapLibre worker BEFORE creating the map
setWorkerUrl(workerUrl);

export default function MapView(containerId) {
	const container = document.getElementById(containerId);

	if (!container) {
		console.error("Map container not found:", containerId);
		return;
	}

	// OpenStreetMap style
	const osmStyle = {
		version: 8,
		sources: {
			osm: {
				type: "raster",
				tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
				tileSize: 256,
				attribution: "&copy; OpenStreetMap contributors",
			},
		},
		layers: [
			{
				id: "osm-layer",
				type: "raster",
				source: "osm",
			},
		],
	};

	// Initialize map
	const map = new maplibregl.Map({
		container,
		style: osmStyle,
		center: [81.63, 21.25],
		zoom: 11,
	});

	map.addControl(new maplibregl.NavigationControl(), "top-right");

	// Drawing toolbar
	const toolbar = document.createElement("div");
	toolbar.className = "drawing-toolbar";

	// Zone dropdown at the top of the toolbar
	const zoningSelect = createZoningSelect();

	const drawButton = document.createElement("button");
	drawButton.textContent = "Draw Polygon";
	drawButton.disabled = true;

	const selectButton = document.createElement("button");
	selectButton.textContent = "Select / Edit";
	selectButton.disabled = true;

	const deleteButton = document.createElement("button");
	deleteButton.textContent = "Delete Selected";
	deleteButton.disabled = true;

	toolbar.append(zoningSelect.element, drawButton, selectButton, deleteButton);
	container.appendChild(toolbar);

	let draw = null;

	// Work out which colour a polygon should be.
	// A finished polygon has properties.categoryId, so we use that.
	// A polygon still being drawn has no categoryId yet, so we show the
	// colour of the zone currently picked in the dropdown.
	function getPolygonColor(feature) {
		const categoryId = feature.properties.categoryId || zoningSelect.getValue();
		return getCategoryColor(categoryId);
	}

	// NEW (Part 3): the styles are kept in variables so we can hand them
	// to Terra Draw again later, which makes it redraw every polygon.
	// Colours are functions, so each polygon gets the colour of its zone.
	const polygonStyles = {
		fillColor: getPolygonColor,
		fillOpacity: 0.45,
		outlineColor: getPolygonColor,
		outlineOpacity: 1,
		outlineWidth: 3,

		closingPointColor: "#ffff00",
		closingPointWidth: 12,
		closingPointOutlineColor: "#000000",
		closingPointOutlineWidth: 3,
	};

	// A selected polygon keeps its zone colour and gets a thick blue
	// outline so you can see it is selected
	const selectStyles = {
		selectedPolygonColor: getPolygonColor,
		selectedPolygonFillOpacity: 0.6,
		selectedPolygonOutlineColor: "#1d4ed8",
		selectedPolygonOutlineWidth: 4,
	};

	// NEW (Part 3): runs every time a zone is added, renamed, recoloured
	// or removed (in the Zones panel)
	onCategoriesChange((change) => {
		if (!draw) {
			return; // Terra Draw has not started yet
		}

		// 1. Polygons whose zone no longer exists become "Unassigned"
		const orphans = draw
			.getSnapshot()
			.filter(
				(feature) =>
					feature.geometry.type === "Polygon" &&
					feature.properties.categoryId &&
					feature.properties.categoryId !== UNASSIGNED_CATEGORY.id &&
					!categoryExists(feature.properties.categoryId),
			);

		orphans.forEach((feature) => {
			draw.updateFeatureProperties(feature.id, {
				categoryId: UNASSIGNED_CATEGORY.id,
			});
		});

		if (orphans.length > 0) {
			console.log(
				`Zone "${change.id}" removed: ${orphans.length} polygon(s) are now Unassigned`,
			);
		}

		// 2. Hand Terra Draw the same styles again. This makes it redraw
		// every polygon, so new zone colours appear straight away.
		draw.updateModeOptions("polygon", { styles: polygonStyles });
		draw.updateModeOptions("select", { styles: selectStyles });
	});

	// Initialize Terra Draw after MapLibre loads
	map.once("load", () => {
		try {
			console.log("Map loaded. Initializing Terra Draw...");

			draw = new TerraDraw({
				adapter: new TerraDrawMapLibreGLAdapter({
					map,
				}),

				modes: [
					new TerraDrawPolygonMode({
						styles: polygonStyles,
					}),

					new TerraDrawSelectMode({
						styles: selectStyles,

						flags: {
							polygon: {
								feature: {
									draggable: true,
									coordinates: {
										midpoints: true,
										draggable: true,
										deletable: true,
									},
								},
							},
						},
					}),
				],
			});

			draw.start();
			draw.setMode("select");

			console.log("Terra Draw initialized successfully.");

			// Enable buttons
			drawButton.disabled = false;
			selectButton.disabled = false;
			deleteButton.disabled = false;

			// When a polygon is finished, store the selected zone
			// inside the polygon's properties
			draw.on("finish", (id, context) => {
				// "finish" also fires after editing (dragging a vertex etc.).
				// We only want brand-new polygons here.
				if (context.mode !== "polygon" || context.action !== "draw") {
					return;
				}

				const categoryId = zoningSelect.getValue();
				draw.updateFeatureProperties(id, { categoryId });

				const feature = draw.getSnapshotFeature(id);
				console.log("New polygon zoned as:", categoryId);
				console.log("Polygon properties:", feature.properties);
			});

			// When you select a polygon, show its zone in the dropdown,
			// so you can see what it is and change it
			draw.on("select", (id) => {
				const feature = draw.getSnapshotFeature(id);
				if (!feature || !feature.properties.categoryId) {
					return;
				}

				zoningSelect.setValue(feature.properties.categoryId);
				console.log("Selected polygon zone:", feature.properties.categoryId);
			});

			// NEW (Part 3): after deselecting an "Unassigned" polygon, put the
			// dropdown back on a real zone, ready for the next polygon you draw
			draw.on("deselect", () => {
				if (zoningSelect.getValue() === UNASSIGNED_CATEGORY.id) {
					zoningSelect.setValue(getDefaultCategoryId());
				}
			});

			// When you change the dropdown while a polygon is selected,
			// give that polygon the new zone. Its colour updates
			// automatically because the colour is looked up from the zone.
			zoningSelect.select.addEventListener("change", () => {
				const selected = draw
					.getSnapshot()
					.filter((feature) => feature.properties.selected === true);

				if (selected.length === 0) {
					// Nothing selected: the new zone will be used for the
					// next polygon you draw
					return;
				}

				const categoryId = zoningSelect.getValue();

				selected.forEach((feature) => {
					draw.updateFeatureProperties(feature.id, { categoryId });
				});

				console.log(
					"Changed zone of",
					selected.length,
					"polygon(s) to:",
					categoryId,
				);
				console.log(
					"Polygon properties:",
					draw.getSnapshotFeature(selected[0].id).properties,
				);
			});

			// Debug map clicks
			map.on("click", () => {
				console.log("Map clicked. Current mode:", draw.getMode());
				console.log("Features:", draw.getSnapshot().length);
			});

			// Draw Polygon
			drawButton.onclick = () => {
				console.log("Activating polygon mode");

				draw.setMode("polygon");
				map.doubleClickZoom.disable();

				drawButton.classList.add("active");
				selectButton.classList.remove("active");
			};

			// Select / Edit
			selectButton.onclick = () => {
				console.log("Activating select mode");

				draw.setMode("select");
				map.doubleClickZoom.enable();

				selectButton.classList.add("active");
				drawButton.classList.remove("active");
			};

			// Delete selected polygon
			deleteButton.onclick = () => {
				const selected = draw
					.getSnapshot()
					.filter((feature) => feature.properties.selected === true);

				if (selected.length > 0) {
					draw.removeFeatures(selected.map((feature) => feature.id));

					console.log("Deleted:", selected.length);
				} else {
					console.log("No selected polygon.");
				}
			};

			console.log("Drawing toolbar ready.");
		} catch (error) {
			console.error("Terra Draw initialization failed:", error);
		}
	});

	return map;
}
