document.addEventListener("DOMContentLoaded", () => {
  const debugModeToggle = document.getElementById("debug-mode-toggle");
  const autoDisableToggle = document.getElementById("auto-disable-toggle");
  const hoursSelect = document.getElementById("hours-select");
  const timeSelector = document.getElementById("time-selector");
  const statusInfo = document.getElementById("status-info");
  const timerStatus = document.getElementById("timer-status");
  const saveStatus = document.getElementById("save-status");
  const micHighlightToggle = document.getElementById("mic-highlight-toggle");

  function updateTimeSelector() {
    const isEnabled = autoDisableToggle.checked;
    autoDisableToggle.setAttribute("aria-checked", isEnabled ? "true" : "false");

    if (isEnabled) {
      timeSelector.classList.remove("disabled");
      hoursSelect.disabled = false;
      hoursSelect.removeAttribute("aria-disabled");
    } else {
      timeSelector.classList.add("disabled");
      hoursSelect.disabled = true;
      hoursSelect.setAttribute("aria-disabled", "true");
    }
  }

  function updateTimerStatus() {
    ChromeUtils.storage.get(["autoDisableStartTime", "autoDisableHours"], (result, error) => {
      if (error) {
        console.error("Teams Caffeine: Failed to read timer status");
        statusInfo.classList.remove("visible");
        return;
      }
      
      if (result.autoDisableStartTime && result.autoDisableHours) {
        const startTime = new Date(result.autoDisableStartTime);
        
        // Validate date
        if (isNaN(startTime.getTime())) {
          console.warn("Teams Caffeine: Invalid start time in storage");
          statusInfo.classList.remove("visible");
          return;
        }
        
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

  function saveDebugMode() {
    const isEnabled = debugModeToggle.checked;
    debugModeToggle.setAttribute("aria-checked", isEnabled ? "true" : "false");

    ChromeUtils.storage.set({ debugModeEnabled: isEnabled }, (error) => {
      if (error) {
        console.error("Teams Caffeine: Failed to save debug mode setting");
        return;
      }
      showSaveStatus();
    });
  }

  function saveSettings() {
    const hours = parseInt(hoursSelect.value);
    
    // Validate hours input
    if (isNaN(hours) || hours < 1 || hours > 24) {
      console.error("Teams Caffeine: Invalid hours value:", hoursSelect.value);
      return;
    }
    
    const settings = {
      autoDisableEnabled: autoDisableToggle.checked,
      autoDisableHours: hours
    };

    ChromeUtils.storage.set(settings, (error) => {
      if (error) {
        console.error("Teams Caffeine: Failed to save settings");
        return;
      }
      
      showSaveStatus();
      ChromeUtils.runtime.sendMessage({ 
        type: "AUTO_DISABLE_SETTINGS_CHANGED", 
        settings: settings 
      }, (response, error) => {
        if (error) {
          ChromeUtils.debugLog("Teams Caffeine: Background script communication - this is normal during extension startup");
        }
      });
      updateTimerStatus();
    });
  }

  ChromeUtils.storage.get([
    "debugModeEnabled",
    "autoDisableEnabled",
    "autoDisableHours",
    "teamsMicHighlightEnabled"
  ], (result, error) => {
    if (error) {
      console.error("Teams Caffeine: Failed to load settings, using defaults");
      debugModeToggle.checked = false;
      autoDisableToggle.checked = false;
      hoursSelect.value = 4;
      micHighlightToggle.checked = true;
    } else {
      debugModeToggle.checked = result.debugModeEnabled || false;
      autoDisableToggle.checked = result.autoDisableEnabled || false;
      hoursSelect.value = result.autoDisableHours || 4;
      micHighlightToggle.checked = result.teamsMicHighlightEnabled !== false;
    }

    debugModeToggle.setAttribute("aria-checked", debugModeToggle.checked ? "true" : "false");
    autoDisableToggle.setAttribute("aria-checked", autoDisableToggle.checked ? "true" : "false");
    micHighlightToggle.setAttribute("aria-checked", micHighlightToggle.checked ? "true" : "false");

    updateTimeSelector();
    updateTimerStatus();
  });

  debugModeToggle.addEventListener("change", () => {
    saveDebugMode();
  });

  micHighlightToggle.addEventListener("change", () => {
    const isEnabled = micHighlightToggle.checked;
    micHighlightToggle.setAttribute("aria-checked", isEnabled ? "true" : "false");
    ChromeUtils.storage.set({ teamsMicHighlightEnabled: isEnabled }, (error) => {
      if (error) {
        console.error("Teams Caffeine: Failed to save mic highlight setting");
        return;
      }
      showSaveStatus();
    });
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