import { create } from 'zustand'
import type { MediaInfo, SubtitleTrackInfo } from '../../../shared/types'
import { playback, type PlaybackSnapshot } from '../lib/playback'
import type { Cue } from '../lib/subtitles'
import { useHistory } from './history'
import { useSettings } from './settings'
import { useUi } from './ui'

export type RepeatMode = 'off' | 'one' | 'all'

export interface VideoFilters {
  brightness: number
  contrast: number
  saturation: number
}

interface PlayerState {
  item: MediaInfo | null
  queue: MediaInfo[]
  index: number
  playing: boolean
  buffering: boolean
  loading: boolean
  time: number
  duration: number
  mode: 'native' | 'mse' | null
  error: string | null
  rate: number
  volume: number
  muted: boolean
  audioIndex: number
  subtitleIndex: number
  subtitleTracks: SubtitleTrackInfo[]
  cue: Cue | null
  subtitleDelay: number
  repeat: RepeatMode
  abLoop: { a: number | null; b: number | null }
  filters: VideoFilters
  zoom: number
  rotation: number
  initialize: () => void
  playItem: (item: MediaInfo, queue?: MediaInfo[], options?: { start?: number; autoplay?: boolean }) => void
  playAt: (index: number) => void
  play: () => void
  pause: () => void
  toggle: () => void
  seek: (time: number) => void
  skip: (delta: number) => void
  next: () => void
  previous: () => void
  stop: () => void
  setVolume: (volume: number) => void
  toggleMute: () => void
  setRate: (rate: number) => void
  setAudio: (index: number) => void
  setSubtitle: (index: number) => void
  addExternalSubtitle: () => Promise<void>
  setSubtitleDelay: (delay: number) => void
  setRepeat: (mode: RepeatMode) => void
  setABLoop: (loop: { a: number | null; b: number | null }) => void
  setFilters: (patch: Partial<VideoFilters>) => void
  resetFilters: () => void
  setZoom: (zoom: number) => void
  setRotation: (rotation: number) => void
  snapshot: () => Promise<void>
  retry: () => void
  addToQueue: (items: MediaInfo[], next?: boolean) => void
  removeFromQueue: (id: string) => void
  moveQueue: (from: number, to: number) => void
  clearQueue: () => void
  handleEnded: () => void
}

const defaultFilters: VideoFilters = { brightness: 1, contrast: 1, saturation: 1 }
let initialized = false

export const usePlayer = create<PlayerState>((set, get) => ({
  item: null,
  queue: [],
  index: -1,
  playing: false,
  buffering: false,
  loading: false,
  time: 0,
  duration: 0,
  mode: null,
  error: null,
  rate: 1,
  volume: useSettings.getState().volume,
  muted: false,
  audioIndex: 0,
  subtitleIndex: -1,
  subtitleTracks: [],
  cue: null,
  subtitleDelay: useSettings.getState().subtitle.delay,
  repeat: 'off',
  abLoop: { a: null, b: null },
  filters: { ...defaultFilters },
  zoom: 1,
  rotation: 0,

  initialize: () => {
    if (initialized) return
    initialized = true
    const settings = useSettings.getState()
    playback.configure({
      maxHeight: settings.maxHeight,
      deinterlace: settings.deinterlace,
      hwDecode: settings.hwDecode
    })
    playback.setVolume(settings.volume)
    playback.setEq(settings.eq)
    playback.setSubtitleDelay(settings.subtitle.delay)
    playback.onState = (snapshot: PlaybackSnapshot) => {
      set({
        playing: snapshot.playing,
        buffering: snapshot.buffering,
        loading: snapshot.loading,
        time: snapshot.time,
        duration: snapshot.duration || get().duration,
        mode: snapshot.mode,
        error: snapshot.error,
        rate: snapshot.rate
      })
    }
    playback.onCue = (cue) => set({ cue })
    playback.onEnded = () => get().handleEnded()
    playback.onProgress = (time, duration) => {
      const item = get().item
      if (item) useHistory.getState().record(item.id, time, duration)
    }
    playback.onError = (message) => {
      set({ error: message, playing: false, buffering: false, loading: false })
    }
    playback.onSubtitleError = (message) => {
      useUi.getState().toast({ title: 'Subtitles unavailable', description: message, tone: 'error' })
    }

    useSettings.subscribe((state, previous) => {
      if (
        state.maxHeight !== previous.maxHeight ||
        state.deinterlace !== previous.deinterlace ||
        state.hwDecode !== previous.hwDecode
      ) {
        playback.configure({
          maxHeight: state.maxHeight,
          deinterlace: state.deinterlace,
          hwDecode: state.hwDecode
        })
      }
      if (state.eq !== previous.eq) playback.setEq(state.eq)
      if (state.volume !== previous.volume && Math.abs(state.volume - get().volume) > 0.001) {
        set({ volume: state.volume })
        playback.setVolume(state.volume)
      }
      if (state.subtitle.delay !== previous.subtitle.delay) {
        playback.setSubtitleDelay(state.subtitle.delay)
        set({ subtitleDelay: state.subtitle.delay })
      }
    })
  },

  playItem: (item, queue, options = {}) => {
    const settings = useSettings.getState()
    const list = queue?.length ? queue : [item]
    let index = list.findIndex((entry) => entry.id === item.id)
    if (index < 0) {
      list.unshift(item)
      index = 0
    }
    const history = useHistory.getState().entries[item.id]
    let start = options.start ?? 0
    if (options.start === undefined && settings.resume && history && !item.isStream) {
      if (history.position > 5 && history.position < item.duration * 0.95) start = history.position
    }
    playback.configure({
      maxHeight: settings.maxHeight,
      deinterlace: settings.deinterlace,
      hwDecode: settings.hwDecode
    })
    playback.setVolume(settings.volume)
    playback.setRate(settings.defaultSpeed)
    playback.setEq(settings.eq)
    playback.setSubtitleDelay(settings.subtitle.delay)
    set({
      item,
      queue: list,
      index,
      subtitleTracks: item.subtitleTracks,
      subtitleIndex: -1,
      cue: null,
      time: start,
      duration: item.duration,
      audioIndex: 0,
      rate: settings.defaultSpeed,
      volume: settings.volume,
      muted: false,
      error: null,
      abLoop: { a: null, b: null },
      filters: { ...defaultFilters },
      zoom: 1,
      rotation: 0
    })
    useUi.getState().openPlayer()
    void playback.open(item, {
      start,
      autoplay: options.autoplay ?? true
    })
    if (start > 5) {
      useUi.getState().toast({
        title: `Resumed at ${formatResume(start)}`,
        description: 'Pick up where you left off',
        actionLabel: 'Start over',
        onAction: () => get().seek(0),
        duration: 5000
      })
    }
    if (settings.subtitle.auto && item.subtitleTracks.length) {
      const preferred = pickSubtitle(item.subtitleTracks, settings.subtitle.language)
      if (preferred) window.setTimeout(() => void get().setSubtitle(preferred.index), 60)
    }
  },

  playAt: (index) => {
    const { queue } = get()
    const item = queue[index]
    if (item) get().playItem(item, queue)
  },

  play: () => {
    playback.play()
  },

  pause: () => {
    playback.pause()
  },

  toggle: () => {
    playback.toggle()
  },

  seek: (time) => {
    playback.seek(time)
  },

  skip: (delta) => {
    playback.skip(delta)
  },

  next: () => {
    const { index, queue, repeat } = get()
    if (!queue.length) return
    let next = index + 1
    if (next >= queue.length) {
      if (repeat === 'all') next = 0
      else return
    }
    const item = queue[next]
    if (item) get().playItem(item, queue)
  },

  previous: () => {
    const { index, queue, time } = get()
    if (time > 3 || index <= 0) {
      get().seek(0)
      return
    }
    const item = queue[index - 1]
    if (item) get().playItem(item, queue)
  },

  stop: () => {
    playback.stop()
    set({
      item: null,
      playing: false,
      buffering: false,
      loading: false,
      time: 0,
      duration: 0,
      cue: null,
      error: null,
      mode: null
    })
    useUi.getState().closePlayer()
  },

  setVolume: (volume) => {
    const value = Math.min(Math.max(volume, 0), 1)
    set({ volume: value, muted: false })
    playback.setVolume(value)
    playback.setMuted(false)
    useSettings.getState().update({ volume: value })
  },

  toggleMute: () => {
    const muted = !get().muted
    set({ muted })
    playback.setMuted(muted)
  },

  setRate: (rate) => {
    set({ rate })
    playback.setRate(rate)
  },

  setAudio: (index) => {
    if (index === get().audioIndex) return
    set({ audioIndex: index })
    playback.setAudio(index)
  },

  setSubtitle: async (index) => {
    const { item } = get()
    if (!item) return
    if (index < 0) {
      set({ subtitleIndex: -1, cue: null })
      await playback.loadSubtitle(null)
      return
    }
    const track = get().subtitleTracks.find((entry) => entry.index === index)
    if (!track) return
    set({ subtitleIndex: index, cue: null })
    let url: string | null = null
    if (track.external && track.token) {
      url = `${window.api.baseUrl}/subtitle-ext/${track.token}`
    } else {
      url = await window.api.media.subtitleUrl(item.id, track.index)
    }
    await playback.loadSubtitle(url)
  },

  addExternalSubtitle: async () => {
    const file = await window.api.dialog.openSubtitle()
    if (!file) return
    try {
      const subtitle = await window.api.media.addSubtitle(file)
      const { item, subtitleTracks } = get()
      if (!item) return
      const track: SubtitleTrackInfo = {
        index: 1000 + subtitleTracks.length,
        codec: file.split('.').pop() ?? 'subtitle',
        title: subtitle.name,
        external: true,
        token: subtitle.token
      }
      const nextTracks = [...subtitleTracks, track]
      set({
        subtitleTracks: nextTracks,
        item: { ...item, subtitleTracks: nextTracks }
      })
      await get().setSubtitle(track.index)
      useUi.getState().toast({ title: 'Subtitles loaded', description: subtitle.name, tone: 'success' })
    } catch (error) {
      useUi.getState().toast({
        title: 'Could not load subtitles',
        description: error instanceof Error ? error.message : String(error),
        tone: 'error'
      })
    }
  },

  setSubtitleDelay: (delay) => {
    const value = Math.max(Math.min(delay, 30), -30)
    set({ subtitleDelay: value })
    playback.setSubtitleDelay(value)
    useSettings.getState().updateSubtitle({ delay: value })
  },

  setRepeat: (mode) => set({ repeat: mode }),

  setABLoop: (loop) => {
    set({ abLoop: loop })
    playback.setABLoop(loop)
  },

  setFilters: (patch) => set((state) => ({ filters: { ...state.filters, ...patch } })),

  resetFilters: () => set({ filters: { ...defaultFilters }, zoom: 1, rotation: 0 }),

  setZoom: (zoom) => set({ zoom: Math.min(Math.max(zoom, 1), 3) }),

  setRotation: (rotation) => set({ rotation: ((rotation % 360) + 360) % 360 }),

  snapshot: async () => {
    const data = playback.captureFrame()
    if (!data) {
      useUi.getState().toast({ title: 'Snapshot unavailable', description: 'The video is not ready yet.', tone: 'error' })
      return
    }
    const item = get().item
    const file = await window.api.media.saveSnapshot(data, item?.title ?? 'snapshot')
    if (file) {
      useUi.getState().toast({ title: 'Snapshot saved', description: file, tone: 'success' })
    }
  },

  retry: () => {
    set({ error: null, loading: true })
    playback.retry()
  },

  addToQueue: (items, next = false) => {
    if (!items.length) return
    set((state) => {
      if (!state.item) {
        return state
      }
      const queue = [...state.queue]
      const current = queue[state.index]
      const filtered = items.filter((item) => item.id !== current?.id)
      if (next) queue.splice(state.index + 1, 0, ...filtered)
      else queue.push(...filtered)
      return { queue }
    })
    if (!get().item && items[0]) get().playItem(items[0], items)
  },

  removeFromQueue: (id) => {
    const state = get()
    const index = state.queue.findIndex((item) => item.id === id)
    if (index < 0) return
    if (index === state.index) {
      const queue = state.queue.filter((item) => item.id !== id)
      if (queue.length) get().playItem(queue[Math.min(index, queue.length - 1)], queue)
      else get().stop()
      return
    }
    set({ queue: state.queue.filter((item) => item.id !== id) })
  },

  moveQueue: (from, to) => {
    set((state) => {
      const queue = [...state.queue]
      if (from < 0 || from >= queue.length || to < 0 || to >= queue.length) return state
      const [item] = queue.splice(from, 1)
      queue.splice(to, 0, item)
      const currentId = state.item?.id
      return { queue, index: currentId ? queue.findIndex((entry) => entry.id === currentId) : state.index }
    })
  },

  clearQueue: () => {
    const { item } = get()
    set({ queue: item ? [item] : [], index: item ? 0 : -1 })
  },

  handleEnded: () => {
    const { repeat, index, queue } = get()
    if (repeat === 'one') {
      get().seek(0)
      get().play()
      return
    }
    if (index < queue.length - 1) {
      get().next()
      return
    }
    if (repeat === 'all' && queue.length) {
      get().playAt(0)
      return
    }
    set({ playing: false })
  }
}))

function pickSubtitle(tracks: SubtitleTrackInfo[], language: string): SubtitleTrackInfo | null {
  const text = tracks.filter((track) => !['hdmv_pgs_subtitle', 'dvd_subtitle', 'dvb_subtitle', 'xsub'].includes(track.codec))
  if (!text.length) return null
  if (language) {
    const match = text.find((track) => track.language?.toLowerCase().startsWith(language.toLowerCase()))
    if (match) return match
  }
  return text.find((track) => track.default) ?? text.find((track) => track.forced) ?? text[0]
}

function formatResume(seconds: number): string {
  const total = Math.floor(seconds)
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor(total / 60) % 60
  const secs = total % 60
  if (hours) return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  return `${minutes}:${String(secs).padStart(2, '0')}`
}
