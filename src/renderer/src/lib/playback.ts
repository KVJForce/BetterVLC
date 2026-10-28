import type { MediaInfo, PlaybackPlan } from '../../../shared/types'
import { cueAt, parseVtt, type Cue } from './subtitles'
import { clamp } from './format'

export interface PlaybackSnapshot {
  playing: boolean
  buffering: boolean
  loading: boolean
  time: number
  duration: number
  mode: 'native' | 'mse' | null
  error: string | null
  rate: number
}

interface PlaybackOptions {
  maxHeight: number
  deinterlace: boolean
  hwDecode: boolean
}

interface MseSession {
  token: number
  abort: AbortController
  reader?: ReadableStreamDefaultReader<Uint8Array>
  sourceBuffer?: SourceBuffer
  mediaSource?: MediaSource
  objectUrl?: string
  queue: Uint8Array[]
  pending: Uint8Array
  initSent: boolean
  appending: boolean
  cleaning: boolean
  finished: boolean
  started: boolean
  baseTime: number
  mime: string
  url: string
}

const EMPTY = new Uint8Array(0)

export class PlaybackController {
  video: HTMLVideoElement | null = null
  item: MediaInfo | null = null
  mode: 'native' | 'mse' | null = null
  onState: ((snapshot: PlaybackSnapshot) => void) | null = null
  onCue: ((cue: Cue | null) => void) | null = null
  onEnded: (() => void) | null = null
  onProgress: ((time: number, duration: number) => void) | null = null
  onError: ((message: string) => void) | null = null
  onSubtitleError: ((message: string) => void) | null = null

  private options: PlaybackOptions = { maxHeight: 1080, deinterlace: false, hwDecode: true }
  private baseTime = 0
  private duration = 0
  private playingIntent = false
  private rate = 1
  private volume = 0.8
  private muted = false
  private audioIndex = 0
  private cues: Cue[] = []
  private activeCue: Cue | null = null
  private subtitleDelay = 0
  private abLoop: { a: number | null; b: number | null } = { a: null, b: null }
  private eq: { enabled: boolean; bands: number[] } = { enabled: false, bands: [] }
  private mse: MseSession | null = null
  private raf = 0
  private lastEmit = 0
  private lastProgress = 0
  private lastCue: Cue | null = null
  private audioContext: AudioContext | null = null
  private sourceNode: MediaElementAudioSourceNode | null = null
  private gainNode: GainNode | null = null
  private filterNodes: BiquadFilterNode[] = []
  private analyserNode: AnalyserNode | null = null
  private attached = false
  private nativeStart = 0
  private triedTranscode = false
  private audioOnly = false
  private error: string | null = null
  private suppressProgress = false

  attach(video: HTMLVideoElement): void {
    if (this.video === video) return
    this.detach()
    this.video = video
    video.crossOrigin = 'anonymous'
    video.preload = 'auto'
    video.addEventListener('play', this.handlePlay)
    video.addEventListener('pause', this.handlePause)
    video.addEventListener('waiting', this.handleWaiting)
    video.addEventListener('playing', this.handlePlaying)
    video.addEventListener('canplay', this.handlePlaying)
    video.addEventListener('ended', this.handleEnded)
    video.addEventListener('error', this.handleVideoError)
    video.addEventListener('loadedmetadata', this.handleLoadedMetadata)
    this.attached = true
    this.ensureAudio()
    this.applyVolume()
    this.applyEq()
  }

  private detach(): void {
    if (!this.video || !this.attached) return
    const video = this.video
    video.removeEventListener('play', this.handlePlay)
    video.removeEventListener('pause', this.handlePause)
    video.removeEventListener('waiting', this.handleWaiting)
    video.removeEventListener('playing', this.handlePlaying)
    video.removeEventListener('canplay', this.handlePlaying)
    video.removeEventListener('ended', this.handleEnded)
    video.removeEventListener('error', this.handleVideoError)
    video.removeEventListener('loadedmetadata', this.handleLoadedMetadata)
    this.attached = false
  }

  configure(options: PlaybackOptions): void {
    this.options = options
  }

  setAudioOnly(value: boolean): void {
    this.audioOnly = value
  }

  async open(item: MediaInfo, opts: { start?: number; audio?: number; autoplay?: boolean } = {}): Promise<void> {
    this.suppressProgress = true
    this.item = item
    this.audioOnly = item.kind === 'audio'
    this.audioIndex = opts.audio ?? 0
    this.triedTranscode = false
    this.error = null
    this.clearSubtitle()
    this.duration = item.duration
    this.playingIntent = opts.autoplay !== false
    this.emit({ loading: true, error: null, time: opts.start ?? 0, duration: this.duration })
    this.suppressProgress = false
    await this.loadAt(opts.start ?? 0, this.playingIntent)
  }

  private async loadAt(start: number, autoplay: boolean, forceTranscode = false): Promise<void> {
    if (!this.video || !this.item) return
    const item = this.item
    this.suppressProgress = true
    this.stopSession()
    this.baseTime = start
    this.playingIntent = autoplay
    this.video.pause()
    this.error = null
    this.emit({ time: start, duration: this.duration, buffering: true, loading: true, error: null })
    this.suppressProgress = false

    let plan: PlaybackPlan
    try {
      plan = await window.api.media.plan(item.id, {
        start,
        audio: this.audioIndex,
        maxHeight: this.options.maxHeight,
        deinterlace: this.options.deinterlace,
        hwDecode: this.options.hwDecode,
        forceTranscode
      })
    } catch (error) {
      this.fail(error instanceof Error ? error.message : 'Could not prepare playback')
      return
    }

    if (!this.video) return
    if (plan.mode === 'native') {
      this.mode = 'native'
      this.nativeStart = start
      this.video.src = plan.url
      this.video.load()
      this.video.playbackRate = this.rate
      this.emit({ mode: 'native', time: start, duration: plan.duration || this.duration })
      if (autoplay) {
        // Playback begins from loadedmetadata so the seek lands first.
      }
      return
    }

    if (!('MediaSource' in window) || !MediaSource.isTypeSupported(plan.mime)) {
      if (!forceTranscode) {
        return this.loadAt(start, autoplay, true)
      }
      this.fail('This media uses a codec that is not supported on this system.')
      return
    }

    this.mode = 'mse'
    await this.startMse(plan, autoplay)
  }

  private async startMse(plan: PlaybackPlan, autoplay: boolean): Promise<void> {
    if (!this.video) return
    const token = Date.now() + Math.random()
    const session: MseSession = {
      token,
      abort: new AbortController(),
      queue: [],
      pending: EMPTY,
      initSent: false,
      appending: false,
      cleaning: false,
      finished: false,
      started: false,
      baseTime: plan.baseTime,
      mime: plan.mime,
      url: plan.url
    }
    this.mse = session
    this.baseTime = plan.baseTime
    this.triedTranscode = false
    const mediaSource = new MediaSource()
    session.mediaSource = mediaSource
    const objectUrl = URL.createObjectURL(mediaSource)
    session.objectUrl = objectUrl
    this.video.src = objectUrl
    this.video.playbackRate = this.rate

    const opened = await new Promise<boolean>((resolve) => {
      const timer = window.setTimeout(() => resolve(false), 8000)
      mediaSource.addEventListener(
        'sourceopen',
        () => {
          window.clearTimeout(timer)
          resolve(true)
        },
        { once: true }
      )
    })
    if (!opened || session.token !== this.mse?.token) {
      this.fail('The media pipeline did not start in time.')
      return
    }

    try {
      const buffer = mediaSource.addSourceBuffer(plan.mime)
      session.sourceBuffer = buffer
      buffer.addEventListener('updateend', () => this.handleUpdateEnd(session))
      buffer.addEventListener('error', () => this.handleMseFailure(session, 'The decoder rejected this stream.'))
      if (plan.duration > 0) {
        try {
          mediaSource.duration = Math.max(plan.duration - plan.baseTime, 0.5)
        } catch {
          /* duration is best-effort */
        }
      }
    } catch (error) {
      this.handleMseFailure(session, error instanceof Error ? error.message : 'Could not create the decoder')
      return
    }

    this.emit({ mode: 'mse', time: plan.baseTime, duration: plan.duration || this.duration, buffering: true })
    void this.readStream(session, autoplay)
  }

  private async readStream(session: MseSession, autoplay: boolean): Promise<void> {
    try {
      const response = await fetch(session.url, { signal: session.abort.signal, cache: 'no-store' })
      if (!response.ok || !response.body) throw new Error(`Stream failed with status ${response.status}`)
      const reader = response.body.getReader()
      session.reader = reader
      if (autoplay) this.play()

      const startupTimer = window.setTimeout(() => {
        if (!session.started) this.handleMseFailure(session, 'Playback took too long to start. Try transcoding.')
      }, 25000)

      while (!session.abort.signal.aborted) {
        const { done, value } = await reader.read()
        if (done) break
        if (!value?.length) continue
        this.feed(session, value)
        if (!session.started && session.pending.length > 0) {
          session.started = true
          window.clearTimeout(startupTimer)
        }
        while (this.bufferedAhead() > 45 && !session.abort.signal.aborted) {
          await sleep(350)
        }
      }
      window.clearTimeout(startupTimer)
      if (session.abort.signal.aborted || session.token !== this.mse?.token) return
      await this.waitForQueue(session)
      if (session.abort.signal.aborted || session.token !== this.mse?.token) return
      if (!this.video?.buffered.length) {
        this.handleMseFailure(session, 'There is no playable audio or video at this position.')
        return
      }
      if (session.mediaSource && session.mediaSource.readyState === 'open') {
        try {
          session.mediaSource.endOfStream()
        } catch {
          /* ignore */
        }
      }
    } catch (error) {
      if (session.abort.signal.aborted || session.token !== this.mse?.token) return
      if (!session.started && !this.triedTranscode) {
        this.triedTranscode = true
        const target = this.currentTime()
        window.setTimeout(() => void this.loadAt(target, this.playingIntent, true), 150)
        return
      }
      this.handleMseFailure(
        session,
        error instanceof Error ? error.message : 'The stream ended unexpectedly.'
      )
    }
  }

  private feed(session: MseSession, chunk: Uint8Array): void {
    const merged = new Uint8Array(session.pending.length + chunk.length)
    merged.set(session.pending)
    merged.set(chunk, session.pending.length)
    session.pending = merged

    if (!session.initSent) {
      const moof = findBox(session.pending, 'moof')
      if (moof < 0) return
      if (moof > 0) {
        session.queue.push(session.pending.slice(0, moof))
      }
      session.pending = session.pending.slice(moof)
      session.initSent = true
    }

    for (;;) {
      if (session.pending.length < 8) break
      const box = readBox(session.pending, 0)
      if (!box) break
      if (box.type === 'moof') {
        if (session.pending.length < box.size + 8) break
        const next = readBox(session.pending, box.size)
        if (!next) break
        if (next.type !== 'mdat') {
          if (session.pending.length < box.size) break
          session.queue.push(session.pending.slice(0, box.size))
          session.pending = session.pending.slice(box.size)
          continue
        }
        const total = box.size + next.size
        if (session.pending.length < total) break
        session.queue.push(session.pending.slice(0, total))
        session.pending = session.pending.slice(total)
        continue
      }
      if (session.pending.length < box.size) break
      session.queue.push(session.pending.slice(0, box.size))
      session.pending = session.pending.slice(box.size)
    }
    this.pumpAppend(session)
  }

  private pumpAppend(session: MseSession): void {
    if (
      session.token !== this.mse?.token ||
      session.appending ||
      session.cleaning ||
      !session.sourceBuffer ||
      session.sourceBuffer.updating ||
      session.queue.length === 0
    ) {
      return
    }
    const data = session.queue.shift()!
    session.appending = true
    try {
      session.sourceBuffer.appendBuffer(data as BufferSource)
    } catch (error) {
      session.appending = false
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        this.trimBuffer(session, true)
        return
      }
      this.handleMseFailure(session, 'Could not buffer this media.')
    }
  }

  private handleUpdateEnd(session: MseSession): void {
    if (session.token !== this.mse?.token) return
    session.appending = false
    session.cleaning = false
    this.trimBuffer(session, false)
    this.pumpAppend(session)
  }

  private bufferedAhead(): number {
    const video = this.video
    if (!video || !video.buffered.length) return 0
    const current = video.currentTime
    const buffered = video.buffered
    for (let i = 0; i < buffered.length; i += 1) {
      if (current >= buffered.start(i) && current <= buffered.end(i)) {
        return Math.max(0, buffered.end(i) - current)
      }
    }
    return Math.max(0, buffered.end(buffered.length - 1) - current)
  }

  private trimBuffer(session: MseSession, force: boolean): void {
    const video = this.video
    const buffer = session.sourceBuffer
    if (!video || !buffer || buffer.updating || session.cleaning) return
    if (!video.buffered.length) return
    const current = video.currentTime
    if (current < 150 && !force) return
    const removeEnd = Math.max(0, current - 120)
    const start = video.buffered.start(0)
    if (start < removeEnd - 2) {
      session.cleaning = true
      try {
        buffer.remove(0, removeEnd)
      } catch {
        session.cleaning = false
      }
    }
  }

  private waitForQueue(session: MseSession): Promise<void> {
    return new Promise((resolve) => {
      const check = () => {
        if (
          session.token !== this.mse?.token ||
          (session.queue.length === 0 && !session.sourceBuffer?.updating)
        ) {
          resolve()
        } else {
          window.setTimeout(check, 150)
        }
      }
      check()
    })
  }

  private handleMseFailure(session: MseSession, message: string): void {
    if (session.token !== this.mse?.token) return
    if (!session.started && !this.triedTranscode && !session.abort.signal.aborted) {
      this.triedTranscode = true
      const target = this.currentTime()
      window.setTimeout(() => void this.loadAt(target, this.playingIntent, true), 200)
      return
    }
    this.fail(message)
  }

  private fail(message: string): void {
    this.playingIntent = false
    this.error = message
    this.emit({ error: message, buffering: false, loading: false, playing: false })
    this.onError?.(message)
  }

  play(): void {
    if (!this.video) return
    this.ensureAudio()
    void this.audioContext?.resume()
    this.playingIntent = true
    const promise = this.video.play()
    if (promise) promise.catch(() => this.emit({ playing: false }))
  }

  pause(): void {
    this.playingIntent = false
    this.video?.pause()
    this.saveProgress(true)
  }

  toggle(): void {
    if (!this.video) return
    if (this.video.paused) this.play()
    else this.pause()
  }

  seek(time: number): void {
    if (!this.video || !this.item) return
    const target = clamp(time, 0, this.duration || Number.MAX_SAFE_INTEGER)
    this.emit({ time: target })
    if (this.mode === 'native' || !this.mse) {
      try {
        this.video.currentTime = target
      } catch {
        /* ignore */
      }
      this.updateCue()
      return
    }
    const relative = target - this.baseTime
    const buffered = this.video.buffered
    let within = false
    for (let i = 0; i < buffered.length; i += 1) {
      if (relative >= buffered.start(i) + 0.2 && relative <= buffered.end(i) - 0.6) {
        within = true
        break
      }
    }
    if (within) {
      this.video.currentTime = relative
      this.updateCue()
    } else {
      void this.loadAt(target, this.playingIntent).then(() => this.updateCue())
    }
  }

  skip(delta: number): void {
    this.seek(this.currentTime() + delta)
  }

  setRate(rate: number): void {
    this.rate = rate
    if (this.video) this.video.playbackRate = rate
    this.emit({ rate })
  }

  setVolume(volume: number): void {
    this.volume = clamp(volume, 0, 1)
    this.applyVolume()
  }

  setMuted(muted: boolean): void {
    this.muted = muted
    this.applyVolume()
  }

  setAudio(index: number): void {
    if (!this.item || index === this.audioIndex) return
    this.audioIndex = index
    void this.loadAt(this.currentTime(), this.playingIntent)
  }

  retry(): void {
    if (!this.item) return
    void this.loadAt(this.currentTime(), true, true)
  }

  getAudioIndex(): number {
    return this.audioIndex
  }

  async loadSubtitle(url: string | null): Promise<void> {
    this.cues = []
    this.setActiveCue(null)
    if (!url) return
    try {
      const response = await fetch(url, { cache: 'no-store' })
      if (!response.ok) throw new Error(await response.text().catch(() => 'Subtitle load failed'))
      const text = await response.text()
      this.cues = parseVtt(text)
      this.updateCue()
    } catch (error) {
      this.cues = []
      this.onSubtitleError?.(error instanceof Error ? error.message : 'Could not load subtitles')
    }
  }

  clearSubtitle(): void {
    this.cues = []
    this.setActiveCue(null)
  }

  setSubtitleDelay(delay: number): void {
    this.subtitleDelay = delay
    this.updateCue()
  }

  setABLoop(loop: { a: number | null; b: number | null }): void {
    this.abLoop = loop
  }

  setEq(eq: { enabled: boolean; bands: number[] }): void {
    this.eq = eq
    this.applyEq()
  }

  getAnalyser(): AnalyserNode | null {
    return this.analyserNode
  }

  getCurrentTime(): number {
    return this.currentTime()
  }

  getBaseTime(): number {
    return this.baseTime
  }

  getDuration(): number {
    return this.duration || this.item?.duration || 0
  }

  getBuffered(): Array<{ start: number; end: number }> {
    if (!this.video) return []
    const ranges: Array<{ start: number; end: number }> = []
    const buffered = this.video.buffered
    for (let i = 0; i < buffered.length; i += 1) {
      const offset = this.mode === 'mse' ? this.baseTime : 0
      ranges.push({ start: buffered.start(i) + offset, end: buffered.end(i) + offset })
    }
    return ranges
  }

  captureFrame(): string | null {
    const video = this.video
    if (!video || !video.videoWidth || !video.videoHeight || video.readyState < 2) return null
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const context = canvas.getContext('2d')
    if (!context) return null
    context.drawImage(video, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/png')
  }

  stop(): void {
    this.playingIntent = false
    this.stopSession()
    this.item = null
    this.mode = null
    this.duration = 0
    this.cues = []
    this.setActiveCue(null)
    if (this.video) {
      this.video.pause()
      this.video.removeAttribute('src')
      this.video.load()
    }
    cancelAnimationFrame(this.raf)
    this.emit({ playing: false, buffering: false, loading: false, mode: null, time: 0, duration: 0 })
  }

  private stopSession(): void {
    const session = this.mse
    this.mse = null
    if (session) {
      session.abort.abort()
      try {
        void session.reader?.cancel().catch(() => {})
      } catch {
        /* ignore */
      }
      try {
        if (session.sourceBuffer && session.sourceBuffer.updating) session.sourceBuffer.abort()
      } catch {
        /* ignore */
      }
      try {
        if (session.mediaSource && session.mediaSource.readyState === 'open') session.mediaSource.endOfStream()
      } catch {
        /* ignore */
      }
      if (session.objectUrl) URL.revokeObjectURL(session.objectUrl)
    }
    cancelAnimationFrame(this.raf)
  }

  private currentTime(): number {
    if (!this.video) return 0
    if (this.mode === 'mse') return this.baseTime + (this.video.currentTime || 0)
    return this.video.currentTime || 0
  }

  private emit(patch: Partial<PlaybackSnapshot>): void {
    const video = this.video
    const base: PlaybackSnapshot = {
      playing: !!video && !video.paused && !video.ended,
      buffering: false,
      loading: false,
      time: this.currentTime(),
      duration: this.getDuration(),
      mode: this.mode,
      error: this.error,
      rate: this.rate
    }
    this.onState?.({ ...base, ...patch })
  }

  private handlePlay = (): void => {
    this.playingIntent = true
    this.emit({ playing: true, buffering: this.video?.readyState ? false : true })
    this.startTick()
  }

  private handlePause = (): void => {
    this.emit({ playing: false, buffering: false })
    this.saveProgress(true)
  }

  private handleWaiting = (): void => {
    this.emit({ buffering: true })
  }

  private handlePlaying = (): void => {
    this.emit({ buffering: false, loading: false })
    if (this.video && !this.video.paused) this.startTick()
  }

  private handleLoadedMetadata = (): void => {
    if (!this.video) return
    if (this.mode === 'native' && this.nativeStart > 0) {
      try {
        this.video.currentTime = this.nativeStart
      } catch {
        /* ignore */
      }
    }
    if (this.mode === 'native' && this.video.duration && Number.isFinite(this.video.duration)) {
      this.duration = this.video.duration
    }
    this.emit({ duration: this.duration, loading: false })
    if (this.playingIntent) this.play()
  }

  private handleEnded = (): void => {
    this.playingIntent = false
    this.saveProgress(true)
    this.emit({ playing: false, buffering: false })
    this.onEnded?.()
  }

  private handleVideoError = (): void => {
    if (this.mode === 'native') {
      this.fail('This file could not be decoded. Try opening it again to use the compatibility pipeline.')
      return
    }
    if (this.mode === 'mse') {
      const session = this.mse
      if (session && this.video && this.video.currentSrc === session.objectUrl && !this.video.buffered.length) {
        this.handleMseFailure(session, 'This media could not be decoded. Try another file or position.')
      }
    }
  }

  private startTick(): void {
    cancelAnimationFrame(this.raf)
    const tick = (): void => {
      if (!this.video) return
      const now = performance.now()
      if (now - this.lastEmit > 110) {
        this.lastEmit = now
        this.emit({})
        this.updateCue()
        this.maybeSaveProgress()
      }
      const time = this.currentTime()
      const { a, b } = this.abLoop
      if (a !== null && b !== null && time >= b) {
        this.seek(a)
      }
      if (!this.video.paused && !this.video.ended) {
        this.raf = requestAnimationFrame(tick)
      }
    }
    this.raf = requestAnimationFrame(tick)
  }

  private updateCue(): void {
    if (!this.cues.length) {
      this.setActiveCue(null)
      return
    }
    const cue = cueAt(this.cues, this.currentTime(), this.subtitleDelay)
    this.setActiveCue(cue)
  }

  private setActiveCue(cue: Cue | null): void {
    if (cue === this.lastCue) return
    this.lastCue = cue
    this.activeCue = cue
    this.onCue?.(cue)
  }

  private maybeSaveProgress(): void {
    const now = performance.now()
    if (now - this.lastProgress < 5000) return
    this.lastProgress = now
    this.saveProgress(false)
  }

  private saveProgress(force: boolean): void {
    if (!this.item || !this.duration || this.suppressProgress) return
    const time = this.currentTime()
    if (time < 2) return
    this.onProgress?.(time, this.duration)
    if (force) this.lastProgress = performance.now()
  }

  private ensureAudio(): void {
    if (this.audioContext || !this.video) return
    try {
      const context = new AudioContext()
      this.audioContext = context
      const source = context.createMediaElementSource(this.video)
      this.sourceNode = source
      const gain = context.createGain()
      this.gainNode = gain
      this.filterNodes = EQ_BANDS.map((frequency) => {
        const filter = context.createBiquadFilter()
        filter.type = 'peaking'
        filter.frequency.value = frequency
        filter.Q.value = 1.1
        filter.gain.value = 0
        return filter
      })
      const analyser = context.createAnalyser()
      analyser.fftSize = 2048
      analyser.smoothingTimeConstant = 0.82
      this.analyserNode = analyser
      let node: AudioNode = source
      for (const filter of this.filterNodes) {
        node.connect(filter)
        node = filter
      }
      node.connect(gain)
      gain.connect(analyser)
      analyser.connect(context.destination)
      this.applyVolume()
      this.applyEq()
    } catch (error) {
      console.warn('Audio processing unavailable', error)
    }
  }

  private applyVolume(): void {
    if (!this.gainNode) return
    const value = this.muted ? 0 : Math.pow(this.volume, 1.6)
    this.gainNode.gain.setTargetAtTime(value, this.audioContext?.currentTime ?? 0, 0.02)
  }

  private applyEq(): void {
    if (!this.filterNodes.length) return
    const bands = this.eq.bands.length ? this.eq.bands : EQ_BANDS.map(() => 0)
    this.filterNodes.forEach((filter, index) => {
      const value = this.eq.enabled ? clamp(bands[index] ?? 0, -12, 12) : 0
      filter.gain.setTargetAtTime(value, this.audioContext?.currentTime ?? 0, 0.03)
    })
  }
}

const EQ_BANDS = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000]

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

function readBox(buffer: Uint8Array, offset: number): { size: number; type: string; header: number } | null {
  if (buffer.length - offset < 8) return null
  const view = new DataView(buffer.buffer, buffer.byteOffset + offset, buffer.length - offset)
  let size = view.getUint32(0)
  const type = String.fromCharCode(buffer[offset + 4], buffer[offset + 5], buffer[offset + 6], buffer[offset + 7])
  let header = 8
  if (size === 1) {
    if (buffer.length - offset < 16) return null
    size = Number(view.getBigUint64(8))
    header = 16
  } else if (size === 0) {
    size = buffer.length - offset
  }
  if (size < header) return null
  return { size, type, header }
}

function findBox(buffer: Uint8Array, wanted: string): number {
  let offset = 0
  while (offset < buffer.length) {
    const box = readBox(buffer, offset)
    if (!box) return -1
    if (box.type === wanted) return offset
    if (buffer.length - offset < box.size) return -1
    offset += box.size
  }
  return -1
}

export const playback = new PlaybackController()

if (import.meta.env.DEV) {
  ;(window as unknown as { __playback?: PlaybackController }).__playback = playback
}
