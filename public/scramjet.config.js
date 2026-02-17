self.__scramjet$config = {
  prefix: "/scramjet/",
  codec: "xor",
  flags: {
    serviceworkers: true,
    captureErrors: true,
    syncxhr: true,
    websocket: true,
  },
  defaultFlags: {
    "open window": false,
  },
  // Custom error handler to prevent crashes from invalid JSON
  errorHandler: (err) => {
    // Silently handle JSON parse errors from websocket messages
    if (err instanceof SyntaxError && err.message && err.message.includes("is not valid JSON")) {
      console.warn("Scramjet: Skipping invalid JSON in websocket message");
      return;
    }
    // Log other errors for debugging
    console.error("Scramjet error:", err);
  },
};
