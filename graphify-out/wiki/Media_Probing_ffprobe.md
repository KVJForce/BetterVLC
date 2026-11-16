# Media Probing (ffprobe)

> 19 nodes · cohesion 0.15

## Key Concepts

- **probe.ts** (36 connections) — `src/main/probe.ts`
- **buildInfo()** (10 connections) — `src/main/probe.ts`
- **avcCodecString()** (3 connections) — `src/main/probe.ts`
- **isH264Copyable()** (3 connections) — `src/main/probe.ts`
- **cleanTitle()** (2 connections) — `src/main/probe.ts`
- **isHdr()** (2 connections) — `src/main/probe.ts`
- **parseRate()** (2 connections) — `src/main/probe.ts`
- **parseTags()** (2 connections) — `src/main/probe.ts`
- **pickTag()** (2 connections) — `src/main/probe.ts`
- **findEmbeddedSubtitlePath()** (1 connections) — `src/main/probe.ts`
- **LOCAL_CACHE** (1 connections) — `src/main/probe.ts`
- **mergeExternalSubtitle()** (1 connections) — `src/main/probe.ts`
- **NATIVE_AUDIO_CODECS** (1 connections) — `src/main/probe.ts`
- **NATIVE_AUDIO_EXT** (1 connections) — `src/main/probe.ts`
- **NATIVE_AUDIO_ONLY** (1 connections) — `src/main/probe.ts`
- **NATIVE_VIDEO_CODECS** (1 connections) — `src/main/probe.ts`
- **ProbeChapter** (1 connections) — `src/main/probe.ts`
- **ProbeResult** (1 connections) — `src/main/probe.ts`
- **ProbeStream** (1 connections) — `src/main/probe.ts`

## Relationships

- [Main Process Core (config, IPC, utilities)](Main_Process_Core_config,_IPC,_utilities.md) (14 shared connections)
- [Preload & IPC API Contract](Preload_&_IPC_API_Contract.md) (3 shared connections)
- [Player Overlay & Media Display](Player_Overlay_&_Media_Display.md) (1 shared connections)
- [MSE Playback Engine](MSE_Playback_Engine.md) (1 shared connections)
- [Project Documentation (README concepts)](Project_Documentation_README_concepts.md) (1 shared connections)

## Source Files

- `src/main/probe.ts`

## Audit Trail

- EXTRACTED: 45 (98%)
- INFERRED: 1 (2%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*