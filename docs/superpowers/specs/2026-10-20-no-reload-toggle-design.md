# No-Reload Toggle: Never Drop a Teams Meeting - Design

**Date:** 2026-10-20
**Status:** Draft (brainstorm; open questions in §10; nothing implemented)
**Author:** Guilherme Guerzoni

## 1. Overview

When the auto-disable timer expires during a meeting, the user is dropped from the call
and has to join again. Turning the extension on or off by hand during a meeting does the
same.

**Root cause: the extension reloads the Teams tabs itself.** Every state change goes through
`reloadTeamsTabsAndToggle()` (`src/scripts/background/background.js`), which calls
`chrome.tabs.reload` on **every** Teams tab, with no check for an ongoing call:

- timer expiry: `handleAutoDisable()` -> `reloadTeamsTabsAndToggle(false)`
- manual toggle (on and off): `TEAMS_CAFFEINE_TOGGLE` -> `reloadTeamsTabsAndToggle(enabled)`

The reload was introduced in v1.3.0 (`1ebf51b`), replacing the message-only toggle of
v1.2.0, because starting and stopping by message could not be **guaranteed**: the script
might not be running in the tab (it is injected only on page load), and stopping might
leave activity running. A reload was the reliable way to get a clean state.

This change removes every automatic reload and replaces it with a toggle that is
**verifiably** reliable without one.

## 2. Goals & non-goals

**Goals**
- The extension never reloads a Teams tab on its own: not on timer expiry, not on a manual
  toggle.
- **Guaranteed stop:** once the extension is off, no synthetic activity reaches the page,
  nothing is left running, and Teams falls back to its normal idle behavior (Away after
  its idle timeout).
- **Guaranteed start:** turning the extension on works in an already-open tab, including a
  tab whose content script was orphaned by an extension update, without a reload.
- Respect the status priority in §3.

**Non-goals**
- Guarding against a refresh the user does (F5, closing the tab). Deferred (§11).
- Postponing the timer until a meeting ends. The timer keeps its meaning: it switches the
  extension off at the set time.
- Setting the Teams presence programmatically (it would break §3).

## 3. Status priority (confirmed with the user)

From highest to lowest:

1. **Manual status** set by the user in Teams (Busy, Do not disturb, Appear away, ...).
2. **Meeting status** (In a call / In a meeting).
3. **Online via Teams Caffeine** (Available, kept by synthetic activity).
4. **Teams Caffeine off:** Teams' regular behavior (Away after idle).

Consequences for the design:
- The extension only synthesizes input; it never writes presence. Teams itself already
  ranks a manual status and a meeting above activity, so levels 1 and 2 win by
  construction. This must hold for every new code path.
- Turning the extension off must return the user to level 4, not freeze them at level 3.
- Open: the away-status corrective burst in `checkTeamsStatus()` fires when the presence
  label contains "away", which may also match a **manual** "Appear away" (§10, Q1).

## 4. Decisions (confirmed with the user)

| # | Decision |
|---|----------|
| D1 | Timer expiry during a meeting: switch off immediately, **without** reload, provided the stop is guaranteed (§6). |
| D2 | Turning on: never reload either, provided the start is guaranteed (§6). |
| D3 | No guard against user-initiated refresh for now. |
| D4 | The plan lives in the repo as this spec, on a `docs/` branch with a PR. |

## 5. Design

### 5.1 One code path for every state change

Replace `reloadTeamsTabsAndToggle()` with `applyState(enabled)`, used by the manual toggle,
the timer, and startup:

1. Write `teamsCaffeineEnabled` to storage (the single source of truth).
2. Start or stop the heartbeat alarm.
3. Send `TEAMS_CAFFEINE_STATE` to every Teams tab and **verify the acknowledgement**
   (§5.4).
4. Recover tabs that do not acknowledge (§5.5).

`chrome.tabs.reload` disappears from the background script entirely.

### 5.2 Two delivery channels (convergence)

Today the content script learns the state from storage once at load, then only from
messages. A message lost while the service worker restarts leaves the tab in the wrong
state, one of the original reasons for the reload.

The content script will also subscribe to `chrome.storage.onChanged` for
`teamsCaffeineEnabled`, the same pattern `teams-controls.js` already uses for the mic
highlight. The message is the fast path; the storage event guarantees convergence.

### 5.3 Activity controller with owned timers (guaranteed stop)

Today `stopJiggle()` clears the main loop and the status interval, but not:
- the 2 s / 4 s corrective burst timeouts in `checkTeamsStatus()`;
- the 50 ms `keyup` and 100 ms scroll-back timeouts.

They can fire after a stop. Move all activity into a small controller:

- Every timeout and interval is registered with the controller; `stop()` clears all of
  them.
- Each start increments a `generation`; every scheduled callback captures it and does
  nothing if the generation changed. This covers any timer that slips through.
- Paired actions are completed, not cancelled: `stop()` immediately dispatches any
  pending `keyup` and scroll-back, so no modifier key is left "pressed" from Teams' point
  of view.
- `TEAMS_CAFFEINE_HEARTBEAT` is ignored unless the controller is running (already the
  case).
- `stop()` returns a snapshot `{ running: false, pendingTimers: 0, generation }` used in
  the acknowledgement.

### 5.4 Acknowledgement protocol

`TEAMS_CAFFEINE_STATE` gets a reply:
`{ ok: true, running, generation, version }`, where `version` is the extension version the
content script was loaded from.

The background checks each tab:
- `running` matches the requested state and `version` matches the current extension:
  done.
- No reply, or a different `version` (orphaned script from before an update): recover the
  tab (§5.5).
- Reply with the wrong `running`: resend once, then recover.

### 5.5 Recovery without reload

Content scripts declared in the manifest only run on page load, so a tab opened before an
install or update has no live script. Recover it by **programmatic injection**:

- `chrome.scripting.executeScript({ target: { tabId }, files: [...] })` with the same
  files and order as the manifest. This needs the `scripting` permission. The Teams host
  permissions are already granted, so this should add no new install warning (verify,
  §10 Q3).
- **Idempotency:** the content scripts declare top-level `const`s (`TeamsSelectors`,
  `MIN_INTERVAL`, ...), and executing them twice in the same world throws "Identifier has
  already been declared". Inject a tiny guard first that reports whether a live instance
  of the current version exists; inject the rest only if not.
- The old orphaned instance already stops itself on the next tick (it checks
  `chrome.runtime.id`), so two instances never both run.
- **Last resort, never automatic:** if injection fails, the popup shows "Reload the Teams
  tab to apply" with a button. The button is disabled (with an explanation) while the tab
  is in a call: `readCallState()` when the script answers, otherwise `tab.audible` and the
  `/meet` URL pattern as hints.

### 5.6 Timer expiry

`handleAutoDisable()` becomes `applyState(false)` plus clearing `autoDisableStartTime`.
The meeting is untouched: activity stops, and Teams keeps showing the meeting status
(priority level 2). When the call ends, Teams' own idle detection takes the user to Away.

## 6. Guarantees and how they are proven

| # | Guarantee | Proof |
|---|-----------|-------|
| G1 | The extension never reloads a Teams tab automatically | `chrome.tabs.reload` is removed from automatic paths; a unit test fails if it appears in `background.js` outside the user-initiated handler |
| G2 | After a stop, no synthetic event reaches the page | Unit tests with fake timers (every scheduled callback is a no-op after `stop()`); e2e on a stub page counting `mousemove` / `keydown` / `scroll` for 2x `MAX_INTERVAL` after stop, heartbeat included |
| G3 | Turning on works in an open tab without a reload | e2e: open tab with the extension off, toggle on, events start; extension reloaded (orphaned tab), toggle on, injection recovers it; injecting twice is a no-op |
| G4 | The user returns to Away after a stop | Manual, against real Teams: after a stop, presence goes Away within Teams' idle window. Record the measured time. A reload never made the user Away instantly either: loading Teams marks the user Available |
| G5 | The status priority holds | Manual matrix (§8) |

G4 depends on Teams, not on our code. The part we control is G2: once nothing is
synthesized, the user is a normal idle user.

**e2e setup:** Playwright with the unpacked extension in Chromium (persistent context),
`page.route()` serving a stub HTML page at `https://teams.microsoft.com/...` so the
manifest matches without hitting Teams.

## 7. Spike first

Before the full implementation, a short spike to validate the risky parts of §5.5:

1. `scripting.executeScript` into an orphaned tab after an extension reload: does it run
   in a fresh isolated world, or in the old one (which affects the `const` guard)?
2. Does adding `scripting` trigger a permission prompt or disable the extension on
   update?
3. Teams' idle-to-Away time in the browser after activity stops.

If (1) or (2) fails, the fallback is: recover only through the manual popup button,
never automatically.

## 8. Manual test matrix

| Scenario | Expected |
|----------|----------|
| Timer expires in a meeting | Stays in the meeting; activity stops; meeting status kept; Away after the call ends and the idle window passes |
| Manual off in a meeting | Same as above |
| Manual on in a meeting | Stays in the meeting; activity starts |
| Manual status "Busy" / "DND", extension on | Status unchanged |
| Manual "Appear away", extension on | Status unchanged; no corrective burst (Q1) |
| Extension off, idle | Away after the idle window |
| Background tab, toggle on/off | Applies (heartbeat path) |
| Two Teams tabs, one in a meeting | Both apply; neither reloads |
| Extension updated with Teams open, toggle | Tab recovered by injection, no reload |

## 9. Changes by file (expected)

- `src/scripts/background/background.js`: `applyState()`, acknowledgement checks, injection
  recovery; remove `reloadTeamsTabsAndToggle()`.
- `src/scripts/content/main.js`: activity controller, `storage.onChanged`, acknowledgement
  reply, injection guard.
- `src/scripts/ui/popup.js` / `src/pages/popup.html`: "reload to apply" fallback.
- `src/manifest.json`: add `scripting`.
- `test/`: controller unit tests, reload guard test; e2e harness (new dev dependency:
  Playwright).
- `README.md`, `ARCHITECTURE.md`: document the new toggle flow. Release as **v1.8.0**
  (behavior change and new permission).

## 10. Open questions

- **Q1.** Does the corrective burst fight a manual "Appear away"? We need the presence
  badge `aria-label` for automatic Away versus manual "Appear away". If they cannot be told
  apart, drop the burst or limit it to when the extension has just been switched on.
- **Q2.** Should activity pause during a meeting? It is not needed (the meeting status
  wins) but harmless. Default: keep it running.
- **Q3.** Spike results (§7).
- **Q4.** Is an e2e dev dependency (Playwright) acceptable, or only unit tests plus the
  manual matrix?

## 11. Out of scope / future

- A `beforeunload` guard against user-initiated refresh during a meeting.
- Postponing the timer until the meeting ends.
