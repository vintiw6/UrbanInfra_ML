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
	getCategories,
	getCategoryColor,
	categoryExists,
	getDefaultCategoryId,
	onCategoriesChange,
	replaceCategories,
	UNASSIGNED_CATEGORY,
} from "../zoning/categories.js";
import { createZoningSelect, MIXED_ZONES } from "../zoning/zoningSelect.js";
import { createAreaReadout } from "./area.js";
import { saveScenarioFile, parseScenarioFile } from "../scenario/scenarioFile.js";

// Configure MapLibre worker BEFORE creating the map
setWorkerUrl(workerUrl);

// onPolygonsChange is called with every finished polygon whenever they change
export default function MapView(containerId, onPolygonsChange) {
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

	const areaReadout = createAreaReadout();

	const saveButton = document.createElement("button");
	saveButton.textContent = "Save Scenario";
	saveButton.disabled = true;

	const loadButton = document.createElement("button");
	loadButton.textContent = "Load Scenario";
	loadButton.disabled = true;

	// Hidden file picker, opened by the Load button
	const fileInput = document.createElement("input");
	fileInput.type = "file";
	fileInput.accept = ".json,application/json";
	fileInput.hidden = true;

	// Short result of the last save or load
	const scenarioMessage = document.createElement("div");
	scenarioMessage.className = "scenario-message";
	scenarioMessage.hidden = true;

	function showScenarioMessage(text, isError = false) {
		scenarioMessage.textContent = text;
		scenarioMessage.classList.toggle("is-error", isError);
		scenarioMessage.hidden = false;
	}

	toolbar.append(
		zoningSelect.element,
		drawButton,
		selectButton,
		deleteButton,
		areaReadout.element,
		saveButton,
		loadButton,
		fileInput,
		scenarioMessage,
	);
	container.appendChild(toolbar);

	let draw = null;

	// Terra Draw can only select one polygon at a time, so polygons added
	// with shift-click are tracked here, as a set of feature ids. They are
	// kept out of the polygons' properties so they never end up in a saved
	// scenario.
	const groupSelection = new Set();

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
	// Shift-clicked polygons are drawn with these styles, so they get the
	// same thick blue outline as the polygon Terra Draw has selected.
	const polygonStyles = {
		fillColor: getPolygonColor,
		fillOpacity: (feature) => (groupSelection.has(feature.id) ? 0.6 : 0.45),
		outlineColor: (feature) =>
			groupSelection.has(feature.id) ? "#1d4ed8" : getPolygonColor(feature),
		outlineOpacity: 1,
		outlineWidth: (feature) => (groupSelection.has(feature.id) ? 4 : 3),

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

	// Hand Terra Draw the same styles again. This makes it redraw every
	// polygon, so colour and selection changes appear straight away.
	function refreshStyles() {
		draw.updateModeOptions("polygon", { styles: polygonStyles });
		draw.updateModeOptions("select", { styles: selectStyles });
	}

	// Every selected polygon: the one Terra Draw has selected, plus any
	// added with shift-click
	function getSelectedPolygons() {
		return draw
			.getSnapshot()
			.filter(
				(feature) =>
					feature.geometry.type === "Polygon" &&
					(feature.properties.selected === true ||
						groupSelection.has(feature.id)),
			);
	}

	// Every finished polygon on the map (not one still being drawn)
	function getFinishedPolygons() {
		return draw
			.getSnapshot()
			.filter(
				(feature) =>
					feature.geometry.type === "Polygon" &&
					!feature.properties.currentlyDrawing,
			);
	}

	// Make the area readout and zone dropdown match the current selection
	function refreshSelection() {
		const selected = getSelectedPolygons();
		areaReadout.update(selected);

		if (selected.length === 0) {
			// Put the dropdown back on a real zone, ready for the next
			// polygon you draw
			const value = zoningSelect.getValue();
			if (value === UNASSIGNED_CATEGORY.id || value === MIXED_ZONES) {
				zoningSelect.setValue(getDefaultCategoryId());
			}
			return;
		}

		const zones = new Set(selected.map((feature) => feature.properties.categoryId));
		zoningSelect.setValue(
			zones.size === 1 ? selected[0].properties.categoryId : MIXED_ZONES,
		);
	}

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

		// 2. Show the new zone colours, and make the dropdown match any
		// selected polygon whose zone was just removed
		refreshStyles();
		refreshSelection();
		onPolygonsChange(getFinishedPolygons());
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
			saveButton.disabled = false;
			loadButton.disabled = false;

			// "change" fires whenever a polygon is selected, deselected,
			// reshaped or deleted
			draw.on("change", () => {
				refreshSelection();
				onPolygonsChange(getFinishedPolygons());
			});

			// Hide shift-clicks from Terra Draw, otherwise it would drop the
			// current selection. Terra Draw listens on the map canvas, so
			// listening on its parent in the capture phase gets there first.
			// A press and its release are always hidden together, or Terra
			// Draw would think the mouse button was still down.
			let hiddenPress = null;
			const canvasContainer = map.getCanvasContainer();
			canvasContainer.addEventListener(
				"pointerdown",
				(event) => {
					hiddenPress = null;
					if (event.shiftKey && draw.getMode() === "select") {
						event.stopPropagation();
						hiddenPress = { x: event.clientX, y: event.clientY };
					}
				},
				true,
			);
			canvasContainer.addEventListener(
				"pointerup",
				(event) => {
					if (!hiddenPress) {
						return;
					}
					event.stopPropagation();

					// If the mouse moved, this was a shift-drag (the map's box
					// zoom), not a shift-click
					const moved = Math.hypot(
						event.clientX - hiddenPress.x,
						event.clientY - hiddenPress.y,
					);
					hiddenPress = null;
					if (moved <= 4) {
						const bounds = canvasContainer.getBoundingClientRect();
						togglePolygonAt(
							map.unproject([
								event.clientX - bounds.left,
								event.clientY - bounds.top,
							]),
						);
					}
				},
				true,
			);

			// Shift-click adds a polygon to the selection, or removes it if it
			// is already selected
			function togglePolygonAt(lngLat) {
				const polygon = draw
					.getFeaturesAtLngLat(lngLat)
					.find((feature) => feature.geometry.type === "Polygon");
				if (!polygon) {
					return;
				}

				if (polygon.properties.selected === true) {
					draw.deselectFeature(polygon.id);
				} else if (groupSelection.has(polygon.id)) {
					groupSelection.delete(polygon.id);
				} else {
					groupSelection.add(polygon.id);
				}

				refreshStyles();
				refreshSelection();
			}

			// A plain click clears the shift-clicked polygons
			map.on("click", (event) => {
				if (
					draw.getMode() === "select" &&
					!event.originalEvent.shiftKey &&
					groupSelection.size > 0
				) {
					groupSelection.clear();
					refreshStyles();
					refreshSelection();
				}
			});

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

			// When you change the dropdown while polygons are selected,
			// give all of them the new zone. Their colours update
			// automatically because the colour is looked up from the zone.
			zoningSelect.select.addEventListener("change", () => {
				const selected = getSelectedPolygons();

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

				groupSelection.clear();
				draw.setMode("polygon");
				refreshStyles();
				refreshSelection();
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

			// Delete selected polygons
			deleteButton.onclick = () => {
				const selected = getSelectedPolygons();

				if (selected.length > 0) {
					draw.removeFeatures(selected.map((feature) => feature.id));
					groupSelection.clear();
					refreshSelection();

					console.log("Deleted:", selected.length);
				} else {
					console.log("No selected polygon.");
				}
			};

			// Save the polygons and zones to a file
			saveButton.onclick = () => {
				const polygons = getFinishedPolygons();
				saveScenarioFile(polygons, getCategories());
				showScenarioMessage(`Saved ${polygons.length} polygon(s).`);
			};

			// Load: pick a file, then replace the polygons and zones with it
			loadButton.onclick = () => fileInput.click();

			fileInput.addEventListener("change", async () => {
				const file = fileInput.files[0];
				fileInput.value = ""; // lets you pick the same file again later
				if (!file) {
					return;
				}

				try {
					// A bad file throws here, before the map has changed
					const scenario = parseScenarioFile(await file.text());

					const current = getFinishedPolygons();
					if (
						current.length > 0 &&
						!window.confirm(
							`Replace the ${current.length} polygon(s) on the map with "${file.name}"?\n\n` +
								"Anything you have not saved will be lost.",
						)
					) {
						return;
					}

					// Leaving draw mode discards a half-drawn polygon, and
					// removing polygons before replacing the zones stops them
					// being marked "Unassigned" when their old zone disappears.
					selectButton.onclick();
					groupSelection.clear();
					draw.removeFeatures(
						getFinishedPolygons().map((polygon) => polygon.id),
					);
					replaceCategories(scenario.categories);

					// Zones first, so the polygons find their zone colours
					const results = draw.addFeatures(scenario.features);
					refreshSelection();

					const loaded = results.filter((result) => result.valid).length;
					const skipped = results.length - loaded;
					showScenarioMessage(
						skipped === 0
							? `Loaded ${loaded} polygon(s).`
							: `Loaded ${loaded} polygon(s). Skipped ${skipped} invalid.`,
						skipped > 0,
					);
				} catch (error) {
					console.error("Could not load scenario:", error);
					showScenarioMessage(error.message, true);
				}
			});

			console.log("Drawing toolbar ready.");
		} catch (error) {
			console.error("Terra Draw initialization failed:", error);
		}
	});

	return map;
}
