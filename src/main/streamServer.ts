import http from 'node:http'
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import path from 'node:path'
import fs from 'node:fs'
import crypto from 'node:crypto'
import { binaryPath, cacheDir } from './config'
import { getSource } from './registry'
import { thumbFileName } from './thumbnails'
import type { MediaInfo } from '../shared/types'

const MIME: Record<string, string> = {
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

interface SubtitleEntry {
  path: string
  embedded?: { id: string; index: number }
}

export class StreamServer {
  private server: http.Server | null = null
  private port = 0
  private children = new Set<ChildProcessWithoutNullStreams>()
  private externalSubtitles = new Map<string, SubtitleEntry>()
  private subtitleJobs = new Map<string, Promise<string>>()

  async start(): Promise<number> {
    if (this.server) return this.port
    this.server = http.createServer((req, res) => {
      this.handle(req, res).catch((error) => {
        console.error('Stream request failed', error)
        if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'text/plain' })
        res.end('Playback error')
      })
    })
    await new Promise<void>((resolve, reject) => {
      this.server!.once('error', reject)
      this.server!.listen(0, '127.0.0.1', () => resolve())
    })
    const address = this.server.address()
    this.port = typeof address === 'object' && address ? address.port : 0
    return this.port
  }

  get baseUrl(): string {
    return `http://127.0.0.1:${this.port}`
  }

  private async handle(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const url = new URL(req.url ?? '/', this.baseUrl)
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin')
    res.setHeader('Access-Control-Allow-Headers', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
    if (req.method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
      return
    }

    if (url.pathname.startsWith('/media/')) {
      const id = url.pathname.slice('/media/'.length)
      const info = getSource(id)
      if (!info || info.isStream) return notFound(res)
      return this.serveFile(req, res, info.path, MIME[ext(info.path)] ?? 'application/octet-stream')
    }

    if (url.pathname.startsWith('/thumb/')) {
      const name = path.basename(url.pathname.slice('/thumb/'.length))
      const file = path.join(cacheDir('thumbs'), name)
      if (!name.endsWith('.jpg') || !fs.existsSync(file)) return notFound(res)
      return this.serveFile(req, res, file, 'image/jpeg')
    }

    if (url.pathname === '/stream') {
      const id = url.searchParams.get('id') ?? ''
      const info = getSource(id)
      if (!info) return notFound(res)
      return this.streamMedia(req, res, info, url.searchParams)
    }

    if (url.pathname.startsWith('/subtitle/')) {
      const parts = url.pathname.split('/').filter(Boolean)
      const id = parts[1]
      const track = Number(parts[2])
      const info = getSource(id)
      if (!info) return notFound(res)
      return this.serveSubtitle(res, info, track)
    }

    if (url.pathname.startsWith('/subtitle-ext/')) {
      const token = url.pathname.split('/')[2]
      const entry = this.externalSubtitles.get(token)
      if (!entry) return notFound(res)
      return this.serveSubtitleFile(res, entry.path)
    }

    notFound(res)
  }

  private serveFile(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    file: string,
    type: string
  ): void {
    let stat: fs.Stats
    try {
      stat = fs.statSync(file)
    } catch {
      return notFound(res)
    }
    const size = stat.size
    const range = req.headers.range
    res.setHeader('Accept-Ranges', 'bytes')
    res.setHeader('Content-Type', type)
    if (range) {
      const match = /bytes=(\d*)-(\d*)/.exec(range)
      let start = match?.[1] ? Number(match[1]) : 0
      let end = match?.[2] ? Number(match[2]) : size - 1
      if (!match?.[1] && match?.[2]) {
        start = Math.max(size - Number(match[2]), 0)
        end = size - 1
      }
      if (start >= size || end < start) {
        res.writeHead(416, { 'Content-Range': `bytes */${size}` })
        res.end()
        return
      }
      end = Math.min(end, size - 1)
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${size}`,
        'Content-Length': end - start + 1
      })
      fs.createReadStream(file, { start, end }).pipe(res)
    } else {
      res.writeHead(200, { 'Content-Length': size })
      fs.createReadStream(file).pipe(res)
    }
  }

  private streamMedia(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    info: MediaInfo,
    params: URLSearchParams
  ): void {
    const duration = info.duration || 0
    const requested = Number(params.get('t') ?? 0) || 0
    const start = duration > 0 ? Math.min(Math.max(requested, 0), Math.max(duration - 0.25, 0)) : 0
    const audioIndex = Number(params.get('a') ?? 0)
    const maxHeight = Math.max(240, Math.min(Number(params.get('mh') ?? 1080) || 1080, 2160))
    const deinterlace = params.get('di') === '1'
    const hw = params.get('hw') !== '0'
    const forceTranscode = params.get('tc') === '1'

    const args = ['-hide_banner', '-loglevel', 'error']
    const inputSeek = start > 0 ? Math.max(0, start - 6) : 0
    if (inputSeek > 0) args.push('-ss', inputSeek.toFixed(3))
    if (info.isStream) {
      if (/^rtsp:/i.test(info.path)) args.push('-rtsp_transport', 'tcp')
      if (/^https?:/i.test(info.path)) {
        args.push(
          '-reconnect', '1',
          '-reconnect_streamed', '1',
          '-reconnect_delay_max', '5',
          '-user_agent', 'BetterVLC/1.0'
        )
      }
    }
    args.push('-i', info.path)
    if (start > 0 && !info.isStream) {
      const trim = start - inputSeek
      if (trim > 0.05) args.push('-ss', trim.toFixed(3))
    }

    const hasVideo = info.kind === 'video'
    const hasAudio = info.audioTracks.length > 0
    if (hasVideo) args.push('-map', '0:v:0')
    if (hasAudio) {
      const idx = Math.min(Math.max(audioIndex, 0), info.audioTracks.length - 1)
      args.push('-map', `0:a:${idx}`)
    }
    args.push('-sn', '-dn', '-map_metadata', '-1')

    if (hasVideo) {
      const copy = info.videoCopy && !deinterlace && !info.hdr && !forceTranscode
      const filters: string[] = []
      if (deinterlace) filters.push('yadif=deint=interlaced')
      if (!copy) {
        filters.push(`scale=-2:'min(${maxHeight},ih)'`)
        if (hw) filters.push('format=yuv420p')
      }
      if (copy) {
        args.push('-c:v', 'copy')
      } else {
        args.push(
          '-c:v', 'libx264',
          '-preset', 'veryfast',
          '-crf', '21',
          '-profile:v', 'high',
          '-level', '4.1',
          '-g', '48',
          '-keyint_min', '48',
          '-sc_threshold', '0',
          '-pix_fmt', 'yuv420p'
        )
        if (filters.length) args.push('-vf', filters.join(','))
      }
    } else {
      args.push('-vn')
    }

    if (hasAudio) {
      args.push('-c:a', 'aac', '-b:a', '192k', '-ac', '2')
    } else {
      args.push('-an')
    }

    args.push(
      '-movflags', '+frag_keyframe+empty_moov+default_base_moof',
      '-avoid_negative_ts', 'make_zero',
      '-f', 'mp4',
      'pipe:1'
    )

    res.writeHead(200, {
      'Content-Type': 'video/mp4',
      'Cache-Control': 'no-store',
      'X-Accel-Buffering': 'no'
    })

    const child = spawn(binaryPath('ffmpeg'), args, { windowsHide: true })
    this.children.add(child)
    let stderr = ''
    child.stdout.pipe(res)
    child.stderr.on('data', (d) => {
      stderr += d.toString()
      if (stderr.length > 8000) stderr = stderr.slice(-8000)
    })
    child.on('error', () => {
      this.children.delete(child)
      res.destroy()
    })
    child.on('close', (code) => {
      this.children.delete(child)
      if (code !== 0 && stderr.trim()) console.warn('ffmpeg stream ended:', stderr.trim().split('\n').slice(-3).join(' | '))
      if (!res.writableEnded) res.end()
    })
    const abort = () => {
      if (!child.killed) child.kill('SIGKILL')
    }
    req.on('close', abort)
    res.on('close', abort)
  }

  registerExternalSubtitle(file: string): { token: string; name: string } {
    const resolved = path.resolve(file)
    if (!fs.existsSync(resolved)) throw new Error('Subtitle file not found')
    const token = crypto.randomBytes(8).toString('hex')
    this.externalSubtitles.set(token, { path: resolved })
    return { token, name: path.basename(resolved) }
  }

  private async serveSubtitle(
    res: http.ServerResponse,
    info: MediaInfo,
    trackIndex: number
  ): Promise<void> {
    const track = info.subtitleTracks.find((t) => t.index === trackIndex)
    if (!track) return notFound(res)
    if (track.external && track.token) {
      const entry = this.externalSubtitles.get(track.token)
      if (!entry) return notFound(res)
      return this.serveSubtitleFile(res, entry.path)
    }
    if (info.isStream) {
      res.writeHead(400, { 'Content-Type': 'text/plain' })
      res.end('Embedded subtitles are not available for live streams')
      return
    }
    if (['hdmv_pgs_subtitle', 'dvd_subtitle', 'dvb_subtitle', 'xsub'].includes(track.codec)) {
      res.writeHead(415, { 'Content-Type': 'text/plain' })
      res.end('Bitmap subtitles cannot be converted to text')
      return
    }

    const cacheKey = `${info.id}-${track.index}-${Math.round(info.mtime)}.vtt`
    const cacheFile = path.join(cacheDir('subs'), cacheKey)
    if (!fs.existsSync(cacheFile)) {
      const jobKey = cacheFile
      let job = this.subtitleJobs.get(jobKey)
      if (!job) {
        job = new Promise<string>((resolve, reject) => {
          const args = [
            '-hide_banner', '-loglevel', 'error', '-y',
            '-i', info.path,
            '-map', `0:s:${track.index}`,
            '-f', 'webvtt',
            cacheFile
          ]
          const child = spawn(binaryPath('ffmpeg'), args, { windowsHide: true })
          let err = ''
          child.stderr.on('data', (d) => (err += d.toString()))
          child.on('error', reject)
          child.on('close', (code) => {
            if (code === 0 && fs.existsSync(cacheFile)) resolve(cacheFile)
            else reject(new Error(err.trim() || 'Could not extract subtitles'))
          })
        }).finally(() => this.subtitleJobs.delete(jobKey))
        this.subtitleJobs.set(jobKey, job)
      }
      try {
        await job
      } catch {
        res.writeHead(500, { 'Content-Type': 'text/plain' })
        res.end('Could not extract subtitles')
        return
      }
    }
    this.serveFile({ headers: {} } as http.IncomingMessage, res, cacheFile, 'text/vtt; charset=utf-8')
  }

  private async serveSubtitleFile(res: http.ServerResponse, file: string): Promise<void> {
    const extName = ext(file)
    if (extName === 'vtt') {
      return this.serveFile({ headers: {} } as http.IncomingMessage, res, file, 'text/vtt; charset=utf-8')
    }
    const stat = fs.statSync(file)
    const key = crypto
      .createHash('sha1')
      .update(`${file}:${stat.mtimeMs}:${stat.size}`)
      .digest('hex')
      .slice(0, 16)
    const cacheFile = path.join(cacheDir('subs'), `${key}.vtt`)
    if (!fs.existsSync(cacheFile)) {
      try {
        await new Promise<void>((resolve, reject) => {
          const child = spawn(
            binaryPath('ffmpeg'),
            ['-hide_banner', '-loglevel', 'error', '-y', '-i', file, '-f', 'webvtt', cacheFile],
            { windowsHide: true }
          )
          let err = ''
          child.stderr.on('data', (d) => (err += d.toString()))
          child.on('error', reject)
          child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(err || 'Subtitle conversion failed'))))
        })
      } catch {
        res.writeHead(500, { 'Content-Type': 'text/plain' })
        res.end('Could not convert subtitles')
        return
      }
    }
    this.serveFile({ headers: {} } as http.IncomingMessage, res, cacheFile, 'text/vtt; charset=utf-8')
  }

  async stop(): Promise<void> {
    for (const child of this.children) child.kill('SIGKILL')
    this.children.clear()
    if (this.server) {
      await new Promise<void>((resolve) => this.server!.close(() => resolve()))
      this.server = null
    }
  }
}

function ext(file: string): string {
  return path.extname(file).slice(1).toLowerCase()
}

function notFound(res: http.ServerResponse): void {
  res.writeHead(404, { 'Content-Type': 'text/plain' })
  res.end('Not found')
}

export function thumbUrlFor(baseUrl: string, info: MediaInfo): string | undefined {
  return info.thumb ? `${baseUrl}/thumb/${thumbFileName(info)}` : undefined
}
