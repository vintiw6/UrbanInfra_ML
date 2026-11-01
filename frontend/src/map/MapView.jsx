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
				attribution: "© OpenStreetMap contributors",
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

	const drawButton = document.createElement("button");
	drawButton.textContent = "Draw Polygon";
	drawButton.disabled = true;

	const selectButton = document.createElement("button");
	selectButton.textContent = "Select / Edit";
	selectButton.disabled = true;

	const deleteButton = document.createElement("button");
	deleteButton.textContent = "Delete Selected";
	deleteButton.disabled = true;

	toolbar.append(drawButton, selectButton, deleteButton);
	container.appendChild(toolbar);

	let draw = null;

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
							fillColor: "#ff0000",
							fillOpacity: 0.3,
							outlineColor: "#ff0000",
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
							selectedPolygonColor: "#2563eb",
							selectedPolygonFillOpacity: 0.3,
							selectedPolygonOutlineColor: "#1d4ed8",
							selectedPolygonOutlineWidth: 3,
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
