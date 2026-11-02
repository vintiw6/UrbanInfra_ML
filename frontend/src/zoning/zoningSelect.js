// Builds the "Zone" dropdown shown in the drawing toolbar.
//
// The dropdown options come from the category list in categories.js.
// When a zone is added, renamed, recoloured or removed, the dropdown
// rebuilds its options automatically.

import {
	getCategories,
	categoryExists,
	getDefaultCategoryId,
	getCategoryColor,
	onCategoriesChange,
	UNASSIGNED_CATEGORY,
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

	// Keep the swatch colour in sync with the dropdown
	function updateSwatch() {
		swatch.style.backgroundColor = getCategoryColor(select.value);
	}

	// (Re)build the list of options from the current categories.
	// Called once at the start, and again every time the list changes.
	function renderOptions() {
		const previousValue = select.value;
		select.innerHTML = ""; // remove all old options

		// One <option> per category
		getCategories().forEach((category) => {
			const option = document.createElement("option");
			option.value = category.id;
			option.textContent = category.name;
			select.appendChild(option);
		});

		// A greyed-out "Unassigned" option. You cannot pick it yourself,
		// but it is shown when you select a polygon whose zone was removed.
		const unassignedOption = document.createElement("option");
		unassignedOption.value = UNASSIGNED_CATEGORY.id;
		unassignedOption.textContent = `(${UNASSIGNED_CATEGORY.name})`;
		unassignedOption.disabled = true;
		select.appendChild(unassignedOption);

		// Keep the same zone selected if it still exists,
		// otherwise go back to the first zone in the list
		if (
			categoryExists(previousValue) ||
			previousValue === UNASSIGNED_CATEGORY.id
		) {
			select.value = previousValue;
		} else {
			select.value = getDefaultCategoryId();
		}

		updateSwatch();
	}

	select.addEventListener("change", updateSwatch);
	renderOptions();
	onCategoriesChange(renderOptions);

	row.append(swatch, select);
	wrapper.append(label, row);

	// Let other code change the dropdown (for example, to show the zone of
	// the polygon you just selected). Changing select.value in code does
	// not fire a "change" event, so we update the swatch ourselves.
	function setValue(categoryId) {
		const isKnown =
			categoryExists(categoryId) || categoryId === UNASSIGNED_CATEGORY.id;
		if (!isKnown) {
			return; // unknown zone id: leave the dropdown as it is
		}
		select.value = categoryId;
		updateSwatch();
	}

	return {
		element: wrapper, // the HTML to put in the toolbar
		select, // the <select> itself, so other code can listen for changes
		getValue: () => select.value, // the selected category id
		setValue, // change the selected category id from code
	};
}
