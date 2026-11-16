# BetterVLC — hardening plan

**Date:** 2026-11-16  
**Scope:** the five seams traced against `graphify-out/graph.json` (495 nodes, 1,284 edges): the `MediaInfo` contract, playback, subtitles, persistence, and startup.  
**Method:** the graph was used to choose traversal order and find seams; every item below was then re-read in source. Nothing here is inferred from the graph alone.  
**Priority:** `P0` = user-visible data loss or whole-app failure, cheap to fix. `P1` = duplicated contracts that drift silently. `P2` = lifecycle/identity changes that need design decisions. `P3` = optional hardening.

## Summary

| ID | Pri | Area | Issue | Effort |
|---|---|---|---|---|
| H01 | P0 | Data hygiene | Removing library items leaves history entries and registry sources behind | 20 min |
| H02 | P0 | Data loss | Stop / track switch discards up to 5 s of progress | 15 min |
| H03 | P0 | Startup | Stream port crosses as an untyped argv string; `app:baseUrl` fallback is dead | 30 min |
| H04 | P0 | Subtitles | Failed selection stays "on" with no rollback | 30 min |
| H05 | P0 | Startup | Theme applied after first paint; light users get a dark flash | 20 min |
| H06 | P0 | Startup | `loaded` is never read; cold start flashes the empty state | 20 min |
| H07 | P0 | Hygiene | Four dead exports/vestiges, including a watcher clause for a removed feature | 15 min |
| H08 | P1 | Contracts | Stream grammar, routes, MIME/codec tables duplicated across main/renderer | 3–4 h |
| H09 | P1 | Playback | Copy-vs-transcode decided twice, by different predicates | 1–2 h |
| H10 | P1 | Persistence | Three different resume/finish thresholds | 2–3 h |
| H11 | P1 | Library | Watcher prunes never reach the renderer; deleted files linger in the UI | 1 h |
| H12 | P1 | Library | Re-probe resets `addedAt`, reshuffling "Recent" | 15 min |
| H13 | P1 | Persistence | `library.json` version ignored; settings has no migration | 2–3 h |
| H14 | P2 | Identity | IDs are path hashes; renames orphan history | 1–2 d |
| H15 | P2 | Startup | `app:open-paths` is a one-shot push with no ready handshake | 3–4 h |
| H16 | P2 | Startup | `bootstrap` failures are invisible: no window, no dialog | 1 h |
| H17 | P2 | Persistence | Queue is memory-only; product decision needed | 3–4 h |
| H18 | P2 | Library | Scan has no cancellation on quit; writes can race teardown | 2 h |
| H19 | P3 | Security | `sandbox: false` keeps full Node behind the preload | 3–6 h |
| H20 | P3 | Security | CSP still allows `script-src 'unsafe-inline'` and broad loopback WS | 2–4 h |
| H21 | P3 | Subtitles | `cueAt` misses long cues behind >4 later cues | 2 h |
| H22 | P3 | Subtitles | Embedded subtitle cache key is mtime-rounded | 30 min |

**Suggested sequencing:** four PRs — `fix/data-hygiene` (H01–H07), `refactor/shared-protocol` (H08–H13), `feat/startup-identity` (H14–H18), then optional security/polish (H19–H22).

**Status (2026-11-16):** H01–H18 and H21–H22 are implemented; H20 is implemented for production builds; H19 is deferred. `npm run typecheck` and `npm run build` pass. H14 ships the `fileKey` design (see below), H17 is documented as session-only, and the scan prune now refuses to touch folders that were missing when the scan started.

---

## P0 — fix now (≈2.5 h total) — ✅ implemented

### H01 — Removal doesn't remove

**Problem:** `Library.removeItem` and `removeFolder` delete from `items` and thumbnails, but never call `forgetSource`; the renderer's removal paths never clear `useHistory`. Resume entries and plan-able registry sources survive deletion.

**Evidence:** `src/main/library.ts:105–127` (removal loops, no registry call); `src/main/registry.ts:13` (`forgetSource` exists, zero callers); `src/renderer/src/store/library.ts:91–99` (snapshots only).

**Fix:**
- In `src/main/library.ts`, import `forgetSource` and call it for every deleted id in both removal paths.
- In `src/renderer/src/store/library.ts`, call `useHistory.getState().clear(id)` in `removeItem`; in `removeFolder`, diff `get().items` before the call against the returned snapshot and clear the difference.

**Acceptance:** remove an item → relaunch → no Continue-watching entry, and `media:plan` for the stale id fails cleanly. Folder removal clears every child entry.

---

### H02 — Flush progress before clearing playback state

**Problem:** `playback.stop()` nulls `item` and `duration` *before* `video.pause()`. The pause event is async, so `handlePause → saveProgress(true)` sees `item === null` and returns. `open()` likewise replaces `item` before flushing the previous one. Media-key Stop and track switches lose up to the 5 s window.

**Evidence:** `src/renderer/src/lib/playback.ts:615–630` (order), `:684–687` (pause handler), `:780–786` (guards), `:126–139` (open replaces item), `:773–778` (5 s gate).

**Fix:** call `this.saveProgress(true)` as the first line of `stop()` and at the top of `open()` (before `suppressProgress`, before `this.item = item`). `saveProgress` already no-ops when there is no item or duration.

**Acceptance:** play 10 s → media-key Stop → relaunch → resume is within 1 s of the stop point. Same for Next/Previous/Play-at.

---

### H03 — Make the port handoff fail-safe

**Problem:** the dynamic stream port reaches the renderer **only** as `--bettervlc-port=` on `additionalArguments`, parsed in preload. If the argument is missing or renamed, `api.baseUrl` becomes `''` and every thumb/subtitle/media URL silently goes relative. An `app:baseUrl` IPC handler exists but has zero callers.

**Evidence:** `src/main/index.ts:83` (argument), `:141` (dead handler); `src/preload/index.ts:5–6, 15` (parse, no fallback).

**Fix:** add `ipcMain.on('app:baseUrlSync', (event) => { event.returnValue = baseUrl })` next to the handler, and in preload use `port ? … : (ipcRenderer.sendSync('app:baseUrlSync') as string)`. One synchronous call at preload time; no runtime cost.

**Acceptance:** temporarily remove the `additionalArguments` entry → thumbnails, subtitles and native/MSE playback still work.

---

### H04 — Roll back failed subtitle selection

**Problem:** `setSubtitle` sets `subtitleIndex` before resolving the URL; `subtitleUrl` returns `null` for an unknown track and `loadSubtitle(null)` clears cues silently. The panel shows the track selected with nothing on screen, and the only feedback is a toast on fetch failure (not on `null`).

**Evidence:** `src/renderer/src/store/player.ts:323–330` (optimistic set), `src/main/index.ts:319` (null), `src/renderer/src/lib/playback.ts:541–555` (null clears, returns void).

**Fix:** make `loadSubtitle` return `Promise<boolean>`; in `setSubtitle`, if the URL is `null` for an index ≥ 0 or the load returns false, reset `{ subtitleIndex: -1, cue: null }` and keep the existing toast. Explicit Off (`index < 0`) remains a success path.

**Acceptance:** select an unavailable/bitmap track → panel returns to Off, toast explains, no phantom "on" state.

---

### H05 — Apply the theme before first paint

**Problem:** `data-theme` is set in a React effect after mount; the color tokens only exist under `[data-theme=…]`. The window's `backgroundColor` masks this for dark users, but light-theme users see a dark flash every launch.

**Evidence:** `src/renderer/src/App.tsx:44–56` (effect); `src/renderer/src/styles/base.css:23, 52` (theme-scoped tokens); `src/main/index.ts:71` (window background).

**Fix:** in `src/renderer/src/main.tsx`, before `createRoot`, set `data-theme`, `data-accent` and `data-motion` from `useSettings.getState()`. Settings hydrate synchronously from localStorage, so the values are available. Keep the App effect for later changes.

**Acceptance:** set light theme → fully quit → relaunch → no dark frame.

---

### H06 — Actually use `loaded`

**Problem:** the library store models `loaded`, but no component reads it. HomePage renders "Drop in a file…" until the `library:get` snapshot arrives, so a cold start with a large library flashes the empty state.

**Evidence:** `src/renderer/src/store/library.ts:8, 24, 33, 35` (writes only); `src/renderer/src/pages/HomePage.tsx:54–56` (empty copy); grep shows no other consumer.

**Fix:** read `loaded` in HomePage (and LibraryPage's count/empty blocks) and render a skeleton or suppress the empty copy until it is true.

**Acceptance:** with an artificially delayed `library:get`, no "Drop in a file" copy appears before items.

---

### H07 — Delete the dead weight

**Problem:** exports with zero callers and a watcher branch for a feature that no longer exists.

**Evidence:**
- `mergeExternalSubtitle` — `src/main/probe.ts:323`
- `findEmbeddedSubtitlePath` — `src/main/probe.ts:339`
- `thumbUrlFor` — `src/main/streamServer.ts:391`
- `.srt` watcher clause — `src/main/library.ts:229` (nothing probes sidecar subtitles; a `.srt` write triggers a pointless folder rescan)

**Fix:** delete all four, then `npm run typecheck`. Keep `forgetSource` (now used by H01) and `app:baseUrl` (now used by H03).

**Acceptance:** grep for the names returns no hits; typecheck passes.

---

## P1 — one shared contract layer (≈1.5 days)

### H08 — `src/shared/protocol.ts`

**Implemented:** `src/shared/protocol.ts` now owns the stream option grammar (`encodeStreamOptions` / `decodeStreamOptions`), route builders and server matchers, the bitmap-subtitle set, native codec/extension sets, and the extension-to-MIME map. `main/index.ts`, `streamServer.ts`, `probe.ts`, `player.ts`, `App.tsx`, `MediaCard.tsx` and `InfoDrawer` consume it. The server uses `RoutePatterns` rather than string prefixes.

**Problem (original):** the same wire vocabulary is written independently on both sides:

| Contract | Copies |
|---|---|
| Stream query `t/a/mh/di/hw/tc` + clamping | `src/main/index.ts:293–301`, `src/main/streamServer.ts:162–169` |
| Routes `/media`, `/thumb`, `/stream`, `/subtitle`, `/subtitle-ext` | `src/main/streamServer.ts:75–110`, `src/main/index.ts:287,309,320–321`, `src/renderer/src/store/player.ts:326`, `src/renderer/src/components/MediaCard.tsx:11` |
| Bitmap subtitle codecs | `src/renderer/src/App.tsx:288`, `src/renderer/src/store/player.ts:468`, `src/main/streamServer.ts:296` |
| Extension → MIME | `src/main/index.ts:345–353` (`nativeMime`), `src/main/streamServer.ts:11–27` (`MIME`) |
| Native extension/codec allowlists | `src/main/probe.ts:238–251` + the two tables above |

**Fix:** add a pure shared module (no Node imports) exporting:
- `StreamOptions` + `encodeStreamOptions()` / `decodeStreamOptions()` with the existing clamps (`mh` 240–2160, `t >= 0`).
- `Routes.media / thumb / stream / subtitle / externalSubtitle`.
- `BITMAP_SUBTITLE_CODECS`, `NATIVE_VIDEO_CODECS`, `NATIVE_AUDIO_CODECS`, `NATIVE_EXTENSIONS`, `MIME_BY_EXT`.

Consume it in `main/index.ts`, `streamServer.ts`, `probe.ts`, `player.ts`, `App.tsx`, `MediaCard.tsx`. Note `main/index.ts:320` already handles external tokens, but only when the track is on the main-process `MediaInfo` — which never happens, since external tracks live only in the renderer copy. The shared route builder makes both branches explicit.

**Acceptance:** grepping for `'mh'`, `'subtitle-ext'`, `hdmv_pgs_subtitle`, or a MIME map outside `shared/protocol.ts` returns nothing; typecheck passes.

---

### H09 — One copy-vs-transcode predicate

**Implemented:** `src/main/playbackPolicy.ts` exports `shouldCopyVideo(info, { deinterlace, forceTranscode })`; probe calls it when it predicts `videoCopy`, and the stream server calls it when it builds FFmpeg arguments. The InfoDrawer now says "Stream copy when settings allow" instead of presenting the prediction as unconditional.

**Problem (original):** probe predicts `videoCopy` (`probe.ts:256`); the server re-decides with `!deinterlace && !info.hdr && !forceTranscode` (`streamServer.ts:201`). The prediction can disagree with the actual ffmpeg path, and the InfoDrawer presents the prediction as fact.

**Fix:** extract `shouldCopyVideo(info, { deinterlace, forceTranscode })`, including the HDR check, into a main-side helper used by both. Probe predicts with default options; the InfoDrawer should say "copy when settings allow" rather than a flat yes/no.

**Acceptance:** for a sample set (H.264 8-bit, HDR H.264, HEVC, multi-audio), the probe prediction matches the server decision under default settings.

---

### H10 — One resume policy

**Implemented:** `src/shared/resume.ts` defines the thresholds, `isFinished`, `shouldKeepProgress`, `resumePoint` and `isContinueWatching`. History writes, `playItem` and HomePage's Continue-watching row all use it; `entry.duration || item.duration` is the single total.

**Problem (original):** three thresholds disagree — delete at `duration - 2`, resume only if `>5 s` and `<95% of item.duration`, show Continue-watching at `1%–97% of entry.duration`. `item.duration` (ffprobe) and `entry.duration` (video element) can differ.

**Evidence:** `src/renderer/src/store/history.ts:26–27`; `src/renderer/src/store/player.ts:171–175`; `src/renderer/src/pages/HomePage.tsx:30–35`.

**Fix:** add `src/shared/resume.ts` (or `lib/resume.ts`) with constants and `resumePoint(entry, item, enabled)`, `isFinished(position, duration)`, `isContinueWatching(entry)`. Use `entry.duration || item.duration` as the single total. Consume in both `playItem` and HomePage.

**Acceptance:** boundary tests for 4.9/5.1 s, 94.9/95.1%, `duration-2`, and a zero/missing `entry.duration`. One behavior, one test table.

---

### H11 — Tell the renderer when the watcher prunes

**Implemented:** `Library.scan` emits `remove` for every pruned id (`forgetSource` included); main forwards `library:remove`; the preload exposes `on.libraryRemove`; the library store removes the card and forgets history unless another item still shares the file identity. The store also subscribes before `library:get` resolves and buffers pushes, which closes the same gap for additions.

**Problem (original):** a watcher-triggered `scan([folder], true)` deletes missing items from `Library.items` but emits no removal event. The renderer keeps the stale card until a manual refresh; clicking it produces "Media is no longer available".

**Evidence:** `src/main/library.ts:183–190` (prune, silent), `:228–240` (watcher scan); renderer subscribes only to `libraryItem`/`libraryProgress` (`src/renderer/src/store/library.ts:37–46`); no `remove` channel exists.

**Fix:** add a `library:remove` event (id) and an `api.on.libraryRemove` subscription; emit it for every pruned id. Alternative: emit a full `library:snapshot` after any pruning scan and replace `items` in one set. The snapshot option is simpler and also fixes ordering.

**Acceptance:** delete a file outside the app while it is open → the card disappears within the 2.5 s debounce + scan time.

---

### H12 — Preserve `addedAt` across re-probes

**Implemented:** `Library.scan` keeps the existing item's `addedAt` on a re-probe, and falls back to the item with the same `fileKey` when the path itself changed (rename).

**Problem (original):** `probeMedia` sets `addedAt: Date.now()` on every call; any mtime change triggers a re-probe, so touching a file promotes it to the top of "Recent".

**Evidence:** `src/main/probe.ts:300`; `src/main/library.ts:156–175` (re-probe on mtime drift).

**Fix:** in `Library.scan`, after `probeMedia`, assign `info.addedAt = existing?.addedAt ?? info.addedAt`.

**Acceptance:** touch an old file → rescan → Recent order unchanged; a genuinely new file still appears first.

---

### H13 — Read the versions you write

**Implemented:** `Library.load` runs a `LIBRARY_VERSION` switch (v0 is the same shape without the field), refuses to overwrite a file written by a newer build, and backfills `fileKey`. Settings persist gained a `migrate` hook that normalizes `subtitle`/`eq` (including band length) and history gained `version: 1` plus a migration that drops malformed entries.

**Problem (original):** `library.json` writes `version: 1` but `load()` never checks it. Settings writes `version: 1` but has no `migrate`, only a shallow `merge` with nested `subtitle`/`eq`.

**Evidence:** `src/main/library.ts:44–53, 78–82`; `src/renderer/src/store/settings.ts:116–127`.

**Fix:** add a `switch (raw.version)` in `Library.load` (v1 = current; future = migrate) and a `migrate` function to the settings persist config. For history, add `version: 1` and a migration hook while it is still keyed by the path hash (before H14 changes the key).

**Acceptance:** a v0/shape-mismatched payload loads without throwing; missing fields fall back to defaults; a dummy v2 migration runs exactly once.

---

## P2 — lifecycle and identity (≈3 days)

### H14 — Stable media identity

**Implemented:** `MediaInfo.fileKey` is `${dev}:${ino}` from `fs.statSync(path, { bigint: true })` (`probe.ts`), and history keys are `file:<fileKey>` with the path hash as fallback (`shared`-level helpers in `store/history.ts`). Legacy id-keyed entries are rekeyed against the library snapshot on load; entries written after this change also carry `fileKey`, so a rename keeps the resume point even though the library mints a new path-hash `id` and thumbnail. Existing `library.json` items are backfilled with `fileKeyFor()` on load. Explicit removal forgets both the file key and the id, unless another item still shares the same file identity (hard link or a rename that has not pruned yet).

**Trade-off:** library cards, React keys and thumbnails remain path-derived. Renaming a file preserves watch history but refreshes the card identity; removing and re-adding a file starts its history over. Filesystems that report `ino === 0` fall back to the path hash.

**History:** originally proposed a library UUID; the `fileKey` path avoids a schema migration and also covers files opened outside the library.

---

### H15 — Ready handshake for startup pushes

**Implemented:** main buffers `app:open-paths` until `app:rendererReady` (sent from the same App effect that registers the listener) and flushes once; `did-start-loading` clears the ready flag for reloads. The library store subscribes to `libraryItem`/`libraryRemove` before awaiting `library:get`, buffers both, and merges after the snapshot.

**Problem (original):** `did-finish-load` sends `app:open-paths` exactly once; the renderer subscribes inside an App effect after mount. `load` usually fires later because fonts/CSS delay it, but nothing guarantees it. `second-instance` drops paths when `mainWindow` is null. The renderer also subscribes to library deltas only after `library:get` resolves, so pushes in that gap are lost.

**Evidence:** `src/main/index.ts:26–32, 105–110`; `src/renderer/src/App.tsx:62–84`; `src/renderer/src/store/library.ts:32–46`.

**Fix:**
- Main: buffer open paths until a renderer sends `app:renderer-ready`, then flush; keep buffering for `second-instance`.
- Renderer: send the ready signal from the same effect that registers `on.openPaths`.
- Library: register `on.libraryItem`/`on.libraryProgress` **before** awaiting `library:get`; buffer pushed items and merge by id after the snapshot.

**Acceptance:** launch cold with a media path argument → it plays. Start a second instance with a path during a slow first paint → it plays. No paths are lost.

---

### H16 — Make bootstrap failures visible

**Implemented:** `app.whenReady().then(bootstrap).catch(...)` shows a blocking error dialog and quits instead of leaving a process with no window.

**Problem (original):** `app.whenReady().then(bootstrap)` has no rejection path. If `StreamServer.start()` rejects (listen error) or window creation throws, the process stays alive with no window and no dialog. `show: false` until `ready-to-show` makes a non-painting renderer equally invisible.

**Evidence:** `src/main/index.ts:35, 42–48`; `streamServer.ts:41–57` (rejects on `error`).

**Fix:** append `.catch((error) => { dialog.showErrorBox('BetterVLC could not start', String(error)); app.quit() })`.

**Acceptance:** force a bind failure → error dialog, clean exit, no zombie process.

---

### H17 — Decide the queue's lifetime

**Problem:** the queue is renderer-only state (`player.ts:19, 79, 187`) and vanishes on restart. Whether that is correct is a product decision, not an accident to leave undocumented.

**Resolution — documented ephemeral:** the queue stays renderer-only. It can contain ad-hoc files and external subtitle tokens that do not survive a restart, so restoring it would either autoplay something unexpected or show rows that fail on click. The README and the `queue` field comment now state this; the unused `rememberQueue` setting was removed rather than left as a promise the app does not keep.

---

### H18 — Scan lifecycle

**Implemented:** `Library` now has a `disposed` flag checked before probing, before thumbnail work, inside `saveSoon`, and before queueing the next scan; `dispose()` clears the save timer and queued scan. The prune step additionally ignores any folder that disappeared before or during the scan, so an unplugged drive cannot empty its section of the library.

**Problem (original):** `scan()` has no cancellation and `dispose()` only clears watchers and saves. A scan in flight during quit can keep probing and call `saveSoon()` after teardown. `queuedScan` is also not cleared.

**Evidence:** `src/main/library.ts:133–203, 257–260`.

**Fix:** add a `disposed` flag checked between probed files and before `saveSoon()`; clear `queuedScan` and the save timer in `dispose()`.

**Acceptance:** quit during a large scan → no writes after `will-quit`, no unhandled rejection.

---

## P3 — optional hardening

### H19 — Try `sandbox: true` — deferred

`sandbox: false` (`main/index.ts:78`) keeps full Node behind the preload; any renderer compromise inherits `window.api`. The preload API surface (`contextBridge`, `ipcRenderer`, `webUtils`, `process.argv`) is sandbox-compatible, but the preload is built as ESM (`out/preload/index.mjs`); sandboxed preloads must be CommonJS. Switching the preload output format and the `BrowserWindow` path is a build-system change that needs a packaged-app smoke test, so it is deliberately left out of this pass rather than half-applied. This remains the highest-value security change in the repo.

### H20 — Tighten the CSP — implemented for production

The dev server needs inline scripts and an HMR WebSocket, so the source meta tag keeps `script-src 'self' 'unsafe-inline'` and the two `ws://` entries. A build-only Vite transform (`electron.vite.config.ts`) rewrites the generated tag to `script-src 'self'` and drops the WebSocket sources; the production renderer loads its bundle from disk and its media bytes from loopback HTTP. Verified by reading `out/renderer/index.html` after `npm run build`. The exact dynamic port is still wildcarded in the meta tag; replacing it with a response-header CSP would also cover loopback bytes and is left for a runtime pass.

### H21 — `cueAt` lookback

**Implemented:** `cueAt` walks back while a prefix-maximum end time can still reach the current time; the old four-cue cap is gone. The prefix maxima are cached per cue array in a `WeakMap`, so normal playback still returns on the first candidate.

**Problem (original):** `subtitles.ts:94–98` scans back only 4 cues. A long cue followed by more than four later cues is missed.

### H22 — Subtitle cache key

**Implemented:** embedded extraction keys on the raw `mtimeMs` plus `size` (the same key `probeMedia` uses), so a same-second edit invalidates the cached VTT.

**Problem (original):** Embedded extraction keys on rounded `mtime` (`streamServer.ts:302`).

---

## Explicitly not fixing

- **Loopback HTTP for media bytes.** Moving bytes over IPC would break range requests, MSE streaming, and backpressure. The current split — plan over IPC, bytes over HTTP — is correct.
- **400-entry history cap and localStorage.** Appropriate for a desktop player; IndexedDB is not worth the migration.
- **`MediaInfo` as the central vocabulary.** It is a data contract, not a god object; 28 import edges and zero calls is the right shape.
- **The `InfoDrawer` bypass.** It reads `item.nativePlayable` etc. via a `usePlayer` selector without importing `MediaInfo`. That is a graph blind spot, not a code defect.
- **Graph artifacts:** 3 self-loops, 22 `ref_node_*` externals, and the dangling `main.tsx → global.css` CSS import edge are export artifacts, not runtime issues.

## Verification matrix

| Scenario | Expected |
|---|---|
| Cold start, dark and light theme | No theme flash; window paints immediately |
| Launch with a file argument | File probes and plays |
| Second instance with a file during startup | Existing window focuses and plays it |
| Remove a library item | Card and resume entry gone; stale plan fails cleanly |
| Play 10 s → media-key Stop → relaunch | Resume within 1 s of the stop point |
| Play 10 s → Next | Previous item's position saved |
| Delete a file outside the app while open | Card disappears after the watcher debounce |
| Touch an old file → rescan | "Recent" order unchanged |
| Select a bitmap/unavailable subtitle | Selection rolls back to Off with a toast |
| Missing port argument | Thumbnails and playback still work |
| Force `server.start()` failure | Error dialog, clean exit |
| Quit during a large scan | No writes after `will-quit` |
| Push to `main` | Actions publishes a `1.0.<run>` release with installer, blockmap and `latest.yml` |
| Installed app, newer release | Downloads silently, then offers Restart now / Later |
| Installed app, offline | Launch unaffected; request failure is logged |
| Portable build | No update check |

**Gate:** `npm run typecheck` currently covers typed breakage across all three projects. There is no test runner; adding Vitest for the pure modules (`protocol`, `resume`, `parseVtt`, `cueAt`) before H10/H14 would pay for itself. Keep tests out of the P0 PRs.

## Update delivery

The installed 1.0.0 build could not receive any of the fixes above, so
auto-update was added after the hardening pass rather than as another H item.

- **CI:** `.github/workflows/release.yml` runs on every push to `main`
  (`windows-latest`, Node 22). It runs `npm run typecheck`, then
  `npm run dist -- --publish always -c.extraMetadata.version=1.0.$GITHUB_RUN_NUMBER`.
  electron-builder publishes the NSIS installer, portable exe, blockmap and
  `latest.yml` to GitHub Releases using `GITHUB_TOKEN` (`contents: write`).
- **Versioning:** `extraMetadata.version` overrides the version in the packaged
  `package.json` and in `latest.yml`, so artifact names and the release tag use
  the workflow run number without editing `package.json`. Run numbers only
  increase, so each push is newer than the last.
- **Client:** `src/main/updater.ts` runs only when `app.isPackaged` and skips
  portable builds (electron-builder sets `PORTABLE_EXECUTABLE_DIR`). It checks
  on launch and every six hours, downloads automatically, and prompts once per
  version with Restart now / Later. Later is covered by
  `autoInstallOnAppQuit`. Offline checks log and leave playback alone.
- **Packaging:** `electron-updater` is a production dependency and ships inside
  `app.asar`. The font packages are bundled by Vite and moved to development
  dependencies so they are not duplicated into the asar.
- **Caveats:** the previously installed 1.0.0 has no `app-update.yml` and must
  be replaced manually with the first CI release. Releases are unsigned, so
  SmartScreen may warn. Portable builds deliberately do not self-update.

## Provenance

| Trace | Memory file |
|---|---|
| T1 — MediaInfo centrality | `graphify-out/memory/query_20261116_171221_6bd0af07_why_does_mediainfo_sit_at_the_center_of_the_whole.md` |
| T2 — playback path | `graphify-out/memory/query_20261116_171904_ededfce8_trace_the_full_playback_path_from_probemedia_to_pl.md` |
| T3 — subtitle path | `graphify-out/memory/query_20261116_182223_f49a45d2_trace_the_subtitle_path_from_embedded_track_extrac.md` |
| T4 — persistence | `graphify-out/memory/query_20261116_182812_f4585fda_trace_queue__history__library_and_settings_persist.md` |
| T5 — startup | `graphify-out/memory/query_20261116_183232_6badf7dd_trace_application_startup_from_process_launch_to_f.md` |

Graph artifacts: `graphify-out/graph.json`, `graphify-out/GRAPH_REPORT.md`, `graphify-out/wiki/`.
