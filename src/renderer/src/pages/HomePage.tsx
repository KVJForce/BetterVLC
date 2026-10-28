import {
  ArrowRight,
  Captions,
  Film,
  FolderPlus,
  Layers,
  LibraryBig,
  Play,
  Plus,
  Sparkles
} from 'lucide-react'
import { motion } from 'framer-motion'
import type { MediaInfo } from '../../../shared/types'
import { useLibrary } from '../store/library'
import { useHistory, progressOf } from '../store/history'
import { usePlayer } from '../store/player'
import { useUi } from '../store/ui'
import { MediaArt, MediaCard, thumbSrc } from '../components/MediaCard'
import { addFolder, openMediaFiles, playMedia } from '../lib/actions'
import { formatTime } from '../lib/format'

export function HomePage(): React.JSX.Element {
  const items = useLibrary((state) => state.items)
  const folders = useLibrary((state) => state.folders)
  const entries = useHistory((state) => state.entries)
  const setView = useUi((state) => state.setView)
  const setLibraryFolder = useUi((state) => state.setLibraryFolder)
  const playItem = usePlayer((state) => state.playItem)

  const continueItems = items
    .filter((item) => {
      const entry = entries[item.id]
      const progress = progressOf(entry)
      return progress > 0.01 && progress < 0.97
    })
    .sort((a, b) => (entries[b.id]?.updatedAt ?? 0) - (entries[a.id]?.updatedAt ?? 0))

  const recent = [...items].sort((a, b) => b.addedAt - a.addedAt).slice(0, 10)
  const hero = continueItems[0] ?? recent[0]
  const heroProgress = hero ? progressOf(entries[hero.id]) : 0
  const date = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  })

  return (
    <div className="page home-page">
      <header className="home-head">
        <div>
          <span className="eyebrow">{date}</span>
          <h1>Your media, beautifully played.</h1>
          <p>
            {items.length
              ? `${items.length} titles across ${folders.length} ${folders.length === 1 ? 'folder' : 'folders'}. No codec left behind.`
              : 'Drop in a file, add a folder, or open a stream. BetterVLC handles the rest.'}
          </p>
        </div>
        <div className="home-actions">
          <button className="button ghost" onClick={() => void addFolder()}>
            <FolderPlus size={17} />
            Add folder
          </button>
          <button className="button primary" onClick={() => void openMediaFiles()}>
            <Plus size={17} />
            Open file
          </button>
        </div>
      </header>

      {hero ? (
        <motion.section
          className="hero"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          {thumbSrc(hero) ? (
            <img className="hero-bg" src={thumbSrc(hero)} alt="" draggable={false} />
          ) : (
            <div className={`hero-bg fallback tone-${hero.kind === 'audio' ? '4' : '0'}`} />
          )}
          <div className="hero-wash" />
          <div className="hero-content">
            <span className="hero-eyebrow">
              <Sparkles size={14} />
              {heroProgress > 0.01 ? 'Continue watching' : 'Featured in your library'}
            </span>
            <h2>{hero.title}</h2>
            <p>
              {hero.kind === 'audio'
                ? [hero.tags?.artist, hero.tags?.album].filter(Boolean).join(' · ')
                : [hero.width && hero.height ? `${hero.width}×${hero.height}` : null, hero.container.split(',')[0]?.toUpperCase(), formatTime(hero.duration)]
                    .filter(Boolean)
                    .join(' · ')}
            </p>
            {heroProgress > 0.01 ? (
              <div className="hero-progress">
                <div className="hero-progress-track">
                  <div style={{ width: `${heroProgress * 100}%` }} />
                </div>
                <span>
                  {formatTime(entries[hero.id]?.position ?? 0)} / {formatTime(hero.duration)}
                </span>
              </div>
            ) : null}
            <div className="hero-buttons">
              <button className="button primary large" onClick={() => playItem(hero, recent.length ? recent : items)}>
                <Play size={18} fill="currentColor" />
                {heroProgress > 0.01 ? 'Resume' : 'Play now'}
              </button>
              {heroProgress > 0.01 ? (
                <button
                  className="button glass large"
                  onClick={() => playItem(hero, recent.length ? recent : items, { start: 0 })}
                >
                  Start over
                </button>
              ) : (
                <button className="button glass large" onClick={() => setView('library')}>
                  Browse library
                  <ArrowRight size={17} />
                </button>
              )}
            </div>
          </div>
          <div className="hero-side">
            <span className="hero-chip">
              <Layers size={13} /> {hero.videoCodec ? hero.videoCodec.toUpperCase() : 'LOSSLESS'}
            </span>
            {hero.hdr ? <span className="hero-chip">HDR</span> : null}
            {hero.audioTracks[0] ? (
              <span className="hero-chip">{hero.audioTracks[0].channels} CH</span>
            ) : null}
          </div>
        </motion.section>
      ) : (
        <motion.section
          className="hero hero-empty"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="hero-orbit orbit-one" />
          <div className="hero-orbit orbit-two" />
          <div className="hero-glow" />
          <div className="empty-hero-content">
            <span className="hero-eyebrow">
              <Sparkles size={14} /> Everything plays
            </span>
            <h2>Drop anything.<br />It just plays.</h2>
            <p>
              MKV, HEVC, AV1, FLAC, HLS, RTSP — BetterVLC brings a full FFmpeg engine and a
              beautiful face to every file you own.
            </p>
            <div className="hero-buttons">
              <button className="button primary large" onClick={() => void openMediaFiles()}>
                <Play size={18} fill="currentColor" />
                Open a file
              </button>
              <button className="button glass large" onClick={() => void addFolder()}>
                <FolderPlus size={17} />
                Add a folder
              </button>
            </div>
            <div className="format-ticker">
              {['MKV', 'HEVC', 'AV1', 'FLAC', 'HLS', 'RTSP', 'ASS', 'DTS'].map((format) => (
                <span key={format}>{format}</span>
              ))}
            </div>
          </div>
        </motion.section>
      )}

      {continueItems.length ? (
        <section className="section">
          <div className="section-head">
            <div>
              <span className="eyebrow">Pick up where you left off</span>
              <h2>Continue watching</h2>
            </div>
            <button className="text-button" onClick={() => setView('library')}>
              See all <ArrowRight size={15} />
            </button>
          </div>
          <div className="media-row">
            {continueItems.slice(0, 6).map((item) => (
              <MediaCard key={item.id} item={item} queue={continueItems} wide />
            ))}
          </div>
        </section>
      ) : null}

      {recent.length ? (
        <section className="section">
          <div className="section-head">
            <div>
              <span className="eyebrow">Fresh in your collection</span>
              <h2>Recently added</h2>
            </div>
            <button className="text-button" onClick={() => setView('library')}>
              View library <ArrowRight size={15} />
            </button>
          </div>
          <div className="media-grid">
            {recent.map((item) => (
              <MediaCard key={item.id} item={item} queue={recent} />
            ))}
          </div>
        </section>
      ) : null}

      {folders.length ? (
        <section className="section">
          <div className="section-head">
            <div>
              <span className="eyebrow">Sources</span>
              <h2>Your folders</h2>
            </div>
            <button className="text-button" onClick={() => void addFolder()}>
              Add folder <Plus size={15} />
            </button>
          </div>
          <div className="folder-grid">
            {folders.map((folder) => {
              const folderItems = items.filter((item) =>
                item.path.toLowerCase().startsWith(folder.toLowerCase())
              )
              const cover = folderItems.find((item) => item.thumb)
              return (
                <button
                  key={folder}
                  className="folder-card"
                  onClick={() => {
                    setLibraryFolder(folder)
                    setView('library')
                  }}
                >
                  <div className="folder-cover">
                    {cover ? <MediaArt item={cover} iconSize={24} /> : <LibraryBig size={26} />}
                    <span className="folder-count-pill">{folderItems.length}</span>
                  </div>
                  <div className="folder-card-info">
                    <span>{folder.split(/[\\/]/).filter(Boolean).pop()}</span>
                    <small>
                      {formatTime(folderItems.reduce((sum, item) => sum + item.duration, 0), true)} of media
                    </small>
                  </div>
                </button>
              )
            })}
          </div>
        </section>
      ) : null}

      {!items.length ? (
        <section className="section">
          <div className="feature-grid">
            <FeatureCard
              icon={<Film size={20} />}
              title="Plays everything"
              text="A complete FFmpeg pipeline decodes, remuxes and transcodes on the fly — so old AVI files and 4K HEVC look equally effortless."
            />
            <FeatureCard
              icon={<Captions size={20} />}
              title="Subtitles, perfected"
              text="SRT, ASS, SSA and VTT with delay control, custom typography and styling that looks like it belongs."
            />
            <FeatureCard
              icon={<LibraryBig size={20} />}
              title="A library worth browsing"
              text="Artwork, resume points and instant search. Your collection finally gets the presentation it deserves."
            />
          </div>
        </section>
      ) : null}

      <footer className="home-foot">
        <span>BetterVLC</span>
        <span className="dot" />
        <span>Powered by FFmpeg</span>
        <span className="dot" />
        <span>Made for your media</span>
      </footer>
    </div>
  )
}

function FeatureCard({
  icon,
  title,
  text
}: {
  icon: React.ReactNode
  title: string
  text: string
}): React.JSX.Element {
  return (
    <div className="feature-card">
      <div className="feature-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  )
}
