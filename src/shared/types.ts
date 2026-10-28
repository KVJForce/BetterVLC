export type MediaKind = 'video' | 'audio'

export interface AudioTrackInfo {
  index: number
  codec: string
  channels: number
  channelLayout?: string
  language?: string
  title?: string
  bitrate?: number
  sampleRate?: number
  default?: boolean
}

export interface SubtitleTrackInfo {
  index: number
  codec: string
  language?: string
  title?: string
  forced?: boolean
  default?: boolean
  external?: boolean
  token?: string
  path?: string
}

export interface ChapterInfo {
  start: number
  end: number
  title: string
}

export interface MediaTags {
  title?: string
  artist?: string
  album?: string
  genre?: string
  date?: string
  comment?: string
}

export interface MediaInfo {
  id: string
  path: string
  name: string
  title: string
  kind: MediaKind
  isStream: boolean
  duration: number
  size: number
  bitrate: number
  container: string
  formatLong: string
  width?: number
  height?: number
  fps?: number
  videoCodec?: string
  videoProfile?: string
  videoLevel?: number
  pixFmt?: string
  hdr?: boolean
  audioTracks: AudioTrackInfo[]
  subtitleTracks: SubtitleTrackInfo[]
  chapters: ChapterInfo[]
  nativePlayable: boolean
  mseMime: string
  videoCopy: boolean
  codecString: string
  thumb?: string
  cover?: string
  folder?: string
  mtime: number
  addedAt: number
  tags?: MediaTags
}

export interface ScanProgress {
  phase: 'scanning' | 'probing' | 'thumbnails' | 'done'
  done: number
  total: number
  current?: string
}

export interface LibrarySnapshot {
  folders: string[]
  items: MediaInfo[]
}

export interface PlaybackPlan {
  mode: 'native' | 'mse'
  url: string
  mime: string
  duration: number
  baseTime: number
}

export interface StreamOptions {
  id: string
  start: number
  audio: number
  maxHeight: number
  hwDecode: boolean
  deinterlace: boolean
}

export interface ExternalSubtitle {
  token: string
  name: string
  path: string
}

export interface AppInfo {
  version: string
  electron: string
  platform: string
  ffmpeg: string
}
