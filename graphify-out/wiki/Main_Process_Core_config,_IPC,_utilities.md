# Main Process Core (config, IPC, utilities)

> 95 nodes · cohesion 0.05

## Key Concepts

- **main/index.ts** (31 connections) — `src/main/index.ts`
- **main/library.ts** (30 connections) — `src/main/library.ts`
- **MediaInfo** (28 connections) — `src/shared/types.ts`
- **streamServer.ts** (24 connections) — `src/main/streamServer.ts`
- **config.ts** (18 connections) — `src/main/config.ts`
- **Library** (18 connections) — `src/main/library.ts`
- **.scan()** (16 connections) — `src/main/library.ts`
- **thumbnails.ts** (16 connections) — `src/main/thumbnails.ts`
- **StreamServer** (12 connections) — `src/main/streamServer.ts`
- **binaryPath()** (11 connections) — `src/main/config.ts`
- **registerIpc()** (11 connections) — `src/main/index.ts`
- **Project layout (src/main, src/preload, src/renderer, src/shared)** (10 connections) — `README.md`
- **.handle()** (10 connections) — `src/main/streamServer.ts`
- **cacheDir()** (9 connections) — `src/main/config.ts`
- **playlists.ts** (9 connections) — `src/main/playlists.ts`
- **registry.ts** (9 connections) — `src/main/registry.ts`
- **LibrarySnapshot** (9 connections) — `src/shared/types.ts`
- **ref_node_fs** (8 connections)
- **dev-cdp.mjs** (8 connections) — `scripts/dev-cdp.mjs`
- **.generateThumbnails()** (8 connections) — `src/main/library.ts`
- **.serveSubtitle()** (8 connections) — `src/main/streamServer.ts`
- **thumbFileName()** (8 connections) — `src/main/thumbnails.ts`
- **thumbPath()** (8 connections) — `src/main/thumbnails.ts`
- **ref_node_path** (7 connections)
- **isMediaFile()** (7 connections) — `src/main/config.ts`
- *... and 70 more nodes in this community*

## Relationships

- [Preload & IPC API Contract](Preload_&_IPC_API_Contract.md) (15 shared connections)
- [Media Probing (ffprobe)](Media_Probing_ffprobe.md) (14 shared connections)
- [Renderer UI Components](Renderer_UI_Components.md) (9 shared connections)
- [Project Documentation (README concepts)](Project_Documentation_README_concepts.md) (6 shared connections)
- [MSE Playback Engine](MSE_Playback_Engine.md) (4 shared connections)
- [Build & Dependencies (package.json)](Build_&_Dependencies_package.json.md) (3 shared connections)
- [Player Overlay & Media Display](Player_Overlay_&_Media_Display.md) (1 shared connections)

## Source Files

- `README.md`
- `scripts/dev-cdp.mjs`
- `src/main/config.ts`
- `src/main/index.ts`
- `src/main/library.ts`
- `src/main/playlists.ts`
- `src/main/probe.ts`
- `src/main/registry.ts`
- `src/main/streamServer.ts`
- `src/main/thumbnails.ts`
- `src/shared/types.ts`

## Audit Trail

- EXTRACTED: 289 (97%)
- INFERRED: 8 (3%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*