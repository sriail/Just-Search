self.__scramjet$config = {
  prefix: "/scramjet/",
  codec: "xor",
  flags: {
    serviceworkers: true,
    captureErrors: true,
    syncxhr: true,
    websocket: true,
    cleanErrors: true,  // Clean up error messages for better handling
    allowFailedIntercepts: true,  // Allow failed intercepts to continue
  },
  defaultFlags: {
    "open window": false,
  },
  // Custom error handler to prevent crashes from invalid JSON
  errorHandler: (err) => {
    // Handle all JSON parse errors from websocket messages and other sources
    if (err instanceof SyntaxError) {
      // Check for various JSON parse error patterns
      const jsonErrorPatterns = [
        "is not valid JSON",
        "Unexpected token",
        "Unexpected end of JSON",
        "JSON.parse",
        "[object Object]",  // Object toString() being parsed as JSON
        "ima://",  // Protocol-prefixed data that shouldn't be parsed as JSON
        "data://",
        "blob://"
      ];
      
      const isJsonError = jsonErrorPatterns.some(pattern => 
        err.message && err.message.includes(pattern)
      );
      
      if (isJsonError) {
        console.warn("Scramjet: Skipping invalid JSON/non-JSON data:", err.message.substring(0, 100));
        return;
      }
    }
    
    // Handle OperationError (e.g., SharedStorage, API restrictions)
    if (err.name === "OperationError" || err instanceof DOMException) {
      console.warn("Scramjet: Skipping operation error:", err.message ? err.message.substring(0, 100) : err.name);
      return;
    }
    
    // Log other errors for debugging
    console.error("Scramjet error:", err);
  },
};
