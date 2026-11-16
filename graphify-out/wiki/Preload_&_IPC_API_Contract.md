# Preload & IPC API Contract

> 48 nodes · cohesion 0.05

## Key Concepts

- **api.ts** (40 connections) — `src/shared/api.ts`
- **types.ts** (33 connections) — `src/shared/types.ts`
- **ScanProgress** (9 connections) — `src/shared/types.ts`
- **preload/index.ts** (8 connections) — `src/preload/index.ts`
- **BetterVlcApi** (8 connections) — `src/shared/api.ts`
- **PlaybackPlan** (6 connections) — `src/shared/types.ts`
- **AppInfo** (5 connections) — `src/shared/types.ts`
- **LibraryState** (3 connections) — `src/renderer/src/store/library.ts`
- **ExternalSubtitle** (3 connections) — `src/shared/types.ts`
- **UiState** (2 connections) — `src/renderer/src/store/ui.ts`
- **AudioTrackInfo** (2 connections) — `src/shared/types.ts`
- **MediaKind** (2 connections) — `src/shared/types.ts`
- **api** (1 connections) — `src/preload/index.ts`
- **portArg** (1 connections) — `src/preload/index.ts`
- **subscribe()** (1 connections) — `src/preload/index.ts`
- **addFolder()** (1 connections) — `src/shared/api.ts`
- **addSubtitle()** (1 connections) — `src/shared/api.ts`
- **close()** (1 connections) — `src/shared/api.ts`
- **forFile()** (1 connections) — `src/shared/api.ts`
- **fullscreen()** (1 connections) — `src/shared/api.ts`
- **get()** (1 connections) — `src/shared/api.ts`
- **info()** (1 connections) — `src/shared/api.ts`
- **isMaximized()** (1 connections) — `src/shared/api.ts`
- **libraryItem()** (1 connections) — `src/shared/api.ts`
- **libraryProgress()** (1 connections) — `src/shared/api.ts`
- *... and 23 more nodes in this community*

## Relationships

- [Main Process Core (config, IPC, utilities)](Main_Process_Core_config,_IPC,_utilities.md) (15 shared connections)
- [Renderer UI Components](Renderer_UI_Components.md) (13 shared connections)
- [MSE Playback Engine](MSE_Playback_Engine.md) (4 shared connections)
- [Media Probing (ffprobe)](Media_Probing_ffprobe.md) (3 shared connections)
- [Player Overlay & Media Display](Player_Overlay_&_Media_Display.md) (3 shared connections)
- [Settings UI & Store](Settings_UI_&_Store.md) (2 shared connections)
- [Build & Dependencies (package.json)](Build_&_Dependencies_package.json.md) (1 shared connections)

## Source Files

- `src/preload/index.ts`
- `src/renderer/src/store/library.ts`
- `src/renderer/src/store/ui.ts`
- `src/shared/api.ts`
- `src/shared/types.ts`

## Audit Trail

- EXTRACTED: 99 (100%)
- INFERRED: 0 (0%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*