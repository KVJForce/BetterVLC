---
type: "query"
date: "2026-11-16T18:22:23.223633+00:00"
question: "Trace the subtitle path from embedded track extraction to on-screen cue rendering: where do main and renderer hand off, and what assumptions are not enforced by types?"
contributor: "graphify"
outcome: "useful"
source_nodes: ["SubtitleTrackInfo", "parseVtt", "cueAt", "serveSubtitle", "serveSubtitleFile", "setSubtitle", "subtitleUrl", "addSubtitle", "loadSubtitle", "Cue"]
---

# Q: Trace the subtitle path from embedded track extraction to on-screen cue rendering: where do main and renderer hand off, and what assumptions are not enforced by types?

## Answer

Expanded from original query via vocab: [subtitle, cue, track, vtt, parse, embedded, external, delay, serve, codec, srt, overlay]. Traversed DFS from Cue/parseVtt/serveSubtitle/SubtitleTrackInfo/findEmbeddedSubtitlePath.

Embedded path: probe.buildInfo maps subtitle streams to SubtitleTrackInfo[] with index = subtitle-relative position (probe.ts L208-218) -> MediaInfo.subtitleTracks -> player store -> UI panel (PlayerOverlay L628-647), auto-pick pickSubtitle (player.ts L467), S key (App.tsx L281-292) -> setSubtitle (player.ts L313) -> IPC media:subtitleUrl -> main/index.ts L316 returns baseUrl/subtitle/:id/:index or null -> streamServer.serveSubtitle L279: rejects streams (400) and bitmap codecs (415), extracts via ffmpeg -map 0:s:${track.index} to cacheDir(subs)/id-index-mtime.vtt, serves text/vtt -> fetch in loadSubtitle (playback.ts L541) -> parseVtt (subtitles.ts L39) -> cueAt binary search + 4-cue lookback (L78-100) on the ~110ms tick -> onCue -> store cue -> overlay renders cue.text when settings.subtitle.enabled (PlayerOverlay L277-293).

External path: dialog.openSubtitle -> IPC media:addSubtitle -> server.registerExternalSubtitle (streamServer L271) stores path in an in-memory token map -> renderer appends SubtitleTrackInfo {index: 1000+len, external:true, token} to the player store copy (player.ts L340-351) -> setSubtitle builds baseUrl/subtitle-ext/:token directly (player.ts L326) -> serveSubtitleFile (L338) serves .vtt as-is or ffmpeg-converts others into a sha1-keyed cache.

Untyped assumptions: (1) track.index is subtitle-relative, not ffmpeg absolute stream index; -map 0:s:${index} relies on ffprobe/ffmpeg ordering agreeing; (2) subtitle URL builders duplicated - renderer builds /subtitle-ext/:token (player.ts L326), main builds /subtitle/:id/:index (index.ts L321); route table must match both; (3) subtitleUrl returns null for unknown track, loadSubtitle(null) silently clears cues while subtitleIndex stays set - UI shows subtitles on with nothing displayed; (4) setSubtitle sets subtitleIndex before fetch resolves (player.ts L323), no rollback on failure - only an error toast; (5) bitmap codec blacklist duplicated 3x: App.tsx L288, player.ts L468 (pickSubtitle), streamServer.ts L296 - drift means auto-select can pick a 415 track; (6) external track lifetime is the session - token map is in-memory, track lives only in the player store copy, playItem overwrites subtitleTracks from the passed MediaInfo (player.ts L189), so external subs vanish on replay/restart; (7) cueAt assumes sparse overlap - long cue followed by >4 later cues is missed (subtitles.ts L94-98); (8) delay clamp -30..+30 applied only at lookup (t = time - delay), cache/extraction unaffected; (9) embedded cache keyed on rounded mtime (streamServer L302) - same-size same-mtime edits stay stale; (10) settings.subtitle.enabled gates rendering only, not loading; (11) streams list subtitleTracks but embedded extraction rejects them with 400 - auto-pick can select an unavailable track; (12) dead code: mergeExternalSubtitle (probe.ts L323) and findEmbeddedSubtitlePath (probe.ts L339) are exported but have zero callers - leftovers from the pre-VTT design, still present as graph nodes.

## Outcome

- Signal: useful

## Source Nodes

- SubtitleTrackInfo
- parseVtt
- cueAt
- serveSubtitle
- serveSubtitleFile
- setSubtitle
- subtitleUrl
- addSubtitle
- loadSubtitle
- Cue
- PlayerOverlay.tsx