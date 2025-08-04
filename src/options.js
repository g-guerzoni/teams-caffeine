document.addEventListener("DOMContentLoaded", () => {
  const autoDisableToggle = document.getElementById("auto-disable-toggle");
  const hoursSelect = document.getElementById("hours-select");
  const timeSelector = document.getElementById("time-selector");
  const statusInfo = document.getElementById("status-info");
  const timerStatus = document.getElementById("timer-status");
  const saveStatus = document.getElementById("save-status");

  function updateTimeSelector() {
    if (autoDisableToggle.checked) {
      timeSelector.classList.remove("disabled");
      hoursSelect.disabled = false;
    } else {
      timeSelector.classList.add("disabled");
      hoursSelect.disabled = true;
    }
  }

  function updateTimerStatus() {
    chrome.storage.local.get(["autoDisableStartTime", "autoDisableHours"], (result) => {
      if (result.autoDisableStartTime && result.autoDisableHours) {
        const startTime = new Date(result.autoDisableStartTime);
        const endTime = new Date(startTime.getTime() + (result.autoDisableHours * 60 * 60 * 1000));
        const now = new Date();
        
        if (now < endTime) {
          const remainingMs = endTime.getTime() - now.getTime();
          const remainingHours = Math.floor(remainingMs / (1000 * 60 * 60));
          const remainingMinutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
          
          timerStatus.textContent = `Will disable in ${remainingHours}h ${remainingMinutes}m`;
          statusInfo.classList.add("visible");
        } else {
          statusInfo.classList.remove("visible");
        }
      } else {
        statusInfo.classList.remove("visible");
      }
    });
  }

  function showSaveStatus() {
    saveStatus.classList.add("success");
    setTimeout(() => {
      saveStatus.classList.remove("success");
    }, 2000);
  }

  function saveSettings() {
    const settings = {
      autoDisableEnabled: autoDisableToggle.checked,
      autoDisableHours: parseInt(hoursSelect.value)
    };

    chrome.storage.local.set(settings, () => {
      showSaveStatus();
      chrome.runtime.sendMessage({ 
        type: "AUTO_DISABLE_SETTINGS_CHANGED", 
        settings: settings 
      });
      updateTimerStatus();
    });
  }

  chrome.storage.local.get([
    "autoDisableEnabled", 
    "autoDisableHours"
  ], (result) => {
    autoDisableToggle.checked = result.autoDisableEnabled || false;
    hoursSelect.value = result.autoDisableHours || 4;
    
    updateTimeSelector();
    updateTimerStatus();
  });

  autoDisableToggle.addEventListener("change", () => {
    updateTimeSelector();
    saveSettings();
  });

  hoursSelect.addEventListener("change", () => {
    saveSettings();
  });

  setInterval(updateTimerStatus, 60000);
});