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

  const MIC_ICONS = {
    mic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>',
    "mic-off": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>',
  };

  function renderCallStatus(callStatus) {
    const view = describeCallStatus(callStatus);
    callStatusEl.classList.remove("tone-in-call", "tone-pre-join", "tone-none");
    callStatusEl.classList.add(`tone-${view.tone}`);
    callLabelEl.textContent = view.label;
    if (view.chip) {
      const icon = MIC_ICONS[view.chip.icon] || "";
      micChipEl.innerHTML = `${icon}<span>${view.chip.label}</span>`;
      micChipEl.style.color = view.chip.color;
      micChipEl.hidden = false;
    } else {
      micChipEl.textContent = "";
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
