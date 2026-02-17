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
    // Log error but don't crash the service worker
    console.error("Service worker fetch error:", err);
    // Return a user-friendly error response
    return new Response("Failed to fetch resource. Please check your connection and try again.", { 
      status: 500,
      statusText: "Service Worker Error"
    });
  }
}

self.addEventListener("fetch", (event) => {
  event.respondWith(handleRequest(event));
});
