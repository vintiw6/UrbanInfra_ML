import "./style.css";
import MapView from "./map/MapView.js";
import { createCategoryPanel } from "./zoning/categoryPanel.js";
import { createStatsPanel } from "./stats/statsPanel.js";
import { showBackendStatus } from "./api/backendStatus.js";

document.querySelector("#app").innerHTML = `
  <main class="app">
    <header class="app-header">
      <h1>UrbanInfra ML</h1>
      <p>Urban Growth & Infrastructure Planner</p>
      <p id="backend-status" class="backend-status">Backend: checking...</p>
    </header>

    <div class="workspace">
      <section class="map-section">
        <div id="map-root"></div>
      </section>

      <aside id="category-panel" class="category-panel"></aside>
    </div>

    <section id="stats-panel" class="stats-panel"></section>
  </main>
`;

const statsPanel = createStatsPanel("stats-panel");
MapView("map-root", statsPanel.update);
createCategoryPanel("category-panel");
showBackendStatus("backend-status");
