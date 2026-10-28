import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { TitleBar } from './components/TitleBar'
import { Sidebar } from './components/Sidebar'
import { TopBar } from './components/TopBar'
import { PlayerOverlay } from './components/PlayerOverlay'
import { CommandPalette } from './components/CommandPalette'
import { UrlModal } from './components/UrlModal'
import { Toasts } from './components/Toasts'
import { ContextMenu } from './components/ContextMenu'
import { DropOverlay } from './components/DropOverlay'
import { HomePage } from './pages/HomePage'
import { LibraryPage } from './pages/LibraryPage'
import { QueuePage } from './pages/QueuePage'
import { SettingsPage } from './pages/SettingsPage'
import { useUi, type View } from './store/ui'
import { useSettings, resolveTheme } from './store/settings'
import { useLibrary } from './store/library'
import { usePlayer } from './store/player'
import { openDroppedPaths, openMediaFiles, addFolder } from './lib/actions'

const PAGES: Record<View, () => React.JSX.Element> = {
  home: HomePage,
  library: LibraryPage,
  queue: QueuePage,
  settings: SettingsPage
}

export function App(): React.JSX.Element {
  const view = useUi((state) => state.view)
  const theme = useSettings((state) => state.theme)
  const accent = useSettings((state) => state.accent)
  const reduceMotion = useSettings((state) => state.reduceMotion)
  const skipSeconds = useSettings((state) => state.skipSeconds)
  const contentRef = useRef<HTMLDivElement>(null)
  const dragDepth = useRef(0)
  const [dragActive, setDragActive] = useState(false)

  useEffect(() => {
    usePlayer.getState().initialize()
    void useLibrary.getState().init()
  }, [])

  useEffect(() => {
    const apply = (): void => {
      const root = document.documentElement
      root.dataset.theme = resolveTheme(theme)
      root.dataset.accent = accent
      root.dataset.motion = reduceMotion ? 'reduced' : 'full'
    }
    apply()
    if (theme !== 'system') return
    const query = window.matchMedia('(prefers-color-scheme: light)')
    query.addEventListener('change', apply)
    return () => query.removeEventListener('change', apply)
  }, [theme, accent, reduceMotion])

  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }, [view])

  useEffect(() => {
    const offs = [
      window.api.on.mediaKey((action) => {
        const player = usePlayer.getState()
        if (action === 'play-pause') {
          if (player.item) player.toggle()
        } else if (action === 'next') {
          if (player.item) player.next()
        } else if (action === 'previous') {
          if (player.item) player.previous()
        } else if (action === 'stop') {
          if (player.item) player.stop()
        }
      }),
      window.api.on.openPaths((paths) => {
        void openDroppedPaths(paths)
      }),
      window.api.on.fullscreen((value) => {
        useUi.getState().setFullscreen(value)
      })
    ]
    return () => offs.forEach((off) => off())
  }, [])

  useEffect(() => {
    const hasFiles = (event: DragEvent): boolean =>
      Array.from(event.dataTransfer?.types ?? []).includes('Files')

    const onEnter = (event: DragEvent): void => {
      if (!hasFiles(event)) return
      event.preventDefault()
      dragDepth.current += 1
      setDragActive(true)
    }
    const onOver = (event: DragEvent): void => {
      if (!hasFiles(event)) return
      event.preventDefault()
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
    }
    const onLeave = (event: DragEvent): void => {
      if (!hasFiles(event)) return
      dragDepth.current = Math.max(dragDepth.current - 1, 0)
      if (dragDepth.current === 0) setDragActive(false)
    }
    const onDrop = (event: DragEvent): void => {
      event.preventDefault()
      dragDepth.current = 0
      setDragActive(false)
      const files = Array.from(event.dataTransfer?.files ?? [])
        .map((file) => {
          try {
            return window.api.paths.forFile(file)
          } catch {
            return ''
          }
        })
        .filter(Boolean)
      if (files.length) void openDroppedPaths(files)
    }

    window.addEventListener('dragenter', onEnter)
    window.addEventListener('dragover', onOver)
    window.addEventListener('dragleave', onLeave)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragenter', onEnter)
      window.removeEventListener('dragover', onOver)
      window.removeEventListener('dragleave', onLeave)
      window.removeEventListener('drop', onDrop)
    }
  }, [])

  useEffect(() => {
    const toggleFullscreen = async (): Promise<void> => {
      const actual = await window.api.window.setFullscreen(!useUi.getState().fullscreen)
      useUi.getState().setFullscreen(actual)
    }

    const onKeyDown = (event: KeyboardEvent): void => {
      const target = event.target as HTMLElement | null
      const ui = useUi.getState()
      const player = usePlayer.getState()
      const typing =
        !!target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      const mod = event.ctrlKey || event.metaKey
      const key = event.key

      if (key === 'Escape') {
        if (ui.contextMenu) {
          event.preventDefault()
          ui.hideContextMenu()
          return
        }
        if (ui.paletteOpen) {
          event.preventDefault()
          ui.setPaletteOpen(false)
          return
        }
        if (ui.urlOpen) {
          event.preventDefault()
          ui.setUrlOpen(false)
          return
        }
        if (ui.queueOpen) {
          event.preventDefault()
          ui.setQueueOpen(false)
          return
        }
        if (ui.infoOpen) {
          event.preventDefault()
          ui.setInfoOpen(false)
          return
        }
        if (ui.fullscreen) {
          event.preventDefault()
          void toggleFullscreen()
          return
        }
        if (ui.playerOpen) {
          event.preventDefault()
          ui.closePlayer()
        }
        return
      }

      if (mod) {
        const lower = key.toLowerCase()
        if (lower === 'k') {
          event.preventDefault()
          ui.setPaletteOpen(!ui.paletteOpen)
        } else if (lower === 'o') {
          event.preventDefault()
          if (event.shiftKey) void addFolder()
          else void openMediaFiles()
        } else if (lower === 'u') {
          event.preventDefault()
          ui.setUrlOpen(true)
        } else if (lower === ',') {
          event.preventDefault()
          ui.setView('settings')
        } else if (lower === 'l') {
          event.preventDefault()
          ui.setView('library')
        }
        return
      }

      if (typing) return
      if (target?.closest('button, a') && (key === ' ' || key === 'Enter')) return
      if (!player.item) return

      switch (key) {
        case ' ':
          event.preventDefault()
          player.toggle()
          break
        case 'ArrowLeft':
          event.preventDefault()
          player.skip(-skipSeconds)
          break
        case 'ArrowRight':
          event.preventDefault()
          player.skip(skipSeconds)
          break
        case 'ArrowUp':
          event.preventDefault()
          player.setVolume(player.volume + 0.05)
          break
        case 'ArrowDown':
          event.preventDefault()
          player.setVolume(player.volume - 0.05)
          break
        case 'j':
        case 'J':
          event.preventDefault()
          player.skip(-10)
          break
        case 'l':
        case 'L':
          event.preventDefault()
          player.skip(10)
          break
        case 'm':
        case 'M':
          player.toggleMute()
          break
        case 'n':
        case 'N':
          player.next()
          break
        case 'p':
        case 'P':
          player.previous()
          break
        case 'f':
        case 'F':
          if (ui.playerOpen) {
            event.preventDefault()
            void toggleFullscreen()
          }
          break
        case 'q':
        case 'Q':
          if (ui.playerOpen) {
            event.preventDefault()
            ui.setQueueOpen(!ui.queueOpen)
          }
          break
        case 'i':
        case 'I':
          if (ui.playerOpen) {
            event.preventDefault()
            ui.setInfoOpen(!ui.infoOpen)
          }
          break
        case 's':
        case 'S': {
          event.preventDefault()
          if (player.subtitleIndex >= 0) {
            void player.setSubtitle(-1)
          } else {
            const track = player.subtitleTracks.find(
              (entry) => !['hdmv_pgs_subtitle', 'dvd_subtitle', 'dvb_subtitle', 'xsub'].includes(entry.codec)
            )
            if (track) void player.setSubtitle(track.index)
          }
          break
        }
        case 'a':
        case 'A': {
          const tracks = player.item.audioTracks
          if (tracks.length > 1) {
            event.preventDefault()
            const current = tracks.findIndex((track) => track.index === player.audioIndex)
            const next = tracks[(current + 1) % tracks.length]
            if (next) player.setAudio(next.index)
          }
          break
        }
        case '[':
          event.preventDefault()
          player.setRate(Math.max(0.25, Math.round((player.rate - 0.1) * 100) / 100))
          break
        case ']':
          event.preventDefault()
          player.setRate(Math.min(4, Math.round((player.rate + 0.1) * 100) / 100))
          break
        default:
          break
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [skipSeconds])

  const Page = PAGES[view]

  return (
    <div className="app-shell">
      <TitleBar />
      <div className="app-body">
        <Sidebar />
        <main className="main-area">
          <TopBar />
          <div className="content" ref={contentRef}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={view}
                className="page-transition"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              >
                <Page />
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>
      <PlayerOverlay />
      <CommandPalette />
      <UrlModal />
      <Toasts />
      <ContextMenu />
      <DropOverlay active={dragActive} />
    </div>
  )
}
