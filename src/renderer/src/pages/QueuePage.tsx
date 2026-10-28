import {
  ArrowDown,
  ArrowUp,
  ListMusic,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  SkipBack,
  SkipForward,
  Trash2,
  X
} from 'lucide-react'
import { usePlayer } from '../store/player'
import { useHistory, progressOf } from '../store/history'
import { useUi } from '../store/ui'
import { MediaArt } from '../components/MediaCard'
import { openMediaFiles, playMedia } from '../lib/actions'
import { formatTime, totalDuration } from '../lib/format'

export function QueuePage(): React.JSX.Element {
  const queue = usePlayer((state) => state.queue)
  const index = usePlayer((state) => state.index)
  const item = usePlayer((state) => state.item)
  const playing = usePlayer((state) => state.playing)
  const time = usePlayer((state) => state.time)
  const duration = usePlayer((state) => state.duration)
  const toggle = usePlayer((state) => state.toggle)
  const next = usePlayer((state) => state.next)
  const previous = usePlayer((state) => state.previous)
  const playAt = usePlayer((state) => state.playAt)
  const moveQueue = usePlayer((state) => state.moveQueue)
  const removeFromQueue = usePlayer((state) => state.removeFromQueue)
  const clearQueue = usePlayer((state) => state.clearQueue)
  const stop = usePlayer((state) => state.stop)
  const setQueueOpen = useUi((state) => state.setQueueOpen)
  const showContextMenu = useUi((state) => state.showContextMenu)
  const entry = useHistory((state) => (item ? state.entries[item.id] : undefined))

  if (!item || !queue.length) {
    return (
      <div className="page queue-page">
        <header className="library-head">
          <div>
            <span className="eyebrow">Playback</span>
            <h1>Queue</h1>
            <p>Nothing queued yet. Your next watch is one click away.</p>
          </div>
        </header>
        <div className="empty-state">
          <div className="empty-art">
            <div className="empty-ring" />
            <ListMusic size={38} />
          </div>
          <h2>The queue is empty</h2>
          <p>Open a file or add a folder to start a session.</p>
          <div className="empty-actions">
            <button className="button primary" onClick={() => void openMediaFiles()}>
              <Plus size={16} /> Open media
            </button>
          </div>
        </div>
      </div>
    )
  }

  const progress = progressOf(entry)
  const upNext = queue.slice(index + 1)

  return (
    <div className="page queue-page">
      <header className="library-head">
        <div>
          <span className="eyebrow">Playback</span>
          <h1>Queue</h1>
          <p>
            {queue.length} {queue.length === 1 ? 'item' : 'items'} · {formatTime(totalDuration(queue), true)}
          </p>
        </div>
        <div className="library-actions">
          <button className="button ghost" onClick={clearQueue}>
            Clear queue
          </button>
          <button className="button ghost danger-text" onClick={stop}>
            <X size={16} /> Stop playback
          </button>
        </div>
      </header>

      <section className="now-playing-card">
        <div className="now-art">
          <MediaArt item={item} iconSize={40} />
          <div className="now-art-glow" />
        </div>
        <div className="now-info">
          <span className="eyebrow">
            <span className={`eq-bars ${playing ? 'playing' : ''}`}>
              <i /><i /><i />
            </span>
            {playing ? 'Now playing' : 'Paused'}
          </span>
          <h2>{item.title}</h2>
          <p>
            {[item.tags?.artist, item.width && item.height ? `${item.width}×${item.height}` : null, item.container.split(',')[0]?.toUpperCase()]
              .filter(Boolean)
              .join(' · ')}
          </p>
          <div className="now-progress">
            <div className="now-progress-track">
              <div style={{ width: `${duration ? (time / duration) * 100 : 0}%` }} />
            </div>
            <span>
              {formatTime(time)} / {formatTime(duration)}
            </span>
          </div>
          <div className="now-controls">
            <button className="icon-button large" onClick={previous} aria-label="Previous">
              <SkipBack size={20} fill="currentColor" />
            </button>
            <button className="play-large" onClick={toggle} aria-label={playing ? 'Pause' : 'Play'}>
              {playing ? <Pause size={22} fill="currentColor" /> : <Play size={22} fill="currentColor" />}
            </button>
            <button className="icon-button large" onClick={next} aria-label="Next">
              <SkipForward size={20} fill="currentColor" />
            </button>
            <button className="button ghost small" onClick={() => setQueueOpen(true)}>
              Open in player
            </button>
          </div>
          {progress > 0.01 ? <span className="resume-note">{Math.round(progress * 100)}% watched</span> : null}
        </div>
      </section>

      <section className="section queue-section">
        <div className="section-head">
          <div>
            <span className="eyebrow">Session</span>
            <h2>Up next</h2>
          </div>
          <button className="text-button" onClick={() => void openMediaFiles()}>
            <Plus size={15} /> Add media
          </button>
        </div>
        <div className="queue-list">
          {queue.map((entryItem, queueIndex) => {
            const current = queueIndex === index
            return (
              <div
                key={`${entryItem.id}-${queueIndex}`}
                className={`queue-row ${current ? 'current' : ''}`}
                draggable
                onDragStart={(event) => event.dataTransfer.setData('text/queue-index', String(queueIndex))}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault()
                  const from = Number(event.dataTransfer.getData('text/queue-index'))
                  if (Number.isFinite(from)) moveQueue(from, queueIndex)
                }}
                onDoubleClick={() => playAt(queueIndex)}
                onContextMenu={(event) => {
                  event.preventDefault()
                  showContextMenu({
                    x: event.clientX,
                    y: event.clientY,
                    items: [
                      { label: 'Play now', icon: 'play', onSelect: () => playAt(queueIndex) },
                      { label: 'Play next', icon: 'next', onSelect: () => moveQueue(queueIndex, Math.min(index + 1, queue.length - 1)) },
                      {
                        label: 'Remove from queue',
                        icon: 'trash',
                        danger: true,
                        onSelect: () => removeFromQueue(entryItem.id)
                      }
                    ]
                  })
                }}
              >
                <span className="queue-index">
                  {current ? (
                    <span className={`eq-bars small ${playing ? 'playing' : ''}`}>
                      <i /><i /><i />
                    </span>
                  ) : (
                    queueIndex + 1
                  )}
                </span>
                <div className="queue-art">
                  <MediaArt item={entryItem} iconSize={16} />
                </div>
                <div className="queue-meta">
                  <strong>{entryItem.title}</strong>
                  <span>
                    {[entryItem.tags?.artist, entryItem.width && entryItem.height ? `${entryItem.width}×${entryItem.height}` : null, entryItem.container.split(',')[0]?.toUpperCase()]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </div>
                <span className="queue-duration">{formatTime(entryItem.duration)}</span>
                <div className="queue-actions">
                  <button
                    className="icon-button tiny"
                    aria-label="Move up"
                    disabled={queueIndex === 0}
                    onClick={() => moveQueue(queueIndex, queueIndex - 1)}
                  >
                    <ArrowUp size={14} />
                  </button>
                  <button
                    className="icon-button tiny"
                    aria-label="Move down"
                    disabled={queueIndex === queue.length - 1}
                    onClick={() => moveQueue(queueIndex, queueIndex + 1)}
                  >
                    <ArrowDown size={14} />
                  </button>
                  <button
                    className="icon-button tiny"
                    aria-label="Remove"
                    onClick={() => removeFromQueue(entryItem.id)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
        {upNext.length === 0 ? (
          <div className="queue-end">
            <ListMusic size={16} />
            End of the queue. Add something else whenever you like.
          </div>
        ) : null}
      </section>
    </div>
  )
}
