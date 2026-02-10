// Import utilities for error handling
importScripts("../utils/chrome-utils.js");

const TEAMS_URLS = ["https://teams.live.com/*", "https://teams.microsoft.com/*", "https://teams.cloud.microsoft/*"];

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
        ChromeUtils.debugLog("Teams Caffeine: Safety timeout — cleaned up tab listener");
      }, 10000);

      chrome.tabs.onUpdated.addListener(onTabUpdated);

      for (const tab of tabs) {
        chrome.tabs.reload(tab.id);
      }
    },
  );
}

function startAutoDisableTimer(hours) {
  // Validate input
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
  }
});

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "TEAMS_CAFFEINE_TOGGLE") {
    const enabled = message.enabled === true;

    reloadTeamsTabsAndToggle(enabled);

    if (enabled) {
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
