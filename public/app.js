"use strict";

// --- Settings helpers ---
function loadSettings() {
  const defaults = {
    searchEngine: "https://duckduckgo.com/?q=%s",
    adblock: false,
    theme: "system",
  };
  try {
    const saved = JSON.parse(localStorage.getItem("just-search-settings"));
    return Object.assign(defaults, saved);
  } catch (e) {
    return defaults;
  }
}

function saveSettings(settings) {
  localStorage.setItem("just-search-settings", JSON.stringify(settings));
}

function applyTheme(theme) {
  let resolved = theme;
  if (theme === "system") {
    resolved = window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  document.documentElement.setAttribute("data-theme", resolved);

  // Apply theme to proxy iframe if it exists
  const frame = document.getElementById("sj-frame");
  if (frame) {
    try {
      frame.contentDocument.documentElement.setAttribute("data-theme", resolved);
    } catch (e) {
      // cross-origin, ignore
    }
  }
}

// --- Scramjet setup ---
const { ScramjetController } = $scramjetLoadController();

const scramjet = new ScramjetController({
  files: {
    wasm: "/scram/scramjet.wasm.wasm",
    all: "/scram/scramjet.all.js",
    sync: "/scram/scramjet.sync.js",
  },
});

scramjet.init();

const connection = new BareMux.BareMuxConnection("/baremux/worker.js");

// --- State ---
let settings = loadSettings();
let settingsOpen = false;
let currentFrame = null;

// --- Apply theme on load ---
applyTheme(settings.theme);

// Listen for system theme changes
window
  .matchMedia("(prefers-color-scheme: dark)")
  .addEventListener("change", () => {
    if (settings.theme === "system") applyTheme("system");
  });

// --- DOM refs ---
const homeContent = document.getElementById("home-content");
const frameContainer = document.getElementById("frame-container");
const navbarUrl = document.getElementById("navbar-url");
const navbarForm = document.getElementById("navbar-form");
const homeForm = document.getElementById("home-form");
const homeSearch = document.getElementById("home-search");
const settingsPanel = document.getElementById("settings-panel");

const btnBack = document.getElementById("btn-back");
const btnForward = document.getElementById("btn-forward");
const btnReload = document.getElementById("btn-reload");
const btnHome = document.getElementById("btn-home");
const btnSettings = document.getElementById("btn-settings");
const btnFullscreen = document.getElementById("btn-fullscreen");

// --- Navigate to URL ---
async function navigateToUrl(input) {
  try {
    await registerSW();
  } catch (err) {
    console.error("Failed to register service worker:", err);
    return;
  }

  const url = search(input, settings.searchEngine);

  const wispUrl =
    (location.protocol === "https:" ? "wss" : "ws") +
    "://" +
    location.host +
    "/wisp/";

  if ((await connection.getTransport()) !== "/libcurl/index.mjs") {
    await connection.setTransport("/libcurl/index.mjs", [
      { websocket: wispUrl },
    ]);
  }

  // Remove old frame if exists
  if (currentFrame) {
    currentFrame.frame.remove();
    currentFrame = null;
  }

  currentFrame = scramjet.createFrame();
  currentFrame.frame.id = "sj-frame";
  frameContainer.appendChild(currentFrame.frame);

  // Show frame, hide home
  homeContent.style.display = "none";
  frameContainer.style.display = "block";

  // Close settings if open
  settingsPanel.style.display = "none";
  settingsOpen = false;

  currentFrame.go(url);

  // Update navbar
  navbarUrl.value = url;

  // Monitor iframe for URL changes and intercept new window opens
  monitorIframeNavigation();
  interceptNewWindowOpens();
}

function monitorIframeNavigation() {
  if (!currentFrame) return;

  // Poll the iframe location to update the navbar URL
  const checkInterval = setInterval(() => {
    if (!currentFrame || !currentFrame.frame) {
      clearInterval(checkInterval);
      return;
    }

    try {
      const iframeUrl = currentFrame.frame.contentWindow.location.href;
      if (iframeUrl && iframeUrl !== navbarUrl.value && !iframeUrl.startsWith("about:")) {
        navbarUrl.value = iframeUrl;
      }
    } catch (e) {
      // Cross-origin access blocked, this is expected
    }
  }, 500);
}

function interceptNewWindowOpens() {
  if (!currentFrame) return;

  try {
    const iframeWindow = currentFrame.frame.contentWindow;
    
    // Override window.open to redirect to the iframe
    const originalOpen = iframeWindow.open;
    iframeWindow.open = function(url, target, features) {
      if (url) {
        // Navigate the current iframe instead of opening a new window
        navigateToUrl(url);
        return null;
      }
      return originalOpen.call(this, url, target, features);
    };

    // Listen for clicks on links with target="_blank"
    currentFrame.frame.addEventListener('load', function() {
      try {
        const iframeDoc = currentFrame.frame.contentDocument || currentFrame.frame.contentWindow.document;
        
        iframeDoc.addEventListener('click', function(e) {
          const target = e.target.closest('a');
          if (target && (target.target === '_blank' || target.target === '_new')) {
            e.preventDefault();
            e.stopPropagation();
            const href = target.href;
            if (href) {
              navigateToUrl(href);
            }
          }
        }, true);
      } catch (err) {
        // Cross-origin, can't access iframe document
      }
    });
  } catch (e) {
    // Cross-origin or other error
  }
}

// --- Event handlers ---

// Home form submit
homeForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const val = homeSearch.value.trim();
  if (val) navigateToUrl(val);
});

// Navbar form submit (search while proxied)
navbarForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const val = navbarUrl.value.trim();
  if (val) navigateToUrl(val);
});

// Back
btnBack.addEventListener("click", () => {
  if (currentFrame) {
    try {
      currentFrame.frame.contentWindow.history.back();
    } catch (e) {
      // ignore cross-origin
    }
  }
});

// Forward
btnForward.addEventListener("click", () => {
  if (currentFrame) {
    try {
      currentFrame.frame.contentWindow.history.forward();
    } catch (e) {
      // ignore cross-origin
    }
  }
});

// Reload
btnReload.addEventListener("click", () => {
  if (currentFrame) {
    try {
      currentFrame.frame.contentWindow.location.reload();
    } catch (e) {
      // ignore cross-origin
    }
  }
});

// Home
btnHome.addEventListener("click", () => {
  if (currentFrame) {
    currentFrame.frame.remove();
    currentFrame = null;
  }
  frameContainer.style.display = "none";
  settingsPanel.style.display = "none";
  settingsOpen = false;
  homeContent.style.display = "flex";
  navbarUrl.value = "";
});

// Settings
btnSettings.addEventListener("click", async () => {
  settingsOpen = !settingsOpen;
  if (settingsOpen) {
    // Load settings panel HTML
    const res = await fetch("/settings.html");
    const html = await res.text();
    settingsPanel.innerHTML = html;
    settingsPanel.style.display = "block";

    // Populate current settings
    const engineSelect = document.getElementById("search-engine-select");
    const adblockToggle = document.getElementById("adblock-toggle");
    const adblockLabel = document.getElementById("adblock-label");
    const themeSelect = document.getElementById("theme-select");
    const saveBtn = document.getElementById("settings-save");

    engineSelect.value = settings.searchEngine;
    adblockToggle.checked = settings.adblock;
    adblockLabel.textContent = settings.adblock ? "On" : "Off";
    themeSelect.value = settings.theme;

    adblockToggle.addEventListener("change", () => {
      adblockLabel.textContent = adblockToggle.checked ? "On" : "Off";
    });

    saveBtn.addEventListener("click", () => {
      settings.searchEngine = engineSelect.value;
      settings.adblock = adblockToggle.checked;
      settings.theme = themeSelect.value;
      saveSettings(settings);
      applyTheme(settings.theme);
      settingsPanel.style.display = "none";
      settingsOpen = false;
    });
  } else {
    settingsPanel.style.display = "none";
  }
});

// Fullscreen
let isFullscreen = false;
const navbar = document.getElementById("navbar");

btnFullscreen.addEventListener("click", () => {
  if (!isFullscreen) {
    // Enter fullscreen
    const elem = document.documentElement;
    if (elem.requestFullscreen) {
      elem.requestFullscreen();
    } else if (elem.webkitRequestFullscreen) {
      elem.webkitRequestFullscreen();
    } else if (elem.msRequestFullscreen) {
      elem.msRequestFullscreen();
    }
    navbar.style.display = "none";
    frameContainer.style.height = "100vh";
    isFullscreen = true;
  } else {
    // Exit fullscreen
    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    } else if (document.msExitFullscreen) {
      document.msExitFullscreen();
    }
    navbar.style.display = "flex";
    frameContainer.style.height = "calc(100vh - 48px)";
    isFullscreen = false;
  }
});

// Listen for fullscreen changes (e.g., pressing ESC)
document.addEventListener("fullscreenchange", () => {
  if (!document.fullscreenElement) {
    navbar.style.display = "flex";
    frameContainer.style.height = "calc(100vh - 48px)";
    isFullscreen = false;
  }
});

document.addEventListener("webkitfullscreenchange", () => {
  if (!document.webkitFullscreenElement) {
    navbar.style.display = "flex";
    frameContainer.style.height = "calc(100vh - 48px)";
    isFullscreen = false;
  }
});

