---
type: "query"
date: "2026-11-16T18:32:32.397988+00:00"
question: "Trace application startup from process launch to first paint: what runs in what order across main, preload and renderer, and what does the ordering assume?"
contributor: "graphify"
outcome: "useful"
source_nodes: ["bootstrap", "createWindow", "registerIpc", "Library", "StreamServer", "preload/index.ts", "App.tsx", "main.tsx", "useLibrary", "usePlayer"]
---

# Q: Trace application startup from process launch to first paint: what runs in what order across main, preload and renderer, and what does the ordering assume?

## Answer

Expanded from original query via vocab: [bootstrap, create, window, app, main, server, library, load, register, ipc, preload, renderer]. Traversed DFS from bootstrap()/createWindow()/registerIpc()/Library/.load()/StreamServer/preload/index.ts/App().

Ordered startup chain:
PHASE 0 main module scope (index.ts L12-36): module globals mainWindow/library/server/baseUrl; appendSwitch autoplay-policy no-user-gesture-required L17 (dev also remote-debugging-port 9222 L18-20); requestSingleInstanceLock L22; if lost -> app.quit(), else register second-instance (focus window + forward media argv as 'app:open-paths' L26-33) and app.whenReady().then(bootstrap) L35. No .catch on bootstrap.
PHASE 1 bootstrap (L38-61): Menu.setApplicationMenu(null) L39; setAppUserModelId L40; new StreamServer() L42 -> await start() L43 binds 127.0.0.1:0 and resolves the ephemeral port (streamServer L41-57); baseUrl set L44; new Library() L45 -> constructor synchronously loads library.json (library.ts L37-38), filters missing paths L48, re-links thumb filenames L49-50, rememberSource(item) L52, starts fs.watch per folder L54; registerIpc() L47 BEFORE window L48 (all handlers exist before any invoke); createWindow() L48; registerMediaKeys() L49 (globalShortcut MediaPlay/Pause/Next/Prev/Stop L117-131); only THEN attach library 'progress'/'item' -> webContents.send L51-56.
PHASE 1b createWindow (L63-115): BrowserWindow show:false, frame:false, backgroundColor #070709, webPreferences preload ../preload/index.mjs, sandbox:false, contextIsolation:true, nodeIntegration:false, webSecurity:true, backgroundThrottling:false, additionalArguments ['--bettervlc-port=' + new URL(baseUrl).port] L76-84; ready-to-show -> show() L87-89 (no white flash, but also no visible error if renderer never paints); window-open handler denies and shells http(s) L94-97; loadURL(ELECTRON_RENDERER_URL) or loadFile(../renderer/index.html) L99-103; did-finish-load -> one-shot send of media argv to 'app:open-paths' L105-110; closed -> mainWindow=null L112-114.
PHASE 2 preload (preload/index.ts L5-6, L14-60): parses --bettervlc-port from process.argv into api.baseUrl (synchronous string, no IPC); builds typed BetterVlcApi over ipcRenderer.invoke; subscribe() helper wraps ipcRenderer.on and returns unsubscribe; contextBridge.exposeInMainWorld('api', api) L62. Runs before page scripts, so baseUrl is known at first render.
PHASE 3 renderer shell: index.html CSP (default-src self; script-src self unsafe-inline; img/media-src self data: blob: http://127.0.0.1:*; connect-src self http://127.0.0.1:* ws://localhost:* ws://127.0.0.1:*; font-src self data:) L5-8; main.tsx imports fonts + global.css L3-5 and createRoot(#root).render(StrictMode App) L11-15.
PHASE 4 store hydration (module evaluation): useSettings persist hydrates synchronously from localStorage 'bettervlc-settings' (settings.ts L102-129; sync storage => sync hydrate, no skipHydration/onRehydrateStorage); useHistory hydrates 'bettervlc-history' (history.ts L17-49); usePlayer module initializers read useSettings.getState().volume and .subtitle.delay (player.ts L89, L95) - this only works because ESM evaluates settings.ts first and localStorage is synchronous.
PHASE 5 App mount (App.tsx L29-42): child PlayerOverlay mounts before parent effects -> its effect calls playback.attach(videoRef.current) (PlayerOverlay L95-97, playback L84-102), which sets crossOrigin=anonymous and ensureAudio() constructs an AudioContext before any user gesture; App effect then usePlayer.initialize() L40 (wires onState/onCue/onEnded/onProgress/onError, applies settings to playback) and void useLibrary.init() L41.
PHASE 6 library init (store/library.ts L28-54): guard `initialized`; await window.api.library.get() -> ipc 'library:get' (main index.ts L196) -> Library.snapshot() sorted by addedAt desc (library.ts L60-65) -> set({items,folders,loaded:true}); THEN subscribe libraryItem/libraryProgress L37-46 (so pushes are only received after the snapshot resolves); if folders exist schedule a one-shot rescan +1.8s L47-53 (the startup reconciliation: catches files changed while the app was closed, since fs.watch only runs while alive).
PHASE 7 deferred/teardown: second-instance or did-finish-load can push app:open-paths (App.tsx L76-78 -> openDroppedPaths -> media:openDropped probe + playItem); will-quit (index.ts L364-368) unregisters shortcuts, library.dispose() flushes library.json synchronously (library.ts L257-260), void server.stop() SIGKILLs ffmpeg children + closes server (streamServer L372-379).

Untyped assumptions: (1) the dynamic port crosses to the renderer ONLY as an additionalArguments string '--bettervlc-port=' parsed in preload L5-6; if the arg is missing/malformed api.baseUrl='' and all thumb/subtitle/media URLs go relative - 404s with no error; an 'app:baseUrl' IPC handler exists (main index.ts L141) but has ZERO callers, so the fallback is dead; (2) bootstrap is app.whenReady().then(bootstrap) with no catch - a StreamServer start() rejection (listen error) leaves the process alive with no window and no dialog; show:false + ready-to-show means a renderer that never paints is also invisible; (3) library:get -> subscription ordering - the renderer subscribes to libraryItem/libraryProgress only AFTER the snapshot await resolves, so any item/progress push emitted in that gap is dropped outright (no listener); masked normally by the +1.8s rescan; (4) did-finish-load fires a ONE-SHOT app:open-paths push for open-with argv; the renderer only subscribes inside an App useEffect after React mount, so a slow first paint can miss it - no queue, ack, or replay; second-instance similarly drops paths when mainWindow is null; (5) loaded:true is written but read by NO component (grep: only store/library.ts itself) - HomePage renders the empty 'Drop in a file' state until the snapshot IPC resolves, so a cold start with a large library flashes empty; (6) player.ts initial state depends on settings hydration having already happened at module-eval time - true only for synchronous localStorage and this import order, nothing encodes it; switching to async storage or lazy-importing player would silently boot at default volume/subtitle delay; (7) fs.watch starts inside the Library constructor before any library event listener exists (attached after createWindow L51-56) - watcher-triggered events in that gap go to zero listeners; (8) startup reconciliation is an uncancelled +1.8s setTimeout rescan; it re-probes any file with >1s mtime drift and probeMedia resets addedAt=Date.now() (probe.ts L300), so launching after a clock/timezone shift can reshuffle 'Recent'; (9) no renderer flush on quit: no beforeunload/pagehide, and playback.stop() (playback.ts L615-630) nulls item/duration BEFORE video.pause() so the async pause-event save is a no-op - media-key Stop or a track switch loses up to the 5s progress window; (10) security posture is config-by-omission: sandbox:false + contextIsolation:true means the preload (and any future renderer compromise) keeps full Node behind window.api, while CSP still allows script-src 'unsafe-inline' and connect-src ws://localhost:*; webSecurity is on and remote content is denied by setWindowOpenHandler.

## Outcome

- Signal: useful

## Source Nodes

- bootstrap
- createWindow
- registerIpc
- Library
- StreamServer
- preload/index.ts
- App.tsx
- main.tsx
- useLibrary
- usePlayer
- index.html