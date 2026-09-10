const { test } = require("node:test");
const assert = require("node:assert/strict");

const { MIN_INTERVAL, MAX_INTERVAL, getRandomInterval } = require("../src/scripts/utils/timing.js");

test("interval constants are the expected bounds (seconds)", () => {
  assert.equal(MIN_INTERVAL, 8);
  assert.equal(MAX_INTERVAL, 12);
});

test("getRandomInterval() returns milliseconds within [MIN, MAX)", () => {
  for (let i = 0; i < 1000; i++) {
    const value = getRandomInterval();
    assert.ok(value >= MIN_INTERVAL * 1000, `expected >= ${MIN_INTERVAL * 1000}, got ${value}`);
    assert.ok(value < MAX_INTERVAL * 1000, `expected < ${MAX_INTERVAL * 1000}, got ${value}`);
  }
});
