# Teams Controls: Mic-Button Highlight + Call/Mic Indicator — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a color-coded Teams mic-button highlight and a read-only call/mic indicator to the popup, on a small extensible "Teams controls" framework.

**Architecture:** A new `src/scripts/content/teams/` module holds the Teams-DOM knowledge (`selectors.js`, exposed as one global `TeamsSelectors`) and a registry/wiring IIFE (`teams-controls.js`). The highlight is pure attribute-keyed CSS (no observers). The popup asks the content script for `{callState, micState}` on demand and renders it using pure helpers in `call-status.js`. These run independently of the caffeine on/off state.

**Tech Stack:** Chrome Manifest V3, vanilla JS (no runtime dependencies), `chrome.storage.local`, content-script messaging, Node built-in test runner (`node --test`), ESLint 9 flat config.

**Spec:** `docs/superpowers/specs/2026-09-09-teams-controls-mic-highlight-and-indicator-design.md`

## Global Constraints

- **Manifest V3, vanilla JS, zero runtime dependencies** (dev-only devDependencies allowed).
- **Content-script global-scope discipline:** content-script files share one lexical scope; a duplicate top-level `const` is a `SyntaxError` that breaks the whole injection. New content code exposes exactly one global, `TeamsSelectors` (from `selectors.js`); `teams-controls.js` is an IIFE that leaks nothing.
- **No new permissions.** Uses existing `storage` + `tabs`.
- **Colors (verbatim):** muted ring/chip `#dc2626`; live ring/chip `#0d9488`.
- **Storage key (verbatim):** `teamsMicHighlightEnabled`, boolean, default `true` (absent key ⇒ enabled).
- **Message name (verbatim):** `TEAMS_CAFFEINE_GET_CALL_STATUS`; response `{ callState: "in-call"|"pre-join"|"none", micState: "muted"|"live"|null }`.
- **Domains:** run on all three existing matches; fail safe (unmatched selectors ⇒ no ring, `readCallState` falls back to the URL, popup shows "Not in call").
- **Commit messages:** Conventional Commits style, matching the repo (`feat:`, `fix:`, `docs:`, `chore:`). Do NOT add any `Co-authored-by`, "Generated with" line, any `claude.ai` session link, or any mention of AI tooling — this overrides any harness default.
- **Branch:** execute on a feature branch, not `main`.

---

### Task 1: `TeamsSelectors` module (Teams DOM knowledge + pure helpers)

**Files:**
- Create: `src/scripts/content/teams/selectors.js`
- Test: `test/selectors.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: global object `TeamsSelectors` with constants `MIC_MUTED_COLOR`, `MIC_LIVE_COLOR`, `HIGHLIGHT_STYLE_ID`, the selector strings, and methods `buildHighlightCss(): string`, `micStateFromDataState(state: string): "muted"|"live"|null`, `readMicState(): "muted"|"live"|null`, `readCallState(): "in-call"|"pre-join"|"none"`. Node: `module.exports = TeamsSelectors`.

- [ ] **Step 1: Write the failing test**

Create `test/selectors.test.js`:

```js
const { test } = require("node:test");
const assert = require("node:assert/strict");

const TeamsSelectors = require("../src/scripts/content/teams/selectors.js");

test("micStateFromDataState maps Teams data-state values", () => {
  assert.equal(TeamsSelectors.micStateFromDataState("mic-off"), "muted");
  assert.equal(TeamsSelectors.micStateFromDataState("mic"), "live");
  assert.equal(TeamsSelectors.micStateFromDataState("disabled"), null);
  assert.equal(TeamsSelectors.micStateFromDataState(undefined), null);
});

test("buildHighlightCss covers all four selectors, both colors, and !important", () => {
  const css = TeamsSelectors.buildHighlightCss();
  assert.match(css, /#microphone-button\[data-state="mic-off"\]/);
  assert.match(css, /#microphone-button\[data-state="mic"\]/);
  assert.match(css, /data-track-action-scenario="preJoinUnmute"/);
  assert.match(css, /data-track-action-scenario="preJoinMute"/);
  assert.ok(css.includes("#dc2626"));
  assert.ok(css.includes("#0d9488"));
  assert.equal((css.match(/!important/g) || []).length, 4);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/selectors.test.js`
Expected: FAIL — `Cannot find module '../src/scripts/content/teams/selectors.js'`.

- [ ] **Step 3: Write minimal implementation**

Create `src/scripts/content/teams/selectors.js`:

```js
// Single source of Microsoft Teams DOM knowledge for the Teams controls.
// Exposed as one global (TeamsSelectors) so the content-script global scope stays
// clean. UMD-guarded so the pure helpers can be unit-tested under Node; the
// document/location reads happen only when the methods run, so requiring this file
// in Node is safe.
const TeamsSelectors = {
  MIC_MUTED_COLOR: "#dc2626", // matches HAL error.solid
  MIC_LIVE_COLOR: "#0d9488", // matches HAL success.solid

  HIGHLIGHT_STYLE_ID: "teams-caffeine-mic-highlight",

  // Mute-VALUE selectors (drive ring color + micState)
  IN_CALL_MIC_MUTED: '#microphone-button[data-state="mic-off"]',
  IN_CALL_MIC_LIVE: '#microphone-button[data-state="mic"]',
  PREJOIN_MIC_MUTED: 'button[data-track-action-scenario="preJoinUnmute"]', // action=unmute => currently muted
  PREJOIN_MIC_LIVE: 'button[data-track-action-scenario="preJoinMute"]', // action=mute => currently live (UNVERIFIED)

  // PRESENCE selectors (drive call detection, decoupled from mute value)
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

  micStateFromDataState(state) {
    if (state === "mic-off") return "muted";
    if (state === "mic") return "live";
    return null;
  },

  readMicState() {
    if (document.querySelector(this.IN_CALL_MIC_MUTED)) return "muted";
    if (document.querySelector(this.IN_CALL_MIC_LIVE)) return "live";
    if (document.querySelector(this.PREJOIN_MIC_MUTED)) return "muted";
    if (document.querySelector(this.PREJOIN_MIC_LIVE)) return "live";
    return null;
  },

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

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/selectors.test.js`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/scripts/content/teams/selectors.js test/selectors.test.js
git commit -m "feat: add TeamsSelectors module for Teams mic controls"
```

---

### Task 2: Teams controls registry, mic-highlight feature, and manifest wiring

**Files:**
- Create: `src/scripts/content/teams/teams-controls.js`
- Modify: `src/manifest.json` (extend `content_scripts[0].js`)
- Modify: `eslint.config.js` (add `TeamsSelectors` global)

**Interfaces:**
- Consumes: `TeamsSelectors` (Task 1); global `ChromeUtils` (existing `src/scripts/utils/chrome-utils.js`).
- Produces: a content-script `chrome.runtime.onMessage` handler that answers `{ type: "TEAMS_CAFFEINE_GET_CALL_STATUS" }` with `{ callState, micState }`; reads/reacts to the `teamsMicHighlightEnabled` storage key; the `FEATURES` extensibility array.

- [ ] **Step 1: Create the controls file**

Create `src/scripts/content/teams/teams-controls.js`:

```js
// Registry + wiring for Microsoft Teams controls. Runs as an IIFE so it leaks no
// globals (content-script files share one lexical scope). Depends on TeamsSelectors
// (selectors.js, injected first) and ChromeUtils (chrome-utils.js). Independent of
// the caffeine on/off state.
(function () {
  const HIGHLIGHT_SETTING = "teamsMicHighlightEnabled";

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

  // The extensibility seam: add future { id, start, stop } controls here.
  const FEATURES = [micHighlight];

  function setFeatureEnabled(feature, enabled) {
    try {
      if (enabled) {
        feature.start();
      } else {
        feature.stop();
      }
    } catch (error) {
      console.error(`Teams Caffeine: Teams control "${feature.id}" failed:`, error);
    }
  }

  // Initial state from storage (default ON when the key is absent).
  ChromeUtils.storage.get([HIGHLIGHT_SETTING], (result, error) => {
    if (error) return;
    setFeatureEnabled(micHighlight, result[HIGHLIGHT_SETTING] !== false);
  });

  // Live toggle driven by the options page.
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local" || !changes[HIGHLIGHT_SETTING]) return;
    setFeatureEnabled(micHighlight, changes[HIGHLIGHT_SETTING].newValue !== false);
  });

  // Answer the popup's on-demand status query (synchronous response).
  chrome.runtime?.onMessage.addListener((message, sender, sendResponse) => {
    if (message && message.type === "TEAMS_CAFFEINE_GET_CALL_STATUS") {
      sendResponse({
        callState: TeamsSelectors.readCallState(),
        micState: TeamsSelectors.readMicState(),
      });
    }
  });
})();
```

- [ ] **Step 2: Wire the new files into the manifest**

In `src/manifest.json`, replace the content-script `js` array:

```json
      "js": ["scripts/utils/chrome-utils.js", "scripts/utils/timing.js", "scripts/content/teams/selectors.js", "scripts/content/teams/teams-controls.js", "scripts/content/main.js"]
```

- [ ] **Step 3: Add the `TeamsSelectors` global to ESLint**

In `eslint.config.js`, inside the `files: ["src/**/*.js"]` block's `globals`, add after `getRandomInterval: "readonly",`:

```js
        TeamsSelectors: "readonly",
```

- [ ] **Step 4: Verify syntax, lint, and existing tests**

Run:
```bash
node --check src/scripts/content/teams/teams-controls.js
node -e "JSON.parse(require('fs').readFileSync('src/manifest.json','utf8')); console.log('manifest OK')"
npm run lint
npm test
```
Expected: `node --check` prints nothing (exit 0); manifest OK; lint exit 0; tests all pass.

- [ ] **Step 5: Commit**

```bash
git add src/scripts/content/teams/teams-controls.js src/manifest.json eslint.config.js
git commit -m "feat: add Teams mic-button highlight with settings toggle"
```

---

### Task 3: Popup call/mic status helpers (pure)

**Files:**
- Create: `src/scripts/utils/call-status.js`
- Test: `test/call-status.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: globals `pickStrongestStatus(replies: {callState,micState}[]): {callState, micState}` and `describeCallStatus(status: {callState,micState}): { label: string, tone: "in-call"|"pre-join"|"none", chip: {glyph,label,color}|null }`. Node: `module.exports = { pickStrongestStatus, describeCallStatus }`.

- [ ] **Step 1: Write the failing test**

Create `test/call-status.test.js`:

```js
const { test } = require("node:test");
const assert = require("node:assert/strict");

const { pickStrongestStatus, describeCallStatus } = require("../src/scripts/utils/call-status.js");

test("pickStrongestStatus prefers in-call > pre-join > none and keeps its micState", () => {
  assert.deepEqual(
    pickStrongestStatus([
      { callState: "none", micState: null },
      { callState: "pre-join", micState: "muted" },
      { callState: "in-call", micState: "live" },
    ]),
    { callState: "in-call", micState: "live" },
  );
  assert.deepEqual(pickStrongestStatus([]), { callState: "none", micState: null });
  assert.deepEqual(
    pickStrongestStatus([
      { callState: "pre-join", micState: "muted" },
      { callState: "none", micState: null },
    ]),
    { callState: "pre-join", micState: "muted" },
  );
});

test("describeCallStatus maps state + mic to a UI descriptor", () => {
  const none = describeCallStatus({ callState: "none", micState: null });
  assert.equal(none.label, "Not in call");
  assert.equal(none.tone, "none");
  assert.equal(none.chip, null);

  const live = describeCallStatus({ callState: "in-call", micState: "live" });
  assert.equal(live.label, "In call");
  assert.deepEqual(live.chip, { glyph: "🎤", label: "Live", color: "#0d9488" });

  const prejoinMuted = describeCallStatus({ callState: "pre-join", micState: "muted" });
  assert.equal(prejoinMuted.label, "Pre-join");
  assert.deepEqual(prejoinMuted.chip, { glyph: "🔇", label: "Muted", color: "#dc2626" });

  assert.equal(describeCallStatus({ callState: "in-call", micState: null }).chip, null);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/call-status.test.js`
Expected: FAIL — `Cannot find module '../src/scripts/utils/call-status.js'`.

- [ ] **Step 3: Write minimal implementation**

Create `src/scripts/utils/call-status.js`:

```js
// Pure helpers for the popup call/mic indicator. UMD-guarded for Node unit tests;
// in the popup this loads as a plain script and exposes the two functions as globals.
const CALL_STATE_RANK = { "in-call": 3, "pre-join": 2, none: 1 };

function pickStrongestStatus(replies) {
  let best = { callState: "none", micState: null };
  for (const reply of replies) {
    if (!reply || !reply.callState) continue;
    const rank = CALL_STATE_RANK[reply.callState] || 0;
    if (rank > (CALL_STATE_RANK[best.callState] || 0)) {
      best = { callState: reply.callState, micState: reply.micState || null };
    }
  }
  return best;
}

function describeCallStatus(status) {
  const callState = status && status.callState ? status.callState : "none";
  const micState = status ? status.micState : null;

  const LABELS = { "in-call": "In call", "pre-join": "Pre-join", none: "Not in call" };

  let chip = null;
  if (callState !== "none") {
    if (micState === "muted") chip = { glyph: "🔇", label: "Muted", color: "#dc2626" };
    else if (micState === "live") chip = { glyph: "🎤", label: "Live", color: "#0d9488" };
  }

  return { label: LABELS[callState] || LABELS.none, tone: callState, chip };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { pickStrongestStatus, describeCallStatus };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/call-status.test.js`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/scripts/utils/call-status.js test/call-status.test.js
git commit -m "feat: add pure call/mic status helpers for the popup"
```

---

### Task 4: Popup indicator UI + on-demand query

**Files:**
- Modify: `src/pages/popup.html` (indicator markup + styles + call-status.js script tag)
- Modify: `src/scripts/ui/popup.js` (query, poll, render — inside the existing `DOMContentLoaded` handler)
- Modify: `eslint.config.js` (add `pickStrongestStatus`, `describeCallStatus` globals)

**Interfaces:**
- Consumes: `pickStrongestStatus`, `describeCallStatus` (Task 3); `ChromeUtils` (existing); the `TEAMS_CAFFEINE_GET_CALL_STATUS` message handler (Task 2).
- Produces: nothing consumed downstream (leaf UI).

- [ ] **Step 1: Add the indicator markup and styles to `popup.html`**

In `src/pages/popup.html`, add these style rules just before the closing `</style>` (after the `.visually-hidden` block):

```css
    .call-status {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      margin-top: 12px;
      font-size: 13px;
      color: #555;
    }
    .call-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: #bbb;
      flex: none;
    }
    .call-status.tone-in-call .call-dot { background: #0d9488; }
    .call-status.tone-pre-join .call-dot { background: #f59e0b; }
    .call-status.tone-none .call-dot { background: #bbb; }
    .mic-chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-weight: 600;
    }
```

Then add the indicator markup immediately after the `</div>` that closes `#toggle-box` and before the `#warning-message` div:

```html
    <div id="call-status" class="call-status tone-none" role="status" aria-live="polite" aria-atomic="true">
      <span class="call-dot" id="call-dot" aria-hidden="true"></span>
      <span class="call-label" id="call-label">Not in call</span>
      <span class="mic-chip" id="mic-chip" hidden></span>
    </div>
```

Finally, add the call-status script tag before the popup.js script tag, so the two lines read:

```html
  <script src="../scripts/utils/chrome-utils.js"></script>
  <script src="../scripts/utils/call-status.js"></script>
  <script src="../scripts/ui/popup.js"></script>
```

- [ ] **Step 2: Add query/poll/render logic to `popup.js`**

In `src/scripts/ui/popup.js`, inside the `DOMContentLoaded` callback, add near the top (after the existing `const` element lookups):

```js
  const TEAMS_URLS = [
    "https://teams.live.com/*",
    "https://teams.microsoft.com/*",
    "https://teams.cloud.microsoft/*",
  ];
  const callStatusEl = document.getElementById("call-status");
  const callLabelEl = document.getElementById("call-label");
  const micChipEl = document.getElementById("mic-chip");

  function renderCallStatus(status) {
    const view = describeCallStatus(status);
    callStatusEl.classList.remove("tone-in-call", "tone-pre-join", "tone-none");
    callStatusEl.classList.add(`tone-${view.tone}`);
    callLabelEl.textContent = view.label;
    if (view.chip) {
      micChipEl.textContent = `${view.chip.glyph} ${view.chip.label}`;
      micChipEl.style.color = view.chip.color;
      micChipEl.hidden = false;
    } else {
      micChipEl.hidden = true;
    }
  }

  function refreshCallStatus() {
    if (!(typeof chrome !== "undefined" && chrome.tabs)) {
      renderCallStatus({ callState: "none", micState: null });
      return;
    }
    chrome.tabs.query({ url: TEAMS_URLS }, (tabs) => {
      if (chrome.runtime.lastError || !tabs || !tabs.length) {
        renderCallStatus({ callState: "none", micState: null });
        return;
      }
      const replies = [];
      let pending = tabs.length;
      const done = () => {
        pending -= 1;
        if (pending === 0) renderCallStatus(pickStrongestStatus(replies));
      };
      for (const tab of tabs) {
        ChromeUtils.tabs.sendMessage(tab.id, { type: "TEAMS_CAFFEINE_GET_CALL_STATUS" }, (response) => {
          if (response) replies.push(response);
          done();
        });
      }
    });
  }
```

Then, at the end of the `DOMContentLoaded` callback (after the settings-icon handler), start it:

```js
  refreshCallStatus();
  setInterval(refreshCallStatus, 1000);
```

- [ ] **Step 3: Add the call-status globals to ESLint**

In `eslint.config.js`, inside the `files: ["src/**/*.js"]` block's `globals`, add after the `TeamsSelectors: "readonly",` line from Task 2:

```js
        pickStrongestStatus: "readonly",
        describeCallStatus: "readonly",
```

- [ ] **Step 4: Verify syntax, lint, and tests**

Run:
```bash
node --check src/scripts/ui/popup.js
npm run lint
npm test
```
Expected: `node --check` exit 0; lint exit 0; all tests pass.

- [ ] **Step 5: Manual smoke (load unpacked)**

Load `src/` unpacked in Chrome, open the popup on a non-Teams page → indicator shows a grey dot + "Not in call" and does not error (check the popup's DevTools console). Full Teams verification is in Task 8's checklist.

- [ ] **Step 6: Commit**

```bash
git add src/pages/popup.html src/scripts/ui/popup.js eslint.config.js
git commit -m "feat: show in-call and mic status in the popup"
```

---

### Task 5: Options-page toggle for the mic highlight

**Files:**
- Modify: `src/pages/options.html` (new "Microsoft Teams" section)
- Modify: `src/scripts/ui/options.js` (load/save `teamsMicHighlightEnabled`)

**Interfaces:**
- Consumes: existing `ChromeUtils` + the `saveDebugMode`/`showSaveStatus` idiom.
- Produces: writes the `teamsMicHighlightEnabled` storage key that Task 2 reacts to.

- [ ] **Step 1: Add the section to `options.html`**

In `src/pages/options.html`, add this `<section>` immediately after the auto-disable `</section>` and before the `debug-group` section:

```html
    <section class="setting-group" aria-labelledby="teams-controls-label">
      <h2 class="setting-label" id="teams-controls-label">Microsoft Teams</h2>
      <p class="setting-description" id="mic-highlight-description">
        Highlight the Teams microphone button with a colored ring — red when muted,
        teal when live — during calls and on the pre-join screen.
      </p>

      <div class="toggle-container">
        <label class="switch" for="mic-highlight-toggle">
          <span class="visually-hidden">Enable mic button highlight</span>
          <input type="checkbox" id="mic-highlight-toggle" role="switch" aria-checked="true" aria-describedby="mic-highlight-description">
          <span class="slider" aria-hidden="true"></span>
        </label>
        <span aria-hidden="true">Highlight mic button during calls</span>
      </div>
    </section>
```

- [ ] **Step 2: Load and save the setting in `options.js`**

In `src/scripts/ui/options.js`:

(a) After the existing element lookups at the top of the `DOMContentLoaded` callback, add:

```js
  const micHighlightToggle = document.getElementById("mic-highlight-toggle");
```

(b) In the initial `ChromeUtils.storage.get([...])` call, add `"teamsMicHighlightEnabled"` to the keys array. In its callback's `else` branch add:

```js
      micHighlightToggle.checked = result.teamsMicHighlightEnabled !== false;
```

and in its `if (error)` branch add:

```js
      micHighlightToggle.checked = true;
```

(c) After the `updateTimeSelector(); updateTimerStatus();` calls in that same callback, add:

```js
    micHighlightToggle.setAttribute("aria-checked", micHighlightToggle.checked ? "true" : "false");
```

(d) Add a change handler alongside the other listeners (e.g., after the `debugModeToggle` change listener):

```js
  micHighlightToggle.addEventListener("change", () => {
    const isEnabled = micHighlightToggle.checked;
    micHighlightToggle.setAttribute("aria-checked", isEnabled ? "true" : "false");
    ChromeUtils.storage.set({ teamsMicHighlightEnabled: isEnabled }, (error) => {
      if (error) {
        console.error("Teams Caffeine: Failed to save mic highlight setting");
        return;
      }
      showSaveStatus();
    });
  });
```

- [ ] **Step 3: Verify syntax, lint, and tests**

Run:
```bash
node --check src/scripts/ui/options.js
npm run lint
npm test
```
Expected: all exit 0 / pass.

- [ ] **Step 4: Manual smoke**

Reload the unpacked extension, open Options → the "Microsoft Teams" toggle shows ON by default; toggling it writes `teamsMicHighlightEnabled` (verify in the options page DevTools: `chrome.storage.local.get('teamsMicHighlightEnabled', console.log)`).

- [ ] **Step 5: Commit**

```bash
git add src/pages/options.html src/scripts/ui/options.js
git commit -m "feat: add options toggle for the Teams mic highlight"
```

---

### Task 6: Documentation update (ARCHITECTURE + README)

**Files:**
- Modify: `ARCHITECTURE.md`
- Modify: `README.md`

**Interfaces:**
- Consumes: the shipped behavior from Tasks 1–5.
- Produces: nothing (docs).

- [ ] **Step 1: Update `ARCHITECTURE.md`**

Make these edits so the doc matches the shipped code:

1. In the **Project Structure** tree, under `scripts/utils/` add `call-status.js  # Pure call/mic status helpers (unit-tested)`, and under `scripts/content/` add a `teams/` subtree:
   ```
   │   │   ├── teams/              # Teams controls (extensible)
   │   │   │   ├── selectors.js    # Single source of Teams DOM knowledge (TeamsSelectors)
   │   │   │   └── teams-controls.js # Registry + mic-highlight feature + status query (IIFE)
   ```
   Under `test/` add `call-status.test.js` and `selectors.test.js`.
2. In **Utility Scripts**, add bullets for `call-status.js` and the `teams/` module (single-`TeamsSelectors`-global rule + IIFE, per the spec).
3. In **Content Script**, note that `main.js` (caffeine) and the `teams/` controls run side-by-side and independently; describe the mic-highlight (pure attribute-keyed CSS) and the `TEAMS_CAFFEINE_GET_CALL_STATUS` on-demand query.
4. In **Communication Flow**, add: popup → content `TEAMS_CAFFEINE_GET_CALL_STATUS` → `{callState, micState}` → popup indicator; options `teamsMicHighlightEnabled` → `chrome.storage.onChanged` → highlight on/off.
5. In **JavaScript Functions Reference**, add a `selectors.js` / `teams-controls.js` / `call-status.js` subsection listing `buildHighlightCss`, `micStateFromDataState`, `readMicState`, `readCallState`, `pickStrongestStatus`, `describeCallStatus`, and the `micHighlight` feature.
6. In the manifest bullet, update the content-scripts list to the five-file order.

- [ ] **Step 2: Update `README.md`**

1. In **Features**, add:
   ```markdown
   - Highlights the Teams mic button by mute state during calls (red = muted, teal = live)
   - Shows in-call / pre-join status and mic state in the popup
   ```
2. In **Usage**, add a line that the mic-button highlight can be turned off in the extension's Options page.

- [ ] **Step 3: Verify docs reference reality**

Run: `rg -n "call-status|teams-controls|TeamsSelectors|TEAMS_CAFFEINE_GET_CALL_STATUS|teamsMicHighlightEnabled" ARCHITECTURE.md README.md`
Expected: matches present; skim for any stale statements.

- [ ] **Step 4: Commit**

```bash
git add ARCHITECTURE.md README.md
git commit -m "docs: document Teams mic highlight and call/mic indicator"
```

---

### Task 7: Dependency refresh (dev tooling to latest)

**Files:**
- Modify: `package.json` (bump devDependencies)
- Modify: `package-lock.json` (regenerated by npm)

**Interfaces:**
- Consumes: nothing.
- Produces: nothing.

- [ ] **Step 1: Bump dev dependencies to latest**

Run:
```bash
npm install --save-dev eslint@latest globals@latest
```

- [ ] **Step 2: Verify lint and tests still pass on the new versions**

Run:
```bash
npm run lint
npm test
```
Expected: lint exit 0; all tests pass. If ESLint's new major flags anything, fix it minimally (it should not — the flat-config API is stable across 9.x). If a genuine incompatibility appears, stop and report rather than pinning blindly.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: update dev dependencies to latest"
```

---

### Task 8: Version bump to 1.7.0, changelog, and final verification

**Files:**
- Modify: `src/manifest.json` (`version`)
- Modify: `src/pages/popup.html` (footer `<span>`)
- Modify: `package.json` (`version`)
- Modify: `README.md` (changelog entry)

**Interfaces:**
- Consumes: everything above.
- Produces: the release.

- [ ] **Step 1: Bump the three version strings to 1.7.0**

- `src/manifest.json`: `"version": "1.7.0",`
- `package.json`: `"version": "1.7.0",`
- `src/pages/popup.html`: `<span>v1.7.0</span>`

- [ ] **Step 2: Add the changelog entry to `README.md`**

Add above the `### v1.6.0` entry:

```markdown
### v1.7.0

- **Mic-Button Highlight**: The Teams microphone button is ringed by mute state during calls and on the pre-join screen (red = muted, teal = live). Toggle it in the Options page.
- **Call / Mic Indicator**: The popup now shows In call / Pre-join / Not in call and, when a mic is present, its mute status.
- **Extensible Teams Controls**: Internal framework so more Teams controls can be added.
- **Maintenance**: Dev dependencies updated to latest.
```

- [ ] **Step 3: Verify version consistency and full green**

Run:
```bash
rg -n "1\.7\.0" src/manifest.json src/pages/popup.html package.json README.md
node -e "console.log(require('./src/manifest.json').version, require('./package.json').version)"
npm run lint
npm test
node --test
```
Expected: all four files show 1.7.0; both versions print `1.7.0 1.7.0`; lint exit 0; all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/manifest.json src/pages/popup.html package.json README.md
git commit -m "chore: release v1.7.0"
```

---

## Self-Review (completed by plan author)

- **Spec coverage:** §4 framework → Tasks 1–2 (`TeamsSelectors` + IIFE registry). §5 highlight → Tasks 1–2. §6 indicator/messaging → Tasks 2 (handler), 3 (pure helpers), 4 (UI). §7 options toggle → Task 5. §8 storage key → Tasks 2/5. §9 manifest/permissions → Task 2. §11/§12 gotchas + tests → unit tests in Tasks 1/3, manual checklist in Task 8 mirrors spec §12. §13 lib refresh → Task 7; version bump → Task 8. Docs (spec §14) → Task 6. No gaps.
- **Placeholder scan:** none — every code/test/step is concrete.
- **Type consistency:** `TeamsSelectors` methods and `HIGHLIGHT_STYLE_ID` used in Task 2 match Task 1; `pickStrongestStatus`/`describeCallStatus` shapes used in Task 4 match Task 3; message name and `{callState, micState}` payload match across Tasks 2/4; `teamsMicHighlightEnabled` matches across Tasks 2/5.

## Manual verification checklist (run once, after Task 5 or 8)

On `teams.cloud.microsoft`, logged in, in a **freshly reloaded** Teams tab (see spec §11 stale-tab caveat):
1. In a call, muted → red ring on mic button; unmute → teal (instant).
2. Pre-join screen → ring present; toggle mic → color flips (verifies the flagged `preJoinMute` value; fix in `selectors.js` if wrong).
3. Focus/hover the mic button → ring survives (Fluent focus-ring collision check).
4. Popup: pre-join → "Pre-join" + chip; in call → "In call" + chip; mute/unmute → chip updates within ~1s; leave → "Not in call".
5. Options → toggle highlight off → ring disappears live; on → returns.
6. Caffeine jiggle + auto-disable timer still behave as before.
