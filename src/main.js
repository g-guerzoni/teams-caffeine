/**
 * This is the interval, measured in seconds, at which to run the script.
 * In other words, this is how often the script should run.
 *
 * The default value is 10, so the mouse will be jiggled every 10 seconds.
 * If you want to change how often the script runs, modify this value.
 */

const intervalSeconds = 10;
const intervalMilliseconds = intervalSeconds * 1000;

let intervalId = null;

function startJiggle() {
  if (intervalId === null) {
    intervalId = setInterval(moveMouse, intervalMilliseconds);
  }
}

function stopJiggle() {
  if (intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

function moveMouse() {
  var evt = new MouseEvent("mousemove", {
    view: window,
    bubbles: true,
    cancelable: true,
  });
  window.dispatchEvent(evt);
}

chrome.storage?.local.get(["teamsCaffeineEnabled"], (result) => {
  const isOn = result.teamsCaffeineEnabled !== false;
  if (isOn) {
    startJiggle();
  } else {
    stopJiggle();
  }
});

chrome.runtime?.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "TEAMS_CAFFEINE_STATE") {
    if (message.enabled) {
      startJiggle();
    } else {
      stopJiggle();
    }
  }
});
