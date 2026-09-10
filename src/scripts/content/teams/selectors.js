// Single source of Microsoft Teams DOM knowledge for the Teams controls.
// Exposed as one global (TeamsSelectors) so the content-script global scope stays
// clean. UMD-guarded so the pure helpers can be unit-tested under Node; the
// document/location reads happen only when the methods run, so requiring this file
// in Node is safe.
const TeamsSelectors = {
  MIC_MUTED_COLOR: "#dc2626", // matches HAL error.solid
  MIC_LIVE_COLOR: "#0d9488", // matches HAL success.solid

  HIGHLIGHT_STYLE_ID: "teams-caffeine-mic-highlight",

  // Mute-VALUE selectors (drive ring color + micState)
  IN_CALL_MIC_MUTED: '#microphone-button[data-state="mic-off"]',
  IN_CALL_MIC_LIVE: '#microphone-button[data-state="mic"]',
  PREJOIN_MIC_MUTED: 'button[data-track-action-scenario="preJoinUnmute"]', // action=unmute => currently muted
  PREJOIN_MIC_LIVE: 'button[data-track-action-scenario="preJoinMute"]', // action=mute => currently live (UNVERIFIED)

  // PRESENCE selectors (drive call detection, decoupled from mute value)
  IN_CALL_MIC: "#microphone-button",
  PREJOIN_MIC:
    'button[data-track-action-scenario="preJoinMute"], button[data-track-action-scenario="preJoinUnmute"]',
  IN_CALL_URL_RE: /\/meet(up-join)?\//i,

  buildHighlightCss() {
    const ring = (c) => `box-shadow: 0 0 0 2px ${c} !important;`;
    return [
      `${this.IN_CALL_MIC_MUTED} { ${ring(this.MIC_MUTED_COLOR)} }`,
      `${this.IN_CALL_MIC_LIVE} { ${ring(this.MIC_LIVE_COLOR)} }`,
      `${this.PREJOIN_MIC_MUTED} { ${ring(this.MIC_MUTED_COLOR)} }`,
      `${this.PREJOIN_MIC_LIVE} { ${ring(this.MIC_LIVE_COLOR)} }`,
    ].join("\n");
  },

  micStateFromDataState(state) {
    if (state === "mic-off") return "muted";
    if (state === "mic") return "live";
    return null;
  },

  readMicState() {
    if (document.querySelector(this.IN_CALL_MIC_MUTED)) return "muted";
    if (document.querySelector(this.IN_CALL_MIC_LIVE)) return "live";
    if (document.querySelector(this.PREJOIN_MIC_MUTED)) return "muted";
    if (document.querySelector(this.PREJOIN_MIC_LIVE)) return "live";
    return null;
  },

  readCallState() {
    if (document.querySelector(this.IN_CALL_MIC)) return "in-call";
    if (document.querySelector(this.PREJOIN_MIC)) return "pre-join";
    if (this.IN_CALL_URL_RE.test(location.pathname)) return "in-call";
    return "none";
  },
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = TeamsSelectors;
}
