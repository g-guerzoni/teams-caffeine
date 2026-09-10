// Pure helpers for the popup call/mic indicator. UMD-guarded for Node unit tests;
// in the popup this loads as a plain script and exposes the two functions as globals.
const CALL_STATE_RANK = { "in-call": 3, "pre-join": 2, none: 1 };

function pickStrongestStatus(replies) {
  let best = { callState: "none", micState: null };
  for (const reply of replies) {
    if (!reply || !reply.callState) continue;
    const rank = CALL_STATE_RANK[reply.callState] || 0;
    if (rank > (CALL_STATE_RANK[best.callState] || 0)) {
      best = { callState: reply.callState, micState: reply.micState || null };
    }
  }
  return best;
}

function describeCallStatus(status) {
  const callState = status && status.callState ? status.callState : "none";
  const micState = status ? status.micState : null;

  const LABELS = { "in-call": "In call", "pre-join": "Pre-join", none: "Not in call" };

  let chip = null;
  if (callState !== "none") {
    if (micState === "muted") chip = { glyph: "🔇", label: "Muted", color: "#dc2626" };
    else if (micState === "live") chip = { glyph: "🎤", label: "Live", color: "#0d9488" };
  }

  return { label: LABELS[callState] || LABELS.none, tone: callState, chip };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { pickStrongestStatus, describeCallStatus };
}
