# Teams Controls: Mic-Button Highlight + Call/Mic Indicator - Design

**Date:** 2026-09-09
**Status:** Approved design (pre-implementation)
**Author:** Guilherme Guerzoni

## 1. Overview

Add two Microsoft Teams "controls" to the Teams Caffeine extension, built on a small
extensible framework so more Teams controls can be added later:

1. **Mic-button highlight** - ring the Teams microphone button by mute state (red when
   muted, teal when live), on the page itself.
2. **Call / mic indicator** - a small read-only status row in the popup showing
   "In call" / "Pre-join" / "Not in call" and, when a mic is present, its current status.

The mechanism is ported (not copied) from HAL's `hal-workflow-dashboard` spec
`025-teams-mic-status-highlight-design.md`. That HAL feature is a *design only* (never
implemented), and its extension is React/TypeScript; Teams Caffeine is vanilla-JS
Manifest V3, so we re-implement the mechanism in plain JS.

## 2. Goals & non-goals

**Goals**
- Ring the Teams mic button by mute state, faithfully to HAL (colors + selectors).
- Show a read-only call/mic indicator in the popup.
- Introduce a minimal, well-bounded framework for future Teams controls.
- Zero new permissions; no regression to the existing caffeine behavior.

**Non-goals (explicitly out of scope for this change)**
- A toolbar-icon badge reflecting call state while the popup is closed (would require
  background state tracking - see §13, deferred).
- Controlling Teams (e.g., programmatically muting) - the framework is *prepared* for it
  but no command feature ships now.
- Verifying the Teams DOM on `teams.live.com` / `teams.microsoft.com` (unverified; the
  design fails safe there - see §11).

## 3. Decisions (confirmed with the user)

| Question | Decision |
|----------|----------|
| Highlight semantics | Replicate HAL: **red `#dc2626` = muted**, **teal `#0d9488` = live**, both states (in-call + pre-join). |
| Domains | Run on **all three** supported domains, fail-safe. Only `teams.cloud.microsoft` is DOM-verified. |
| Configuration | Popup keeps **only** the caffeine on/off toggle. The **mic-highlight gets its own toggle in the options page** (default ON), like HAL. The popup call/mic indicator is **read-only display** (no toggle). |
| Popup state delivery | **On-demand query** (Approach A): the popup asks the Teams tab's content script for state on open and re-polls ~1s while open. No service-worker state, no DOM observer. |
| Popup call states | Three states - **Not in call / Pre-join / In call** - with the mic chip shown whenever a mic state is readable. |

## 4. Architecture

### 4.1 Content-script module layout

Two new files under `src/scripts/content/teams/`, injected as ordinary content-script
files that share the page's isolated-world global scope (the same pattern
`chrome-utils.js` and `timing.js` already rely on):

- **`selectors.js`** - the single quarantined source of Teams DOM knowledge:
  colors, selector strings, the highlight CSS builder, and the state readers. When Teams
  rotates its DOM, this is the only file to change. Exposed as one global object,
  `TeamsSelectors`.
- **`teams-controls.js`** - the registry + wiring: the `FEATURES` array (the extension
  seam), the mic-highlight feature, the settings/storage subscription, and the popup
  status-query message handler. Runs as an IIFE (§4.4). Each feature call is wrapped in
  try/catch so a broken control cannot break Teams or the caffeine jiggle.

These run **independently of the caffeine on/off state** (`teamsCaffeineEnabled`). The
caffeine jiggle (`content/main.js`) is unchanged and stays a separate concern.

### 4.2 Manifest injection order

```jsonc
"js": [
  "scripts/utils/chrome-utils.js",
  "scripts/utils/timing.js",
  "scripts/content/teams/selectors.js",
  "scripts/content/teams/teams-controls.js",
  "scripts/content/main.js"
]
```

`selectors.js` must precede `teams-controls.js` (it defines the shared `TeamsSelectors`
global). Order relative to `main.js` is irrelevant (independent).

### 4.3 The `TeamsFeature` contract (extensibility seam)

Each control is a plain object:

```js
// { id: string, start(): void, stop(): void }
```

`teams-controls.js` holds `const FEATURES = [micHighlight];`. Adding a future control =
implement a `{ id, start, stop }` object, add it to `FEATURES`, and (only if it needs
popup/SW interaction) add a message type. `start`/`stop` are driven by that feature's
setting via `chrome.storage.onChanged`.

### 4.4 Global-scope discipline

Content-script files share one isolated-world lexical scope, so a top-level `const`
declared in one file is visible to the next - but two files declaring the same top-level
name is a **redeclaration `SyntaxError` that aborts the whole content-script injection**
(taking the caffeine jiggle down with it). To keep the collision surface at exactly one
name:

- `selectors.js` exposes a single global object `TeamsSelectors` (§5.1) - no other
  top-level names.
- `teams-controls.js` runs as an **IIFE** (`(function () { … })()`), leaking no globals;
  it references `TeamsSelectors` and adds its listeners from inside the closure.

## 5. Feature 1 - Mic-button highlight

Pure attribute-keyed CSS, exactly as HAL designed it. Teams flips the mic button's
attributes in place, so a static stylesheet lets the CSS engine recolor instantly - **no
MutationObserver, no polling, no button-finding JS.**

### 5.1 `selectors.js` contents

Everything Teams-DOM-specific lives on a **single top-level global**, `TeamsSelectors`,
so the content-script global scope stays clean and there is exactly one name that could
collide with another injected file (§4.4).

```js
const TeamsSelectors = {
  MIC_MUTED_COLOR: "#dc2626", // matches HAL error.solid
  MIC_LIVE_COLOR: "#0d9488",  // matches HAL success.solid

  HIGHLIGHT_STYLE_ID: "teams-caffeine-mic-highlight",

  // --- Mute-VALUE selectors (drive ring color + micState) ---
  IN_CALL_MIC_MUTED: '#microphone-button[data-state="mic-off"]',
  IN_CALL_MIC_LIVE: '#microphone-button[data-state="mic"]',
  PREJOIN_MIC_MUTED: 'button[data-track-action-scenario="preJoinUnmute"]', // action=unmute => currently muted
  PREJOIN_MIC_LIVE: 'button[data-track-action-scenario="preJoinMute"]',    // action=mute => currently live (UNVERIFIED, §11)

  // --- PRESENCE selectors (drive call detection, decoupled from mute value) ---
  IN_CALL_MIC: "#microphone-button",
  PREJOIN_MIC:
    'button[data-track-action-scenario="preJoinMute"], button[data-track-action-scenario="preJoinUnmute"]',
  IN_CALL_URL_RE: /\/meet(up-join)?\//i,

  buildHighlightCss() {
    const ring = (c) => `box-shadow: 0 0 0 2px ${c} !important;`;
    return [
      `${this.IN_CALL_MIC_MUTED} { ${ring(this.MIC_MUTED_COLOR)} }`,
      `${this.IN_CALL_MIC_LIVE} { ${ring(this.MIC_LIVE_COLOR)} }`,
      `${this.PREJOIN_MIC_MUTED} { ${ring(this.MIC_MUTED_COLOR)} }`,
      `${this.PREJOIN_MIC_LIVE} { ${ring(this.MIC_LIVE_COLOR)} }`,
    ].join("\n");
  },

  // Pure mapping (unit-tested)
  micStateFromDataState(state) {
    if (state === "mic-off") return "muted";
    if (state === "mic") return "live";
    return null;
  },

  // "muted" | "live" | null - checks the mute-value selectors in order
  readMicState() {
    if (document.querySelector(this.IN_CALL_MIC_MUTED)) return "muted";
    if (document.querySelector(this.IN_CALL_MIC_LIVE)) return "live";
    if (document.querySelector(this.PREJOIN_MIC_MUTED)) return "muted";
    if (document.querySelector(this.PREJOIN_MIC_LIVE)) return "live";
    return null;
  },

  // "in-call" | "pre-join" | "none" - presence first (decoupled from mute value),
  // then a URL fallback so a call with an unrecognized mic state still reads as in-call
  readCallState() {
    if (document.querySelector(this.IN_CALL_MIC)) return "in-call";
    if (document.querySelector(this.PREJOIN_MIC)) return "pre-join";
    if (this.IN_CALL_URL_RE.test(location.pathname)) return "in-call";
    return "none";
  },
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = TeamsSelectors;
}
```

**Why presence is separate from mute value:** `readCallState()` keys "in-call" off the
*presence* of `#microphone-button` (any `data-state`) - not off the mute-value selectors - 
so a call whose mic is disabled / has no device / is mid-connect still reads as in-call,
with `micState` returning `null`. The `IN_CALL_URL_RE` fallback (HAL's shipped signal)
covers selector churn: if the button can't be found but the URL is a meeting path, we
still report "in-call". `pre-join` is checked before the URL fallback so a lobby screen
on a `/meetup-join/` URL is labeled correctly. Everything fails safe to `"none"` / `null`.

The `module.exports` guard (same UMD trick as `timing.js`) exports `TeamsSelectors` for
Node unit tests; in a content script `module` is undefined so the block is skipped. The
`document`/`location` reads happen only when the methods are called, so requiring the file
under Node is safe (tests exercise the pure `buildHighlightCss` / `micStateFromDataState`).

### 5.2 Highlight lifecycle (`teams-controls.js`)

Defined inside the `teams-controls.js` IIFE (§4.4):

```js
const micHighlight = {
  id: "mic-highlight",
  start() {
    if (document.getElementById(TeamsSelectors.HIGHLIGHT_STYLE_ID)) return; // idempotent
    const style = document.createElement("style");
    style.id = TeamsSelectors.HIGHLIGHT_STYLE_ID;
    style.textContent = TeamsSelectors.buildHighlightCss();
    document.documentElement.appendChild(style); // survives SPA <head> churn
  },
  stop() {
    document.getElementById(TeamsSelectors.HIGHLIGHT_STYLE_ID)?.remove();
  },
};
```

Injected once when enabled; the dormant rules cover buttons that mount later (call
start) or unmount (call end) automatically. Nothing to re-sync.

### 5.3 Setting & live toggle

- Storage key: **`teamsMicHighlightEnabled`** (boolean, default `true`).
- Teams Caffeine stores flat keys in `chrome.storage.local` (not a single JSON blob like
  HAL), so `chrome.storage.onChanged` watches the flat key directly - avoiding HAL's
  nested-blob diffing trap. Guard `areaName === "local"`.

```js
ChromeUtils.storage.get(["teamsMicHighlightEnabled"], (result) => {
  if (result.teamsMicHighlightEnabled !== false) micHighlight.start();
});
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local" || !changes.teamsMicHighlightEnabled) return;
  changes.teamsMicHighlightEnabled.newValue !== false ? micHighlight.start() : micHighlight.stop();
});
```

## 6. Feature 2 - Popup call/mic indicator (read-only)

### 6.1 Messaging

- New request message **`TEAMS_CAFFEINE_GET_CALL_STATUS`** (popup → content script).
- Response payload: `{ callState: "in-call" | "pre-join" | "none", micState: "muted" | "live" | null }`.
- Handled in `teams-controls.js`'s `chrome.runtime.onMessage` listener; responds
  synchronously from `TeamsSelectors.readCallState()` / `TeamsSelectors.readMicState()`.
  The existing `main.js` listener ignores this type (only one listener calls
  `sendResponse`).
- No service-worker involvement.

### 6.2 Popup query logic (`popup.js`)

On `DOMContentLoaded` and then every ~1s while open (interval torn down with the popup):

1. `chrome.tabs.query({ url: TEAMS_URLS }, ...)` (same `TEAMS_URLS` triple used elsewhere).
2. If no Teams tabs → render "Not in call".
3. Otherwise message every Teams tab `TEAMS_CAFFEINE_GET_CALL_STATUS`, collect the
   replies (which may arrive in any order), and pick the strongest state:
   `in-call` > `pre-join` > `none`. (Typical case: one Teams tab.) Tabs without a ready
   content script fail silently via `ChromeUtils.tabs.sendMessage` - treated as no data.

### 6.3 Popup UI

A small status row rendered under the existing caffeine toggle container, with three
call states (mic chip shown whenever a mic state is readable):

```
   ●  Not in call

   ●  In call
        [mic] Live            (mic row sits below the label, smaller)

   ●  Pre-join
        [mic-off] Muted       (teal #0d9488 live / red #dc2626 muted)
```

- `callState === "none"` → grey dot, "Not in call", no mic chip.
- `callState === "pre-join"` → amber dot, "Pre-join", plus the mic chip. Matches the
  on-page ring, which also highlights the pre-join mic button.
- `callState === "in-call"` → green dot, "In call", plus the mic chip.
- **Mic row** (shown below the label for `pre-join` and `in-call`, in a smaller font):
  `micState === "live"` shows a mic icon plus "Live" (teal); `"muted"` shows a muted-mic
  icon plus "Muted" (red); `null` hides the row. Icons are inline SVG, not emoji.

Colors match the on-page ring. The indicator uses the existing popup styling idiom
(inline `<style>` and inline SVG icons) and includes an `aria-live="polite"`
region for the status text. The popup's first page gains **no new toggle**.

## 7. Options page

Add a "Microsoft Teams" `<section>` styled like the existing debug/auto-disable groups,
with one toggle:

- **"Highlight mic button during calls"** - `role="switch"`, `aria-checked` kept in sync,
  default ON.
- `options.js` loads/saves `teamsMicHighlightEnabled` via `ChromeUtils.storage.set`. No
  messaging needed - the content script reacts through `chrome.storage.onChanged` (§5.3).
- Reuse the existing "Settings saved!" confirmation pattern.

## 8. Storage schema (additions)

| Key | Type | Default | Written by | Read by |
|-----|------|---------|-----------|---------|
| `teamsMicHighlightEnabled` | boolean | `true` | options.js | teams-controls.js |

No changes to existing keys.

## 9. Manifest & permissions

- `content_scripts[0].js` extended per §4.2.
- **No new permissions.** `storage` + `tabs` (already granted) cover the content read,
  the storage toggle, and the popup's tab query/message. The features run on the existing
  domain matches (`teams.live.com`, `teams.microsoft.com`, `teams.cloud.microsoft`).
- No `all_frames` - the mic button is in the top document (HAL §5.3). No
  `web_accessible_resources`.

## 10. Error handling / fail-safe behavior

- Each `feature.start()/stop()` in `teams-controls.js` is try/caught; a throwing feature
  is logged (via `ChromeUtils.debugLog` / `console.error`) and skipped, never breaking
  Teams or the caffeine jiggle.
- Unmatched selectors → highlight rings nothing; `readCallState()` returns `"none"`;
  popup shows "Not in call". No errors surfaced to the user.
- Popup messages to tabs without a ready content script fail silently (existing
  `ChromeUtils.tabs.sendMessage` debug-logs and continues).

## 11. Known limitations & gotchas (carried from HAL spec §11)

- **Pre-join "live" value is UNVERIFIED** (`data-track-action-scenario="preJoinMute"`).
  Must be eyeballed live; if wrong it's a one-line fix in `selectors.js`.
- **Fluent focus-ring collision:** Teams' Fluent buttons set their own `box-shadow`
  focus ring, and a single winning `box-shadow` *replaces* rather than merges - a focused
  mic button may momentarily drop our colored ring. Fail-safe (worst case: no ring while
  focused). If it matters after live testing, raise specificity or switch to `outline`.
- **Selector churn / Teams versions:** Microsoft rotates the DOM. `selectors.js` is the
  single place to fix it; the design fails safe (stale selector → no ring, `readCallState`
  falls back to the URL, never breaks).
- **Only `teams.cloud.microsoft` is DOM-verified.** The other two domains get the
  features but will show nothing (ring/mic status) until their selectors are confirmed;
  call detection still has the URL fallback.
- **Stale tabs after install/update:** adding files to `content_scripts` does not
  retro-inject them into already-open Teams tabs - the new controls (and the popup query)
  only take effect after such tabs are reloaded. Until then the popup reads "Not in call"
  and no ring appears on those tabs.
- **Desktop Teams app** is unreachable by any browser extension (web only).

## 12. Testing

**Automated (`node --test`, no new deps):**
- `TeamsSelectors.buildHighlightCss()` contains all four selector strings, both colors,
  and `!important`.
- `TeamsSelectors.micStateFromDataState("mic-off") === "muted"`, `("mic") === "live"`,
  `("x") === null`.
- ESLint (`npm run lint`) covers the new `src/**/*.js` files (globals updated for
  `TeamsSelectors`).

**Manual checklist (on `teams.cloud.microsoft`, logged in, in a freshly reloaded tab - see
the stale-tab caveat in §11):**
1. In a call, muted → red ring on mic button; unmute → ring turns teal (instant).
2. Pre-join screen → ring present; toggle mic → color flips (verifies the flagged value).
3. Focus/hover the mic button → confirm the ring survives (focus-ring collision check).
4. Open popup: on the pre-join screen → "Pre-join" + correct mic chip; in a call → "In
   call" + correct mic chip; mute/unmute → chip updates within ~1s; leave call → "Not in
   call".
5. Toggle "Highlight mic button" off in options → ring disappears live; on → returns.
6. Confirm the caffeine jiggle and auto-disable timer still behave as before.

## 13. Out of scope / future

- **Toolbar-icon badge** for call state while the popup is closed → would need Approach B
  (content MutationObserver → SW state). The `FEATURES` seam + a new message type make
  this additive.
- **Command controls** (e.g., mute from the popup) → add a `{id,start,stop}` feature plus
  a command message dispatched in `teams-controls.js`.
- **Dependency refresh** ("update all libs"): bump `eslint` / `globals` devDeps to latest.
  This is an independent chore done at the very end of implementation, not part of this
  feature's spec.

## 14. File-by-file change list

**New**
- `src/scripts/content/teams/selectors.js`
- `src/scripts/content/teams/teams-controls.js`
- `test/selectors.test.js`

**Modified**
- `src/manifest.json` - extend `content_scripts[0].js` (§4.2). Version bump handled at
  release (feature → minor bump; keep manifest/popup/package.json/changelog in lockstep).
- `src/pages/popup.html` - add the indicator row markup + styles.
- `src/scripts/ui/popup.js` - tab query + status polling + render.
- `src/pages/options.html` - add the "Microsoft Teams" section + toggle.
- `src/scripts/ui/options.js` - load/save `teamsMicHighlightEnabled`.
- `eslint.config.js` - add the one new shared global `TeamsSelectors` (teams-controls.js
  is an IIFE and leaks none).
- `README.md` / `ARCHITECTURE.md` - document the new controls, module layout, and the
  changelog entry at release.

**Chore (separate, end of implementation)**
- `package.json` - bump devDependencies to latest.
