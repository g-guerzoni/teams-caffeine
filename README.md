# Teams Caffeine

![Teams Caffeine Logo](src/images/96.png) [![Try out the extension in the Google Chrome Store.](/src/images/chrome-store.png)](https://chromewebstore.google.com/detail/ngijfjcimmlajolmohfpjegneedaflpm)

[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**This is merely a case study. If your company measures productivity based on your Teams status, you might want to reconsider your current job.**

## Overview

Teams Caffeine is a lightweight browser extension that keeps your Microsoft Teams status active by simulating mouse movement at regular intervals. This prevents your status from changing to "Away" or "Inactive" during periods of inactivity.

## Features

- Keeps your Microsoft Teams status active
- Works seamlessly in the background
- Highlights the Teams mic button by mute state during calls (red = muted, teal = live)
- Shows in-call / pre-join status and mic state in the popup
- Privacy-focused with minimal permissions
- No tracking or data collection

## Usage

1. Click on the Teams Caffeine icon in your browser toolbar
2. Toggle the extension on/off
3. Check the popup for your in-call / mic status while in a Teams call
4. Adjust settings in the Options page (auto-disable timer, mic-button highlight)
5. Continue using Microsoft Teams as usual

## Local Setup

### Manual load

1. Go to chrome://extensions/
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `src` folder

### Build

Building the extension needs no dependencies, so it just zips `src/` into `chrome.zip`:

```bash
git clone https://github.com/g-guerzoni/teams-caffeine.git
cd teams-caffeine

./build.sh   # macOS/Linux
build.bat    # Windows
```

The resulting `chrome.zip` can be uploaded to the Chrome Web Store or loaded unpacked.

### Development

Linting and tests use dev-only tooling (there are no runtime dependencies):

```bash
npm install   # installs ESLint and test tooling
npm run lint  # lint src/
npm test      # run unit tests (node --test)
```

## Privacy Policy

Teams Caffeine respects your privacy. The extension does not collect, store, or transmit any user data. It only performs local mouse movement simulation on Microsoft Teams pages. For more details, see our [Privacy Policy](PRIVACY_POLICY.md).

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Keywords

microsoft teams, teams extension, stay active, prevent timeout, teams status, active status, browser extension, chrome extension, edge extension, firefox extension, teams caffeine, teams activity, prevent away status, microsoft teams extension, productivity tool, work from home, remote work, keep teams awake, teams awake, awake, sleep teams.

---

## Changelog

### v1.7.1

- **Toolbar Status Dot**: While you are in a Teams call, the extension icon shows a status dot, red when muted and teal when live.
- **Cleaner Status Icons**: The popup call and mic status use simple icons instead of emoji, centered, with the mic state on its own line below the call state.
- **Tighter Permissions**: Replaced the broad `tabs` permission with access scoped to the Microsoft Teams domains only.
- **Stability**: The content script now stops cleanly when the extension is reloaded or updated, instead of logging errors on already-open tabs.
- **Hardening**: Removed a DOM injection point in the popup, restricted privileged background messages to the extension's own pages, and de-duplicated the storage helpers.

### v1.7.0

- **Mic-Button Highlight**: The Teams microphone button is ringed by mute state during calls and on the pre-join screen (red = muted, teal = live). Toggle it in the Options page.
- **Call / Mic Indicator**: The popup now shows In call / Pre-join / Not in call and, when a mic is present, its mute status.
- **Extensible Teams Controls**: Internal framework so more Teams controls can be added.
- **Maintenance**: Dev dependencies updated to latest.

### v1.6.0

- **Reliable Background Activity**: Added a service-worker heartbeat so activity simulation keeps running when the Teams tab is in the background, where the browser throttles page timers.
- **Resilient Status Detection**: Presence detection now tries multiple selectors and warns visibly if Teams changes its layout, instead of failing silently.
- **Developer Tooling**: Added ESLint and unit tests (no runtime dependencies) and corrected the setup/build documentation.

### v1.5.0

- **New Domain Support**: Added support for Microsoft Teams' new `teams.cloud.microsoft` domain
- **Reliable Tab Reload**: Replaced fragile timeout-based reload with event-driven `tabs.onUpdated` listener
- **Service Worker Stability**: Eliminated risk of service worker termination during tab reload process

### v1.4.0

- **Web Accessibility Improvements**: Enhanced accessibility for screen readers and keyboard navigation
- **ARIA Support**: Added comprehensive ARIA attributes (aria-label, aria-checked, role="switch") to all interactive elements
- **Semantic HTML**: Improved HTML structure with proper landmarks (main, header, footer, section)
- **Keyboard Navigation**: Enhanced focus indicators and keyboard accessibility for all controls
- **Screen Reader Announcements**: Added aria-live regions for dynamic status updates
- **WCAG Compliance**: Improved color contrast and focus visibility for better accessibility standards

### v1.3.0

- **Page Reload Strategy**: Extension now reloads Teams pages when toggling state to improve reliability
- **Enhanced Activation**: 1-second delay after page reload ensures proper script injection timing
- **Consistent Behavior**: Both manual and auto-disable now use the same page reload approach
- **Better Compatibility**: Addresses timing issues with Teams security mechanisms

### v1.2.0

- **Background Activity**: Extension now continues working when switching tabs or applications
- **Debug Mode**: Added optional debug logging toggle in settings for troubleshooting
- **Tab Focus Fix**: Teams no longer goes "Away" when switching tabs or losing browser focus

### v1.1.1

- **Critical Fix**: Fixed blur event handler that was causing incorrect visibility tracking
- **Compatibility**: Replaced deprecated mouse event API with modern MouseEvent constructor
- **Reliability**: Added comprehensive error handling for all Chrome extension APIs
- **Validation**: Added input validation for auto-disable timer hours
- **Stability**: Improved error recovery and user feedback throughout the extension

### v1.1.0

- Added timer feature to turn the extension ON and OFF
- Improved the extension's reliability to keep you online

### v1.0.0

- Initial code base
