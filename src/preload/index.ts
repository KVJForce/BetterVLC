import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type { BetterVlcApi } from '../shared/api'
import type { ScanProgress } from '../shared/types'

const portArg = process.argv.find((arg) => arg.startsWith('--bettervlc-port='))
const port = portArg ? portArg.split('=')[1] : ''

function subscribe<T>(channel: string, cb: (value: T) => void): () => void {
  const listener = (_event: Electron.IpcRendererEvent, value: T) => cb(value)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

const api: BetterVlcApi = {
  baseUrl: port ? `http://127.0.0.1:${port}` : '',
  platform: process.platform,
  app: {
    info: () => ipcRenderer.invoke('app:info')
  },
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
    setFullscreen: (value) => ipcRenderer.invoke('window:setFullscreen', value)
  },
  dialog: {
    openFiles: () => ipcRenderer.invoke('dialog:openFiles'),
    openFolder: () => ipcRenderer.invoke('dialog:openFolder'),
    openSubtitle: () => ipcRenderer.invoke('dialog:openSubtitle')
  },
  library: {
    get: () => ipcRenderer.invoke('library:get'),
    addFolder: (folder) => ipcRenderer.invoke('library:addFolder', folder),
    removeFolder: (folder) => ipcRenderer.invoke('library:removeFolder', folder),
    removeItem: (id) => ipcRenderer.invoke('library:removeItem', id),
    rescan: () => ipcRenderer.invoke('library:rescan'),
    reveal: (file) => ipcRenderer.invoke('library:reveal', file)
  },
  media: {
    probePaths: (paths) => ipcRenderer.invoke('media:probePaths', paths),
    probeUrl: (url) => ipcRenderer.invoke('media:probeUrl', url),
    openDropped: (paths) => ipcRenderer.invoke('media:openDropped', paths),
    plan: (id, options) => ipcRenderer.invoke('media:plan', id, options),
    subtitleUrl: (id, trackIndex) => ipcRenderer.invoke('media:subtitleUrl', id, trackIndex),
    addSubtitle: (file) => ipcRenderer.invoke('media:addSubtitle', file),
    saveSnapshot: (dataUrl, suggested) => ipcRenderer.invoke('media:saveSnapshot', dataUrl, suggested),
    sourceId: (source) => ipcRenderer.invoke('media:sourceId', source)
  },
  paths: {
    forFile: (file) => webUtils.getPathForFile(file)
  },
  on: {
    libraryProgress: (cb) => subscribe<ScanProgress>('library:progress', cb),
    libraryItem: (cb) => subscribe('library:item', cb),
    mediaKey: (cb) => subscribe('media-key', cb),
    openPaths: (cb) => subscribe('app:open-paths', cb),
    fullscreen: (cb) => subscribe('window:fullscreen', cb)
  }
}

contextBridge.exposeInMainWorld('api', api)
