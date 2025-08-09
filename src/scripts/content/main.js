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
    simulateActivity();
    scheduleNextActivity();
  }, delay);
}

function simulateActivity() {
  if (document.hidden) {
    ChromeUtils.debugLog("Teams Caffeine: Tab hidden, continuing activity simulation in background");
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
      ChromeUtils.debugLog("Teams Caffeine: Status check detected away/offline status, triggering activity");
      simulateActivity();
      setTimeout(() => simulateActivity(), 2000);
      setTimeout(() => simulateActivity(), 4000);
    } else {
      ChromeUtils.debugLog(`Teams Caffeine: Status check - current status: ${ariaLabel}`);
    }
  } else {
    ChromeUtils.debugLog("Teams Caffeine: Status check - presence badge not found");
  }
}

function startStatusMonitoring() {
  if (statusCheckIntervalId === null && isExtensionEnabled) {
    statusCheckIntervalId = setInterval(checkTeamsStatus, STATUS_CHECK_INTERVAL);
    ChromeUtils.debugLog("Teams Caffeine: Status monitoring started (5 minute intervals)");
  }
}

function stopStatusMonitoring() {
  if (statusCheckIntervalId !== null) {
    clearInterval(statusCheckIntervalId);
    statusCheckIntervalId = null;
    ChromeUtils.debugLog("Teams Caffeine: Status monitoring stopped");
  }
}

function handleVisibilityChange() {
  isTabVisible = !document.hidden;
  if (!isTabVisible) {
    ChromeUtils.debugLog("Teams Caffeine: Tab hidden, continuing activity simulation");
  } else {
    ChromeUtils.debugLog("Teams Caffeine: Tab visible, continuing activity simulation");
  }
}

document.addEventListener("visibilitychange", handleVisibilityChange);
window.addEventListener("focus", () => {
  isTabVisible = true;
  ChromeUtils.debugLog("Teams Caffeine: Window focused, continuing activity simulation");
});
window.addEventListener("blur", () => {
  isTabVisible = false;
  ChromeUtils.debugLog("Teams Caffeine: Window blurred, continuing activity simulation");
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
