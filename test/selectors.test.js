const { test } = require("node:test");
const assert = require("node:assert/strict");

const TeamsSelectors = require("../src/scripts/content/teams/selectors.js");

test("micStateFromDataState maps Teams data-state values", () => {
  assert.equal(TeamsSelectors.micStateFromDataState("mic-off"), "muted");
  assert.equal(TeamsSelectors.micStateFromDataState("mic"), "live");
  assert.equal(TeamsSelectors.micStateFromDataState("disabled"), null);
  assert.equal(TeamsSelectors.micStateFromDataState(undefined), null);
});

test("buildHighlightCss covers all four selectors, both colors, and !important", () => {
  const css = TeamsSelectors.buildHighlightCss();
  assert.match(css, /#microphone-button\[data-state="mic-off"\]/);
  assert.match(css, /#microphone-button\[data-state="mic"\]/);
  assert.match(css, /data-track-action-scenario="preJoinUnmute"/);
  assert.match(css, /data-track-action-scenario="preJoinMute"/);
  assert.ok(css.includes("#dc2626"));
  assert.ok(css.includes("#0d9488"));
  assert.equal((css.match(/!important/g) || []).length, 4);
});
