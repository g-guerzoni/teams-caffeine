/* global importScripts */
importScripts("../utils/chrome-utils.js");

const TEAMS_URLS = ["https://teams.live.com/*", "https://teams.microsoft.com/*", "https://teams.cloud.microsoft/*"];

const HEARTBEAT_ALARM = "activityHeartbeat";
// A service-worker alarm is not subject to background-tab timer throttling, so it
// drives activity when the Teams tab is hidden and the content script's own
// setTimeout loop is throttled. Chrome clamps periodInMinutes below 0.5 up to 1 on
// versions < 120; either value is comfortably under Teams' ~5-minute idle threshold.
const HEARTBEAT_PERIOD_MINUTES = 0.5;

function startHeartbeat() {
  ChromeUtils.alarms.create(HEARTBEAT_ALARM, { periodInMinutes: HEARTBEAT_PERIOD_MINUTES }, (error) => {
    if (error) {
      console.error("Teams Caffeine: Error creating heartbeat alarm:", error);
      return;
    }
    ChromeUtils.debugLog("Teams Caffeine: Activity heartbeat started");
  });
}

function stopHeartbeat() {
  ChromeUtils.alarms.clear(HEARTBEAT_ALARM, (wasCleared, error) => {
    if (error) {
      console.error("Teams Caffeine: Error clearing heartbeat alarm:", error);
      return;
    }
    ChromeUtils.debugLog("Teams Caffeine: Activity heartbeat stopped");
  });
}

// Re-arm the heartbeat after a browser restart or extension update if the user left
// the extension enabled, since alarms do not reliably survive these events.
function ensureHeartbeat() {
  ChromeUtils.storage.get(["teamsCaffeineEnabled"], (result, error) => {
    if (error) return;
    if (result.teamsCaffeineEnabled !== false) {
      startHeartbeat();
    }
  });
}

function sendMessageToTeamsTabs(message) {
  if (!message || typeof message !== "object") {
    console.error("Teams Caffeine: Invalid message parameter");
    return;
  }

  chrome.tabs.query(
    {
      url: TEAMS_URLS,
    },
    (tabs) => {
      if (chrome.runtime.lastError) {
        console.error("Teams Caffeine: Error querying tabs:", chrome.runtime.lastError);
        return;
      }

      for (const tab of tabs) {
        ChromeUtils.tabs.sendMessage(tab.id, message);
      }
    },
  );
}

function reloadTeamsTabsAndToggle(enabled) {
  chrome.tabs.query(
    {
      url: TEAMS_URLS,
    },
    (tabs) => {
      if (chrome.runtime.lastError) {
        console.error("Teams Caffeine: Error querying tabs:", chrome.runtime.lastError);
        return;
      }

      if (!tabs.length) return;

      if (!enabled) {
        for (const tab of tabs) {
          chrome.tabs.reload(tab.id);
        }
        return;
      }

      const pendingTabIds = new Set(tabs.map((t) => t.id));

      const onTabUpdated = (tabId, changeInfo) => {
        if (!pendingTabIds.has(tabId) || changeInfo.status !== "complete") return;

        pendingTabIds.delete(tabId);
        ChromeUtils.tabs.sendMessage(tabId, {
          type: "TEAMS_CAFFEINE_STATE",
          enabled: true,
        });

        if (pendingTabIds.size === 0) {
          chrome.tabs.onUpdated.removeListener(onTabUpdated);
          clearTimeout(safetyTimeout);
        }
      };

      const safetyTimeout = setTimeout(() => {
        chrome.tabs.onUpdated.removeListener(onTabUpdated);
        ChromeUtils.debugLog("Teams Caffeine: Safety timeout: cleaned up tab listener");
      }, 10000);

      chrome.tabs.onUpdated.addListener(onTabUpdated);

      for (const tab of tabs) {
        chrome.tabs.reload(tab.id);
      }
    },
  );
}

function startAutoDisableTimer(hours) {
  if (!hours || typeof hours !== "number" || hours <= 0 || hours > 24) {
    console.error("Teams Caffeine: Invalid hours parameter for auto-disable timer:", hours);
    return false;
  }

  const alarmName = "autoDisableTeamsCaffeine";
  const delayInMinutes = Math.max(1, Math.floor(hours * 60)); // Chrome minimum is 1 minute

  ChromeUtils.alarms.clear(alarmName, (wasCleared, error) => {
    if (error) {
      console.error("Teams Caffeine: Error clearing alarm:", error);
      return;
    }

    ChromeUtils.alarms.create(alarmName, { delayInMinutes });

    ChromeUtils.storage.set(
      {
        autoDisableStartTime: Date.now(),
      },
      (error) => {
        if (!error) {
          ChromeUtils.debugLog(`Teams Caffeine: Auto-disable timer set for ${hours} hours`);
        }
      },
    );
  });

  return true;
}

function stopAutoDisableTimer() {
  ChromeUtils.alarms.clear("autoDisableTeamsCaffeine", (wasCleared, error) => {
    if (error) {
      console.error("Teams Caffeine: Error clearing alarm:", error);
    }

    ChromeUtils.storage.remove(["autoDisableStartTime"], (error) => {
      if (!error) {
        ChromeUtils.debugLog("Teams Caffeine: Auto-disable timer cleared");
      }
    });
  });
}

function handleAutoDisable() {
  ChromeUtils.storage.set({ teamsCaffeineEnabled: false }, (error) => {
    if (error) {
      console.error("Teams Caffeine: Error disabling extension:", error);
      return;
    }

    reloadTeamsTabsAndToggle(false);
    stopHeartbeat();

    ChromeUtils.storage.remove(["autoDisableStartTime"], (error) => {
      if (!error) {
        ChromeUtils.debugLog("Teams Caffeine: Auto-disabled after timer expiry");
      }
    });
  });
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "autoDisableTeamsCaffeine") {
    handleAutoDisable();
  } else if (alarm.name === HEARTBEAT_ALARM) {
    sendMessageToTeamsTabs({ type: "TEAMS_CAFFEINE_HEARTBEAT" });
  }
});

// Toolbar status dot: a small dot in the top corner of the extension icon while in a
// Teams call, red when muted and teal when live. The dot is drawn onto the icon with a
// canvas so it stays small, instead of Chrome's larger corner badge.
const tabCallStatus = new Map();
const STATUS_ICON_SIZE = 32;
let baseIconBitmapPromise = null;

function getBaseIconBitmap() {
  if (!baseIconBitmapPromise) {
    baseIconBitmapPromise = fetch(chrome.runtime.getURL("images/128.png"))
      .then((response) => response.blob())
      .then((blob) => createImageBitmap(blob))
      .catch((error) => {
        console.error("Teams Caffeine: Could not load base icon:", error);
        baseIconBitmapPromise = null;
        return null;
      });
  }
  return baseIconBitmapPromise;
}

async function drawStatusDot(color) {
  const base = await getBaseIconBitmap();
  if (!base) return;
  const size = STATUS_ICON_SIZE;
  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(base, 0, 0, size, size);

  const radius = size * 0.18;
  const cx = size - radius - 1;
  const cy = radius + 1;
  ctx.beginPath();
  ctx.arc(cx, cy, radius + 1.5, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();

  chrome.action.setIcon({ imageData: ctx.getImageData(0, 0, size, size) });
}

function refreshStatusIcon() {
  // Only show the dot when actually in a call with a readable mic state. This drops the
  // dot when not in a meeting, including the pre-join screen and lingering meeting URLs
  // where the in-call controls are already gone.
  let mic = null;
  for (const status of tabCallStatus.values()) {
    if (status.callState !== "in-call") continue;
    if (status.micState === "muted") {
      mic = "muted";
      break;
    }
    if (status.micState === "live") {
      mic = "live";
    }
  }
  if (!mic) {
    chrome.action.setIcon({ path: { 48: "images/48.png", 96: "images/96.png", 128: "images/128.png" } });
    return;
  }
  drawStatusDot(mic === "muted" ? "#dc2626" : "#0d9488");
}

chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabCallStatus.delete(tabId)) {
    refreshStatusIcon();
  }
});

chrome.runtime.onMessage.addListener((message, sender) => {
  if (message.type === "TEAMS_CAFFEINE_STATUS_REPORT") {
    if (sender.tab) {
      if (message.callState === "in-call") {
        tabCallStatus.set(sender.tab.id, { callState: message.callState, micState: message.micState });
      } else {
        tabCallStatus.delete(sender.tab.id);
      }
      refreshStatusIcon();
    }
    return;
  }

  // Only the popup and options pages drive these actions; those have no sender.tab.
  // Reject anything originating from a content script (defense in depth).
  if (sender.tab) return;

  if (message.type === "TEAMS_CAFFEINE_TOGGLE") {
    const enabled = message.enabled === true;

    reloadTeamsTabsAndToggle(enabled);

    if (enabled) {
      startHeartbeat();
      ChromeUtils.storage.get(["autoDisableEnabled", "autoDisableHours"], (result, error) => {
        if (error) {
          console.error("Teams Caffeine: Error reading auto-disable settings:", error);
          return;
        }

        if (
          result.autoDisableEnabled &&
          result.autoDisableHours &&
          typeof result.autoDisableHours === "number" &&
          result.autoDisableHours > 0
        ) {
          startAutoDisableTimer(result.autoDisableHours);
        }
      });
    } else {
      stopHeartbeat();
      stopAutoDisableTimer();
    }
  } else if (message.type === "AUTO_DISABLE_SETTINGS_CHANGED") {
    const settings = message.settings;

    if (!settings.autoDisableEnabled) {
      stopAutoDisableTimer();
    } else {
      ChromeUtils.storage.get(["teamsCaffeineEnabled"], (result, error) => {
        if (error) {
          console.error("Teams Caffeine: Error reading extension state:", error);
          return;
        }

        if (
          result.teamsCaffeineEnabled &&
          settings.autoDisableHours &&
          typeof settings.autoDisableHours === "number" &&
          settings.autoDisableHours > 0
        ) {
          startAutoDisableTimer(settings.autoDisableHours);
        }
      });
    }
  }
});

chrome.runtime.onStartup.addListener(ensureHeartbeat);
chrome.runtime.onInstalled.addListener(ensureHeartbeat);
