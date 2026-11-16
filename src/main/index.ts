import { app, BrowserWindow, dialog, globalShortcut, ipcMain, Menu, shell } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import { Library } from './library'
import { StreamServer } from './streamServer'
import { probeMedia, sourceId } from './probe'
import { getSource, rememberSource } from './registry'
import { binaryPath, isMediaFile } from './config'
import { readPlaylist } from './playlists'
import { Routes, mimeForFile } from '../shared/protocol'
import type { AppInfo, MediaInfo, PlaybackPlan } from '../shared/types'

let mainWindow: BrowserWindow | null = null
let library: Library
let server: StreamServer
let baseUrl = ''
let rendererReady = false
const pendingOpenPaths: string[] = []

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required')
if (process.env['ELECTRON_RENDERER_URL']) {
  app.commandLine.appendSwitch('remote-debugging-port', '9222')
}

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', (_event, argv) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
    const files = argv.slice(1).filter((arg) => isMediaFile(arg) && fs.existsSync(arg))
    sendOpenPaths(files)
  })

  app.whenReady()
    .then(bootstrap)
    .catch((error: unknown) => {
      dialog.showErrorBox(
        'BetterVLC could not start',
        error instanceof Error ? error.stack ?? error.message : String(error)
      )
      app.quit()
    })
}

async function bootstrap(): Promise<void> {
  Menu.setApplicationMenu(null)
  app.setAppUserModelId('com.bettervlc.app')

  server = new StreamServer()
  const port = await server.start()
  baseUrl = server.baseUrl
  library = new Library()

  registerIpc()
  createWindow()
  registerMediaKeys()

  library.on('progress', (progress) => {
    mainWindow?.webContents.send('library:progress', progress)
  })
  library.on('item', (item: MediaInfo) => {
    mainWindow?.webContents.send('library:item', item)
  })
  library.on('remove', (item: MediaInfo) => {
    mainWindow?.webContents.send('library:remove', item)
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
}

function createWindow(): void {
  rendererReady = false
  mainWindow = new BrowserWindow({
    width: 1420,
    height: 900,
    minWidth: 1040,
    minHeight: 680,
    show: false,
    frame: false,
    backgroundColor: '#070709',
    title: 'BetterVLC',
    icon: app.isPackaged
      ? path.join(process.resourcesPath, 'icon.png')
      : path.join(app.getAppPath(), 'resources', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.mjs'),
      // Sandboxed preloads must be CommonJS; this build emits ESM. See H19 in
      // HARDENING_PLAN.md before changing either side.
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      backgroundThrottling: false,
      additionalArguments: [`--bettervlc-port=${server ? new URL(baseUrl).port : ''}`]
    }
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.on('enter-full-screen', () => mainWindow?.webContents.send('window:fullscreen', true))
  mainWindow.on('leave-full-screen', () => mainWindow?.webContents.send('window:fullscreen', false))

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    void mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  mainWindow.webContents.on('did-start-loading', () => {
    rendererReady = false
  })

  mainWindow.webContents.once('did-finish-load', () => {
    const files = process.argv
      .slice(1)
      .filter((arg) => !arg.startsWith('-') && isMediaFile(arg) && fs.existsSync(arg))
    sendOpenPaths(files)
  })

  mainWindow.on('closed', () => {
    rendererReady = false
    mainWindow = null
  })
}

function sendOpenPaths(paths: string[]): void {
  if (!paths.length) return
  if (!rendererReady || !mainWindow || mainWindow.isDestroyed()) {
    pendingOpenPaths.push(...paths)
    return
  }
  mainWindow.webContents.send('app:open-paths', paths)
}

function flushOpenPaths(): void {
  if (!mainWindow || mainWindow.isDestroyed() || !pendingOpenPaths.length) return
  const paths = pendingOpenPaths.splice(0)
  mainWindow.webContents.send('app:open-paths', paths)
}

function registerMediaKeys(): void {
  const bind = (accelerator: string, action: string) => {
    try {
      globalShortcut.register(accelerator, () => {
        mainWindow?.webContents.send('media-key', action)
      })
    } catch {
      /* Media keys can be claimed by other apps. */
    }
  }
  bind('MediaPlayPause', 'play-pause')
  bind('MediaNextTrack', 'next')
  bind('MediaPreviousTrack', 'previous')
  bind('MediaStop', 'stop')
}

function registerIpc(): void {
  ipcMain.handle('app:info', (): AppInfo => ({
    version: app.getVersion(),
    electron: process.versions.electron,
    platform: process.platform,
    ffmpeg: binaryPath('ffmpeg')
  }))

  ipcMain.handle('app:baseUrl', () => baseUrl)
  ipcMain.on('app:baseUrlSync', (event) => {
    event.returnValue = baseUrl
  })
  ipcMain.handle('app:rendererReady', () => {
    rendererReady = true
    flushOpenPaths()
  })

  ipcMain.handle('window:minimize', () => mainWindow?.minimize())
  ipcMain.handle('window:maximize', () => {
    if (!mainWindow) return false
    if (mainWindow.isMaximized()) mainWindow.unmaximize()
    else mainWindow.maximize()
    return mainWindow.isMaximized()
  })
  ipcMain.handle('window:close', () => mainWindow?.close())
  ipcMain.handle('window:isMaximized', () => mainWindow?.isMaximized() ?? false)
  ipcMain.handle('window:setFullscreen', (_e, value: boolean) => {
    mainWindow?.setFullScreen(value)
    return mainWindow?.isFullScreen() ?? false
  })

  ipcMain.handle('dialog:openFiles', async () => {
    if (!mainWindow) return []
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Open media',
      properties: ['openFile', 'multiSelections'],
      filters: [
        {
          name: 'Media',
          extensions: [
            'mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm', 'm4v', 'mpg', 'mpeg', 'ts',
            'm2ts', 'ogv', '3gp', 'vob', 'mp3', 'flac', 'wav', 'm4a', 'aac', 'ogg', 'opus',
            'wma', 'aiff', 'mka', 'm3u', 'm3u8', 'pls', 'xspf'
          ]
        },
        { name: 'All files', extensions: ['*'] }
      ]
    })
    return result.canceled ? [] : result.filePaths
  })

  ipcMain.handle('dialog:openFolder', async () => {
    if (!mainWindow) return null
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Add a folder to your library',
      properties: ['openDirectory']
    })
    return result.canceled ? null : result.filePaths[0]
  })

  ipcMain.handle('dialog:openSubtitle', async () => {
    if (!mainWindow) return null
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Open subtitles',
      properties: ['openFile'],
      filters: [{ name: 'Subtitles', extensions: ['srt', 'ass', 'ssa', 'vtt', 'sub', 'smi'] }]
    })
    return result.canceled ? null : result.filePaths[0]
  })

  ipcMain.handle('library:get', () => library.snapshot())
  ipcMain.handle('library:addFolder', async (_e, folder: string) => library.addFolder(folder))
  ipcMain.handle('library:removeFolder', (_e, folder: string) => library.removeFolder(folder))
  ipcMain.handle('library:removeItem', (_e, id: string) => library.removeItem(id))
  ipcMain.handle('library:rescan', () => library.rescan())
  ipcMain.handle('library:reveal', (_e, file: string) => {
    if (fs.existsSync(file)) shell.showItemInFolder(file)
  })

  ipcMain.handle('media:probePaths', async (_e, paths: string[]) => {
    const results: MediaInfo[] = []
    for (const file of paths) {
      if (!fs.existsSync(file) || !isMediaFile(file)) continue
      try {
        const info = await probeMedia(file)
        rememberSource(info)
        results.push(info)
      } catch (error) {
        console.warn('Could not probe', file, error)
      }
    }
    return results
  })

  ipcMain.handle('media:probeUrl', async (_e, url: string) => {
    const trimmed = String(url ?? '').trim()
    if (!/^(https?|rtsp|rtmp|rtmps|udp|tcp|mms|mmsh|file):\/\//i.test(trimmed)) {
      throw new Error('Enter a valid http, https, rtsp, rtmp or udp stream URL')
    }
    const info = await probeMedia(trimmed, { isStream: true, timeoutMs: 18000 })
    rememberSource(info)
    return info
  })

  ipcMain.handle('media:openDropped', async (_e, paths: string[]) => {
    const items: MediaInfo[] = []
    const folders: string[] = []
    const playlistEntries: Array<{ source: string; title?: string }> = []
    for (const raw of paths) {
      const file = path.resolve(raw)
      if (!fs.existsSync(file)) continue
      const stat = fs.statSync(file)
      if (stat.isDirectory()) {
        folders.push(file)
        continue
      }
      const ext = path.extname(file).toLowerCase()
      if (['.m3u', '.m3u8', '.pls', '.xspf'].includes(ext)) {
        try {
          playlistEntries.push(...readPlaylist(file))
        } catch {
          /* ignore broken playlist */
        }
        continue
      }
      if (!isMediaFile(file)) continue
      try {
        const info = await probeMedia(file)
        rememberSource(info)
        items.push(info)
      } catch {
        /* ignore unreadable file */
      }
    }
    for (const entry of playlistEntries) {
      try {
        const isRemote = /^[a-z][a-z0-9+.-]*:\/\//i.test(entry.source)
        const info = await probeMedia(entry.source, { isStream: isRemote })
        rememberSource(info)
        items.push(info)
      } catch {
        /* ignore unreadable playlist entry */
      }
    }
    return { items, folders }
  })

  ipcMain.handle('media:plan', (_e, id: string, options: {
    start?: number
    audio?: number
    maxHeight?: number
    deinterlace?: boolean
    hwDecode?: boolean
    forceTranscode?: boolean
  } = {}): PlaybackPlan => {
    const info = getSource(id)
    if (!info) throw new Error('Media is no longer available')
    const start = Math.max(Number(options.start ?? 0) || 0, 0)
    if (info.nativePlayable) {
      return {
        mode: 'native',
        url: `${baseUrl}${Routes.media(info.id)}`,
        mime: mimeForFile(info.path, info.kind),
        duration: info.duration,
        baseTime: 0
      }
    }
    const mime = options.forceTranscode
      ? info.kind === 'video'
        ? `video/mp4; codecs="avc1.640029${info.audioTracks.length ? ',mp4a.40.2' : ''}"`
        : 'audio/mp4; codecs="mp4a.40.2"'
      : info.mseMime
    return {
      mode: 'mse',
      url: `${baseUrl}${Routes.stream(info.id, {
        start,
        audio: options.audio,
        maxHeight: options.maxHeight,
        deinterlace: options.deinterlace,
        hwDecode: options.hwDecode,
        forceTranscode: options.forceTranscode
      })}`,
      mime,
      duration: info.duration,
      baseTime: start
    }
  })

  ipcMain.handle('media:subtitleUrl', (_e, id: string, trackIndex: number) => {
    const info = getSource(id)
    const track = info?.subtitleTracks.find((t) => t.index === trackIndex)
    if (!track) return null
    if (track.external && track.token) return `${baseUrl}${Routes.externalSubtitle(track.token)}`
    return `${baseUrl}${Routes.subtitle(id, trackIndex)}`
  })

  ipcMain.handle('media:addSubtitle', (_e, file: string) => {
    const result = server.registerExternalSubtitle(file)
    return result
  })

  ipcMain.handle('media:saveSnapshot', async (_e, dataUrl: string, suggested: string) => {
    if (!mainWindow) return null
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Save snapshot',
      defaultPath: path.join(app.getPath('pictures'), sanitizeName(suggested) + '.png'),
      filters: [{ name: 'PNG image', extensions: ['png'] }]
    })
    if (result.canceled || !result.filePath) return null
    const base64 = dataUrl.replace(/^data:image\/png;base64,/, '')
    fs.writeFileSync(result.filePath, Buffer.from(base64, 'base64'))
    return result.filePath
  })

  ipcMain.handle('media:sourceId', (_e, source: string) => sourceId(source))
}

function sanitizeName(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, '-').replace(/\s+/g, ' ').trim().slice(0, 80) || 'snapshot'
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  library?.dispose()
  void server?.stop()
})
