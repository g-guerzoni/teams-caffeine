// Chrome API utilities with comprehensive error handling
const ChromeUtils = {
  // Debug logging utility
  debugLog: (...args) => {
    ChromeUtils.storage.get(["debugModeEnabled"], (result, error) => {
      if (!error && result.debugModeEnabled) {
        console.log(...args);
      }
    });
  },
  // Helper function to format error messages properly
  _formatError: (error) => {
    if (!error) return "Unknown error";
    
    // Handle Chrome runtime.lastError structure
    if (error.message) return error.message;
    
    // Handle nested error objects
    if (typeof error === "object") {
      try {
        return JSON.stringify(error);
      } catch {
        return error.toString() || "Unknown error";
      }
    }
    
    return error.toString() || "Unknown error";
  },

  storage: {
    get: (keys, callback) => {
      try {
        chrome.storage.local.get(keys, (result) => {
          if (chrome.runtime.lastError) {
            const errorMsg = ChromeUtils._formatError(chrome.runtime.lastError);
            console.error("Teams Caffeine: Storage get error:", errorMsg);
            callback({}, chrome.runtime.lastError);
          } else {
            callback(result, null);
          }
        });
      } catch (error) {
        console.error("Teams Caffeine: Storage get exception:", ChromeUtils._formatError(error));
        callback({}, error);
      }
    },
    
    set: (data, callback) => {
      try {
        chrome.storage.local.set(data, () => {
          if (chrome.runtime.lastError) {
            const errorMsg = ChromeUtils._formatError(chrome.runtime.lastError);
            console.error("Teams Caffeine: Storage set error:", errorMsg);
            callback && callback(chrome.runtime.lastError);
          } else {
            callback && callback(null);
          }
        });
      } catch (error) {
        console.error("Teams Caffeine: Storage set exception:", ChromeUtils._formatError(error));
        callback && callback(error);
      }
    },
    
    remove: (keys, callback) => {
      try {
        chrome.storage.local.remove(keys, () => {
          if (chrome.runtime.lastError) {
            const errorMsg = ChromeUtils._formatError(chrome.runtime.lastError);
            console.error("Teams Caffeine: Storage remove error:", errorMsg);
            callback && callback(chrome.runtime.lastError);
          } else {
            callback && callback(null);
          }
        });
      } catch (error) {
        console.error("Teams Caffeine: Storage remove exception:", ChromeUtils._formatError(error));
        callback && callback(error);
      }
    }
  },
  
  runtime: {
    sendMessage: (message, callback) => {
      try {
        chrome.runtime.sendMessage(message, (response) => {
          if (chrome.runtime.lastError) {
            const errorMsg = ChromeUtils._formatError(chrome.runtime.lastError);
            
            // Message port closed is expected when background script isn't ready - log as debug
            if (errorMsg.includes("message port closed") || errorMsg.includes("receiving end does not exist")) {
              console.debug("Teams Caffeine: Background script not ready:", errorMsg);
            } else {
              console.error("Teams Caffeine: Runtime message send error:", errorMsg);
              console.debug("Teams Caffeine: Message that failed:", message);
            }
            
            callback && callback(null, chrome.runtime.lastError);
          } else {
            callback && callback(response, null);
          }
        });
      } catch (error) {
        console.error("Teams Caffeine: Runtime message send exception:", ChromeUtils._formatError(error));
        callback && callback(null, error);
      }
    }
  },
  
  tabs: {
    sendMessage: (tabId, message, callback) => {
      try {
        chrome.tabs.sendMessage(tabId, message, (response) => {
          if (chrome.runtime.lastError) {
            const errorMsg = ChromeUtils._formatError(chrome.runtime.lastError);
            // Content script not ready - this is normal, log as debug
            console.debug(`Teams Caffeine: Could not send message to tab ${tabId}: ${errorMsg}`);
            callback && callback(null, chrome.runtime.lastError);
          } else {
            callback && callback(response, null);
          }
        });
      } catch (error) {
        console.error("Teams Caffeine: Tab message send exception:", ChromeUtils._formatError(error));
        callback && callback(null, error);
      }
    }
  },
  
  alarms: {
    create: (name, alarmInfo, callback) => {
      try {
        chrome.alarms.create(name, alarmInfo);
        // Note: chrome.alarms.create doesn't have a callback, but we provide consistency
        callback && callback(null);
      } catch (error) {
        console.error("Teams Caffeine: Alarm create exception:", ChromeUtils._formatError(error));
        callback && callback(error);
      }
    },
    
    clear: (name, callback) => {
      try {
        chrome.alarms.clear(name, (wasCleared) => {
          if (chrome.runtime.lastError) {
            const errorMsg = ChromeUtils._formatError(chrome.runtime.lastError);
            console.error("Teams Caffeine: Alarm clear error:", errorMsg);
            callback && callback(false, chrome.runtime.lastError);
          } else {
            callback && callback(wasCleared, null);
          }
        });
      } catch (error) {
        console.error("Teams Caffeine: Alarm clear exception:", ChromeUtils._formatError(error));
        callback && callback(false, error);
      }
    }
  }
};