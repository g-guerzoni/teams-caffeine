// MIN_INTERVAL, MAX_INTERVAL and getRandomInterval() are provided by
// scripts/utils/timing.js, which is injected before this file (see manifest.json).
const STATUS_CHECK_INTERVAL = 5 * 60 * 1000;

let intervalId = null;
let statusCheckIntervalId = null;
let isExtensionEnabled = false;

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

// Teams rotates its internal class names, so try several selectors from most to
// least specific. If Microsoft changes the DOM and none match, surface a real
// warning (not a debug-only log) so the breakage is visible.
const PRESENCE_SELECTORS = [
  '[aria-label][role="img"][id*="avatar"][class*="PresenceBadge"]',
  '[class*="PresenceBadge"][aria-label]',
  '[data-tid*="presence"][aria-label]',
  '[id*="avatar"][role="img"][aria-label]',
];

let presenceLookupWarned = false;

function findPresenceBadge() {
  for (const selector of PRESENCE_SELECTORS) {
    const element = document.querySelector(selector);
    if (element && element.getAttribute("aria-label")) {
      return element;
    }
  }
  return null;
}

function checkTeamsStatus() {
  if (!isExtensionEnabled) {
    return;
  }

  const presenceBadge = findPresenceBadge();

  if (!presenceBadge) {
    if (!presenceLookupWarned) {
      console.warn(
        "Teams Caffeine: Could not find the presence badge with any known selector. Teams may have changed its DOM. Passive activity simulation still runs. Only the away-status corrective check is affected.",
      );
      presenceLookupWarned = true;
    }
    return;
  }

  presenceLookupWarned = false;

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

chrome.runtime?.onMessage.addListener((message) => {
  if (message.type === "TEAMS_CAFFEINE_STATE") {
    isExtensionEnabled = message.enabled;
    if (message.enabled) {
      startJiggle();
    } else {
      stopJiggle();
    }
  } else if (message.type === "TEAMS_CAFFEINE_HEARTBEAT") {
    // Service-worker alarm poke: fire one activity even when this tab is
    // backgrounded and our own setTimeout loop is throttled.
    if (isExtensionEnabled) {
      simulateActivity();
    }
  }
});
