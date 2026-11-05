// The "Statistics" panel under the map.
//
// It shows the total mapped area, how many polygons and zones are in use, and
// the area and share of each zone, as a table with a bar in every row.
//
// Like the Zones panel, it never touches the map directly. It is handed the
// current polygons through update(), and looks up zone names and colours from
// categories.js, so renaming or recolouring a zone updates it straight away.

import { getAreaHectares, formatHectares } from "../map/area.js";
import { getCategoryById, onCategoriesChange } from "../zoning/categories.js";

// Work out the statistics for a list of polygons. Zones with no polygons are
// left out, and the biggest zone comes first.
export function computeStats(polygons) {
	const hectaresByZone = new Map();
	let totalHectares = 0;

	polygons.forEach((polygon) => {
		const zoneId = polygon.properties.categoryId;
		const hectares = getAreaHectares(polygon);
		hectaresByZone.set(zoneId, (hectaresByZone.get(zoneId) || 0) + hectares);
		totalHectares += hectares;
	});

	const zones = [...hectaresByZone].map(([zoneId, hectares]) => ({
		zoneId,
		hectares,
		percent: totalHectares > 0 ? (hectares / totalHectares) * 100 : 0,
	}));
	zones.sort((a, b) => b.hectares - a.hectares);

	return { totalHectares, polygonCount: polygons.length, zones };
}

export function createStatsPanel(containerId) {
	const container = document.getElementById(containerId);

	if (!container) {
		console.error("Stats panel container not found:", containerId);
		return;
	}

	container.innerHTML = `
		<h2 class="panel-title">Statistics</h2>
		<p class="panel-hint stats-empty">Draw a polygon to see statistics.</p>

		<div class="stats-content" hidden>
			<dl class="stats-summary">
				<div>
					<dt>Total mapped area</dt>
					<dd class="stats-total"></dd>
				</div>
				<div>
					<dt>Polygons</dt>
					<dd class="stats-polygons"></dd>
				</div>
				<div>
					<dt>Zones in use</dt>
					<dd class="stats-zones"></dd>
				</div>
			</dl>

			<table class="stats-table">
				<thead>
					<tr>
						<th scope="col">Zone</th>
						<th scope="col" class="stats-number">Area (ha)</th>
						<th scope="col" class="stats-number">Share</th>
						<th scope="col" class="stats-bar-column"><span class="stats-visually-hidden">Share of total area</span></th>
					</tr>
				</thead>
				<tbody></tbody>
			</table>
		</div>
	`;

	const emptyMessage = container.querySelector(".stats-empty");
	const content = container.querySelector(".stats-content");
	const tableBody = container.querySelector("tbody");

	// Build one table row: [colour] [name] [area] [share] [bar]
	function createRow({ zoneId, hectares, percent }) {
		const zone = getCategoryById(zoneId);
		const area = formatHectares(hectares);
		const share = `${percent.toFixed(1)}%`;

		const row = document.createElement("tr");

		const nameCell = document.createElement("td");
		const swatch = document.createElement("span");
		swatch.className = "zoning-swatch";
		swatch.style.backgroundColor = zone.color;
		const name = document.createElement("span");
		name.textContent = zone.name;
		nameCell.className = "stats-zone";
		nameCell.append(swatch, name);

		const areaCell = document.createElement("td");
		areaCell.className = "stats-number";
		areaCell.textContent = area;

		const shareCell = document.createElement("td");
		shareCell.className = "stats-number";
		shareCell.textContent = share;

		// The bar's full width means 100% of the total mapped area
		const barCell = document.createElement("td");
		barCell.className = "stats-bar-column";
		const bar = document.createElement("div");
		bar.className = "stats-bar";
		bar.style.width = `${percent}%`;
		bar.style.backgroundColor = zone.color;
		barCell.title = `${zone.name}: ${area} ha, ${share} of the total`;
		barCell.append(bar);

		row.append(nameCell, areaCell, shareCell, barCell);
		return row;
	}

	let polygons = [];

	function render() {
		const stats = computeStats(polygons);

		emptyMessage.hidden = stats.polygonCount > 0;
		content.hidden = stats.polygonCount === 0;

		container.querySelector(".stats-total").textContent =
			`${formatHectares(stats.totalHectares)} ha`;
		container.querySelector(".stats-polygons").textContent = stats.polygonCount;
		container.querySelector(".stats-zones").textContent = stats.zones.length;

		tableBody.replaceChildren(...stats.zones.map(createRow));
	}

	onCategoriesChange(render);
	render();

	return {
		// Call with the current polygons whenever they change
		update(newPolygons) {
			polygons = newPolygons;
			render();
		},
	};
}
