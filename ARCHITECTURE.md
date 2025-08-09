# Teams Caffeine - Architecture Documentation

This document describes the project structure and explains the purpose of each folder and file in the Teams Caffeine Chrome extension.

## Project Structure

```
teams-caffeine/
├── README.md                     # Main project documentation
├── LICENSE                       # MIT license file
├── CHANGELOG.md                  # Version history and release notes
├── PRIVACY_POLICY.md            # Privacy policy for users
├── CHROME_STORE_DESCRIPTION.md  # Chrome Web Store listing content
├── CLAUDE.md                    # AI assistant instructions for development
├── MEMORY.md                    # Development memory and important notes
├── ARCHITECTURE.md              # This file - project architecture documentation
├── build.sh                     # Build script for Mac/Linux
├── build.bat                    # Build script for Windows
├── chrome.zip                   # Built extension archive (generated)
└── src/                         # Extension source code directory
    ├── manifest.json            # Chrome extension manifest
    ├── scripts/                 # JavaScript files organized by purpose
    │   ├── utils/               # Utility functions and helpers
    │   │   └── chrome-utils.js  # Chrome API wrappers with error handling
    │   ├── content/             # Content scripts
    │   │   └── main.js          # Main content script (injected into Teams pages)
    │   ├── background/          # Background service worker
    │   │   └── background.js    # Service worker (background script)
    │   └── ui/                  # User interface scripts
    │       ├── popup.js         # Popup functionality and logic
    │       └── options.js       # Options page functionality
    ├── pages/                   # HTML pages
    │   ├── popup.html           # Extension popup interface
    │   └── options.html         # Extension options/settings page
    ├── styles/                  # CSS stylesheets (for future use)
    └── images/                  # Extension icons and assets
        ├── 48.png               # Icon for extension toolbar
        ├── 96.png               # Icon for extension management
        ├── 128.png              # Icon for Chrome Web Store
        ├── 256.png              # High-resolution icon
        ├── 512.png              # Very high-resolution icon
        ├── 1024.png             # Maximum resolution icon
        └── chrome-store.png     # Chrome Web Store promotional image
```

## File Descriptions

### Root Level Files

#### Documentation Files
- **README.md**: Main project documentation with setup instructions, features, and usage guide
- **LICENSE**: MIT license governing the use and distribution of the extension
- **CHANGELOG.md**: Version history tracking all changes, features, and bug fixes
- **PRIVACY_POLICY.md**: Privacy policy explaining data handling practices
- **CHROME_STORE_DESCRIPTION.md**: Marketing copy and description for Chrome Web Store listing
- **ARCHITECTURE.md**: This file - comprehensive project structure documentation

#### Development Files
- **CLAUDE.md**: Instructions and context for AI-assisted development
- **MEMORY.md**: Development memory containing important implementation details and challenges faced

#### Build Scripts
- **build.sh**: Unix/Linux build script that creates the chrome.zip package from src/ directory
- **build.bat**: Windows batch file equivalent of build.sh for Windows development environments
- **chrome.zip**: Generated archive containing the packaged extension ready for installation/distribution

### Source Code Directory (`src/`)

#### Core Extension Files
- **manifest.json**: Chrome Extension Manifest V3 configuration file defining:
  - Extension metadata (name, version, description)
  - Permissions (storage, alarms)
  - Content scripts targeting Teams domains
  - Background service worker
  - Extension icons and popup configuration
  - Options page reference

#### Utility Scripts (`scripts/utils/`)
- **chrome-utils.js**: Chrome API utility wrappers providing:
  - Comprehensive error handling for storage operations
  - Error handling for runtime messaging
  - Error handling for tab communication
  - Error handling for alarms API
  - Consistent error logging across the extension

#### Background Processing (`scripts/background/`)
- **background.js**: Service worker that handles:
  - Extension state management
  - Auto-disable timer functionality using Chrome alarms API
  - Communication between popup, options, and content scripts
  - Cross-tab state synchronization
  - Input validation for timer operations

#### Content Script (`scripts/content/`)
- **main.js**: Content script injected into Microsoft Teams pages that:
  - Simulates user activity (mouse movement, key presses, scrolling)
  - Monitors Teams presence status every 5 minutes
  - Manages activity intervals with randomization
  - Handles tab visibility changes
  - Responds to extension state changes

#### User Interface Pages (`pages/`)
- **popup.html**: Extension toolbar popup interface featuring:
  - Toggle switch for enabling/disabling the extension
  - Status indicator (ON/OFF with visual feedback)
  - Settings gear icon for accessing options
  - Consistent styling with extension theme

- **options.html**: Extension options page providing:
  - Auto-disable timer configuration
  - Time selection dropdown (1-24 hours)
  - Timer status display
  - Clean, accessible interface design

#### User Interface Scripts (`scripts/ui/`)
- **popup.js**: Popup functionality handling:
  - Toggle switch interactions
  - Chrome storage integration with error handling
  - Settings icon click events
  - Status updates and visual feedback
  - DOM element validation

- **options.js**: Options page functionality managing:
  - Auto-disable settings persistence with validation
  - Real-time timer status updates
  - Settings validation and saving
  - Input validation for hours selection
  - Date validation for timer calculations
  - Communication with background script

#### Assets Directory (`src/images/`)
- **48.png**: Standard extension icon (48x48px) used in browser toolbar
- **96.png**: Medium resolution icon (96x96px) for extension management page
- **128.png**: Chrome Web Store icon (128x128px) for store listings
- **256.png**: High resolution icon (256x256px) for various UI contexts
- **512.png**: Very high resolution icon (512x512px) for large displays
- **1024.png**: Maximum resolution icon (1024x1024px) for promotional materials
- **chrome-store.png**: Promotional image for Chrome Web Store listing

## Architecture Overview

### Extension Type
Teams Caffeine is built as a Chrome Extension using Manifest V3, providing:
- Modern security model with service workers
- Restricted permissions (only storage and alarms)
- Content script injection only on Teams domains

### Communication Flow
1. **User Interaction**: User toggles extension via popup interface
2. **State Management**: Popup saves state to Chrome storage and notifies background script
3. **Cross-Tab Communication**: Background script forwards state changes to all Teams tabs
4. **Activity Simulation**: Content scripts start/stop activity simulation based on state
5. **Auto-Disable**: Background script manages timer and automatically disables when expired

### Security Considerations
- Minimal permissions requested (storage, alarms only)
- Content scripts only injected on Teams domains
- No external network requests
- All data stored locally using Chrome storage API
- No tracking or analytics

### Development Workflow
1. Make changes to files in `src/` directory
2. Run `./build.sh` (Mac/Linux) or `build.bat` (Windows) to create chrome.zip
3. Load unpacked extension from `src/` directory for development
4. Use chrome.zip for distribution

This architecture ensures a secure, efficient, and maintainable Chrome extension that provides the core Teams activity simulation functionality while offering advanced features like auto-disable timers and status monitoring.

## JavaScript Functions Reference

### main.js (Content Script)

#### Constants & Variables
- `MIN_INTERVAL = 8`: Minimum seconds between activities
- `MAX_INTERVAL = 12`: Maximum seconds between activities  
- `STATUS_CHECK_INTERVAL = 5 * 60 * 1000`: 5 minutes in milliseconds for status checks
- `intervalId`: Stores timeout ID for activity scheduling
- `statusCheckIntervalId`: Stores interval ID for status monitoring
- `isTabVisible`: Boolean tracking tab visibility state
- `isExtensionEnabled`: Boolean tracking extension enabled state

#### Core Activity Functions
- **`getRandomInterval()`**: Returns random interval between MIN_INTERVAL and MAX_INTERVAL in milliseconds
- **`startJiggle()`**: Initiates activity simulation by scheduling first activity and starting status monitoring
- **`stopJiggle()`**: Stops all activity simulation and status monitoring by clearing timeouts/intervals
- **`scheduleNextActivity()`**: Recursively schedules the next activity simulation with random delay
- **`simulateActivity()`**: Main activity controller that randomly selects and executes one of three activity types (mouse, keyboard, scroll)

#### Activity Simulation Functions
- **`simulateMouseMovement()`**: Creates and dispatches synthetic mouse movement events at random coordinates within the page bounds
- **`simulateKeyPress()`**: Simulates safe key presses (Shift, Control, Alt) with proper keydown/keyup sequence and 50ms delay
- **`simulateScroll()`**: Performs minimal scroll (1px up/down) and immediately reverses it after 100ms

#### Status Monitoring Functions
- **`checkTeamsStatus()`**: Searches for Teams presence badge, checks if status is "away"/"offline", triggers triple activity burst if needed
- **`startStatusMonitoring()`**: Starts 5-minute interval timer for status checking (only when extension enabled)
- **`stopStatusMonitoring()`**: Stops status monitoring interval and clears the timer

#### Event Handlers
- **`handleVisibilityChange()`**: Updates `isTabVisible` when tab visibility changes and logs when tab becomes hidden

#### Event Listeners & Initialization
- Document visibility change listener
- Window focus/blur listeners to track tab activity
- Chrome storage initialization to get extension state
- Chrome runtime message listener for state changes

### background.js (Service Worker)

#### Communication Functions
- **`sendMessageToTeamsTabs(message)`**: Queries all open Teams tabs and sends messages to their content scripts

#### Auto-Disable Timer Functions
- **`startAutoDisableTimer(hours)`**: Creates Chrome alarm for auto-disable, stores start time in storage, logs timer creation
- **`stopAutoDisableTimer()`**: Clears auto-disable alarm and removes start time from storage
- **`handleAutoDisable()`**: Executes auto-disable by setting extension state to false, notifying tabs, and cleaning up storage

#### Event Listeners
- **Chrome alarms listener**: Listens for "autoDisableTeamsCaffeine" alarm and triggers `handleAutoDisable()`
- **Chrome runtime message listener**: Handles two message types:
  - `TEAMS_CAFFEINE_TOGGLE`: Manages extension on/off state and auto-disable timer
  - `AUTO_DISABLE_SETTINGS_CHANGED`: Updates auto-disable timer when settings change

### popup.js (Extension Popup)

#### UI Management Functions
- **`updateStatus(isOn)`**: Updates popup UI elements (text, classes, animations) based on extension state
  - Changes status text between "ON"/"OFF"
  - Adds/removes CSS classes for visual feedback
  - Controls pulse animation on toggle container

#### Event Handlers & Initialization
- **DOMContentLoaded listener**: Main initialization function that:
  - Gets DOM element references
  - Detects if running in extension context
  - Loads saved state from Chrome storage
  - Sets up toggle change event listener
  - Sets up settings icon click handler to open options page

### options.js (Options Page)

#### UI Control Functions
- **`updateTimeSelector()`**: Enables/disables time selector dropdown based on auto-disable toggle state
- **`updateTimerStatus()`**: Calculates and displays remaining time for active auto-disable timer
  - Retrieves start time and duration from storage
  - Calculates remaining hours and minutes
  - Updates UI with countdown or hides status if timer expired
- **`showSaveStatus()`**: Shows "Settings saved!" message for 2 seconds with fade effect

#### Settings Management Functions
- **`saveSettings()`**: Saves auto-disable settings to Chrome storage and notifies background script
  - Creates settings object from form values
  - Stores in Chrome local storage
  - Sends message to background script
  - Shows save confirmation
  - Updates timer status display

#### Event Listeners & Initialization
- **DOMContentLoaded listener**: Main initialization function that:
  - Gets DOM element references
  - Loads existing settings from Chrome storage
  - Sets default values (auto-disable off, 4 hours default)
  - Sets up change event listeners for form controls
  - Starts 60-second interval for timer status updates

## Function Call Flow

### Extension Activation Flow
1. User clicks toggle in popup → `popup.js:updateStatus()` → Chrome storage save → Message to background
2. Background receives toggle → `background.js:sendMessageToTeamsTabs()` → Message to content scripts
3. Content script receives message → `main.js:startJiggle()` → `scheduleNextActivity()` → `simulateActivity()`
4. If auto-disable enabled → `background.js:startAutoDisableTimer()` → Chrome alarm created

### Activity Simulation Flow
1. `scheduleNextActivity()` sets timeout → `simulateActivity()` called
2. `simulateActivity()` randomly selects activity type → Calls one of:
   - `simulateMouseMovement()` → Creates mouse event → Dispatches to DOM
   - `simulateKeyPress()` → Creates key events → Dispatches with delay
   - `simulateScroll()` → Scrolls page → Reverses scroll
3. Process repeats with new random delay

### Status Monitoring Flow
1. `startStatusMonitoring()` sets 5-minute interval → `checkTeamsStatus()` called
2. `checkTeamsStatus()` searches DOM → Finds presence badge → Checks aria-label
3. If "away"/"offline" detected → Triggers 3 rapid `simulateActivity()` calls (0s, 2s, 4s delays)

This comprehensive function reference provides detailed insight into how each component of the Teams Caffeine extension operates and interacts with other parts of the system.