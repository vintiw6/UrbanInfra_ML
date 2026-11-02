// Zoning categories for the UrbanInfra ML planner.
//
// Each category has:
//   id    - a short code that never changes. Polygons store this id.
//   name  - the label people see in the dropdown.
//   color - the fill colour used on the map.
//
// Rule: a polygon stores only the category id (for example "residential"),
// never the colour. The colour is looked up from this list, so changing a
// colour here updates every polygon of that zone automatically.

export const ZONING_CATEGORIES = [
	{ id: "residential", name: "Residential", color: "#facc15" }, // yellow
	{ id: "commercial", name: "Commercial", color: "#f97316" }, // orange
	{ id: "industrial", name: "Industrial", color: "#9333ea" }, // purple
	{ id: "green-space", name: "Green Space", color: "#16a34a" }, // green
	{ id: "water", name: "Water", color: "#3b82f6" }, // blue
	{ id: "agriculture", name: "Agriculture", color: "#a3e635" }, // light green
	{ id: "public-facilities", name: "Public Facilities", color: "#ec4899" }, // pink
	{ id: "transportation", name: "Transportation", color: "#475569" }, // dark grey
];

// Used when a polygon has no zone, or its zone id is not in the list.
export const UNASSIGNED_CATEGORY = {
	id: "unassigned",
	name: "Unassigned",
	color: "#94a3b8", // light grey
};

// The zone that is selected when the app starts.
export const DEFAULT_CATEGORY_ID = ZONING_CATEGORIES[0].id;

// Find a category by its id. Returns the "Unassigned" category if not found.
export function getCategoryById(categoryId) {
	const category = ZONING_CATEGORIES.find((item) => item.id === categoryId);
	return category || UNASSIGNED_CATEGORY;
}

// Shortcut: get just the colour for a category id.
export function getCategoryColor(categoryId) {
	return getCategoryById(categoryId).color;
}
