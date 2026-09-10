# Teams Caffeine - Architecture Documentation

This document describes the project structure and explains the purpose of each folder and file in the Teams Caffeine Chrome extension.

## Project Structure

```
teams-caffeine/
├── README.md                     # Main project documentation (includes the changelog)
├── LICENSE                       # MIT license file
├── PRIVACY_POLICY.md             # Privacy policy for users
├── CHROME_STORE_DESCRIPTION.md   # Chrome Web Store listing content
├── ARCHITECTURE.md               # This file - project architecture documentation
├── package.json                  # Dev tooling (ESLint + tests); no runtime dependencies
├── eslint.config.js              # ESLint flat config
├── build.sh                      # Build script for Mac/Linux
├── build.bat                     # Build script for Windows
├── chrome.zip                    # Built extension archive (generated; git-ignored)
├── test/                         # Unit tests (Node's built-in test runner)
│   └── timing.test.js            # Tests for the pure timing helpers
└── src/                          # Extension source code directory
    ├── manifest.json             # Chrome extension manifest (Manifest V3)
    ├── scripts/                  # JavaScript files organized by purpose
    │   ├── utils/                # Utility functions and helpers
    │   │   ├── chrome-utils.js   # Chrome API wrappers with error handling
    │   │   └── timing.js         # Pure activity-interval helpers (unit-tested)
    │   ├── content/              # Content scripts
    │   │   └── main.js           # Main content script (injected into Teams pages)
    │   ├── background/           # Background service worker
    │   │   └── background.js     # Service worker (background script)
    │   └── ui/                   # User interface scripts
    │       ├── popup.js          # Popup functionality and logic
    │       └── options.js        # Options page functionality
    ├── pages/                    # HTML pages
    │   ├── popup.html            # Extension popup interface
    │   └── options.html          # Extension options/settings page
    └── images/                   # Extension icons and assets
        ├── 48.png ... 1024.png   # Icons at various resolutions
        └── chrome-store.png      # Chrome Web Store promotional image
```

## File Descriptions

### Root Level Files

#### Documentation Files

- **README.md**: Main project documentation with setup instructions, features, usage, and the changelog
- **LICENSE**: MIT license governing the use and distribution of the extension
- **PRIVACY_POLICY.md**: Privacy policy explaining data handling practices
- **CHROME_STORE_DESCRIPTION.md**: Marketing copy and description for the Chrome Web Store listing
- **ARCHITECTURE.md**: This file - project structure documentation

#### Tooling & Build Files

- **package.json**: Declares dev-only tooling (ESLint, the Node test runner) and `lint` / `test` / `build` scripts. The extension itself has **no runtime dependencies**.
- **eslint.config.js**: ESLint flat config; lints `src/` with browser/service-worker/web-extension globals.
- **build.sh**: Unix/Linux build script that creates `chrome.zip` from the `src/` directory
- **build.bat**: Windows batch-file equivalent of `build.sh`
- **chrome.zip**: Generated archive containing the packaged extension (git-ignored)

### Source Code Directory (`src/`)

#### Core Extension Files

- **manifest.json**: Manifest V3 configuration defining:
  - Extension metadata (name, version, description)
  - Permissions (storage, alarms, tabs)
  - Content scripts targeting the Teams domains (`chrome-utils.js`, `timing.js`, then `main.js`)
  - Background service worker
  - Extension icons, popup, and options page

#### Utility Scripts (`scripts/utils/`)

- **chrome-utils.js**: Chrome API utility wrappers providing consistent error handling for storage, runtime messaging, tab communication, and alarms, plus a `debugLog` gated on the `debugModeEnabled` setting.
- **timing.js**: Pure helpers (`MIN_INTERVAL`, `MAX_INTERVAL`, `getRandomInterval()`) for the activity loop. Injected before `main.js` so they are available as globals, and guarded with a `module.exports` block so the same logic can be unit-tested under Node.

#### Background Processing (`scripts/background/`)

- **background.js**: Service worker that handles:
  - Extension state management and cross-tab synchronization
  - The **activity heartbeat**: a `chrome.alarms` timer (~30s) that pokes content scripts so activity continues even when a Teams tab is backgrounded and its own `setTimeout` loop is throttled by Chrome
  - Auto-disable timer functionality using the Chrome alarms API
  - Communication between popup, options, and content scripts
  - Input validation for timer operations
  - Re-arming the heartbeat on `onStartup` / `onInstalled` when the extension is enabled

#### Content Script (`scripts/content/`)

- **main.js**: Content script injected into Microsoft Teams pages that:
  - Simulates user activity (mouse movement, key presses, scrolling) on a randomized 8-12s loop
  - Fires a single activity on each `TEAMS_CAFFEINE_HEARTBEAT` message from the service worker
  - Monitors Teams presence status every 5 minutes, trying multiple selectors and warning if none match
  - Responds to extension state changes

#### User Interface Pages (`pages/`)

- **popup.html**: Toolbar popup with the on/off toggle, status indicator, an away-focus warning, and a settings gear icon.
- **options.html**: Options page with the auto-disable timer configuration, time-selection dropdown, timer status display, and debug-mode toggle.

#### User Interface Scripts (`scripts/ui/`)

- **popup.js**: Toggle interactions, storage integration with error handling, warning display, and opening the options page.
- **options.js**: Auto-disable settings persistence with validation, live timer-status countdown, debug-mode persistence, and communication with the background script.

## Architecture Overview

### Extension Type

Teams Caffeine is a Chrome Extension built on Manifest V3, providing a modern service-worker security model, restricted permissions (`storage`, `alarms`, `tabs`), and content-script injection only on Teams domains.

### Communication Flow

1. **User Interaction**: The user toggles the extension via the popup.
2. **State Management**: The popup saves state to `chrome.storage.local` and notifies the service worker.
3. **Cross-Tab Communication**: The service worker reloads Teams tabs, re-broadcasts state, and starts/stops the activity heartbeat and the auto-disable timer.
4. **Activity Simulation**: Content scripts run their own randomized loop and also fire one activity on each heartbeat message.
5. **Auto-Disable**: The service worker manages a timer and disables the extension when it expires.

### Reliability Model

Content-script `setTimeout`/`setInterval` are throttled (and the tab may be frozen) when a Teams tab is in the background, so the 8-12s loop alone is unreliable there. The service worker's `chrome.alarms` heartbeat is **not** subject to tab-visibility throttling, so it drives activity in the background; the content-script loop supplies a natural, faster cadence in the foreground. Content scripts also self-initialize from storage on load, so state stays correct even if a post-reload message is missed.

### Security Considerations

- Minimal permissions (storage, alarms, tabs)
- Content scripts injected only on Teams domains
- No external network requests, no remote code, no analytics
- All data stored locally via the Chrome storage API

### Development Workflow

1. Make changes in `src/`.
2. `npm run lint` and `npm test` to check the changes (dev tooling only; not required to build).
3. Load the unpacked extension from `src/` for manual testing.
4. `./build.sh` (or `build.bat`) to produce `chrome.zip` for distribution.

## JavaScript Functions Reference

### timing.js (Shared Helper)

- **`getRandomInterval()`**: Returns a random delay in milliseconds within `[MIN_INTERVAL, MAX_INTERVAL)` seconds. Pure and unit-tested.

### main.js (Content Script)

- **`startJiggle()` / `stopJiggle()`**: Start/stop the activity loop and the 5-minute status monitor.
- **`scheduleNextActivity()`**: Recursively schedules the next activity with a random delay.
- **`simulateActivity()`**: Randomly runs one of `simulateMouseMovement`, `simulateKeyPress`, or `simulateScroll`.
- **`simulateMouseMovement()` / `simulateKeyPress()` / `simulateScroll()`**: Dispatch synthetic events (mouse move, safe modifier keys, 1px scroll).
- **`findPresenceBadge()`**: Returns the first presence badge matching any known selector, or `null`.
- **`checkTeamsStatus()`**: Uses `findPresenceBadge`; if the status reads away/offline, triggers a 3-shot activity burst; warns once (non-debug) if no selector matches.
- **`startStatusMonitoring()` / `stopStatusMonitoring()`**: Manage the 5-minute status-check interval.
- **Message listener**: Handles `TEAMS_CAFFEINE_STATE` (enable/disable) and `TEAMS_CAFFEINE_HEARTBEAT` (fire one activity).

### background.js (Service Worker)

- **`sendMessageToTeamsTabs(message)`**: Queries all Teams tabs and forwards a message to their content scripts (used by the heartbeat).
- **`reloadTeamsTabsAndToggle(enabled)`**: Reloads Teams tabs and, when enabling, messages each tab once it finishes loading (via a `tabs.onUpdated` listener with a safety timeout).
- **`startHeartbeat()` / `stopHeartbeat()`**: Create/clear the `activityHeartbeat` alarm.
- **`ensureHeartbeat()`**: Re-arms the heartbeat on startup/install if the extension is enabled.
- **`startAutoDisableTimer(hours)` / `stopAutoDisableTimer()` / `handleAutoDisable()`**: Manage the auto-disable alarm and its expiry.
- **Alarm listener**: Routes `autoDisableTeamsCaffeine` to `handleAutoDisable()` and `activityHeartbeat` to the heartbeat broadcast.
- **Message listener**: Handles `TEAMS_CAFFEINE_TOGGLE` and `AUTO_DISABLE_SETTINGS_CHANGED`.

### popup.js (Extension Popup)

- **`updateStatus(isOn)`**: Updates the popup UI (text, classes, pulse animation) from state.
- **`showWarning()`**: Briefly shows the "keep the Teams tab in focus" warning when enabling.
- **DOMContentLoaded handler**: Loads state, wires the toggle, and opens the options page from the gear icon.

### options.js (Options Page)

- **`updateTimeSelector()`**: Enables/disables the hours dropdown from the auto-disable toggle.
- **`updateTimerStatus()`**: Computes and displays the remaining time for an active auto-disable timer.
- **`saveSettings()` / `saveDebugMode()`**: Persist settings (with validation) and notify the service worker.
