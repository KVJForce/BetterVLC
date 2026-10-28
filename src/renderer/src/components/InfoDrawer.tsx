import { AnimatePresence, motion } from 'framer-motion'
import {
  Check,
  Copy,
  ExternalLink,
  FileAudio,
  FileVideo,
  Info,
  Layers,
  ListMusic,
  Subtitles,
  X
} from 'lucide-react'
import { usePlayer } from '../store/player'
import { useUi } from '../store/ui'
import { MediaArt } from './MediaCard'
import {
  audioLabel,
  codecLabel,
  containerLabel,
  formatBitrate,
  formatBytes,
  formatDate,
  formatTime,
  languageName,
  resolutionLabel
} from '../lib/format'

export function InfoDrawer(): React.JSX.Element {
  const open = useUi((state) => state.infoOpen)
  const setInfoOpen = useUi((state) => state.setInfoOpen)
  const item = usePlayer((state) => state.item)
  const mode = usePlayer((state) => state.mode)
  const toast = useUi((state) => state.toast)
  const close = (): void => setInfoOpen(false)

  const copy = async (value: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(value)
      toast({ title: 'Copied to clipboard', tone: 'success' })
    } catch {
      toast({ title: 'Could not copy', tone: 'error' })
    }
  }

  return (
    <AnimatePresence>
      {open && item ? (
        <motion.div
          className="drawer-scrim"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={close}
          key="info-drawer"
        >
          <motion.aside
            className="drawer info-drawer"
            role="dialog"
            aria-label="Media information"
            initial={{ x: 460, opacity: 0.6 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 460, opacity: 0.4 }}
            transition={{ type: 'spring', stiffness: 360, damping: 36 }}
            onClick={(event) => event.stopPropagation()}
          >
            <header className="drawer-head info-drawer-head">
              <div className="info-hero">
                <div className="info-art">
                  <MediaArt item={item} iconSize={28} />
                </div>
                <div className="info-hero-text">
                  <span className="eyebrow">
                    {item.kind === 'video' ? <FileVideo size={12} /> : <FileAudio size={12} />}
                    {item.kind === 'video' ? 'Video' : 'Audio'}
                    {item.isStream ? ' · Live stream' : ''}
                  </span>
                  <h2>{item.title}</h2>
                  <p>{item.name}</p>
                </div>
              </div>
              <button className="round-button drawer-close" onClick={close} aria-label="Close media info">
                <X size={18} />
              </button>
            </header>

            <div className="drawer-body info-body">
              <section className="info-section">
                <h3>
                  <Info size={14} /> Overview
                </h3>
                <InfoRow label="Container" value={containerLabel(item.container)} />
                <InfoRow label="Format" value={item.formatLong} />
                <InfoRow label="Duration" value={item.isStream ? 'Live' : formatTime(item.duration, true)} />
                <InfoRow label="Bitrate" value={formatBitrate(item.bitrate)} />
                <InfoRow label="File size" value={item.isStream ? '—' : formatBytes(item.size)} />
                {item.tags?.artist ? <InfoRow label="Artist" value={item.tags.artist} /> : null}
                {item.tags?.album ? <InfoRow label="Album" value={item.tags.album} /> : null}
                {item.tags?.genre ? <InfoRow label="Genre" value={item.tags.genre} /> : null}
                {item.tags?.date ? <InfoRow label="Released" value={item.tags.date} /> : null}
              </section>

              {item.kind === 'video' ? (
                <section className="info-section">
                  <h3>
                    <Layers size={14} /> Video
                  </h3>
                  <InfoRow label="Resolution" value={resolutionLabel(item.width, item.height) ?? '—'} />
                  <InfoRow label="Codec" value={codecLabel(item.videoCodec)} />
                  {item.videoProfile ? <InfoRow label="Profile" value={item.videoProfile} /> : null}
                  {item.videoLevel ? <InfoRow label="Level" value={`${item.videoLevel}`} /> : null}
                  {item.fps ? <InfoRow label="Frame rate" value={`${item.fps.toFixed(item.fps % 1 === 0 ? 0 : 2)} fps`} /> : null}
                  {item.pixFmt ? <InfoRow label="Pixel format" value={item.pixFmt} /> : null}
                  <InfoRow label="HDR" value={item.hdr ? 'Yes · HDR10 / HLG' : 'SDR'} />
                  <InfoRow label="Codec string" value={item.codecString} mono />
                </section>
              ) : null}

              <section className="info-section">
                <h3>
                  <FileAudio size={14} /> Audio
                  <span className="info-count">{item.audioTracks.length}</span>
                </h3>
                {item.audioTracks.length === 0 ? (
                  <p className="info-empty">No audio streams.</p>
                ) : (
                  <div className="info-track-list">
                    {item.audioTracks.map((track, trackIndex) => (
                      <div className={`info-track ${trackIndex === 0 ? 'primary' : ''}`} key={track.index}>
                        <div>
                          <strong>
                            {track.title || languageName(track.language)}
                            {track.default ? <span className="info-tag">Default</span> : null}
                          </strong>
                          <span>{audioLabel(track.codec, track.channels)}</span>
                        </div>
                        <small>
                          {track.sampleRate ? `${(track.sampleRate / 1000).toFixed(track.sampleRate % 1000 ? 1 : 0)} kHz` : '—'}
                          {track.bitrate ? ` · ${formatBitrate(track.bitrate)}` : ''}
                        </small>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="info-section">
                <h3>
                  <Subtitles size={14} /> Subtitles
                  <span className="info-count">{item.subtitleTracks.length}</span>
                </h3>
                {item.subtitleTracks.length === 0 ? (
                  <p className="info-empty">No subtitle streams.</p>
                ) : (
                  <div className="info-track-list">
                    {item.subtitleTracks.map((track) => (
                      <div className="info-track" key={track.index}>
                        <div>
                          <strong>
                            {track.title || languageName(track.language)}
                            {track.forced ? <span className="info-tag">Forced</span> : null}
                            {track.external ? <span className="info-tag">External</span> : null}
                          </strong>
                          <span>{codecLabel(track.codec)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {item.chapters.length ? (
                <section className="info-section">
                  <h3>
                    <ListMusic size={14} /> Chapters
                    <span className="info-count">{item.chapters.length}</span>
                  </h3>
                  <div className="info-chapters">
                    {item.chapters.map((chapter, chapterIndex) => (
                      <button
                        key={`${chapter.start}-${chapterIndex}`}
                        className="info-chapter"
                        onClick={() => usePlayer.getState().seek(chapter.start)}
                      >
                        <span className="info-chapter-index">{String(chapterIndex + 1).padStart(2, '0')}</span>
                        <span className="info-chapter-title">{chapter.title}</span>
                        <span className="info-chapter-time">{formatTime(chapter.start)}</span>
                      </button>
                    ))}
                  </div>
                </section>
              ) : null}

              <section className="info-section">
                <h3>
                  <Layers size={14} /> Playback
                </h3>
                <InfoRow label="Engine" value={mode === 'mse' ? 'FFmpeg compatibility pipeline' : 'Direct play'} />
                <InfoRow label="Native capable" value={item.nativePlayable ? 'Yes' : 'No · remux or transcode'} />
                <InfoRow label="Video strategy" value={item.videoCopy ? 'Stream copy (H.264)' : 'Transcode (H.264)'} />
                <InfoRow label="MSE MIME" value={item.mseMime} mono />
                {item.folder ? <InfoRow label="Added" value={formatDate(item.addedAt)} /> : null}
                {item.mtime ? <InfoRow label="Modified" value={formatDate(item.mtime)} /> : null}
              </section>

              <section className="info-section">
                <h3>
                  <ExternalLink size={14} /> Location
                </h3>
                <div className="info-path">
                  <span title={item.path}>{item.path}</span>
                  <button className="icon-button tiny" onClick={() => void copy(item.path)} aria-label="Copy path">
                    <Copy size={13} />
                  </button>
                </div>
                {!item.isStream ? (
                  <button
                    className="button ghost small info-reveal"
                    onClick={() => void window.api.library.reveal(item.path)}
                  >
                    <ExternalLink size={14} /> Show in Explorer
                  </button>
                ) : (
                  <div className="info-stream-note">
                    <Check size={14} /> Network stream · details are read from the live source.
                  </div>
                )}
              </section>
            </div>
          </motion.aside>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

function InfoRow({
  label,
  value,
  mono = false
}: {
  label: string
  value: React.ReactNode
  mono?: boolean
}): React.JSX.Element {
  return (
    <div className="info-row">
      <span>{label}</span>
      <strong className={mono ? 'mono' : ''}>{value}</strong>
    </div>
  )
}
