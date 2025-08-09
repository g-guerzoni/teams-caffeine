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
          console.warn("Teams Caffeine: Could not communicate with background script for settings update.");
        }
      });
      updateTimerStatus();
    });
  }

  ChromeUtils.storage.get([
    "autoDisableEnabled", 
    "autoDisableHours"
  ], (result, error) => {
    if (error) {
      console.error("Teams Caffeine: Failed to load settings, using defaults");
      autoDisableToggle.checked = false;
      hoursSelect.value = 4;
    } else {
      autoDisableToggle.checked = result.autoDisableEnabled || false;
      hoursSelect.value = result.autoDisableHours || 4;
    }
    
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