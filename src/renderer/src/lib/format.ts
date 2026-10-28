export function formatTime(value: number, forceHours = false): string {
  if (!Number.isFinite(value) || value < 0) value = 0
  const total = Math.floor(value)
  const seconds = total % 60
  const minutes = Math.floor(total / 60) % 60
  const hours = Math.floor(total / 3600)
  if (hours > 0 || forceHours) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

export function formatClock(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return 'Live'
  return formatTime(value)
}

export function formatBytes(bytes: number): string {
  if (!bytes) return '—'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let index = 0
  let value = bytes
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024
    index += 1
  }
  return `${value >= 10 || index === 0 ? Math.round(value) : value.toFixed(1)} ${units[index]}`
}

export function formatBitrate(bits: number): string {
  if (!bits) return '—'
  if (bits >= 1_000_000) return `${(bits / 1_000_000).toFixed(1)} Mbps`
  return `${Math.round(bits / 1000)} kbps`
}

export function formatDate(timestamp: number): string {
  if (!timestamp) return ''
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: new Date(timestamp).getFullYear() === new Date().getFullYear() ? undefined : 'numeric'
  })
}

export function resolutionLabel(width?: number, height?: number): string | null {
  if (!width || !height) return null
  if (height >= 2160) return '4K'
  if (height >= 1440) return '1440p'
  if (height >= 1080) return '1080p'
  if (height >= 720) return '720p'
  return `${width}×${height}`
}

export function codecLabel(codec?: string): string {
  if (!codec) return '—'
  const map: Record<string, string> = {
    h264: 'H.264', hevc: 'HEVC', h265: 'HEVC', av1: 'AV1', vp8: 'VP8', vp9: 'VP9',
    mpeg4: 'MPEG-4', mpeg2video: 'MPEG-2', vc1: 'VC-1', wmv3: 'WMV', theora: 'Theora',
    aac: 'AAC', mp3: 'MP3', ac3: 'AC-3', eac3: 'E-AC-3', dts: 'DTS', truehd: 'TrueHD',
    flac: 'FLAC', opus: 'Opus', vorbis: 'Vorbis', pcm_s16le: 'PCM', alac: 'ALAC',
    subrip: 'SRT', ass: 'ASS', webvtt: 'VTT', hdmv_pgs_subtitle: 'PGS', dvd_subtitle: 'VobSub'
  }
  return map[codec.toLowerCase()] ?? codec.toUpperCase()
}

export function containerLabel(container: string): string {
  const first = container.split(',')[0] ?? container
  const map: Record<string, string> = {
    matroska: 'MKV', 'matroska,webm': 'MKV', mov: 'MOV', mp4: 'MP4', avi: 'AVI',
    mpegts: 'TS', mpeg: 'MPEG', asf: 'ASF', flv: 'FLV', ogg: 'OGG', wav: 'WAV',
    mp3: 'MP3', flac: 'FLAC'
  }
  return map[first] ?? first.toUpperCase()
}

export function audioLabel(codec: string, channels: number): string {
  const layout = channels === 1 ? 'Mono' : channels === 2 ? 'Stereo' : `${channels} channels`
  return `${codecLabel(codec)} · ${layout}`
}

export function languageName(code?: string): string {
  if (!code) return 'Unknown'
  try {
    const display = new Intl.DisplayNames(['en'], { type: 'language' })
    return display.of(code) ?? code.toUpperCase()
  } catch {
    return code.toUpperCase()
  }
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export function totalDuration(items: { duration: number }[]): number {
  return items.reduce((sum, item) => sum + (item.duration || 0), 0)
}
