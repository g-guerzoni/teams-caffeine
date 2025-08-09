const MIN_INTERVAL = 8;
const MAX_INTERVAL = 12;
const STATUS_CHECK_INTERVAL = 5 * 60 * 1000;

let intervalId = null;
let statusCheckIntervalId = null;
let isTabVisible = true;
let isExtensionEnabled = false;

function getRandomInterval() {
  return (MIN_INTERVAL + Math.random() * (MAX_INTERVAL - MIN_INTERVAL)) * 1000;
}

function startJiggle() {
  if (intervalId === null) {
    scheduleNextActivity();
  }
  startStatusMonitoring();
}

function stopJiggle() {
  if (intervalId !== null) {
    clearTimeout(intervalId);
    intervalId = null;
  }
  stopStatusMonitoring();
}

function scheduleNextActivity() {
  if (intervalId !== null) {
    clearTimeout(intervalId);
  }
  
  const delay = getRandomInterval();
  intervalId = setTimeout(() => {
    if (isTabVisible) {
      simulateActivity();
    }
    scheduleNextActivity();
  }, delay);
}

function simulateActivity() {
  if (!document.hasFocus() || document.hidden) {
    return;
  }
  
  const activities = [
    simulateMouseMovement,
    simulateKeyPress,
    simulateScroll
  ];
  
  const randomActivity = activities[Math.floor(Math.random() * activities.length)];
  randomActivity();
}

function simulateMouseMovement() {
  const element = document.body || document.documentElement;
  if (!element) return;
  
  const x = Math.random() * window.innerWidth;
  const y = Math.random() * window.innerHeight;
  
  const event = new MouseEvent("mousemove", {
    bubbles: true,
    cancelable: true,
    clientX: x,
    clientY: y,
    screenX: x,
    screenY: y
  });
  element.dispatchEvent(event);
}

function simulateKeyPress() {
  const safeKeys = ["Shift", "Control", "Alt"];
  const randomKey = safeKeys[Math.floor(Math.random() * safeKeys.length)];
  
  const keyDownEvent = new KeyboardEvent("keydown", {
    key: randomKey,
    code: randomKey,
    bubbles: true
  });
  
  const keyUpEvent = new KeyboardEvent("keyup", {
    key: randomKey,
    code: randomKey,
    bubbles: true
  });
  
  document.dispatchEvent(keyDownEvent);
  setTimeout(() => document.dispatchEvent(keyUpEvent), 50);
}

function simulateScroll() {
  const scrollAmount = Math.random() > 0.5 ? 1 : -1;
  window.scrollBy(0, scrollAmount);
  setTimeout(() => window.scrollBy(0, -scrollAmount), 100);
}

function checkTeamsStatus() {
  if (!isExtensionEnabled) {
    return;
  }
  
  const presenceBadge = document.querySelector('[aria-label][role="img"][id*="avatar"][class*="PresenceBadge"]');
  
  if (presenceBadge) {
    const ariaLabel = presenceBadge.getAttribute("aria-label");
    const isAway = ariaLabel && (ariaLabel.toLowerCase().includes("away") || ariaLabel.toLowerCase().includes("offline"));
    
    if (isAway) {
      console.log("Teams Caffeine: Status check detected away/offline status, triggering activity");
      simulateActivity();
      setTimeout(() => simulateActivity(), 2000);
      setTimeout(() => simulateActivity(), 4000);
    } else {
      console.log(`Teams Caffeine: Status check - current status: ${ariaLabel}`);
    }
  } else {
    console.log("Teams Caffeine: Status check - presence badge not found");
  }
}

function startStatusMonitoring() {
  if (statusCheckIntervalId === null && isExtensionEnabled) {
    statusCheckIntervalId = setInterval(checkTeamsStatus, STATUS_CHECK_INTERVAL);
    console.log("Teams Caffeine: Status monitoring started (5 minute intervals)");
  }
}

function stopStatusMonitoring() {
  if (statusCheckIntervalId !== null) {
    clearInterval(statusCheckIntervalId);
    statusCheckIntervalId = null;
    console.log("Teams Caffeine: Status monitoring stopped");
  }
}

function handleVisibilityChange() {
  isTabVisible = !document.hidden;
  if (!isTabVisible) {
    console.log("Teams Caffeine: Tab hidden, pausing activity");
  }
}

document.addEventListener("visibilitychange", handleVisibilityChange);
window.addEventListener("focus", () => {
  isTabVisible = true;
});
window.addEventListener("blur", () => {
  isTabVisible = false;
});

ChromeUtils.storage.get(["teamsCaffeineEnabled"], (result, error) => {
  if (error) {
    console.error("Teams Caffeine: Failed to load extension state, defaulting to disabled");
    isExtensionEnabled = false;
    return;
  }
  
  isExtensionEnabled = result.teamsCaffeineEnabled !== false;
  if (isExtensionEnabled) {
    startJiggle();
  } else {
    stopJiggle();
  }
});

chrome.runtime?.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "TEAMS_CAFFEINE_STATE") {
    isExtensionEnabled = message.enabled;
    if (message.enabled) {
      startJiggle();
    } else {
      stopJiggle();
    }
  }
});
