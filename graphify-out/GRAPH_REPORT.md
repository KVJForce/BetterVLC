# Graph Report - Better_VLC  (2026-11-16)

## Corpus Check
- Corpus is ~28,721 words - fits in a single context window. You may not need a graph.

## Summary
- 495 nodes · 1284 edges · 14 communities (12 shown, 2 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 14 edges (avg confidence: 0.81)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Main Process Core (config, IPC, utilities)
- Renderer UI Components
- MSE Playback Engine
- Build & Dependencies (package.json)
- Preload & IPC API Contract
- Player Overlay & Media Display
- Settings UI & Store
- Packaging & Installer (electron-builder)
- Media Probing (ffprobe)
- Project Documentation (README concepts)
- TS Config (web)
- TS Config (node)
- TS Config (solution root)
- App Icon & Branding

## God Nodes (most connected - your core abstractions)
1. `PlaybackController` - 60 edges
2. `useUi` - 36 edges
3. `MediaInfo` - 28 edges
4. `usePlayer` - 27 edges
5. `formatTime()` - 23 edges
6. `lucide-react` - 19 edges
7. `Library` - 18 edges
8. `App()` - 17 edges
9. `PlayerOverlay()` - 17 edges
10. `react` - 16 edges

## Surprising Connections (you probably didn't know these)
- `src/renderer/index.html (renderer HTML shell, CSP, #root)` --conceptually_related_to--> `FFmpeg compatibility pipeline (remux/transcode to fMP4, MSE streaming)`  [INFERRED]
  src/renderer/index.html → README.md
- `LibraryFile` --references--> `MediaInfo`  [EXTRACTED]
  src/main/library.ts → src/shared/types.ts
- `thumbUrlFor()` --calls--> `thumbFileName()`  [EXTRACTED]
  src/main/streamServer.ts → src/main/thumbnails.ts
- `App()` --calls--> `PlayerOverlay()`  [EXTRACTED]
  src/renderer/src/App.tsx → src/renderer/src/components/PlayerOverlay.tsx
- `App()` --calls--> `useSettings`  [EXTRACTED]
  src/renderer/src/App.tsx → src/renderer/src/store/settings.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **BetterVLC playback architecture (native path vs FFmpeg fMP4 pipeline, streams through the same pipeline)** — readme_bettervlc, readme_native_playback, readme_ffmpeg_pipeline, readme_streams_playlists [INFERRED 0.85]
- **Electron main process modules (window/IPC, library, probe, stream server, playlists, thumbnails)** — src_main_index, src_main_library, src_main_probe, src_main_streamserver, src_main_playlists, src_main_thumbnails [EXTRACTED 1.00]
- **Renderer loopback media boundary (CSP exceptions for 127.0.0.1 serve the local fMP4 stream server)** — src_renderer_index, src_renderer_src_main, src_main_streamserver, readme_ffmpeg_pipeline [INFERRED 0.75]

## Communities (14 total, 2 thin omitted)

### Community 0 - "Main Process Core (config, IPC, utilities)"
Cohesion: 0.05
Nodes (54): Preload layer (typed contextBridge API), Project layout (src/main, src/preload, src/renderer, src/shared), Shared IPC types and contracts (src/shared), evaluate(), pending, screenshot(), send(), target (+46 more)

### Community 1 - "Renderer UI Components"
Cohesion: 0.10
Nodes (58): framer-motion, lucide-react, react, zustand, App(), PAGES, CommandPalette(), PaletteEntry (+50 more)

### Community 2 - "MSE Playback Engine"
Cohesion: 0.06
Nodes (18): clamp(), EMPTY, EQ_BANDS, findBox(), MseSession, PlaybackController, PlaybackOptions, PlaybackSnapshot (+10 more)

### Community 3 - "Build & Dependencies (package.json)"
Cohesion: 0.05
Nodes (48): author, dependencies, @fontsource-variable/inter@^5.3.0, @fontsource-variable/space-grotesk@^5.3.0, description, devDependencies, electron@^45.1.0, electron-builder@^26.0.12 (+40 more)

### Community 4 - "Preload & IPC API Contract"
Cohesion: 0.05
Nodes (15): api, portArg, LibraryState, UiState, BetterVlcApi, PlayerPlanOptions, Window, AppInfo (+7 more)

### Community 5 - "Player Overlay & Media Display"
Cohesion: 0.18
Nodes (26): mediaHint(), InfoDrawer(), InfoRow(), thumbSrc(), AudioStage(), MiniPlayer(), Panel, PanelContent() (+18 more)

### Community 6 - "Settings UI & Store"
Cohesion: 0.15
Nodes (18): ACCENTS, SECTIONS, Segmented(), Select(), SettingRow(), SettingsCard(), SettingsPage(), Toggle() (+10 more)

### Community 7 - "Packaging & Installer (electron-builder)"
Cohesion: 0.11
Nodes (19): build, appId, copyright, directories, extraResources, files, nsis, portable (+11 more)

### Community 8 - "Media Probing (ffprobe)"
Cohesion: 0.15
Nodes (16): avcCodecString(), buildInfo(), cleanTitle(), isH264Copyable(), isHdr(), LOCAL_CACHE, NATIVE_AUDIO_CODECS, NATIVE_AUDIO_EXT (+8 more)

### Community 9 - "Project Documentation (README concepts)"
Cohesion: 0.15
Nodes (16): BetterVLC (project), Build tooling (electron-vite 6, Vite 8; npm dev/typecheck/build/dist), Desktop behaviour (frameless chrome, media keys, single instance, open-with), Electron 45 (application shell), FFmpeg/FFprobe binaries (ffmpeg-static, ffprobe-static, resources/bin), FFmpeg compatibility pipeline (remux/transcode to fMP4, MSE streaming), Interface (themes, command palette, drawers, context menus, drag-and-drop), Keyboard shortcuts (Space, arrows, J/L, M, F, N/P, S, A, [ ], Q/I, Ctrl+O/U/K/L/,) (+8 more)

### Community 10 - "TS Config (web)"
Cohesion: 0.12
Nodes (15): compilerOptions, allowSyntheticDefaultImports, esModuleInterop, forceConsistentCasingInFileNames, jsx, lib, module, moduleResolution (+7 more)

### Community 11 - "TS Config (node)"
Cohesion: 0.13
Nodes (14): compilerOptions, allowSyntheticDefaultImports, esModuleInterop, forceConsistentCasingInFileNames, lib, module, moduleResolution, noEmit (+6 more)

## Knowledge Gaps
- **9 isolated node(s):** `Interface (themes, command palette, drawers, context menus, drag-and-drop)`, `Electron 45 (application shell)`, `React 19 UI layer (TypeScript, Framer Motion, Lucide)`, `Zustand state stores (settings, library, player, history, UI)`, `Build tooling (electron-vite 6, Vite 8; npm dev/typecheck/build/dist)` (+4 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 172 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `MediaInfo` connect `Main Process Core (config, IPC, utilities)` to `Renderer UI Components`, `MSE Playback Engine`, `Preload & IPC API Contract`, `Player Overlay & Media Display`, `Media Probing (ffprobe)`?**
  _High betweenness centrality (0.233) - this node is a cross-community bridge._
- **What connects `Interface (themes, command palette, drawers, context menus, drag-and-drop)`, `Electron 45 (application shell)`, `React 19 UI layer (TypeScript, Framer Motion, Lucide)` to the rest of the system?**
  _9 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Main Process Core (config, IPC, utilities)` be split into smaller, more focused modules?**
  _Cohesion score 0.05442329227323628 - nodes in this community are weakly interconnected._
- **Why does `PlaybackController` connect `MSE Playback Engine` to `Main Process Core (config, IPC, utilities)`?**
  _High betweenness centrality (0.167) - this node is a cross-community bridge._
- **Should `Renderer UI Components` be split into smaller, more focused modules?**
  _Cohesion score 0.09550396708786366 - nodes in this community are weakly interconnected._
- **Why does `electron` connect `Build & Dependencies (package.json)` to `Main Process Core (config, IPC, utilities)`, `Preload & IPC API Contract`?**
  _High betweenness centrality (0.087) - this node is a cross-community bridge._
- **Should `MSE Playback Engine` be split into smaller, more focused modules?**
  _Cohesion score 0.06049213943950786 - nodes in this community are weakly interconnected._