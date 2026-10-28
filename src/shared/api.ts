import type {
  AppInfo,
  ExternalSubtitle,
  LibrarySnapshot,
  MediaInfo,
  PlaybackPlan,
  ScanProgress
} from './types'

export interface PlayerPlanOptions {
  start?: number
  audio?: number
  maxHeight?: number
  deinterlace?: boolean
  hwDecode?: boolean
  forceTranscode?: boolean
}

export interface BetterVlcApi {
  baseUrl: string
  platform: string
  app: {
    info(): Promise<AppInfo>
  }
  window: {
    minimize(): Promise<void>
    maximize(): Promise<boolean>
    close(): Promise<void>
    isMaximized(): Promise<boolean>
    setFullscreen(value: boolean): Promise<boolean>
  }
  dialog: {
    openFiles(): Promise<string[]>
    openFolder(): Promise<string | null>
    openSubtitle(): Promise<string | null>
  }
  library: {
    get(): Promise<LibrarySnapshot>
    addFolder(folder: string): Promise<LibrarySnapshot>
    removeFolder(folder: string): Promise<LibrarySnapshot>
    removeItem(id: string): Promise<LibrarySnapshot>
    rescan(): Promise<LibrarySnapshot>
    reveal(file: string): Promise<void>
  }
  media: {
    probePaths(paths: string[]): Promise<MediaInfo[]>
    probeUrl(url: string): Promise<MediaInfo>
    openDropped(paths: string[]): Promise<{ items: MediaInfo[]; folders: string[] }>
    plan(id: string, options?: PlayerPlanOptions): Promise<PlaybackPlan>
    subtitleUrl(id: string, trackIndex: number): Promise<string | null>
    addSubtitle(file: string): Promise<ExternalSubtitle>
    saveSnapshot(dataUrl: string, suggested: string): Promise<string | null>
    sourceId(source: string): Promise<string>
  }
  paths: {
    forFile(file: File): string
  }
  on: {
    libraryProgress(cb: (progress: ScanProgress) => void): () => void
    libraryItem(cb: (item: MediaInfo) => void): () => void
    mediaKey(cb: (action: string) => void): () => void
    openPaths(cb: (paths: string[]) => void): () => void
    fullscreen(cb: (value: boolean) => void): () => void
  }
}

declare global {
  interface Window {
    api: BetterVlcApi
  }
}
