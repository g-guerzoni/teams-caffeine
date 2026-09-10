// Shared timing helpers for the content script's activity loop.
// Injected before content/main.js (see manifest.json) so MIN_INTERVAL,
// MAX_INTERVAL and getRandomInterval() are available there as globals.
// The module.exports guard lets the pure logic be unit-tested under Node
// without pulling in any browser globals (module is undefined in a content
// script, so the block is skipped there).
const MIN_INTERVAL = 8;
const MAX_INTERVAL = 12;

function getRandomInterval() {
  return (MIN_INTERVAL + Math.random() * (MAX_INTERVAL - MIN_INTERVAL)) * 1000;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { MIN_INTERVAL, MAX_INTERVAL, getRandomInterval };
}
