# Teams Version Check + "Keep the Extension Updated" Footer - Design

**Date:** 2026-10-20
**Status:** Draft (brainstorm; open questions in §8; nothing implemented)
**Author:** Guilherme Guerzoni

## 1. Overview

Microsoft updates Teams constantly, and an update can silently break a feature that reads
the Teams page. v1.7.4 is an example: a Teams update renamed the mic button's live state,
and the mic highlight stopped working without any error.

Two additions:

1. **Teams version check:** detect the Teams version the user is running and, when it
   differs from the version the extension was last validated against, tell the user.
2. **Footer note:** a small, permanent note in the popup footer saying that Teams updates
   often and that, if a feature stops working, the user should keep the extension updated,
   with a link to the extension on the Chrome Web Store.

## 2. Goals & non-goals

**Goals**
- Read the user's Teams version from the page, without new permissions if possible.
- Compare it with the version the extension release was validated against, and show the
  difference in the popup.
- Add the footer note with the Chrome Web Store link.

**Non-goals**
- Fixing selectors automatically or fetching selectors remotely.
- Blocking any feature on a version mismatch. The notice is informational.

## 3. The footer note

Popup footer, below the toggle area, next to the version (`v1.7.4`), in small muted text:

> Teams updates often. If something stops working, keep the extension up to date:
> [Chrome Web Store](https://chromewebstore.google.com/detail/ngijfjcimmlajolmohfpjegneedaflpm)

- One or two lines at the popup width; the existing footer layout (version on the left,
  settings gear on the right) stays.
- The link opens in a new tab (`target="_blank"`, `rel="noopener"`).
- The text is static and always visible. It is the one piece of this spec with no unknowns
  and can ship on its own.

## 4. Teams version detection

### 4.1 Where the version comes from (spike)

The Teams web client does not expose its version in an obvious, documented place. A
spike must find a source that is stable and readable from the content script. Candidates,
in order of preference:

1. A global or bootstrap config object on `window` holding the client build. Content
   scripts run in an isolated world and cannot read page globals directly; reading one
   needs a `world: "MAIN"` script or a DOM handoff.
2. A `<meta>` tag, a `data-*` attribute, or a script URL in the DOM that carries the build
   number.
3. The version shown in Teams under **Settings > About**. Reliable, but only rendered when
   that view is open.
4. The `x-ms-client-version` request header Teams sends. Needs the `webRequest`
   permission, which is heavy for this feature.

The spike records which source works on `teams.microsoft.com`, `teams.cloud.microsoft`
and `teams.live.com`, and its format.

### 4.2 Comparison

- **Validated version:** a constant shipped with each release, e.g.
  `TEAMS_VALIDATED_VERSION` in `selectors.js` (next to the selectors it validates), updated
  whenever a release is tested against real Teams.
- **Running version:** read by the content script and reported with the existing call
  status (`TEAMS_CAFFEINE_GET_CALL_STATUS` reply), so no new message type is needed.
- The comparison is pure and unit-tested (`compareTeamsVersions(running, validated)` ->
  `"same" | "newer" | "older" | "unknown"`).

### 4.3 What the user sees

Teams ships updates weekly or more, so a notice on every version difference would be shown
almost all the time and stop meaning anything. Proposal:

- **Version differs, everything works:** a discreet line in the footer area, e.g. "Teams
  updated since this version was tested". No warning color.
- **Version differs and a feature check fails** (the mic button is visible but its state
  is not recognized, or the presence badge cannot be found): a warning in the existing
  `warning-message` style, "Teams changed and some features may not work. Check for an
  extension update.", with the store link.
- **Version unknown** (source not found): show nothing beyond the footer note.

The feature checks reuse what exists: `readCallState()` / `readMicState()` and
`findPresenceBadge()`.

### 4.4 Extension update check (optional)

`chrome.runtime.requestUpdateCheck()` tells whether a newer version of the extension is
available on the store. The popup could show "Update available" instead of only asking the
user to keep it updated. Chrome throttles the call, so cache the result. No new permission.

## 5. Changes by file (expected)

- `src/pages/popup.html` / `src/scripts/ui/popup.js`: footer note; version notice and
  warning.
- `src/scripts/content/teams/selectors.js`: `TEAMS_VALIDATED_VERSION`, version reader.
- `src/scripts/content/teams/teams-controls.js`: include the Teams version in the status
  reply.
- `src/scripts/utils/`: pure `compareTeamsVersions()` with unit tests.
- `README.md`, `ARCHITECTURE.md`: document both.

## 6. Testing

- Unit: `compareTeamsVersions()`, and the mapping from (version result, feature checks) to
  what the popup shows.
- Manual: footer layout and link; version read on each Teams domain; a simulated mismatch
  (temporarily change `TEAMS_VALIDATED_VERSION`) shows the notice; a simulated broken
  selector shows the warning.

## 7. Rollout

1. Footer note alone (small, no unknowns).
2. Spike for the version source (§4.1).
3. Version check and notices.

## 8. Open questions

- **Q1.** Which version does "local" mean: the version the extension release was validated
  against (proposed), or the last Teams version this user's browser saw (detects "Teams
  updated since your last visit", but not whether the extension still works with it)?
- **Q2.** Notice on every version difference, or only when a feature check also fails
  (proposed, to avoid a permanent notice)?
- **Q3.** Include the extension update check (§4.4)?
- **Q4.** Footer wording; the README also targets Edge and Firefox, but the link is to the
  Chrome Web Store only. Fine for now?
