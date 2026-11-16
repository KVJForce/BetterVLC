---
type: "query"
date: "2026-11-16T17:19:04.830509+00:00"
question: "Trace the full playback path from probeMedia to PlayerOverlay: where do main and renderer hand off, and what assumptions are not enforced by types?"
contributor: "graphify"
outcome: "useful"
source_nodes: ["PlaybackController", "PlaybackPlan", "probeMedia", "streamServer.ts", "MseSession", "PlayerOverlay.tsx", "api.ts", "registry.ts", "player.ts", "index.ts"]
---

# Q: Trace the full playback path from probeMedia to PlayerOverlay: where do main and renderer hand off, and what assumptions are not enforced by types?

## Answer

Expanded from original query via vocab: [probe, media, plan, playback, stream, mse, session, controller, native, transcode, ipc, overlay]. Traversed DFS from plan()/StreamServer/MseSession/PlaybackController/probe.ts.

Chain: actions.playMedia/openDroppedPaths -> store.playItem (player.ts L163) -> PlaybackController.open (playback.ts L126) -> loadAt (L141) -> IPC media:plan -> main index.ts L273 getSource(id) -> PlaybackPlan {mode,url,mime,duration,baseTime} -> native: /media/:id byte-range file (streamServer L115); mse: /stream?... ffmpeg spawn (streamServer L156, args L171-239, +frag_keyframe+empty_moov+default_base_moof L235) -> MseSession SourceBuffer (startMse L194) -> readStream fetch L258 -> feed() moof/mdat parse L313 -> appendBuffer -> video element attached at PlayerOverlay mount (L207, playback.attach L84) -> onState snapshots -> usePlayer -> PlayerOverlay. Subtitles: media:subtitleUrl L316 -> /subtitle/:id/:index or /subtitle-ext/:token -> VTT -> parseVtt.

Handoffs: (1) renderer->main IPC invoke(media:plan); (2) main->renderer PlaybackPlan plain object; (3) renderer->main loopback HTTP GET for media bytes (NOT IPC) - only the plan crosses IPC; (4) main->ffmpeg child argv + stdout pipe.

Untyped assumptions: (a) URL query grammar t/a/mh/di/hw/tc duplicated in index.ts L293-301 and streamServer L162-169 - no shared constants, silent breakage; (b) id must be live in main-process registry via rememberSource (probe handlers L211/226/264) - plan throws 'Media is no longer available' for disk-loaded library items; (c) mseMime prediction from probe L262 must satisfy MediaSource.isTypeSupported, verified only at runtime L182 with forced-transcode fallback; (d) baseTime coordinate system - MSE clock starts at 0, media time = baseTime + currentTime (L657), seek converts L489, getBuffered adds back L597, native uses nativeStart + loadedmetadata seek L700; (e) videoCopy re-evaluated server-side L201 with !deinterlace && !hdr && !forceTranscode - probe prediction L256 and server decision must agree; (f) fMP4 box grammar - renderer expects moof+mdat pairs L329-352, server flags L235 must match, else 8s sourceopen / 25s startup timeouts fire; (g) CORS+CSP needed for snapshots - crossOrigin anonymous L88 + canvas.toDataURL L612 need Access-Control-Allow-Origin (server L65) and CSP 127.0.0.1 from index.html; (h) nativeMime extension map index.ts L345 duplicates probe.ts extension lists L242/L250; (i) native path requires HTTP Range for seeking (serveFile L128-149); (j) nativePlayable implies audioTracks.length <= 1 (probe L247/251) - setAudio L526 always re-plans so only MSE supports track switching; (k) subtitle URL builders duplicated - renderer builds /subtitle-ext/:token (player.ts L326), main builds /subtitle/:id/:index (index.ts L321) - route table must match both.

## Outcome

- Signal: useful

## Source Nodes

- PlaybackController
- PlaybackPlan
- probeMedia
- streamServer.ts
- MseSession
- PlayerOverlay.tsx
- api.ts
- registry.ts
- player.ts
- index.ts