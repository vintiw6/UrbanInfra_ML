// Calls the FastAPI backend's /health endpoint and shows the result in the
// header. The check runs once, so reload the page after starting the backend.

// To use a different address, set VITE_API_URL in frontend/.env.local
const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

export async function showBackendStatus(elementId) {
	const element = document.getElementById(elementId);

	let isConnected = false;
	try {
		const response = await fetch(`${API_URL}/health`);
		isConnected = response.ok;
	} catch (error) {
		// fetch fails if the backend is not running or CORS blocks the call
		console.warn("Backend not reachable:", error.message);
	}

	element.textContent = isConnected ? "Backend: connected" : "Backend: offline";
	element.classList.toggle("is-connected", isConnected);
}
