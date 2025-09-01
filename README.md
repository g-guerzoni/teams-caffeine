# Teams Caffeine

![Teams Caffeine Logo](src/images/96.png) [![Try out the extension in the Google Chrome Store.](/src/images/chrome-store.png)](https://chromewebstore.google.com/detail/ngijfjcimmlajolmohfpjegneedaflpm)

[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**This is merely a case study. If your company measures productivity based on your Teams status, you might want to reconsider your current job.**

## Overview

Teams Caffeine is a lightweight browser extension that keeps your Microsoft Teams status active by simulating mouse movement at regular intervals. This prevents your status from changing to "Away" or "Inactive" during periods of inactivity.

## Features

- Keeps your Microsoft Teams status active
- Works seamlessly in the background
- Privacy-focused with minimal permissions
- No tracking or data collection

## Usage

1. Click on the Teams Caffeine icon in your browser toolbar
2. Toggle the extension on/off
3. Adjust the interval settings (if needed)
4. Continue using Microsoft Teams as usual

## Local Setup

### Manual load
1. Go to chrome://extensions/
2. Enable the "develop mode""
3. Go to "Load unpacked""
4. Select the `src` folder

### Build

```bash
# Clone the repository
git clone https://github.com/g-guerzoni/teams-caffeine.git

# Navigate to the project directory
cd teams-caffeine

# Install dependencies (if any)
npm install

# Build the extension
./build.sh  # For Mac/Linux
build.bat   # For Windows
```

## Privacy Policy

Teams Caffeine respects your privacy. The extension does not collect, store, or transmit any user data. It only performs local mouse movement simulation on Microsoft Teams pages. For more details, see our [Privacy Policy](PRIVACY_POLICY.md).

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Keywords

microsoft teams, teams extension, stay active, prevent timeout, teams status, active status, browser extension, chrome extension, edge extension, firefox extension, teams caffeine, teams activity, prevent away status, microsoft teams extension, productivity tool, work from home, remote work, keep teams awake, teams awake, awake, sleep teams.

---

## Changelog

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
