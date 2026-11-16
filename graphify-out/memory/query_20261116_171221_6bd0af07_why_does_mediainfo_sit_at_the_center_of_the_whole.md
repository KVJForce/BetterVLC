---
type: "query"
date: "2026-11-16T17:12:21.198005+00:00"
question: "Why does MediaInfo sit at the center of the whole system - bridging Main Process Core, Renderer UI, the MSE Playback Engine, the Preload API, Player Overlay, and Media Probing?"
contributor: "graphify"
outcome: "useful"
source_nodes: ["MediaInfo", "probe.ts", "library.ts", "registry.ts", "streamServer.ts", "thumbnails.ts", "api.ts", "PlaybackController", "player.ts", "PlayerOverlay.tsx"]
---

# Q: Why does MediaInfo sit at the center of the whole system - bridging Main Process Core, Renderer UI, the MSE Playback Engine, the Preload API, Player Overlay, and Media Probing?

## Answer

Expanded from original query via vocab: [info, media, bridge, main, process, renderer, playback, preload, overlay, probe, ipc]. Traversed BFS from MediaInfo and its satellites.

MediaInfo (src/shared/types.ts L42) is the shared type for one playable item: identity (id/path/name/title/kind/isStream), tech metadata (duration/size/bitrate/container/formatLong/width/height/fps/videoCodec/videoProfile/videoLevel/pixFmt/hdr/codecString), tracks (audioTracks/subtitleTracks/chapters), playback strategy (nativePlayable/mseMime/videoCopy), artwork (thumb/cover), bookkeeping (folder/mtime/addedAt/tags).

Producer: src/main/probe.ts builds it - probeMedia returns MediaInfo (L122), nativePlayable computed L238, mseMime L262, videoCopy L296, assembled as info L271. Library stores items: MediaInfo[] (library.ts L14/L27, get() L67); registry keeps Map<string, MediaInfo> (registry.ts L3); thumbnails key off it (thumbnails.ts L30/L35/L39). streamServer consumes it: streamMedia L159, serveSubtitle L281, thumbUrlFor L391, reads info.videoCopy L201 to choose copy vs transcode. main/index.ts plans playback: nativePlayable branch L284, mseMime L306, nativeMime(info) L345.

IPC/preload: contract is MediaInfo-shaped - probePaths(): Promise<MediaInfo[]> api.ts L46, probeUrl L47, openDropped L48, libraryItem callback L60, BetterVlcApi references MediaInfo L58.

Renderer: player store item: MediaInfo | null (player.ts L18), queue L19; PlaybackController item L45 and open() L126 (playback.ts); PlayerOverlay AudioStage/MiniPlayer L451/L480; library store items L6, upsert L16; actions playMedia/subtitleFor L65/L69; MediaCard thumbSrc L10, queue L49; LibraryPage LibraryRow L219; Sidebar folderName L168; CommandPalette mediaHint L431; HomePage L13.

Why central: all 28 edges are imports/references, no calls. MediaInfo is not a component that does work - it is the vocabulary every layer speaks: probe produces it, library/registry store it, streamServer/thumbnails serve it, main/index.ts plans playback from it, api.ts ships it over IPC, stores hold it, UI renders it. Hence highest betweenness - it crosses every boundary by construction.

Caveat: clustered into Main Process Core but lives in src/shared/types.ts; nested types scatter across communities (AudioTrackInfo/MediaTags/PlaybackPlan/AppInfo -> Preload & IPC API Contract, SubtitleTrackInfo -> MSE Playback Engine, ChapterInfo -> Player Overlay & Media Display). Community label reflects heaviest importer group, not role.

Bypass: src/renderer/src/components/InfoDrawer.tsx consumes MediaInfo shape (nativePlayable L200, videoCopy L201, mseMime L202) via usePlayer selector without importing MediaInfo, so AST sees no edge - a real consumer invisible to the graph.

## Outcome

- Signal: useful

## Source Nodes

- MediaInfo
- probe.ts
- library.ts
- registry.ts
- streamServer.ts
- thumbnails.ts
- api.ts
- PlaybackController
- player.ts
- PlayerOverlay.tsx
- MediaCard.tsx
- LibraryPage.tsx
- Sidebar.tsx
- CommandPalette.tsx
- actions.ts
- InfoDrawer.tsx