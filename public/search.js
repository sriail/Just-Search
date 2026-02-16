"use strict";

/**
 * Resolve user input to a fully qualified URL or search query URL.
 * @param {string} input
 * @param {string} template Search engine template with %s placeholder
 * @returns {string}
 */
function search(input, template) {
  try {
    return new URL(input).toString();
  } catch (err) {
    // not a valid URL as-is
  }

  try {
    const url = new URL("http://" + input);
    if (url.hostname.includes(".")) return url.toString();
  } catch (err) {
    // not valid with http:// prefix either
  }

  return template.replace("%s", encodeURIComponent(input));
}
