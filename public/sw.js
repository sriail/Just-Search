importScripts("/scramjet.config.js");
importScripts("/scram/scramjet.all.js");

const { ScramjetServiceWorker } = $scramjetLoadWorker();
const scramjet = new ScramjetServiceWorker();

async function handleRequest(event) {
  try {
    await scramjet.loadConfig();
    if (scramjet.route(event)) {
      return await scramjet.fetch(event);
    }
    return await fetch(event.request);
  } catch (err) {
    // Special handling for JSON parse errors that shouldn't crash the worker
    if (err instanceof SyntaxError && err.message) {
      console.warn("Service worker: Skipping invalid data format:", err.message.substring(0, 100));
      // Return a pass-through response for non-critical parse errors
      // This allows the request to fail gracefully without crashing the worker
      return new Response(null, { status: 400, statusText: "Bad Request" });
    }
    
    // Log other errors but don't crash the service worker
    console.error("Service worker fetch error:", err);
    // Return a user-friendly error response for real errors
    return new Response("Failed to fetch resource. Please check your connection and try again.", { 
      status: 500,
      statusText: "Service Worker Error"
    });
  }
}

self.addEventListener("fetch", (event) => {
  event.respondWith(handleRequest(event));
});
