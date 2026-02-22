importScripts("/scramjet.config.js");
importScripts("/scram/scramjet.all.js");

const { ScramjetServiceWorker } = $scramjetLoadWorker();
const scramjet = new ScramjetServiceWorker();

// Transient libcurl error codes that are worth retrying
const RETRYABLE_CURL_CODES = [
  35, // SSL connect error
  55, // Failed sending data to the peer
  56, // Failure in receiving network data
  7,  // Failed to connect to host
  28, // Operation timeout
];
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 300;

function isRetryableError(err) {
  if (!(err instanceof TypeError)) return false;
  return RETRYABLE_CURL_CODES.some((code) =>
    err.message && err.message.includes(`error code ${code}`)
  );
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function handleRequest(event) {
  let lastErr;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
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
        return new Response(null, { status: 400, statusText: "Bad Request" });
      }

      // Retry transient libcurl connection/SSL errors
      if (isRetryableError(err) && attempt < MAX_RETRIES) {
        console.warn(
          `Service worker: Retrying request (retry ${attempt + 1}/${MAX_RETRIES}) after transient error:`,
          err.message.substring(0, 120)
        );
        await delay(RETRY_DELAY_MS);
        lastErr = err;
        continue;
      }

      lastErr = err;
      break;
    }
  }

  // Log final error but don't crash the service worker
  console.error("Service worker fetch error:", lastErr);
  return new Response("Failed to fetch resource. Please check your connection and try again.", {
    status: 500,
    statusText: "Service Worker Error",
  });
}

self.addEventListener("fetch", (event) => {
  event.respondWith(handleRequest(event));
});
