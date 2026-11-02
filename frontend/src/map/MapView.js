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

// NEW: zoning categories and the zone dropdown
import { getCategoryColor } from "../zoning/categories.js";
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

	// NEW: zone dropdown at the top of the toolbar
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

	// NEW: work out which colour a polygon should be.
	// A finished polygon has properties.categoryId, so we use that.
	// A polygon still being drawn has no categoryId yet, so we show the
	// colour of the zone currently picked in the dropdown.
	function getPolygonColor(feature) {
		const categoryId = feature.properties.categoryId || zoningSelect.getValue();
		return getCategoryColor(categoryId);
	}

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
						styles: {
							// NEW: colours are functions, so each polygon
							// gets the colour of its own zone
							fillColor: getPolygonColor,
							fillOpacity: 0.45,
							outlineColor: getPolygonColor,
							outlineOpacity: 1,
							outlineWidth: 3,

							closingPointColor: "#ffff00",
							closingPointWidth: 12,
							closingPointOutlineColor: "#000000",
							closingPointOutlineWidth: 3,
						},
					}),

					new TerraDrawSelectMode({
						styles: {
							// NEW: a selected polygon keeps its zone colour
							// and gets a thick blue outline so you can see
							// it is selected
							selectedPolygonColor: getPolygonColor,
							selectedPolygonFillOpacity: 0.6,
							selectedPolygonOutlineColor: "#1d4ed8",
							selectedPolygonOutlineWidth: 4,
						},

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

			// NEW: when a polygon is finished, store the selected zone
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
