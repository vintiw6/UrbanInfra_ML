// The "Zones" panel beside the map.
//
// It lists every zone and lets you:
//   - recolour a zone (click its colour square)
//   - rename a zone (edit its name, then press Enter or click elsewhere)
//   - remove a zone (its polygons become "Unassigned")
//   - add a new zone (form at the bottom)
//
// The panel never touches the map directly. It only changes the category
// list in categories.js. The map and the dropdown are told about the change
// and update themselves.

import {
	getCategories,
	addCategory,
	updateCategory,
	isNameTaken,
	removeCategory,
	onCategoriesChange,
	UNASSIGNED_CATEGORY,
} from "./categories.js";

export function createCategoryPanel(containerId) {
	const container = document.getElementById(containerId);

	if (!container) {
		console.error("Category panel container not found:", containerId);
		return;
	}

	// The fixed parts of the panel: title, hint, list, and "add" form
	container.innerHTML = `
		<h2 class="panel-title">Zones</h2>
		<p class="panel-hint">
			Click a colour to change it, or edit a name.
			Changes apply to every polygon in that zone.
		</p>

		<ul class="category-list"></ul>

		<div class="category-row category-row-fixed">
			<span class="category-color-static"></span>
			<span class="category-name-static"></span>
		</div>

		<p class="panel-message" hidden></p>

		<form class="category-add">
			<h3 class="panel-subtitle">Add a zone</h3>
			<div class="category-add-row">
				<input type="color" class="category-add-color" value="#0ea5e9" aria-label="New zone colour" />
				<input type="text" class="category-add-name" placeholder="e.g. Mixed Use" maxlength="40" aria-label="New zone name" />
			</div>
			<button type="submit" class="category-add-button">Add zone</button>
		</form>
	`;

	const list = container.querySelector(".category-list");
	const addForm = container.querySelector(".category-add");
	const addColorInput = container.querySelector(".category-add-color");
	const addNameInput = container.querySelector(".category-add-name");
	const message = container.querySelector(".panel-message");

	// Show a short message in the panel (for example, "name already used").
	// Call with no text to hide it again.
	function showMessage(text = "") {
		message.textContent = text;
		message.hidden = text === "";
	}

	// The "Unassigned" row is shown for reference only (it cannot be edited)
	container.querySelector(".category-color-static").style.backgroundColor =
		UNASSIGNED_CATEGORY.color;
	container.querySelector(".category-name-static").textContent =
		`${UNASSIGNED_CATEGORY.name} (zone was removed)`;

	// Build one row for one zone: [colour] [name] [remove]
	function createRow(category, isOnlyZone) {
		const row = document.createElement("li");
		row.className = "category-row";

		// Colour picker. The "input" event fires while you drag around the
		// colour picker, so the map updates live.
		const colorInput = document.createElement("input");
		colorInput.type = "color";
		colorInput.className = "category-color";
		colorInput.value = category.color;
		colorInput.setAttribute("aria-label", `Colour of ${category.name}`);
		colorInput.addEventListener("input", () => {
			updateCategory(category.id, { color: colorInput.value });
		});

		// Name box. The "change" event fires when you press Enter or click
		// somewhere else, so we don't rename on every single key press.
		const nameInput = document.createElement("input");
		nameInput.type = "text";
		nameInput.className = "category-name";
		nameInput.value = category.name;
		nameInput.maxLength = 40;
		nameInput.setAttribute("aria-label", `Name of ${category.name}`);
		nameInput.addEventListener("change", () => {
			const newName = nameInput.value.trim();

			if (newName === "") {
				nameInput.value = category.name; // empty name: undo the edit
				return;
			}
			if (isNameTaken(newName, category.id)) {
				showMessage(`There is already a zone called "${newName}".`);
				nameInput.value = category.name; // undo the edit
				return;
			}

			showMessage();
			updateCategory(category.id, { name: newName });
		});
		nameInput.addEventListener("keydown", (event) => {
			if (event.key === "Enter") {
				nameInput.blur(); // finish editing, which fires "change"
			}
		});

		// Remove button
		const removeButton = document.createElement("button");
		removeButton.type = "button";
		removeButton.className = "category-remove";
		removeButton.textContent = "\u2715"; // a small "x" symbol
		removeButton.title = isOnlyZone
			? "You need at least one zone"
			: `Remove ${category.name}`;
		removeButton.disabled = isOnlyZone;
		removeButton.addEventListener("click", () => {
			const ok = window.confirm(
				`Remove the zone "${category.name}"?\n\n` +
					`Polygons in this zone will become "${UNASSIGNED_CATEGORY.name}".`,
			);
			if (ok) {
				removeCategory(category.id);
			}
		});

		row.append(colorInput, nameInput, removeButton);
		return row;
	}

	// (Re)build the list of zone rows
	function renderList() {
		const categories = getCategories();
		list.innerHTML = "";
		categories.forEach((category) => {
			list.appendChild(createRow(category, categories.length === 1));
		});
	}

	// Add a new zone when the form is submitted (button or Enter key)
	addForm.addEventListener("submit", (event) => {
		event.preventDefault(); // stop the browser from reloading the page

		const name = addNameInput.value.trim();

		if (name === "") {
			showMessage("Type a name for the new zone first.");
			addNameInput.focus();
			return;
		}
		if (isNameTaken(name)) {
			showMessage(`There is already a zone called "${name}".`);
			addNameInput.focus();
			return;
		}

		const category = addCategory(name, addColorInput.value);
		console.log("Added zone:", category);
		showMessage();
		addNameInput.value = "";
	});

	// Rebuild the rows when zones are added, removed or replaced.
	// We skip "update" (rename/recolour) on purpose: rebuilding then would
	// close the colour picker while you are still using it.
	onCategoriesChange((change) => {
		if (change.type !== "update") {
			renderList();
		}
	});

	renderList();
}
