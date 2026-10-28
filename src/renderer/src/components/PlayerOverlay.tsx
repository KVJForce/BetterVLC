import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AlertTriangle,
  ArrowLeft,
  AudioLines,
  Camera,
  Captions,
  Check,
  ChevronRight,
  Film,
  Gauge,
  Info,
  ListMusic,
  Loader2,
  Maximize2,
  Minimize2,
  Minus,
  MoreHorizontal,
  Music2,
  Pause,
  PictureInPicture2,
  Play,
  Plus,
  Repeat,
  Repeat1,
  Settings2,
  SkipBack,
  SkipForward,
  SlidersHorizontal,
  Square,
  X
} from 'lucide-react'
import type { MediaInfo } from '../../../shared/types'
import { usePlayer } from '../store/player'
import { useSettings } from '../store/settings'
import { useUi } from '../store/ui'
import { playback } from '../lib/playback'
import { formatTime, languageName, audioLabel, resolutionLabel } from '../lib/format'
import { Scrubber } from './Scrubber'
import { VolumeControl } from './VolumeControl'
import { Visualizer } from './Visualizer'
import { QueueDrawer } from './QueueDrawer'
import { InfoDrawer } from './InfoDrawer'
import { thumbSrc } from './MediaCard'

type Panel = 'audio' | 'subtitles' | 'speed' | 'eq' | 'more' | null

export function PlayerOverlay(): React.JSX.Element {
  const videoRef = useRef<HTMLVideoElement>(null)
  const shellRef = useRef<HTMLDivElement>(null)
  const hideTimer = useRef<number | null>(null)
  const clickTimer = useRef<number | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const playerOpen = useUi((state) => state.playerOpen)
  const fullscreen = useUi((state) => state.fullscreen)
  const infoOpen = useUi((state) => state.infoOpen)
  const queueOpen = useUi((state) => state.queueOpen)
  const setInfoOpen = useUi((state) => state.setInfoOpen)
  const setQueueOpen = useUi((state) => state.setQueueOpen)
  const closePlayer = useUi((state) => state.closePlayer)
  const setView = useUi((state) => state.setView)
  const setSettingsSection = useUi((state) => state.setSettingsSection)
  const setFullscreen = useUi((state) => state.setFullscreen)
  const toast = useUi((state) => state.toast)

  const item = usePlayer((state) => state.item)
  const playing = usePlayer((state) => state.playing)
  const buffering = usePlayer((state) => state.buffering)
  const loading = usePlayer((state) => state.loading)
  const time = usePlayer((state) => state.time)
  const duration = usePlayer((state) => state.duration)
  const mode = usePlayer((state) => state.mode)
  const error = usePlayer((state) => state.error)
  const rate = usePlayer((state) => state.rate)
  const subtitleIndex = usePlayer((state) => state.subtitleIndex)
  const cue = usePlayer((state) => state.cue)
  const repeat = usePlayer((state) => state.repeat)
  const abLoop = usePlayer((state) => state.abLoop)
  const filters = usePlayer((state) => state.filters)
  const zoom = usePlayer((state) => state.zoom)
  const rotation = usePlayer((state) => state.rotation)
  const toggle = usePlayer((state) => state.toggle)
  const next = usePlayer((state) => state.next)
  const previous = usePlayer((state) => state.previous)
  const seek = usePlayer((state) => state.seek)
  const skip = usePlayer((state) => state.skip)
  const snapshot = usePlayer((state) => state.snapshot)
  const retry = usePlayer((state) => state.retry)
  const settings = useSettings()

  const [panel, setPanel] = useState<Panel>(null)
  const [controlsVisible, setControlsVisible] = useState(true)

  useEffect(() => {
    if (videoRef.current) playback.attach(videoRef.current)
  }, [])

  const wake = useCallback(() => {
    setControlsVisible(true)
    if (hideTimer.current) window.clearTimeout(hideTimer.current)
    if (playing && playerOpen && !panel) {
      hideTimer.current = window.setTimeout(() => setControlsVisible(false), 2600)
    }
  }, [playing, playerOpen, panel])

  useEffect(() => {
    wake()
    return () => {
      if (hideTimer.current) window.clearTimeout(hideTimer.current)
    }
  }, [wake, item?.id])

  useEffect(() => {
    if (!playerOpen) {
      setPanel(null)
      setControlsVisible(true)
    }
  }, [playerOpen])

  useEffect(() => {
    if (!panel) return
    const onDown = (event: MouseEvent): void => {
      const target = event.target as HTMLElement
      if (panelRef.current?.contains(target)) return
      if (target.closest('.panel-trigger')) return
      setPanel(null)
    }
    window.addEventListener('mousedown', onDown)
    return () => window.removeEventListener('mousedown', onDown)
  }, [panel])

  useEffect(() => {
    if (!fullscreen && !playerOpen) return
    if (!playerOpen && fullscreen) {
      void window.api.window.setFullscreen(false)
      setFullscreen(false)
    }
  }, [playerOpen, fullscreen, setFullscreen])

  const live = !!item?.isStream && !duration
  const isAudio = item?.kind === 'audio'
  const mini = !playerOpen && !!item && settings.miniPlayer
  const hidden = !item

  const toggleFullscreen = async (): Promise<void> => {
    const value = !useUi.getState().fullscreen
    const actual = await window.api.window.setFullscreen(value)
    setFullscreen(actual)
  }

  const handleClose = async (): Promise<void> => {
    if (useUi.getState().fullscreen) {
      await window.api.window.setFullscreen(false)
      setFullscreen(false)
    }
    closePlayer()
  }

  const handleStageClick = (event: React.MouseEvent): void => {
    if (!playerOpen) return
    const target = event.target as HTMLElement
    if (target.closest('button, input, .player-topbar, .player-controls, .player-panel, .drawer, .player-error, .mini-player, .subtitle-layer')) {
      return
    }
    if (clickTimer.current) {
      window.clearTimeout(clickTimer.current)
      clickTimer.current = null
      void toggleFullscreen()
      return
    }
    clickTimer.current = window.setTimeout(() => {
      clickTimer.current = null
      toggle()
    }, 220)
  }

  const requestPip = async (): Promise<void> => {
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture()
      else if (videoRef.current) await videoRef.current.requestPictureInPicture()
    } catch {
      toast({ title: 'Picture-in-picture unavailable', tone: 'error' })
    }
  }

  const progress = duration ? (time / duration) * 100 : 0
  const resolution = item ? resolutionLabel(item.width, item.height) : null

  return (
    <>
      <div
        ref={shellRef}
        className={`player-shell ${playerOpen ? 'is-open' : mini ? 'is-mini' : 'is-hidden'} ${hidden ? 'is-idle' : ''}`}
        onMouseMove={playerOpen ? wake : undefined}
        onMouseLeave={() => {
          if (playerOpen && playing && !panel) {
            if (hideTimer.current) window.clearTimeout(hideTimer.current)
            hideTimer.current = window.setTimeout(() => setControlsVisible(false), 900)
          }
        }}
      >
        <div
          className={`player-stage ${controlsVisible ? 'controls-visible' : 'controls-hidden'}`}
          onClick={handleStageClick}
        >
          <video
            ref={videoRef}
            className={`player-video ${isAudio ? 'is-audio' : ''}`}
            style={{
              filter: `brightness(${filters.brightness}) contrast(${filters.contrast}) saturate(${filters.saturation})`,
              transform: `scale(${zoom}) rotate(${rotation}deg)`
            }}
            playsInline
          />

          {isAudio && item ? <AudioStage item={item} playing={playing} /> : null}

          {playerOpen ? (
            <>
              <div className="player-topbar ui-block">
                <button className="round-button" onClick={() => void handleClose()} aria-label="Back to library" data-tip="Back (Esc)">
                  <ArrowLeft size={19} />
                </button>
                <div className="player-heading">
                  <h2>{item?.title ?? 'Nothing playing'}</h2>
                  <div className="player-heading-meta">
                    {resolution ? <span>{resolution}</span> : null}
                    {item?.hdr ? <span className="chip hdr">HDR</span> : null}
                    {item?.audioTracks[0] ? <span>{item.audioTracks[0].codec.toUpperCase()}</span> : null}
                    <span className="engine-pill">{mode === 'native' ? 'Direct play' : 'FFmpeg pipeline'}</span>
                    {item?.folder ? <span className="folder-path">{item.folder.split(/[\\/]/).filter(Boolean).pop()}</span> : null}
                  </div>
                </div>
                <div className="player-top-actions">
                  <button
                    className={`round-button ${infoOpen ? 'active' : ''}`}
                    onClick={() => setInfoOpen(!infoOpen)}
                    aria-label="Media info"
                    data-tip="Media info (I)"
                  >
                    <Info size={18} />
                  </button>
                  <button
                    className={`round-button ${queueOpen ? 'active' : ''}`}
                    onClick={() => setQueueOpen(!queueOpen)}
                    aria-label="Queue"
                    data-tip="Queue (Q)"
                  >
                    <ListMusic size={18} />
                  </button>
                  <button className="round-button" onClick={() => void snapshot()} aria-label="Snapshot" data-tip="Snapshot">
                    <Camera size={18} />
                  </button>
                  <button className="round-button" onClick={() => void requestPip()} aria-label="Picture in picture" data-tip="Picture in picture">
                    <PictureInPicture2 size={18} />
                  </button>
                  <button className="round-button" onClick={() => void toggleFullscreen()} aria-label={fullscreen ? 'Exit fullscreen' : 'Fullscreen'} data-tip="Fullscreen (F)">
                    {fullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                  </button>
                  {!fullscreen ? (
                    <div className="player-window-controls">
                      <button className="window-button" onClick={() => void window.api.window.minimize()} aria-label="Minimize">
                        <Minus size={14} />
                      </button>
                      <button className="window-button" onClick={() => void window.api.window.maximize()} aria-label="Maximize">
                        <Square size={11} />
                      </button>
                      <button className="window-button window-close" onClick={() => void window.api.window.close()} aria-label="Close">
                        <X size={14} />
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>

              {item && subtitleIndex >= 0 && cue && settings.subtitle.enabled ? (
                <div
                  className="subtitle-layer"
                  style={{ bottom: `${Math.max(100 - settings.subtitle.position, 3)}%` }}
                >
                  <span
                    className="subtitle-cue"
                    style={{
                      fontFamily: settings.subtitle.fontFamily,
                      fontSize: `${settings.subtitle.size * 0.024}vh`,
                      color: settings.subtitle.color,
                      background: `rgba(0, 0, 0, ${settings.subtitle.background})`,
                      textShadow: `0 1px ${settings.subtitle.outline * 2}px rgba(0,0,0,0.9), 0 0 ${settings.subtitle.outline * 3}px rgba(0,0,0,0.6)`
                    }}
                  >
                    {cue.text}
                  </span>
                </div>
              ) : null}

              {loading && !error ? (
                <div className="player-center">
                  <div className="loading-ring" />
                  <span>Preparing your media</span>
                </div>
              ) : error ? (
                <div className="player-error ui-block">
                  <AlertTriangle size={28} />
                  <h2>Playback stopped</h2>
                  <p>{error}</p>
                  <div className="player-error-actions">
                    <button className="button primary" onClick={retry}>
                      Try again
                    </button>
                    <button className="button glass" onClick={() => void handleClose()}>
                      Back to library
                    </button>
                  </div>
                </div>
              ) : buffering ? (
                <div className="player-center">
                  <div className="loading-ring small" />
                  <span>Buffering</span>
                </div>
              ) : !playing ? (
                <button className="center-play" onClick={toggle} aria-label="Play">
                  <Play size={30} fill="currentColor" />
                </button>
              ) : null}

              <div className={`player-controls ui-block ${controlsVisible ? 'visible' : ''}`}>
                <Scrubber
                  time={time}
                  duration={duration}
                  chapters={item?.chapters ?? []}
                  abLoop={abLoop}
                  onSeek={seek}
                  live={live}
                />
                <div className="controls-main">
                  <div className="controls-left">
                    <button className="control-button" onClick={previous} aria-label="Previous" data-tip="Previous (P)">
                      <SkipBack size={19} fill="currentColor" />
                    </button>
                    <button className="play-button" onClick={toggle} aria-label={playing ? 'Pause' : 'Play'} data-tip="Play / pause (Space)">
                      {playing ? <Pause size={21} fill="currentColor" /> : <Play size={21} fill="currentColor" />}
                    </button>
                    <button className="control-button" onClick={next} aria-label="Next" data-tip="Next (N)">
                      <SkipForward size={19} fill="currentColor" />
                    </button>
                    <div className="skip-group">
                      <button className="control-button" onClick={() => skip(-settings.skipSeconds)} aria-label="Skip back" data-tip={`Back ${settings.skipSeconds}s (←)`}>
                        <span className="skip-icon">−{settings.skipSeconds}</span>
                      </button>
                      <button className="control-button" onClick={() => skip(settings.skipSeconds)} aria-label="Skip forward" data-tip={`Forward ${settings.skipSeconds}s (→)`}>
                        <span className="skip-icon">+{settings.skipSeconds}</span>
                      </button>
                    </div>
                    <VolumeControl />
                    <div className="time-readout">
                      <span>{formatTime(time)}</span>
                      <span className="time-sep">/</span>
                      <span>{live ? 'LIVE' : formatTime(duration)}</span>
                    </div>
                  </div>
                  <div className="controls-right">
                    <button
                      className={`control-button panel-trigger ${subtitleIndex >= 0 ? 'active' : ''}`}
                      onClick={() => setPanel(panel === 'subtitles' ? null : 'subtitles')}
                      aria-label="Subtitles"
                      data-tip="Subtitles (S)"
                    >
                      <Captions size={19} />
                      {subtitleIndex >= 0 ? <span className="active-dot" /> : null}
                    </button>
                    <button
                      className={`control-button panel-trigger ${item && item.audioTracks.length > 1 ? 'active' : ''}`}
                      onClick={() => setPanel(panel === 'audio' ? null : 'audio')}
                      aria-label="Audio track"
                      data-tip="Audio track (A)"
                    >
                      <AudioLines size={19} />
                    </button>
                    <button
                      className="control-button speed-trigger panel-trigger"
                      onClick={() => setPanel(panel === 'speed' ? null : 'speed')}
                      aria-label="Playback speed"
                      data-tip="Playback speed ([ ])"
                    >
                      {rate.toFixed(rate % 1 === 0 ? 0 : 2)}×
                    </button>
                    <button
                      className={`control-button panel-trigger ${settings.eq.enabled ? 'active' : ''}`}
                      onClick={() => setPanel(panel === 'eq' ? null : 'eq')}
                      aria-label="Equalizer"
                      data-tip="Equalizer"
                    >
                      <SlidersHorizontal size={18} />
                    </button>
                    <button
                      className={`control-button panel-trigger ${repeat !== 'off' ? 'active' : ''}`}
                      onClick={() => setPanel(panel === 'more' ? null : 'more')}
                      aria-label="More options"
                      data-tip="More"
                    >
                      <MoreHorizontal size={19} />
                    </button>
                    <button className="control-button" onClick={() => void requestPip()} aria-label="Picture in picture" data-tip="Picture in picture">
                      <PictureInPicture2 size={18} />
                    </button>
                    <button className="control-button" onClick={() => void toggleFullscreen()} aria-label={fullscreen ? 'Exit fullscreen' : 'Fullscreen'} data-tip="Fullscreen (F)">
                      {fullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                    </button>
                  </div>
                </div>
              </div>

              {panel ? (
                <div className="player-panel ui-block" ref={panelRef}>
                  <PanelContent
                    panel={panel}
                    onClose={() => setPanel(null)}
                    onOpenSettings={() => {
                      setView('settings')
                      setSettingsSection(panel === 'eq' ? 'audio' : 'subtitles')
                      void handleClose()
                    }}
                  />
                </div>
              ) : null}
            </>
          ) : mini && item ? (
            <MiniPlayer
              item={item}
              playing={playing}
              time={time}
              duration={duration}
              progress={progress}
              onOpen={() => useUi.getState().openPlayer()}
            />
          ) : null}
        </div>
      </div>

      {playerOpen ? (
        <>
          <QueueDrawer />
          <InfoDrawer />
        </>
      ) : null}
    </>
  )
}

function AudioStage({ item, playing }: { item: MediaInfo; playing: boolean }): React.JSX.Element {
  const cover = thumbSrc(item)
  return (
    <div className="audio-stage">
      {cover ? <img className="audio-bg" src={cover} alt="" /> : <div className="audio-bg fallback tone-4" />}
      <div className="audio-wash" />
      <div className="audio-content">
        <div className="audio-cover">
          {cover ? <img src={cover} alt="" /> : <Music2 size={64} />}
          <span className="cover-glint" />
        </div>
        <div className="audio-title">{item.title}</div>
        <div className="audio-artist">
          {[item.tags?.artist, item.tags?.album].filter(Boolean).join(' · ') || 'Unknown artist'}
        </div>
      </div>
      <Visualizer playing={playing} />
    </div>
  )
}

function MiniPlayer({
  item,
  playing,
  time,
  duration,
  progress,
  onOpen
}: {
  item: MediaInfo
  playing: boolean
  time: number
  duration: number
  progress: number
  onOpen: () => void
}): React.JSX.Element {
  const toggle = usePlayer((state) => state.toggle)
  const next = usePlayer((state) => state.next)
  const stop = usePlayer((state) => state.stop)
  const cover = thumbSrc(item)
  return (
    <div className="mini-player ui-block" onClick={onOpen}>
      <div className="mini-progress">
        <div style={{ width: `${progress}%` }} />
      </div>
      <div className="mini-glow" />
      <div className={`mini-art ${item.kind === 'audio' ? 'is-audio' : ''}`}>
        {cover ? (
          <img src={cover} alt="" />
        ) : item.kind === 'audio' ? (
          <Music2 size={20} />
        ) : (
          <Film size={20} />
        )}
      </div>
      <div className="mini-info">
        <span className="mini-eyebrow">
          <span className={`eq-bars tiny ${playing ? 'playing' : ''}`}>
            <i /><i /><i />
          </span>
          {playing ? 'Now playing' : 'Paused'}
        </span>
        <strong>{item.title}</strong>
        <span>
          {formatTime(time)} / {formatTime(duration)}
        </span>
      </div>
      <div className="mini-actions" onClick={(event) => event.stopPropagation()}>
        <button className="mini-button" onClick={toggle} aria-label={playing ? 'Pause' : 'Play'}>
          {playing ? <Pause size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" />}
        </button>
        <button className="mini-button" onClick={next} aria-label="Next">
          <SkipForward size={16} fill="currentColor" />
        </button>
        <button className="mini-button" onClick={onOpen} aria-label="Expand player">
          <Maximize2 size={16} />
        </button>
        <button className="mini-button" onClick={stop} aria-label="Close player">
          <X size={16} />
        </button>
      </div>
    </div>
  )
}

function PanelContent({
  panel,
  onClose,
  onOpenSettings
}: {
  panel: Exclude<Panel, null>
  onClose: () => void
  onOpenSettings: () => void
}): React.JSX.Element {
  const item = usePlayer((state) => state.item)
  const audioIndex = usePlayer((state) => state.audioIndex)
  const setAudio = usePlayer((state) => state.setAudio)
  const subtitleIndex = usePlayer((state) => state.subtitleIndex)
  const subtitleTracks = usePlayer((state) => state.subtitleTracks)
  const setSubtitle = usePlayer((state) => state.setSubtitle)
  const addExternalSubtitle = usePlayer((state) => state.addExternalSubtitle)
  const subtitleDelay = usePlayer((state) => state.subtitleDelay)
  const setSubtitleDelay = usePlayer((state) => state.setSubtitleDelay)
  const rate = usePlayer((state) => state.rate)
  const setRate = usePlayer((state) => state.setRate)
  const repeat = usePlayer((state) => state.repeat)
  const setRepeat = usePlayer((state) => state.setRepeat)
  const abLoop = usePlayer((state) => state.abLoop)
  const setABLoop = usePlayer((state) => state.setABLoop)
  const time = usePlayer((state) => state.time)
  const zoom = usePlayer((state) => state.zoom)
  const rotation = usePlayer((state) => state.rotation)
  const setZoom = usePlayer((state) => state.setZoom)
  const setRotation = usePlayer((state) => state.setRotation)
  const filters = usePlayer((state) => state.filters)
  const setFilters = usePlayer((state) => state.setFilters)
  const resetFilters = usePlayer((state) => state.resetFilters)
  const snapshot = usePlayer((state) => state.snapshot)
  const settings = useSettings()
  const toast = useUi((state) => state.toast)

  if (panel === 'audio') {
    return (
      <>
        <header className="panel-head">
          <h3>Audio track</h3>
          <span>{item?.audioTracks.length ?? 0} available</span>
        </header>
        <div className="panel-list">
          {item?.audioTracks.map((track) => (
            <button
              key={track.index}
              className={`panel-row ${audioIndex === track.index ? 'selected' : ''}`}
              onClick={() => {
                setAudio(track.index)
                onClose()
              }}
            >
              <div>
                <strong>
                  {track.title || languageName(track.language)}
                  {track.default ? ' · Default' : ''}
                </strong>
                <span>{audioLabel(track.codec, track.channels)}{track.sampleRate ? ` · ${track.sampleRate / 1000} kHz` : ''}</span>
              </div>
              {audioIndex === track.index ? <Check size={17} /> : null}
            </button>
          ))}
        </div>
        <p className="panel-note">Switching tracks restarts the compatibility pipeline at your current position.</p>
      </>
    )
  }

  if (panel === 'subtitles') {
    return (
      <>
        <header className="panel-head">
          <h3>Subtitles</h3>
          <button className="icon-button tiny" onClick={onClose} aria-label="Close">
            <X size={14} />
          </button>
        </header>
        <div className="panel-list">
          <button
            className={`panel-row ${subtitleIndex < 0 ? 'selected' : ''}`}
            onClick={() => {
              void setSubtitle(-1)
              onClose()
            }}
          >
            <div>
              <strong>Off</strong>
              <span>Hide subtitles</span>
            </div>
            {subtitleIndex < 0 ? <Check size={17} /> : null}
          </button>
          {subtitleTracks.map((track) => (
            <button
              key={track.index}
              className={`panel-row ${subtitleIndex === track.index ? 'selected' : ''}`}
              onClick={() => {
                void setSubtitle(track.index)
                onClose()
              }}
            >
              <div>
                <strong>{track.title || languageName(track.language)}</strong>
                <span>
                  {track.codec.toUpperCase()}
                  {track.forced ? ' · Forced' : ''}
                  {track.external ? ' · External' : ''}
                </span>
              </div>
              {subtitleIndex === track.index ? <Check size={17} /> : null}
            </button>
          ))}
        </div>
        <button
          className="panel-action"
          onClick={() => {
            void addExternalSubtitle()
            onClose()
          }}
        >
          <Plus size={16} /> Add subtitle file…
        </button>
        <div className="panel-slider">
          <div>
            <span>Delay</span>
            <strong>{subtitleDelay > 0 ? '+' : ''}{subtitleDelay.toFixed(1)}s</strong>
          </div>
          <input
            type="range"
            min={-10}
            max={10}
            step={0.1}
            value={subtitleDelay}
            onChange={(event) => setSubtitleDelay(Number(event.target.value))}
          />
        </div>
        <button className="panel-action subtle" onClick={onOpenSettings}>
          <Settings2 size={15} /> Subtitle style & language
          <ChevronRight size={15} />
        </button>
      </>
    )
  }

  if (panel === 'speed') {
    return (
      <>
        <header className="panel-head">
          <h3>Playback speed</h3>
          <span>{rate.toFixed(2)}×</span>
        </header>
        <div className="speed-grid">
          {[0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 3, 4].map((value) => (
            <button
              key={value}
              className={`speed-button ${Math.abs(rate - value) < 0.001 ? 'active' : ''}`}
              onClick={() => {
                setRate(value)
                onClose()
              }}
            >
              {value}×
            </button>
          ))}
        </div>
        <p className="panel-note">Pitch is preserved. Use [ and ] to nudge the speed.</p>
      </>
    )
  }

  if (panel === 'eq') {
    return (
      <>
        <header className="panel-head">
          <h3>Equalizer</h3>
          <button
            className={`toggle small ${settings.eq.enabled ? 'on' : ''}`}
            role="switch"
            aria-checked={settings.eq.enabled}
            onClick={() => settings.updateEq({ enabled: !settings.eq.enabled })}
          >
            <span className="toggle-knob" />
          </button>
        </header>
        <div className="preset-chips">
          {['Flat', 'Bass boost', 'Rock', 'Pop', 'Jazz', 'Vocal', 'Late night'].map((preset) => (
            <button
              key={preset}
              className={`chip-button ${settings.eq.preset === preset ? 'active' : ''}`}
              onClick={() => {
                const bands = preset === 'Flat'
                  ? [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
                  : preset === 'Bass boost'
                    ? [7, 6, 4, 2, 0, 0, 0, 0, 0, 0]
                    : preset === 'Rock'
                      ? [5, 4, 2, -1, -2, -1, 2, 4, 5, 5]
                      : preset === 'Pop'
                        ? [-1, 0, 2, 4, 4, 2, 0, -1, -1, -1]
                        : preset === 'Jazz'
                          ? [4, 3, 1, 2, -1, -1, 0, 1, 3, 4]
                          : preset === 'Vocal'
                            ? [-2, -1, 0, 2, 5, 5, 3, 1, 0, -1]
                            : [-3, -2, -1, 0, 2, 3, 3, 1, -1, -2]
                settings.updateEq({ preset, bands, enabled: true })
              }}
            >
              {preset}
            </button>
          ))}
        </div>
        <button className="panel-action subtle" onClick={onOpenSettings}>
          <Settings2 size={15} /> Open full 10-band EQ
          <ChevronRight size={15} />
        </button>
      </>
    )
  }

  return (
    <>
      <header className="panel-head">
        <h3>Playback options</h3>
        <button className="icon-button tiny" onClick={onClose} aria-label="Close">
          <X size={14} />
        </button>
      </header>
      <div className="panel-group">
        <span className="panel-label">Repeat</span>
        <div className="segmented compact">
          {(['off', 'all', 'one'] as const).map((value) => (
            <button key={value} className={repeat === value ? 'active' : ''} onClick={() => setRepeat(value)}>
              {value === 'one' ? <Repeat1 size={14} /> : <Repeat size={14} />}
              {value === 'off' ? 'Off' : value === 'all' ? 'All' : 'One'}
            </button>
          ))}
        </div>
      </div>
      <div className="panel-group">
        <span className="panel-label">A–B loop</span>
        <div className="ab-row">
          <button
            className="button ghost small"
            onClick={() => setABLoop({ a: time, b: abLoop.b && abLoop.b > time ? abLoop.b : null })}
          >
            Set A
          </button>
          <button
            className="button ghost small"
            onClick={() => {
              const a = abLoop.a ?? 0
              if (time <= a) {
                toast({ title: 'Choose a point after A', tone: 'error' })
                return
              }
              setABLoop({ a, b: time })
            }}
          >
            Set B
          </button>
          <button className="button ghost small" onClick={() => setABLoop({ a: null, b: null })}>
            Clear
          </button>
        </div>
        <span className="panel-hint">
          {abLoop.a !== null ? formatTime(abLoop.a) : '—'} → {abLoop.b !== null ? formatTime(abLoop.b) : '—'}
        </span>
      </div>
      <div className="panel-group">
        <span className="panel-label">Picture</span>
        <div className="option-row">
          <span>Zoom</span>
          <div className="stepper">
            <button onClick={() => setZoom(zoom - 0.1)}>−</button>
            <strong>{Math.round(zoom * 100)}%</strong>
            <button onClick={() => setZoom(zoom + 0.1)}>+</button>
          </div>
        </div>
        <div className="option-row">
          <span>Rotate</span>
          <button className="button ghost small" onClick={() => setRotation(rotation + 90)}>
            {rotation}° · Rotate
          </button>
        </div>
        <div className="filter-slider">
          <span>Brightness</span>
          <input
            type="range"
            min={0.5}
            max={1.6}
            step={0.01}
            value={filters.brightness}
            onChange={(event) => setFilters({ brightness: Number(event.target.value) })}
          />
        </div>
        <div className="filter-slider">
          <span>Contrast</span>
          <input
            type="range"
            min={0.5}
            max={1.6}
            step={0.01}
            value={filters.contrast}
            onChange={(event) => setFilters({ contrast: Number(event.target.value) })}
          />
        </div>
        <div className="filter-slider">
          <span>Saturation</span>
          <input
            type="range"
            min={0}
            max={2}
            step={0.01}
            value={filters.saturation}
            onChange={(event) => setFilters({ saturation: Number(event.target.value) })}
          />
        </div>
        <div className="filter-actions">
          <button className="button ghost small" onClick={resetFilters}>
            Reset picture
          </button>
          <button className="button ghost small" onClick={() => void snapshot()}>
            <Camera size={14} /> Snapshot
          </button>
        </div>
      </div>
      <div className="panel-engine">
        <Gauge size={15} />
        <span>
          {usePlayer.getState().mode === 'native' ? 'Direct play · hardware decode' : 'FFmpeg compatibility pipeline'}
        </span>
      </div>
    </>
  )
}
