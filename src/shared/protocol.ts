import type { MediaKind } from './types'

/**
 * Wire vocabulary shared by the main process, the stream server and the
 * renderer. Nothing in here may import Node or Electron: the renderer bundles
 * this file too.
 */

export const STREAM_MIN_HEIGHT = 240
export const STREAM_MAX_HEIGHT = 2160
export const STREAM_DEFAULT_HEIGHT = 1080

export const BITMAP_SUBTITLE_CODECS = new Set([
  'hdmv_pgs_subtitle',
  'dvd_subtitle',
  'dvb_subtitle',
  'xsub'
])

export const NATIVE_VIDEO_CODECS = new Set(['h264', 'vp8', 'vp9', 'av1'])

export const NATIVE_AUDIO_CODECS = new Set(['aac', 'mp3', 'opus', 'vorbis'])

export const NATIVE_AUDIO_ONLY_CODECS = new Set([
  'mp3',
  'flac',
  'aac',
  'opus',
  'vorbis',
  'pcm_s16le',
  'pcm_s24le',
  'pcm_f32le',
  'pcm_s32le'
])

export const NATIVE_VIDEO_EXTENSIONS = new Set(['mp4', 'm4v', 'mov', 'webm'])

export const NATIVE_AUDIO_EXTENSIONS = new Set([
  'mp3',
  'flac',
  'wav',
  'm4a',
  'aac',
  'ogg',
  'oga',
  'opus'
])

export const MIME_BY_EXT: Record<string, string> = {
  mp4: 'video/mp4',
  m4v: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
  ogv: 'video/ogg',
  ogg: 'audio/ogg',
  oga: 'audio/ogg',
  opus: 'audio/ogg',
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  flac: 'audio/flac',
  wav: 'audio/wav',
  mkv: 'video/x-matroska',
  avi: 'video/x-msvideo'
}

export function extensionOf(file: string): string {
  const clean = file.split(/[?#]/, 1)[0]
  const slash = Math.max(clean.lastIndexOf('/'), clean.lastIndexOf('\\'))
  const dot = clean.lastIndexOf('.')
  return dot > slash ? clean.slice(dot + 1).toLowerCase() : ''
}

export function mimeForFile(file: string, kind?: MediaKind): string {
  const mime = MIME_BY_EXT[extensionOf(file)]
  if (mime) return mime
  if (kind === 'video') return 'video/mp4'
  if (kind === 'audio') return 'audio/mpeg'
  return 'application/octet-stream'
}

export interface StreamOptions {
  start: number
  audio: number
  maxHeight: number
  deinterlace: boolean
  hwDecode: boolean
  forceTranscode: boolean
}

export type StreamOptionInput = Partial<StreamOptions>

export function clampMaxHeight(value: number | string | null | undefined): number {
  const numeric = Number(value)
  const height = Number.isFinite(numeric) && numeric > 0 ? numeric : STREAM_DEFAULT_HEIGHT
  return Math.max(STREAM_MIN_HEIGHT, Math.min(height, STREAM_MAX_HEIGHT))
}

export function encodeStreamOptions(id: string, options: StreamOptionInput = {}): string {
  const params = new URLSearchParams()
  params.set('id', id)
  params.set('t', Math.max(Number(options.start ?? 0) || 0, 0).toFixed(3))
  params.set('a', String(Math.max(0, Math.floor(Number(options.audio ?? 0) || 0))))
  params.set('mh', String(clampMaxHeight(options.maxHeight)))
  params.set('di', options.deinterlace ? '1' : '0')
  params.set('hw', options.hwDecode === false ? '0' : '1')
  if (options.forceTranscode) params.set('tc', '1')
  return params.toString()
}

export function decodeStreamOptions(params: URLSearchParams, duration = 0): StreamOptions {
  const requested = Number(params.get('t') ?? 0) || 0
  const start =
    duration > 0
      ? Math.min(Math.max(requested, 0), Math.max(duration - 0.25, 0))
      : 0
  return {
    start,
    audio: Math.max(0, Math.floor(Number(params.get('a') ?? 0) || 0)),
    maxHeight: clampMaxHeight(params.get('mh')),
    deinterlace: params.get('di') === '1',
    hwDecode: params.get('hw') !== '0',
    forceTranscode: params.get('tc') === '1'
  }
}

export const Routes = {
  media: (id: string): string => `/media/${encodeURIComponent(id)}`,
  thumb: (name: string): string => `/thumb/${encodeURIComponent(name)}`,
  stream: (id: string, options?: StreamOptionInput): string =>
    `/stream?${encodeStreamOptions(id, options)}`,
  subtitle: (id: string, trackIndex: number): string =>
    `/subtitle/${encodeURIComponent(id)}/${trackIndex}`,
  externalSubtitle: (token: string): string => `/subtitle-ext/${encodeURIComponent(token)}`
}

/** Server-side matchers for the routes above. */
export const RoutePatterns = {
  media: /^\/media\/([^/]+)$/,
  thumb: /^\/thumb\/([^/]+)$/,
  subtitle: /^\/subtitle\/([^/]+)\/(\d+)$/,
  externalSubtitle: /^\/subtitle-ext\/([^/]+)$/,
  stream: '/stream'
}
