---
type: "query"
date: "2026-11-16T18:28:12.528479+00:00"
question: "Trace queue, history, library and settings persistence: where does each live, how do they flow, and what assumptions are not enforced by types?"
contributor: "graphify"
outcome: "useful"
source_nodes: ["useHistory", "progressOf", "Library", "library.ts", "player.ts", "usePlayer", "scan", "snapshot", "saveSoon", "rememberSource"]
---

# Q: Trace queue, history, library and settings persistence: where does each live, how do they flow, and what assumptions are not enforced by types?

## Answer

Expanded from original query via vocab: [queue, history, resume, progress, library, scan, snapshot, save, folder, store]. Traversed DFS from Library/.snapshot()/.save()/.scan(), store/library.ts, history.ts, progressOf(), saveSnapshot(), QueuePage.tsx.

Three uncoordinated persistence domains, joined only by MediaInfo.id = sha1(path).slice(0,16) (probe.ts L62-63):
(1) QUEUE: renderer-only zustand usePlayer.queue (player.ts L19, L79, set at playItem L187). Never persisted; QueuePage renders it (QueuePage.tsx L22-35). Dies on window close. playItem also overwrites subtitleTracks from the passed MediaInfo (L189), which is why external subtitle tracks vanish on queue advance.
(2) HISTORY: renderer zustand persist to localStorage key 'bettervlc-history' (history.ts L17-49). Entry {position,duration,updatedAt}. Write path: playback.startTick ~110ms (playback.ts L739-744) -> maybeSaveProgress L773 (>=5000ms gate) -> saveProgress(false) L780 (skip if !item/!duration/suppressProgress/time<2) -> onProgress -> player.initialize wiring (player.ts L128-131) -> useHistory.record. record ignores non-finite/<1, DELETES the entry when duration>0 && position>=duration-2 (finished), caps at 400 by updatedAt LRU (history.ts L21-39). Read path: progressOf = min(position/duration,1) (L52-55) in MediaCard L52-53, HomePage L30-40 (filter 1%<p<97%), LibraryPage L220-221. Resume: playItem reads entries[item.id], uses start only if settings.resume && !isStream && history.position>5 && history.position < item.duration*0.95 (player.ts L171-175).
(3) LIBRARY: main-process Library class -> library.json in userDir() = app.getPath('userData') (library.ts L37, L302). Shape {version:1, folders[], items[]}. Atomic tmp+rename write (L83-85), 400ms debounce saveSoon (L71-74), save on dispose (L257-260) and will-quit (index.ts L364-366). Load: filters missing paths (L48), re-links thumb filenames (L49-50), calls rememberSource(item) for every item (L52) - this RESOLVES the playback-trace registry concern: disk-restored library items are live in the main registry after restart, so media:plan works; only ad-hoc files and external subtitle tokens are process-scoped. Scan: walk MAX_FILES 20000 / MAX_DEPTH 12 / SKIP_DIRS (L17-23, L268-288) -> mapLimit concurrency 3 (L153) -> probeMedia -> rememberSource + items.set + emit('item') (L168-175) -> saveSoon at end (L192) -> background thumbnails (L205-223). Change detection: skip re-probe if |existing.mtime - stat.mtimeMs| < 1000 (L159), else re-probe; probeMedia sets addedAt: Date.now() on EVERY probe (probe.ts L300), so addedAt is 'last probed', not 'first added' - a touched file jumps to the top of Home's recent list (HomePage L38). Watcher: fs.watch recursive, filter isMediaFile || .srt (library.ts L229), 2.5s debounce, scan([folder], true) with prune (L232-240). The .srt branch is a leftover from a sidecar-subtitle design - probe no longer discovers .srt and nothing reads them.
(4) SETTINGS: renderer persist key 'bettervlc-settings', version 1, custom merge shallow-spreads saved and deep-merges only subtitle/eq (settings.ts L116-127). No migrate function.

Untyped assumptions: (a) IDs are content-independent path hashes - rename/move orphans resume history and 'Continue watching' entries; history is never rekeyed or cleared on library removeItem/removeFolder (store/library.ts L91-99), so orphans survive until the 400-entry LRU evicts them; (b) three resume thresholds disagree: record deletes at duration-2, playItem resumes only if >5s and <95% of item.duration, HomePage shows at 1%-97% of history.duration - item.duration (probe) and history.duration (player-reported) can differ, so a file can be 'finished' for the list but resumable; (c) record is called from a 5s performance.now() gate but the persist middleware writes localStorage on every set - last 5s before close can be lost; (d) restore trusts library.json shape: version is written but never checked on load, and stale MediaInfo fields survive upgrades because nothing re-probes on version mismatch; (e) item.duration used for resume window vs entry.duration stored - divergence unhandled; (f) history persist has no version/migrate at all; (g) watcher filter claims .srt matters but no sidecar-subtitle reader exists; (h) rememberSource is called on load and after every probe - registry correctness depends on every write path remembering, and library.removeItem does not unregister - forgetSource exists (registry.ts L13) but has zero callers, so removed items remain planned-able and the registry grows monotonically for the process lifetime.

## Outcome

- Signal: useful

## Source Nodes

- useHistory
- progressOf
- Library
- library.ts
- player.ts
- usePlayer
- scan
- snapshot
- saveSoon
- rememberSource
- sourceId
- settings.ts
- QueuePage.tsx