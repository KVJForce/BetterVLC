# MSE Playback Engine

> 77 nodes · cohesion 0.06

## Key Concepts

- **PlaybackController** (60 connections) — `src/renderer/src/lib/playback.ts`
- **playback.ts** (23 connections) — `src/renderer/src/lib/playback.ts`
- **.emit()** (18 connections) — `src/renderer/src/lib/playback.ts`
- **.loadAt()** (13 connections) — `src/renderer/src/lib/playback.ts`
- **.currentTime()** (11 connections) — `src/renderer/src/lib/playback.ts`
- **.readStream()** (10 connections) — `src/renderer/src/lib/playback.ts`
- **.handleMseFailure()** (8 connections) — `src/renderer/src/lib/playback.ts`
- **.startMse()** (8 connections) — `src/renderer/src/lib/playback.ts`
- **.startTick()** (8 connections) — `src/renderer/src/lib/playback.ts`
- **.updateCue()** (8 connections) — `src/renderer/src/lib/playback.ts`
- **subtitles.ts** (8 connections) — `src/renderer/src/lib/subtitles.ts`
- **.seek()** (7 connections) — `src/renderer/src/lib/playback.ts`
- **.fail()** (6 connections) — `src/renderer/src/lib/playback.ts`
- **.play()** (6 connections) — `src/renderer/src/lib/playback.ts`
- **.saveProgress()** (6 connections) — `src/renderer/src/lib/playback.ts`
- **.setActiveCue()** (6 connections) — `src/renderer/src/lib/playback.ts`
- **Cue** (6 connections) — `src/renderer/src/lib/subtitles.ts`
- **clamp()** (5 connections) — `src/renderer/src/lib/format.ts`
- **.applyEq()** (5 connections) — `src/renderer/src/lib/playback.ts`
- **.applyVolume()** (5 connections) — `src/renderer/src/lib/playback.ts`
- **.attach()** (5 connections) — `src/renderer/src/lib/playback.ts`
- **.ensureAudio()** (5 connections) — `src/renderer/src/lib/playback.ts`
- **.feed()** (5 connections) — `src/renderer/src/lib/playback.ts`
- **.open()** (5 connections) — `src/renderer/src/lib/playback.ts`
- **.pumpAppend()** (5 connections) — `src/renderer/src/lib/playback.ts`
- *... and 52 more nodes in this community*

## Relationships

- [Player Overlay & Media Display](Player_Overlay_&_Media_Display.md) (12 shared connections)
- [Renderer UI Components](Renderer_UI_Components.md) (6 shared connections)
- [Main Process Core (config, IPC, utilities)](Main_Process_Core_config,_IPC,_utilities.md) (4 shared connections)
- [Preload & IPC API Contract](Preload_&_IPC_API_Contract.md) (4 shared connections)
- [Media Probing (ffprobe)](Media_Probing_ffprobe.md) (1 shared connections)

## Source Files

- `src/renderer/src/lib/format.ts`
- `src/renderer/src/lib/playback.ts`
- `src/renderer/src/lib/subtitles.ts`
- `src/renderer/src/store/player.ts`
- `src/shared/types.ts`

## Audit Trail

- EXTRACTED: 205 (100%)
- INFERRED: 0 (0%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*