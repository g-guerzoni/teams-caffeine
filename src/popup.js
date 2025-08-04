document.addEventListener("DOMContentLoaded", () => {
  const toggle = document.getElementById("toggle-feature");
  const status = document.getElementById("toggle-status");
  const toggleBox = document.getElementById("toggle-box");
  const settingsIcon = document.getElementById("settings-icon");

  function updateStatus(isOn) {
    status.textContent = isOn ? "ON" : "OFF";

    if (isOn) {
      status.classList.add("status-on");
      status.classList.remove("status-off");
      toggleBox.classList.add("pulse");
    } else {
      status.classList.add("status-off");
      status.classList.remove("status-on");
      toggleBox.classList.remove("pulse");
    }
  }

  const isExtension = typeof chrome !== "undefined" && chrome.storage;

  if (isExtension) {
    chrome.storage.local.get(["teamsCaffeineEnabled"], (result) => {
      const isOn = result.teamsCaffeineEnabled !== false;
      toggle.checked = isOn;
      updateStatus(isOn);
    });

    toggle.addEventListener("change", () => {
      const isOn = toggle.checked;
      chrome.storage.local.set({ teamsCaffeineEnabled: isOn }, () => {
        updateStatus(isOn);
        chrome.runtime.sendMessage({ type: "TEAMS_CAFFEINE_TOGGLE", enabled: isOn });
      });
    });
  } else {
    updateStatus(false);
    toggle.addEventListener("change", () => {
      const isOn = toggle.checked;
      updateStatus(isOn);
    });
  }

  settingsIcon.addEventListener("click", () => {
    if (typeof chrome !== "undefined" && chrome.runtime) {
      chrome.runtime.openOptionsPage();
    }
  });
});
