// Registry + wiring for Microsoft Teams controls. Runs as an IIFE so it leaks no
// globals (content-script files share one lexical scope). Depends on TeamsSelectors
// (selectors.js, injected first) and ChromeUtils (chrome-utils.js). Independent of
// the caffeine on/off state.
(function () {
  const micHighlight = {
    id: "mic-highlight",
    settingKey: "teamsMicHighlightEnabled",
    start() {
      if (document.getElementById(TeamsSelectors.HIGHLIGHT_STYLE_ID)) return; // idempotent
      const style = document.createElement("style");
      style.id = TeamsSelectors.HIGHLIGHT_STYLE_ID;
      style.textContent = TeamsSelectors.buildHighlightCss();
      document.documentElement.appendChild(style); // survives SPA <head> churn
    },
    stop() {
      document.getElementById(TeamsSelectors.HIGHLIGHT_STYLE_ID)?.remove();
    },
  };

  // The extensibility seam: add future { id, settingKey, start, stop } controls here.
  const FEATURES = [micHighlight];

  function setFeatureEnabled(feature, enabled) {
    try {
      if (enabled) {
        feature.start();
      } else {
        feature.stop();
      }
    } catch (error) {
      console.error(`Teams Caffeine: Teams control "${feature.id}" failed:`, error);
    }
  }

  // Initial state from storage (a feature is ON unless its key is explicitly false).
  ChromeUtils.storage.get(
    FEATURES.map((feature) => feature.settingKey),
    (result, error) => {
      if (error) return;
      for (const feature of FEATURES) {
        setFeatureEnabled(feature, result[feature.settingKey] !== false);
      }
    },
  );

  // Live toggle driven by the options page.
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") return;
    for (const feature of FEATURES) {
      const change = changes[feature.settingKey];
      if (change) setFeatureEnabled(feature, change.newValue !== false);
    }
  });

  // Answer the popup's on-demand status query (synchronous response).
  chrome.runtime?.onMessage.addListener((message, sender, sendResponse) => {
    if (message && message.type === "TEAMS_CAFFEINE_GET_CALL_STATUS") {
      sendResponse({
        callState: TeamsSelectors.readCallState(),
        micState: TeamsSelectors.readMicState(),
      });
    }
  });

  // Report call and mic state to the service worker whenever it changes, so it can
  // show the status dot on the toolbar icon. Only sends on change, so the service
  // worker can still suspend between updates.
  let lastReportedCall = null;
  let lastReportedMic = null;

  function reportCallStatus() {
    if (!(chrome.runtime && chrome.runtime.id)) {
      clearInterval(statusReportTimer);
      return;
    }
    const callState = TeamsSelectors.readCallState();
    const micState = TeamsSelectors.readMicState();
    if (callState === lastReportedCall && micState === lastReportedMic) return;
    ChromeUtils.runtime.sendMessage(
      { type: "TEAMS_CAFFEINE_STATUS_REPORT", callState, micState },
      (response, error) => {
        // Only remember the state once the service worker has received it. If the
        // message was dropped (e.g. the worker was asleep), retry on the next tick
        // instead of leaving the icon stuck on a stale state.
        if (!error) {
          lastReportedCall = callState;
          lastReportedMic = micState;
        }
      },
    );
  }

  const statusReportTimer = setInterval(reportCallStatus, 2000);
  reportCallStatus();
})();
