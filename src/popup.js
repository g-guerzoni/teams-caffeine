document.addEventListener("DOMContentLoaded", () => {
  const toggle = document.getElementById("toggle-feature");
  const status = document.getElementById("toggle-status");
  const toggleBox = document.getElementById("toggle-box");

  // Helper to update status text and appearance
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

  // Check if running in browser context or as extension
  const isExtension = typeof chrome !== "undefined" && chrome.storage;

  if (isExtension) {
    // Load current state from storage
    chrome.storage.local.get(["teamsCaffeineEnabled"], (result) => {
      const isOn = result.teamsCaffeineEnabled !== false; // default ON
      toggle.checked = isOn;
      updateStatus(isOn);
    });

    // Listen for toggle changes
    toggle.addEventListener("change", () => {
      const isOn = toggle.checked;
      chrome.storage.local.set({ teamsCaffeineEnabled: isOn }, () => {
        updateStatus(isOn);
        // Notify background script
        chrome.runtime.sendMessage({ type: "TEAMS_CAFFEINE_TOGGLE", enabled: isOn });
      });
    });
  } else {
    // When viewing in regular browser (for development/preview)
    updateStatus(false);
    toggle.addEventListener("change", () => {
      const isOn = toggle.checked;
      updateStatus(isOn);
    });
  }
});
