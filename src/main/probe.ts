import { spawn } from 'node:child_process'
import path from 'node:path'
import fs from 'node:fs'
import crypto from 'node:crypto'
import { binaryPath } from './config'
import type {
  AudioTrackInfo,
  ChapterInfo,
  MediaInfo,
  MediaKind,
  SubtitleTrackInfo
} from '../shared/types'

interface ProbeStream {
  index: number
  codec_type?: string
  codec_name?: string
  codec_long_name?: string
  profile?: string
  level?: number
  width?: number
  height?: number
  pix_fmt?: string
  bit_rate?: string
  sample_rate?: string
  channels?: number
  channel_layout?: string
  r_frame_rate?: string
  avg_frame_rate?: string
  duration?: string
  display_aspect_ratio?: string
  color_transfer?: string
  color_primaries?: string
  color_space?: string
  tags?: Record<string, string>
  disposition?: Record<string, number>
  side_data_list?: Array<Record<string, unknown>>
}

interface ProbeChapter {
  start_time?: string
  end_time?: string
  tags?: Record<string, string>
}

interface ProbeResult {
  streams?: ProbeStream[]
  format?: {
    filename?: string
    format_name?: string
    format_long_name?: string
    duration?: string
    size?: string
    bit_rate?: string
    tags?: Record<string, string>
  }
  chapters?: ProbeChapter[]
}

const LOCAL_CACHE = new Map<string, { key: string; info: MediaInfo }>()

export function sourceId(source: string): string {
  return crypto.createHash('sha1').update(source).digest('hex').slice(0, 16)
}

export function cleanTitle(name: string): string {
  const base = path.basename(name, path.extname(name))
  return base
    .replace(/[._]+/g, ' ')
    .replace(/\s*-\s*/g, ' - ')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function parseRate(rate?: string): number | undefined {
  if (!rate) return undefined
  const [a, b] = rate.split('/').map(Number)
  if (!a || !b) return undefined
  return a / b
}

function parseTags(tags?: Record<string, string>): Record<string, string> {
  if (!tags) return {}
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(tags)) {
    if (typeof value === 'string' && value.trim()) out[key.toLowerCase()] = value.trim()
  }
  return out
}

function pickTag(tags: Record<string, string>, ...keys: string[]): string | undefined {
  for (const key of keys) if (tags[key]) return tags[key]
  return undefined
}

const NATIVE_VIDEO_CODECS = new Set(['h264', 'vp8', 'vp9', 'av1'])
const NATIVE_AUDIO_CODECS = new Set(['aac', 'mp3', 'opus', 'vorbis'])
const NATIVE_AUDIO_ONLY = new Set(['mp3', 'flac', 'aac', 'opus', 'vorbis', 'pcm_s16le', 'pcm_s24le', 'pcm_f32le', 'pcm_s32le'])
const NATIVE_AUDIO_EXT = new Set(['mp3', 'flac', 'wav', 'm4a', 'aac', 'ogg', 'oga', 'opus'])

export function avcCodecString(profile?: string, level?: number): string | null {
  if (!profile) return null
  let p: string | null = null
  if (/baseline/i.test(profile)) p = '42'
  else if (/main/i.test(profile)) p = '4d'
  else if (/high/i.test(profile) && !/10|4:2:2|4:4:4/i.test(profile)) p = '64'
  if (!p) return null
  const lvl = level && level > 0 ? level.toString(16).padStart(2, '0') : '1f'
  return `avc1.${p}00${lvl}`
}

function isH264Copyable(stream?: ProbeStream): boolean {
  if (!stream || stream.codec_name !== 'h264') return false
  const pix = (stream.pix_fmt || '').toLowerCase()
  if (pix && !['yuv420p', 'yuvj420p', 'nv12'].includes(pix)) return false
  return avcCodecString(stream.profile, stream.level) !== null
}

export function probeMedia(
  source: string,
  options: { isStream?: boolean; timeoutMs?: number } = {}
): Promise<MediaInfo> {
  const isStream = !!options.isStream
  const stat = !isStream && fs.existsSync(source) ? fs.statSync(source) : null
  const cacheKey = stat ? `${stat.mtimeMs}:${stat.size}` : ''
  const cached = LOCAL_CACHE.get(source)
  if (!isStream && cached && cached.key === cacheKey) return Promise.resolve(cached.info)

  return new Promise((resolve, reject) => {
    const args = [
      '-hide_banner',
      '-v', 'error',
      '-print_format', 'json',
      '-show_format',
      '-show_streams',
      '-show_chapters'
    ]
    if (isStream) {
      args.push('-analyzeduration', '12M', '-probesize', '12M')
      if (/^rtsp:/i.test(source)) args.push('-rtsp_transport', 'tcp')
      args.push('-rw_timeout', '15000000')
    }
    args.push('-i', source)

    const child = spawn(binaryPath('ffprobe'), args, { windowsHide: true })
    let out = ''
    let err = ''
    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      reject(new Error('Timed out while reading media information'))
    }, options.timeoutMs ?? (isStream ? 20000 : 30000))

    child.stdout.on('data', (d) => (out += d.toString()))
    child.stderr.on('data', (d) => (err += d.toString()))
    child.on('error', (e) => {
      clearTimeout(timer)
      reject(e)
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      if (code !== 0 && !out) {
        reject(new Error(err.trim() || `ffprobe exited with code ${code}`))
        return
      }
      try {
        resolve(buildInfo(source, JSON.parse(out) as ProbeResult, isStream, stat))
      } catch (e) {
        reject(e)
      }
    })
  })
}

function buildInfo(
  source: string,
  data: ProbeResult,
  isStream: boolean,
  stat: fs.Stats | null
): MediaInfo {
  const streams = data.streams ?? []
  const format = data.format ?? {}
  const formatTags = parseTags(format.tags)
  const video = streams.find(
    (s) => s.codec_type === 'video' && !(s.disposition?.attached_pic === 1)
  )
  const cover = streams.find(
    (s) => s.codec_type === 'video' && s.disposition?.attached_pic === 1
  )
  const audioStreams = streams.filter((s) => s.codec_type === 'audio')
  const subtitleStreams = streams.filter((s) => s.codec_type === 'subtitle')
  const kind: MediaKind = video ? 'video' : 'audio'

  const audioTracks: AudioTrackInfo[] = audioStreams.map((s, index) => {
    const tags = parseTags(s.tags)
    return {
      index,
      codec: s.codec_name ?? 'unknown',
      channels: s.channels ?? 2,
      channelLayout: s.channel_layout,
      language: pickTag(tags, 'language', 'lang'),
      title: pickTag(tags, 'title', 'handler_name'),
      bitrate: s.bit_rate ? Number(s.bit_rate) : undefined,
      sampleRate: s.sample_rate ? Number(s.sample_rate) : undefined,
      default: s.disposition?.default === 1
    }
  })

  const subtitleTracks: SubtitleTrackInfo[] = subtitleStreams.map((s, index) => {
    const tags = parseTags(s.tags)
    return {
      index,
      codec: s.codec_name ?? 'unknown',
      language: pickTag(tags, 'language', 'lang'),
      title: pickTag(tags, 'title', 'handler_name'),
      forced: s.disposition?.forced === 1,
      default: s.disposition?.default === 1
    }
  })

  const chapters: ChapterInfo[] = (data.chapters ?? []).map((c, i) => ({
    start: Number(c.start_time ?? 0),
    end: Number(c.end_time ?? 0),
    title: pickTag(parseTags(c.tags), 'title') ?? `Chapter ${i + 1}`
  }))

  const ext = path.extname(source).slice(1).toLowerCase()
  const rawContainer = format.format_name ?? ext ?? 'unknown'
  const container = ext === 'webm' && rawContainer.includes('webm') ? 'webm' : rawContainer
  const duration = Number(format.duration ?? video?.duration ?? 0) || 0
  const size = Number(format.size ?? stat?.size ?? 0) || 0
  const bitrate = Number(format.bit_rate ?? 0) || 0
  const fps = parseRate(video?.avg_frame_rate) || parseRate(video?.r_frame_rate)

  const videoCodec = video?.codec_name
  const audioCodecs = audioTracks.map((a) => a.codec)
  const audioCompatible = audioCodecs.every((c) => NATIVE_AUDIO_CODECS.has(c))

  let nativePlayable = false
  if (!isStream) {
    if (kind === 'video') {
      nativePlayable =
        ['mp4', 'm4v', 'mov', 'webm'].includes(ext) &&
        !!videoCodec &&
        NATIVE_VIDEO_CODECS.has(videoCodec) &&
        (videoCodec !== 'h264' || isH264Copyable(video)) &&
        audioCompatible &&
        audioTracks.length <= 1
    } else {
      nativePlayable =
        NATIVE_AUDIO_EXT.has(ext) &&
        audioTracks.length <= 1 &&
        NATIVE_AUDIO_ONLY.has(audioTracks[0]?.codec ?? '')
    }
  }

  const copyVideo = !!video && isH264Copyable(video) && !isHdr(video)
  const videoCodecString = copyVideo
    ? avcCodecString(video?.profile, video?.level) ?? 'avc1.640029'
    : 'avc1.640029'
  const hasAudio = audioTracks.length > 0
  const codecString = hasAudio ? `${videoCodecString},mp4a.40.2` : videoCodecString
  const mseMime =
    kind === 'video' ? `video/mp4; codecs="${codecString}"` : 'audio/mp4; codecs="mp4a.40.2"'

  const title =
    pickTag(formatTags, 'title') ??
    pickTag(parseTags(video?.tags), 'title') ??
    cleanTitle(path.basename(source)) ??
    source

  const info: MediaInfo = {
    id: sourceId(source),
    path: source,
    name: isStream ? title : path.basename(source),
    title,
    kind,
    isStream,
    duration,
    size,
    bitrate,
    container,
    formatLong: format.format_long_name ?? format.format_name ?? 'Unknown format',
    width: video?.width,
    height: video?.height,
    fps,
    videoCodec,
    videoProfile: video?.profile,
    videoLevel: video?.level,
    pixFmt: video?.pix_fmt,
    hdr: video ? isHdr(video) : false,
    audioTracks,
    subtitleTracks,
    chapters,
    nativePlayable,
    mseMime,
    videoCopy: copyVideo,
    codecString,
    folder: isStream ? undefined : path.dirname(source),
    mtime: stat?.mtimeMs ?? 0,
    addedAt: Date.now(),
    tags: {
      title: pickTag(formatTags, 'title'),
      artist: pickTag(formatTags, 'artist', 'album_artist', 'performer'),
      album: pickTag(formatTags, 'album'),
      genre: pickTag(formatTags, 'genre'),
      date: pickTag(formatTags, 'date', 'year'),
      comment: pickTag(formatTags, 'comment', 'description')
    },
    cover: cover ? source : undefined
  }
  if (!isStream && stat) LOCAL_CACHE.set(source, { key: `${stat.mtimeMs}:${stat.size}`, info })
  return info
}

function isHdr(stream: ProbeStream): boolean {
  const transfer = (stream.color_transfer ?? '').toLowerCase()
  if (transfer === 'smpte2084' || transfer === 'arib-std-b67') return true
  return (stream.side_data_list ?? []).some((s) =>
    String(s.side_data_type ?? '').toLowerCase().includes('mastering')
  )
}

export function mergeExternalSubtitle(
  info: MediaInfo,
  subtitle: { token: string; name: string; path: string }
): MediaInfo {
  const ext = path.extname(subtitle.path).slice(1).toLowerCase()
  const track: SubtitleTrackInfo = {
    index: 1000 + info.subtitleTracks.length,
    codec: ext || 'subtitle',
    title: subtitle.name,
    external: true,
    token: subtitle.token,
    path: subtitle.path
  }
  return { ...info, subtitleTracks: [...info.subtitleTracks, track] }
}

export function findEmbeddedSubtitlePath(info: MediaInfo, index: number): string | null {
  return info.subtitleTracks.find((s) => s.index === index)?.path ?? null
}
