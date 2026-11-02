import "./style.css";
import MapView from "./map/MapView.js";
import { createCategoryPanel } from "./zoning/categoryPanel.js";

document.querySelector("#app").innerHTML = `
  <main class="app">
    <header class="app-header">
      <h1>UrbanInfra ML</h1>
      <p>Urban Growth & Infrastructure Planner</p>
    </header>

    <div class="workspace">
      <section class="map-section">
        <div id="map-root"></div>
      </section>

      <aside id="category-panel" class="category-panel"></aside>
    </div>
  </main>
`;

MapView("map-root");
createCategoryPanel("category-panel");
