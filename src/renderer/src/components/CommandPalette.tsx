import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  AudioLines,
  Captions,
  FileVideo,
  FolderPlus,
  Home,
  Info,
  LibraryBig,
  ListMusic,
  MonitorPlay,
  Palette,
  Pause,
  Play,
  Radio,
  RefreshCw,
  Search,
  Settings2,
  SkipBack,
  SkipForward,
  SunMoon,
  Volume2,
  VolumeX,
  type LucideIcon
} from 'lucide-react'
import type { MediaInfo } from '../../../shared/types'
import { useUi } from '../store/ui'
import { usePlayer } from '../store/player'
import { useLibrary } from '../store/library'
import { useSettings, resolveTheme } from '../store/settings'
import { addFolder, openMediaFiles, playMedia } from '../lib/actions'
import { formatTime, resolutionLabel } from '../lib/format'

interface PaletteEntry {
  id: string
  group: string
  label: string
  hint?: string
  icon: LucideIcon
  keywords?: string
  run: () => void
}

export function CommandPalette(): React.JSX.Element {
  const open = useUi((state) => state.paletteOpen)
  const setPaletteOpen = useUi((state) => state.setPaletteOpen)
  const setView = useUi((state) => state.setView)
  const setSettingsSection = useUi((state) => state.setSettingsSection)
  const setUrlOpen = useUi((state) => state.setUrlOpen)
  const items = useLibrary((state) => state.items)
  const rescan = useLibrary((state) => state.rescan)
  const item = usePlayer((state) => state.item)
  const playing = usePlayer((state) => state.playing)
  const toggle = usePlayer((state) => state.toggle)
  const next = usePlayer((state) => state.next)
  const previous = usePlayer((state) => state.previous)
  const muted = usePlayer((state) => state.muted)
  const toggleMute = usePlayer((state) => state.toggleMute)
  const theme = useSettings((state) => state.theme)
  const updateSettings = useSettings((state) => state.update)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const activeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    setQuery('')
    setActive(0)
    const timer = window.setTimeout(() => inputRef.current?.focus(), 40)
    return () => window.clearTimeout(timer)
  }, [open])

  const commands = useMemo<PaletteEntry[]>(() => {
    const go = (view: 'home' | 'library' | 'queue' | 'settings'): (() => void) => () => setView(view)
    const settings = (section: string): (() => void) => () => {
      setSettingsSection(section)
      setView('settings')
    }
    const list: PaletteEntry[] = [
      {
        id: 'nav-home',
        group: 'Go to',
        label: 'Home',
        hint: 'Your library at a glance',
        icon: Home,
        keywords: 'start dashboard',
        run: go('home')
      },
      {
        id: 'nav-library',
        group: 'Go to',
        label: 'Library',
        hint: 'Browse every title',
        icon: LibraryBig,
        keywords: 'collection media files',
        run: go('library')
      },
      {
        id: 'nav-queue',
        group: 'Go to',
        label: 'Queue',
        hint: 'See what is coming up',
        icon: ListMusic,
        keywords: 'playlist up next',
        run: go('queue')
      },
      {
        id: 'nav-settings',
        group: 'Go to',
        label: 'Settings',
        hint: 'Tune the player',
        icon: Settings2,
        keywords: 'preferences options',
        run: go('settings')
      },
      {
        id: 'open-files',
        group: 'Media',
        label: 'Open media files',
        hint: 'Play anything from your computer',
        icon: FileVideo,
        keywords: 'file open browse',
        run: () => void openMediaFiles()
      },
      {
        id: 'open-folder',
        group: 'Media',
        label: 'Add a folder to the library',
        hint: 'Scan and watch a folder',
        icon: FolderPlus,
        keywords: 'library source scan',
        run: () => void addFolder()
      },
      {
        id: 'open-stream',
        group: 'Media',
        label: 'Open a network stream',
        hint: 'HTTP, HLS, RTSP, RTMP, UDP',
        icon: Radio,
        keywords: 'url network live',
        run: () => setUrlOpen(true)
      },
      {
        id: 'rescan',
        group: 'Media',
        label: 'Rescan the library',
        hint: 'Look for new and changed files',
        icon: RefreshCw,
        keywords: 'refresh update',
        run: () => void rescan()
      },
      {
        id: 'theme',
        group: 'Appearance',
        label: 'Toggle light and dark theme',
        hint: `Currently ${theme === 'system' ? resolveTheme(theme) : theme}`,
        icon: SunMoon,
        keywords: 'dark light mode color',
        run: () => updateSettings({ theme: resolveTheme(theme) === 'dark' ? 'light' : 'dark' })
      },
      {
        id: 'settings-appearance',
        group: 'Appearance',
        label: 'Appearance settings',
        hint: 'Theme, accent and motion',
        icon: Palette,
        keywords: 'color theme design',
        run: settings('appearance')
      },
      {
        id: 'settings-playback',
        group: 'Appearance',
        label: 'Playback settings',
        hint: 'Speed, skipping and video',
        icon: MonitorPlay,
        keywords: 'resume speed quality',
        run: settings('playback')
      },
      {
        id: 'settings-subtitles',
        group: 'Appearance',
        label: 'Subtitle settings',
        hint: 'Typography, delay and language',
        icon: Captions,
        keywords: 'captions text font',
        run: settings('subtitles')
      },
      {
        id: 'settings-audio',
        group: 'Appearance',
        label: 'Audio settings',
        hint: 'Ten-band equalizer',
        icon: AudioLines,
        keywords: 'equalizer eq sound',
        run: settings('audio')
      },
      {
        id: 'settings-about',
        group: 'Appearance',
        label: 'About BetterVLC',
        hint: 'Version and credits',
        icon: Info,
        keywords: 'version electron ffmpeg',
        run: settings('about')
      }
    ]

    if (item) {
      list.unshift(
        {
          id: 'playback-toggle',
          group: 'Playback',
          label: playing ? 'Pause' : 'Play',
          hint: item.title,
          icon: playing ? Pause : Play,
          keywords: 'space resume',
          run: toggle
        },
        {
          id: 'playback-next',
          group: 'Playback',
          label: 'Next in queue',
          hint: 'Skip to the next item',
          icon: SkipForward,
          keywords: 'forward',
          run: next
        },
        {
          id: 'playback-previous',
          group: 'Playback',
          label: 'Previous item',
          hint: 'Back to the start or previous item',
          icon: SkipBack,
          keywords: 'back rewind',
          run: previous
        },
        {
          id: 'playback-mute',
          group: 'Playback',
          label: muted ? 'Unmute' : 'Mute',
          hint: 'Toggle audio output',
          icon: muted ? Volume2 : VolumeX,
          keywords: 'sound volume silence',
          run: toggleMute
        }
      )
    }

    return list
  }, [
    item,
    playing,
    muted,
    theme,
    toggle,
    next,
    previous,
    toggleMute,
    setView,
    setSettingsSection,
    setUrlOpen,
    updateSettings,
    rescan
  ])

  const results = useMemo<PaletteEntry[]>(() => {
    const needle = query.trim().toLowerCase()
    const matched = commands.filter((entry) => {
      if (!needle) return true
      return `${entry.label} ${entry.hint ?? ''} ${entry.keywords ?? ''}`.toLowerCase().includes(needle)
    })
    const source = [...items].sort((a, b) => b.addedAt - a.addedAt)
    const filtered = needle
      ? source
          .filter((entry) =>
            `${entry.title} ${entry.name} ${entry.tags?.artist ?? ''} ${entry.folder ?? ''}`
              .toLowerCase()
              .includes(needle)
          )
          .slice(0, 10)
      : source.slice(0, 4)
    const media: PaletteEntry[] = filtered.map((entry) => ({
      id: `media-${entry.id}`,
      group: 'From your library',
      label: entry.title,
      hint: mediaHint(entry),
      icon: entry.kind === 'audio' ? AudioLines : FileVideo,
      keywords: entry.name,
      run: () => playMedia(entry, items)
    }))
    return [...matched, ...media]
  }, [commands, items, query])

  useEffect(() => {
    setActive(0)
  }, [query])

  useEffect(() => {
    setActive((value) => Math.min(value, Math.max(results.length - 1, 0)))
  }, [results.length])

  useEffect(() => {
    if (!open) return
    activeRef.current?.scrollIntoView({ block: 'nearest' })
  }, [active, open])

  const choose = (entry: PaletteEntry | undefined): void => {
    if (!entry) return
    setPaletteOpen(false)
    entry.run()
  }

  const groups = results.reduce<Record<string, Array<{ entry: PaletteEntry; index: number }>>>(
    (accumulator, entry, index) => {
      const bucket = accumulator[entry.group] ?? []
      bucket.push({ entry, index })
      accumulator[entry.group] = bucket
      return accumulator
    },
    {}
  )

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="palette-scrim"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          onClick={() => setPaletteOpen(false)}
          key="palette"
        >
          <motion.div
            className="palette"
            role="dialog"
            aria-label="Command palette"
            initial={{ opacity: 0, y: -14, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.99 }}
            transition={{ type: 'spring', stiffness: 420, damping: 34 }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="palette-search">
              <Search size={19} />
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'ArrowDown') {
                    event.preventDefault()
                    setActive((value) => (results.length ? (value + 1) % results.length : 0))
                  } else if (event.key === 'ArrowUp') {
                    event.preventDefault()
                    setActive((value) => (results.length ? (value - 1 + results.length) % results.length : 0))
                  } else if (event.key === 'Enter') {
                    event.preventDefault()
                    choose(results[active])
                  } else if (event.key === 'Escape') {
                    event.preventDefault()
                    setPaletteOpen(false)
                  }
                }}
                placeholder="Search your library, actions, settings…"
                spellCheck={false}
                aria-label="Search commands and media"
              />
              <kbd>ESC</kbd>
            </div>

            <div className="palette-results">
              {results.length === 0 ? (
                <div className="palette-empty">
                  <Search size={24} />
                  <strong>No matches for “{query}”</strong>
                  <span>Try a title, an artist or an action.</span>
                </div>
              ) : (
                Object.entries(groups).map(([group, entries]) => (
                  <div className="palette-group" key={group}>
                    <span className="palette-group-label">{group}</span>
                    {entries.map(({ entry, index }) => {
                      const Icon = entry.icon
                      return (
                        <button
                          key={entry.id}
                          ref={index === active ? activeRef : undefined}
                          className={`palette-item ${index === active ? 'active' : ''}`}
                          onMouseEnter={() => setActive(index)}
                          onClick={() => choose(entry)}
                        >
                          <span className="palette-item-icon">
                            <Icon size={17} />
                          </span>
                          <span className="palette-item-text">
                            <strong>{entry.label}</strong>
                            {entry.hint ? <small>{entry.hint}</small> : null}
                          </span>
                          <span className="palette-enter">↵</span>
                        </button>
                      )
                    })}
                  </div>
                ))
              )}
            </div>

            <footer className="palette-foot">
              <span>
                <kbd>↑</kbd>
                <kbd>↓</kbd> navigate
              </span>
              <span>
                <kbd>↵</kbd> select
              </span>
              <span>
                <kbd>Ctrl K</kbd> close
              </span>
            </footer>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

function mediaHint(item: MediaInfo): string {
  if (item.kind === 'audio') {
    return [item.tags?.artist, formatTime(item.duration)].filter(Boolean).join(' · ')
  }
  return [resolutionLabel(item.width, item.height), formatTime(item.duration)].filter(Boolean).join(' · ')
}
