// Builds the "Zone" dropdown shown in the drawing toolbar.
//
// The dropdown options come from the ZONING_CATEGORIES list, so adding a
// new category there adds it to the dropdown automatically.

import {
	ZONING_CATEGORIES,
	DEFAULT_CATEGORY_ID,
	getCategoryColor,
} from "./categories.js";

export function createZoningSelect() {
	// Wrapper that holds the label, colour swatch and dropdown together
	const wrapper = document.createElement("div");
	wrapper.className = "zoning-select";

	const label = document.createElement("label");
	label.textContent = "Zone";
	label.htmlFor = "zoning-dropdown";

	// Row with the colour swatch next to the dropdown
	const row = document.createElement("div");
	row.className = "zoning-select-row";

	// Small coloured square that shows the selected zone's colour
	const swatch = document.createElement("span");
	swatch.className = "zoning-swatch";

	const select = document.createElement("select");
	select.id = "zoning-dropdown";

	// One <option> per category
	ZONING_CATEGORIES.forEach((category) => {
		const option = document.createElement("option");
		option.value = category.id;
		option.textContent = category.name;
		select.appendChild(option);
	});

	select.value = DEFAULT_CATEGORY_ID;

	// Keep the swatch colour in sync with the dropdown
	function updateSwatch() {
		swatch.style.backgroundColor = getCategoryColor(select.value);
	}

	select.addEventListener("change", updateSwatch);
	updateSwatch();

	row.append(swatch, select);
	wrapper.append(label, row);

	// NEW: let other code change the dropdown (for example, to show the
	// zone of the polygon you just selected). Changing select.value in code
	// does not fire a "change" event, so we update the swatch ourselves.
	function setValue(categoryId) {
		const exists = ZONING_CATEGORIES.some((item) => item.id === categoryId);
		if (!exists) {
			return; // unknown zone id: leave the dropdown as it is
		}
		select.value = categoryId;
		updateSwatch();
	}

	return {
		element: wrapper, // the HTML to put in the toolbar
		select, // the <select> itself, so other code can listen for changes
		getValue: () => select.value, // the selected category id
		setValue, // NEW: change the selected category id from code
	};
}
