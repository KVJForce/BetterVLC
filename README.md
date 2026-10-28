# BetterVLC

A VLC-class desktop media player with a calmer, more considered interface.

BetterVLC plays the files VLC plays — MKV, AVI, MP4, TS, WebM, MP3, FLAC and
more — while treating the library, the player and the settings like one
coherent product instead of a stack of dialogs.

> BetterVLC is an independent project inspired by the legendary VLC media
> player. It is not affiliated with or endorsed by VideoLAN.

## Highlights

- **Native playback when possible.** Browser-friendly files play directly with
  hardware acceleration and zero remuxing.
- **FFmpeg compatibility pipeline for everything else.** MKV/AVI/TS, HEVC, VP9,
  Opus, multi-track audio and other awkward containers are remuxed or
  transcoded to fragmented MP4 and streamed through Media Source Extensions.
- **A real library.** Add folders, scan recursively, watch for changes, resume
  playback, filter by type, and sort by recency, title or length.
- **Subtitles that look right.** Embedded and external SRT/ASS/SSA/VTT tracks,
  auto-selection, delay control, custom typeface, size, colour, outline and
  background.
- **Player essentials.** Chapters, A–B loop, 10-second skips, speed control
  from 0.25× to 4×, 10-band equalizer, rotation, zoom, colour filters,
  snapshots, picture-in-picture and a compact mini player.
- **Streams and playlists.** HTTP(S), HLS, RTSP, RTMP and UDP URLs open through
  the same FFmpeg pipeline. M3U/M3U8 and PLS playlists are understood.
- **An interface worth using.** Dark and light themes, five accents, command
  palette (`Ctrl+K`), queue and media-info drawers, custom context menus,
  keyboard shortcuts and drag-and-drop.
- **Desktop behaviour.** Frameless chrome, media-key support, single-instance
  handling, open-with integration and remembered window state.

## Stack

| Layer      | Choice                                                        |
| ---------- | ------------------------------------------------------------- |
| Shell      | Electron 45                                                   |
| UI         | React 19, TypeScript, Framer Motion, Lucide                   |
| State      | Zustand (settings, library, player, history, UI)              |
| Build      | electron-vite 6, Vite 8                                       |
| Media      | HTML5 `<video>`, Media Source Extensions, FFmpeg / FFprobe     |
| Typography | Inter Variable, Space Grotesk Variable (bundled)              |

The app does **not** bind libVLC. VLC's source and installed binaries were used
as behavioural references for parity targets such as A–B loop, chapter
navigation, track selection, playback speed and snapshots.

## Getting started

```bash
npm install
npm run dev        # Electron + Vite with hot reload
npm run typecheck  # main, preload and renderer type checks
npm run build      # production bundles in out/
npm run dist       # Windows NSIS installer + portable build in release/
```

Development expects the FFmpeg and FFprobe binaries installed by
`ffmpeg-static` and `ffprobe-static`. Packaged builds copy both binaries to
`resources/bin` and use them from there.

## Keyboard shortcuts

| Keys             | Action                              |
| ---------------- | ----------------------------------- |
| `Space`          | Play / pause                        |
| `←` / `→`        | Skip 10 seconds (configurable)      |
| `J` / `L`        | Skip 10 seconds                     |
| `↑` / `↓`        | Volume up / down                    |
| `M`              | Mute                                |
| `F`              | Fullscreen                          |
| `Esc`            | Close panel, drawer or player       |
| `N` / `P`        | Next / previous in the queue        |
| `S`              | Cycle subtitles                     |
| `A`              | Cycle audio tracks                  |
| `[` / `]`        | Decrease / increase playback speed  |
| `Q` / `I`        | Queue / media info drawer           |
| `Ctrl+O`         | Open files                          |
| `Ctrl+Shift+O`   | Add a library folder                |
| `Ctrl+U`         | Open a stream URL                   |
| `Ctrl+K`         | Command palette                     |
| `Ctrl+L`         | Jump to the library                 |
| `Ctrl+,`         | Settings                            |

## Project layout

```
src/
  main/            Electron main process
    index.ts       window, IPC, media keys, open-with
    library.ts     recursive scan, persistence, file watching
    probe.ts       ffprobe metadata, playback planning
    streamServer.ts fMP4 pipeline, range requests, subtitle conversion
    playlists.ts   M3U / PLS parsing
    thumbnails.ts  artwork extraction
  preload/         typed contextBridge API
  renderer/
    src/
      pages/       Home, Library, Queue, Settings
      components/  player, chrome, drawers, palette, cards
      store/       Zustand stores
      lib/         playback controller, subtitles, formatting, actions
      styles/      design tokens and feature styles
  shared/          IPC types and contracts
```

## Deliberate limitations

- DRM-protected content and Blu-ray menus are out of scope.
- Bitmap subtitle formats (PGS, VobSub) are detected but cannot be converted to
  text for the custom overlay.
- Compatibility playback is software-transcoded; very high-bitrate 4K files
  benefit from the resolution cap in Settings.
- Streaming from a URL depends on FFmpeg's protocol support and the source's
  seekability.

## License

MIT
