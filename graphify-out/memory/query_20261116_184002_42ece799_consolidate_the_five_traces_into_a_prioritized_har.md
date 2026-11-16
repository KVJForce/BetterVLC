---
type: "query"
date: "2026-11-16T18:40:02.075750+00:00"
question: "Consolidate the five traces into a prioritized hardening plan: what should be fixed first, and what should be left alone?"
contributor: "graphify"
outcome: "useful"
source_nodes: ["PlaybackController", "Library", "bootstrap", "useHistory", "subtitleUrl", "streamServer.ts", "probe.ts", "player.ts"]
---

# Q: Consolidate the five traces into a prioritized hardening plan: what should be fixed first, and what should be left alone?

## Answer

Synthesis of T1-T5 into HARDENING_PLAN.md at repo root (22 items, P0-P3). Method: graph for traversal, source for evidence; every finding cites a file:line.

P0 (2.5h): H01 call forgetSource in Library.removeItem/removeFolder and clear useHistory in renderer removal (registry.ts L13 currently zero callers; library.ts L105-127; store/library.ts L91-99); H02 saveProgress(true) before mutating item/duration in playback.stop L615 and at open L126 (current order makes the async pause save a no-op); H03 preload fallback to ipcRenderer.sendSync('app:baseUrlSync') when --bettervlc-port is absent (main index.ts L141 handler currently dead); H04 loadSubtitle returns boolean and setSubtitle resets subtitleIndex on null/failure (player.ts L323, playback.ts L541); H05 set data-theme/accent/motion in main.tsx before createRoot (App.tsx L44 effect runs post-paint); H06 consume loaded in Home/Library pages (store/library.ts writes it, nobody reads it); H07 delete mergeExternalSubtitle/findEmbeddedSubtitlePath (probe.ts L323/L339), thumbUrlFor (streamServer.ts L391), .srt watcher clause (library.ts L229).

P1 (1.5d): H08 src/shared/protocol.ts for stream query grammar + routes + bitmap codec set + MIME/ext/codec tables (currently 2 stream copies, 3 bitmap copies, 2 MIME maps, 3 extension lists); H09 single shouldCopyVideo predicate incl HDR (probe L256 vs server L201); H10 shared resume/finish policy (delete at duration-2, resume >5s/<95%, show 1-97%); H11 NEW finding: watcher prune (library.ts L183-190) emits no removal event, so the renderer keeps deleted cards until manual refresh - add library:remove or snapshot push; H12 preserve addedAt across re-probe (probe.ts L300); H13 read library.json version and add settings/history migrate.

P2 (3d): H14 stable id - library UUID persisted in library.json, path hash only for ad-hoc; migrate sha1->uuid; H15 renderer-ready handshake buffering app:open-paths + subscribe to library pushes before library:get; H16 bootstrap .catch -> dialog + quit; H17 queue lifetime product decision (document ephemeral or persist ids/index paused, strip external subs); H18 scan cancellation/disposed flag.

P3: H19 sandbox:true (CJS preload), H20 CSP prod tightening, H21 cueAt backward scan, H22 subtitle cache mtimeMs+size.

Not fixing: loopback HTTP data plane, 400-entry localStorage history, MediaInfo centrality, InfoDrawer type bypass, graph artifacts (self-loops/ref nodes/CSS import edge).

## Outcome

- Signal: useful

## Source Nodes

- PlaybackController
- Library
- bootstrap
- useHistory
- subtitleUrl
- streamServer.ts
- probe.ts
- player.ts