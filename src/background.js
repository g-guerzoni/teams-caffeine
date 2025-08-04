function sendMessageToTeamsTabs(message) {
  chrome.tabs.query(
    {
      url: ["https://teams.live.com/*", "https://teams.microsoft.com/*"],
    },
    (tabs) => {
      for (const tab of tabs) {
        chrome.tabs.sendMessage(tab.id, message);
      }
    }
  );
}

function startAutoDisableTimer(hours) {
  const alarmName = "autoDisableTeamsCaffeine";
  
  chrome.alarms.clear(alarmName, () => {
    chrome.alarms.create(alarmName, {
      delayInMinutes: hours * 60
    });
    
    chrome.storage.local.set({
      autoDisableStartTime: Date.now()
    });
    
    console.log(`Teams Caffeine: Auto-disable timer set for ${hours} hours`);
  });
}

function stopAutoDisableTimer() {
  chrome.alarms.clear("autoDisableTeamsCaffeine", () => {
    chrome.storage.local.remove(["autoDisableStartTime"]);
    console.log("Teams Caffeine: Auto-disable timer cleared");
  });
}

function handleAutoDisable() {
  chrome.storage.local.set({ teamsCaffeineEnabled: false }, () => {
    sendMessageToTeamsTabs({
      type: "TEAMS_CAFFEINE_STATE",
      enabled: false,
    });
    
    chrome.storage.local.remove(["autoDisableStartTime"]);
    console.log("Teams Caffeine: Auto-disabled after timer expiry");
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

    sendMessageToTeamsTabs({
      type: "TEAMS_CAFFEINE_STATE",
      enabled,
    });

    if (enabled) {
      chrome.storage.local.get(["autoDisableEnabled", "autoDisableHours"], (result) => {
        if (result.autoDisableEnabled && result.autoDisableHours) {
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
      chrome.storage.local.get(["teamsCaffeineEnabled"], (result) => {
        if (result.teamsCaffeineEnabled) {
          startAutoDisableTimer(settings.autoDisableHours);
        }
      });
    }
  }
});
