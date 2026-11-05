// Zoning categories for the UrbanInfra ML planner.
//
// Each category has:
//   id    - a short code that never changes. Polygons store this id.
//   name  - the label people see (can be renamed).
//   color - the fill colour used on the map (can be changed).
//
// Rule: a polygon stores only the category id (for example "residential"),
// never the colour or name. They are looked up from this list, so renaming
// or recolouring a category updates every polygon of that zone automatically.
//
// The list can change while the app runs (add, rename, recolour, remove).
// Other parts of the app (dropdown, map, panel) call onCategoriesChange()
// to be told when that happens, so they can update themselves.

// The zones the app starts with
const DEFAULT_CATEGORIES = [
	{ id: "residential", name: "Residential", color: "#facc15" }, // yellow
	{ id: "commercial", name: "Commercial", color: "#f97316" }, // orange
	{ id: "industrial", name: "Industrial", color: "#9333ea" }, // purple
	{ id: "green-space", name: "Green Space", color: "#16a34a" }, // green
	{ id: "water", name: "Water", color: "#3b82f6" }, // blue
	{ id: "agriculture", name: "Agriculture", color: "#a3e635" }, // light green
	{ id: "public-facilities", name: "Public Facilities", color: "#ec4899" }, // pink
	{ id: "transportation", name: "Transportation", color: "#475569" }, // dark grey
];

// Used when a polygon has no zone, or its zone was removed.
// It is not in the list above, so it can never be renamed or removed.
export const UNASSIGNED_CATEGORY = {
	id: "unassigned",
	name: "Unassigned",
	color: "#94a3b8", // light grey
};

// The current list. We copy the defaults so the originals stay untouched.
let categories = DEFAULT_CATEGORIES.map((category) => ({ ...category }));

// Functions that want to be told when the list changes
const changeListeners = [];

// ---------- Reading the list ----------

// Get the current list of categories
export function getCategories() {
	return categories;
}

// Does a category with this id exist in the list?
export function categoryExists(categoryId) {
	return categories.some((item) => item.id === categoryId);
}

// Is this name already used by another zone? (Not case-sensitive, so
// "Mixed Use" and "mixed use" count as the same.) exceptId lets a zone keep
// its own name when it is renamed.
export function isNameTaken(name, exceptId = null) {
	const cleanName = name.trim().toLowerCase();
	return categories.some(
		(item) => item.id !== exceptId && item.name.toLowerCase() === cleanName,
	);
}

// Find a category by its id. Returns the "Unassigned" category if not found.
export function getCategoryById(categoryId) {
	const category = categories.find((item) => item.id === categoryId);
	return category || UNASSIGNED_CATEGORY;
}

// Shortcut: get just the colour for a category id.
export function getCategoryColor(categoryId) {
	return getCategoryById(categoryId).color;
}

// The zone the dropdown starts on: the first one in the list.
export function getDefaultCategoryId() {
	return categories.length > 0 ? categories[0].id : UNASSIGNED_CATEGORY.id;
}

// ---------- Being told about changes ----------

// Register a function to call whenever the list changes.
// The function receives a short description of the change,
// for example { type: "update", id: "residential" }.
export function onCategoriesChange(listener) {
	changeListeners.push(listener);
}

function notifyChange(change) {
	changeListeners.forEach((listener) => listener(change));
}

// ---------- Changing the list ----------

// Add a new category. Returns the new category, or null if the name is
// empty or already used by another zone.
export function addCategory(name, color) {
	const cleanName = name.trim();
	if (cleanName === "" || isNameTaken(cleanName)) {
		return null;
	}

	const category = {
		id: makeUniqueId(cleanName),
		name: cleanName,
		color,
	};

	categories.push(category);
	notifyChange({ type: "add", id: category.id });
	return category;
}

// Rename and/or recolour a category.
// Example: updateCategory("residential", { color: "#fde047" })
export function updateCategory(categoryId, changes) {
	const category = categories.find((item) => item.id === categoryId);
	if (!category) {
		return;
	}

	// Only rename if the new name is not empty and not used by another zone
	if (
		typeof changes.name === "string" &&
		changes.name.trim() !== "" &&
		!isNameTaken(changes.name, categoryId)
	) {
		category.name = changes.name.trim();
	}
	if (typeof changes.color === "string") {
		category.color = changes.color;
	}

	notifyChange({ type: "update", id: categoryId });
}

// Remove a category. The last remaining category cannot be removed.
// Returns true if it was removed.
export function removeCategory(categoryId) {
	if (categories.length <= 1 || !categoryExists(categoryId)) {
		return false;
	}

	categories = categories.filter((item) => item.id !== categoryId);
	notifyChange({ type: "remove", id: categoryId });
	return true;
}

// Replace the whole list, for example when loading a saved scenario
export function replaceCategories(newCategories) {
	categories = newCategories.map((category) => ({ ...category }));
	notifyChange({ type: "replace" });
}

// ---------- Helpers ----------

// Turn a name like "Mixed Use" into an id like "mixed-use".
// If that id is already taken, add a number: "mixed-use-2".
function makeUniqueId(name) {
	const base =
		name
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-") // spaces and symbols become "-"
			.replace(/^-+|-+$/g, "") || "zone"; // trim "-" from the ends

	let id = base;
	let number = 2;
	while (categoryExists(id) || id === UNASSIGNED_CATEGORY.id) {
		id = `${base}-${number}`;
		number += 1;
	}
	return id;
}
