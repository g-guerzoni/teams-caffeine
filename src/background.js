chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "TEAMS_CAFFEINE_TOGGLE") {
    const enabled = message.enabled === true;

    chrome.tabs.query(
      {
        url: ["https://teams.live.com/*", "https://teams.microsoft.com/*"],
      },
      (tabs) => {
        for (const tab of tabs) {
          chrome.tabs.sendMessage(tab.id, {
            type: "TEAMS_CAFFEINE_STATE",
            enabled,
          });
        }
      }
    );
  }
});
