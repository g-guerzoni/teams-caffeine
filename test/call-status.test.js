const { test } = require("node:test");
const assert = require("node:assert/strict");

const { pickStrongestStatus, describeCallStatus } = require("../src/scripts/utils/call-status.js");

test("pickStrongestStatus prefers in-call > pre-join > none and keeps its micState", () => {
  assert.deepEqual(
    pickStrongestStatus([
      { callState: "none", micState: null },
      { callState: "pre-join", micState: "muted" },
      { callState: "in-call", micState: "live" },
    ]),
    { callState: "in-call", micState: "live" },
  );
  assert.deepEqual(pickStrongestStatus([]), { callState: "none", micState: null });
  assert.deepEqual(
    pickStrongestStatus([
      { callState: "pre-join", micState: "muted" },
      { callState: "none", micState: null },
    ]),
    { callState: "pre-join", micState: "muted" },
  );
});

test("describeCallStatus maps state + mic to a UI descriptor", () => {
  const none = describeCallStatus({ callState: "none", micState: null });
  assert.equal(none.label, "Not in call");
  assert.equal(none.tone, "none");
  assert.equal(none.chip, null);

  const live = describeCallStatus({ callState: "in-call", micState: "live" });
  assert.equal(live.label, "In call");
  assert.deepEqual(live.chip, { icon: "mic", label: "Live", color: "#0d9488" });

  const prejoinMuted = describeCallStatus({ callState: "pre-join", micState: "muted" });
  assert.equal(prejoinMuted.label, "Pre-join");
  assert.deepEqual(prejoinMuted.chip, { icon: "mic-off", label: "Muted", color: "#dc2626" });

  assert.equal(describeCallStatus({ callState: "in-call", micState: null }).chip, null);
});
