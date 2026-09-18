# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Teams Caffeine is a Manifest V3 Chrome extension (vanilla JS, no bundler, no runtime dependencies) that keeps Microsoft Teams "Active" by simulating background activity, and adds Teams call controls (mic-button highlight, popup call/mic indicator, toolbar status dot). All extension code lives under `src/`. `ARCHITECTURE.md` has the full file-by-file breakdown; this file covers the commands and the non-obvious cross-cutting design.

## Commands

- **Build**: `./build.sh` (macOS/Linux) or `build.bat` (Windows). Zips `src/` into `chrome.zip`. Needs no dependencies. The `./*` glob excludes dotfiles.
- **Lint**: `npm run lint` (ESLint 10 flat config in `eslint.config.js`).
- **Test**: `npm test` (Node's built-in runner, `node --test`).
- **Single test**: `node --test test/selectors.test.js`.
- **Install dev tooling**: `npm install` (ESLint + globals; dev-only, not required to build).
- **Load for manual testing**: `chrome://extensions` → Developer mode → Load unpacked → select the `src/` folder.

Only pure logic is unit-tested (`timing.js`, `selectors.js`, `call-status.js`). DOM- and Chrome-API-dependent code is verified by loading the extension.

## Architecture and gotchas

**Content-script files share one lexical scope.** The files in `manifest.json` `content_scripts[].js` execute in a single shared isolated-world scope. A top-level `const` in one file (e.g. `ChromeUtils`, `TeamsSelectors`, `getRandomInterval`) is visible to later files. Consequences:
- The `js` array order matters: a file must appear after the files it depends on.
- Two files declaring the same top-level name is a redeclaration `SyntaxError` that kills the entire injection (including the caffeine loop). So `content/teams/selectors.js` exposes exactly one global (`TeamsSelectors`) and `content/teams/teams-controls.js` is an IIFE that leaks nothing. Adding new shared globals also means updating the `globals` list in `eslint.config.js`.

**Two independent content-script subsystems** run side by side on Teams pages: `content/main.js` (the caffeine activity simulator, gated on the `teamsCaffeineEnabled` storage key) and `content/teams/*` (mic highlight + call/mic status, gated on their own settings). The Teams controls run regardless of the caffeine on/off state.

**UMD guard for testability.** Pure-logic files end with `if (typeof module !== "undefined" && module.exports) { module.exports = ... }`. In the browser they load as plain global scripts; under Node the test files `require()` them. `module` is declared as a global in `eslint.config.js`.

**MV3 service-worker lifecycle** (`background/background.js`): the worker is ephemeral. Timers use `chrome.alarms`, not `setTimeout`, and all event listeners are registered at the top level so they survive worker restarts. The `activityHeartbeat` alarm exists because content-script `setTimeout`/`setInterval` are throttled when the Teams tab is backgrounded; the alarm drives activity that survives throttling.

**Extension-context invalidation.** After the extension reloads/updates, content scripts already running in open tabs are orphaned: `chrome.runtime.id` becomes undefined and `chrome.*` calls throw. Content scripts guard on `chrome.runtime?.id` and stop their loops. Testing implication: reloading the extension does NOT refresh the content script in an already-open Teams tab — reload the tab too, and reload the extension *first*, then the tab.

**Teams DOM coupling.** All Teams selectors live only in `content/teams/selectors.js` (single quarantined source). They are verified for `teams.cloud.microsoft`; the in-call mic button is `#microphone-button[data-state="mic-off"]` (muted) / `[data-state="mic"]` (live), checked for visibility via `getClientRects()`. Everything fails safe: no selector match means no ring/dot and never breaks Teams.

**Toolbar dot messaging.** The content script reports call/mic changes to the worker via `TEAMS_CAFFEINE_STATUS_REPORT`; the worker keeps a per-tab map and composites a red/teal dot onto the icon with `OffscreenCanvas`. Both drawing and clearing the dot go through `setIcon({ imageData })` (mixing `{path}` and `{imageData}` was a real clear-doesn't-work bug), guarded by a render sequence counter against async races. The worker acknowledges the report with `sendResponse` so the content script's callback does not see a closed message port or fall into a resend loop.

**Message types**: `TEAMS_CAFFEINE_TOGGLE` and `AUTO_DISABLE_SETTINGS_CHANGED` (popup/options → worker; privileged, rejected when `sender.tab` is set, i.e. from a content script); `TEAMS_CAFFEINE_STATE` and `TEAMS_CAFFEINE_HEARTBEAT` (worker → content); `TEAMS_CAFFEINE_GET_CALL_STATUS` (popup query → content, synchronous response); `TEAMS_CAFFEINE_STATUS_REPORT` (content → worker, for the dot).

**Permissions**: `storage`, `alarms`, and `host_permissions` for the three Teams domains — deliberately not the broad `tabs` permission. Content-script injection is governed separately by `content_scripts.matches`.

## Conventions

- **Version lives in three files that must stay in sync**: `src/manifest.json`, `package.json`, and the footer `<span>` in `src/pages/popup.html`. The changelog is a section in `README.md` (there is no separate CHANGELOG.md).
- **Storage keys** (all in `chrome.storage.local`): `teamsCaffeineEnabled`, `teamsMicHighlightEnabled` (both default ON, read as `!== false`), `autoDisableEnabled`, `autoDisableHours`, `autoDisableStartTime`, `debugModeEnabled`. `ChromeUtils.debugLog` is silent unless `debugModeEnabled` is set.
- Design docs for the Teams controls are under `docs/superpowers/specs/` and `docs/superpowers/plans/`.
