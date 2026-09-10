document.addEventListener("DOMContentLoaded", () => {
  const toggle = document.getElementById("toggle-feature");
  const status = document.getElementById("toggle-status");
  const toggleBox = document.getElementById("toggle-box");
  const settingsIcon = document.getElementById("settings-icon");
  const warningMessage = document.getElementById("warning-message");

  const TEAMS_URLS = [
    "https://teams.live.com/*",
    "https://teams.microsoft.com/*",
    "https://teams.cloud.microsoft/*",
  ];
  const callStatusEl = document.getElementById("call-status");
  const callLabelEl = document.getElementById("call-label");
  const micChipEl = document.getElementById("mic-chip");

  function renderCallStatus(callStatus) {
    const view = describeCallStatus(callStatus);
    callStatusEl.classList.remove("tone-in-call", "tone-pre-join", "tone-none");
    callStatusEl.classList.add(`tone-${view.tone}`);
    callLabelEl.textContent = view.label;
    if (view.chip) {
      micChipEl.textContent = `${view.chip.glyph} ${view.chip.label}`;
      micChipEl.style.color = view.chip.color;
      micChipEl.hidden = false;
    } else {
      micChipEl.hidden = true;
    }
  }

  function refreshCallStatus() {
    if (!(typeof chrome !== "undefined" && chrome.tabs)) {
      renderCallStatus({ callState: "none", micState: null });
      return;
    }
    chrome.tabs.query({ url: TEAMS_URLS }, (tabs) => {
      if (chrome.runtime.lastError || !tabs || !tabs.length) {
        renderCallStatus({ callState: "none", micState: null });
        return;
      }
      const replies = [];
      let pending = tabs.length;
      const done = () => {
        pending -= 1;
        if (pending === 0) renderCallStatus(pickStrongestStatus(replies));
      };
      for (const tab of tabs) {
        ChromeUtils.tabs.sendMessage(tab.id, { type: "TEAMS_CAFFEINE_GET_CALL_STATUS" }, (response) => {
          if (response) replies.push(response);
          done();
        });
      }
    });
  }

  function updateStatus(isOn) {
    status.textContent = isOn ? "ON" : "OFF";
    toggle.setAttribute("aria-checked", isOn ? "true" : "false");

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

  function showWarning() {
    warningMessage.classList.remove("hide");
    warningMessage.style.display = "block";
    
    // Small delay to allow display to take effect before animation
    setTimeout(() => {
      warningMessage.classList.add("show");
    }, 10);
    
    setTimeout(() => {
      warningMessage.classList.remove("show");
      warningMessage.classList.add("hide");
    }, 10000);
  }

  const isExtension = typeof chrome !== "undefined" && chrome.storage;

  if (isExtension) {
    ChromeUtils.storage.get(["teamsCaffeineEnabled"], (result, error) => {
      if (error) {
        console.error("Teams Caffeine: Failed to load settings, defaulting to OFF");
        toggle.checked = false;
        updateStatus(false);
        return;
      }
      
      const isOn = result.teamsCaffeineEnabled !== false;
      toggle.checked = isOn;
      updateStatus(isOn);
    });

    toggle.addEventListener("change", () => {
      const isOn = toggle.checked;
      ChromeUtils.storage.set({ teamsCaffeineEnabled: isOn }, (error) => {
        if (error) {
          console.error("Teams Caffeine: Failed to save setting");
          return;
        }
        
        updateStatus(isOn);
        
        // Show warning when enabling the extension
        if (isOn) {
          showWarning();
        }
        
        ChromeUtils.runtime.sendMessage({ type: "TEAMS_CAFFEINE_TOGGLE", enabled: isOn }, (response, error) => {
          if (error) {
            const errorMsg = error.message || error.toString() || "Unknown error";
            // Message port errors are expected when background script isn't ready
            if (errorMsg.includes("message port closed") || errorMsg.includes("receiving end does not exist")) {
              console.debug("Teams Caffeine: Background script not ready, but extension will still function");
            } else {
              console.warn("Teams Caffeine: Could not communicate with background script:", errorMsg);
            }
          }
        });
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

  refreshCallStatus();
  setInterval(refreshCallStatus, 1000);
});
