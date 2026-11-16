# Project Documentation (README concepts)

> 17 nodes · cohesion 0.15

## Key Concepts

- **BetterVLC (project)** (16 connections) — `README.md`
- **FFmpeg compatibility pipeline (remux/transcode to fMP4, MSE streaming)** (5 connections) — `README.md`
- **Player essentials (chapters, A-B loop, speed, 10-band EQ, PiP, mini player)** (3 connections) — `README.md`
- **Streams and playlists (HTTP/S, HLS, RTSP, RTMP, UDP; M3U/M3U8, PLS)** (3 connections) — `README.md`
- **src/renderer/index.html (renderer HTML shell, CSP, #root)** (3 connections) — `src/renderer/index.html`
- **Desktop behaviour (frameless chrome, media keys, single instance, open-with)** (2 connections) — `README.md`
- **FFmpeg/FFprobe binaries (ffmpeg-static, ffprobe-static, resources/bin)** (2 connections) — `README.md`
- **Keyboard shortcuts (Space, arrows, J/L, M, F, N/P, S, A, [ ], Q/I, Ctrl+O/U/K/L/,)** (2 connections) — `README.md`
- **Library (recursive scan, change watching, resume, filter, sort)** (2 connections) — `README.md`
- **Native playback (hardware acceleration, zero remuxing)** (2 connections) — `README.md`
- **Subtitle engine (embedded/external SRT, ASS, SSA, VTT; custom overlay)** (2 connections) — `README.md`
- **Build tooling (electron-vite 6, Vite 8; npm dev/typecheck/build/dist)** (1 connections) — `README.md`
- **Deliberate limitations (DRM/Blu-ray, PGS/VobSub, 4K software transcode, URL seekability)** (1 connections) — `README.md`
- **Electron 45 (application shell)** (1 connections) — `README.md`
- **Interface (themes, command palette, drawers, context menus, drag-and-drop)** (1 connections) — `README.md`
- **React 19 UI layer (TypeScript, Framer Motion, Lucide)** (1 connections) — `README.md`
- **Zustand state stores (settings, library, player, history, UI)** (1 connections) — `README.md`

## Relationships

- [Main Process Core (config, IPC, utilities)](Main_Process_Core_config,_IPC,_utilities.md) (6 shared connections)
- [Media Probing (ffprobe)](Media_Probing_ffprobe.md) (1 shared connections)
- [Renderer UI Components](Renderer_UI_Components.md) (1 shared connections)

## Source Files

- `README.md`
- `src/renderer/index.html`

## Audit Trail

- EXTRACTED: 21 (75%)
- INFERRED: 7 (25%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*