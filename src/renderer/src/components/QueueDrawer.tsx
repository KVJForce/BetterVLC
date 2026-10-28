import { useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { GripVertical, ListMusic, Pause, Play, Plus, Trash2, X } from 'lucide-react'
import { usePlayer } from '../store/player'
import { useUi } from '../store/ui'
import { MediaArt } from './MediaCard'
import { openMediaFiles } from '../lib/actions'
import { formatTime, totalDuration } from '../lib/format'

export function QueueDrawer(): React.JSX.Element {
  const open = useUi((state) => state.queueOpen)
  const setQueueOpen = useUi((state) => state.setQueueOpen)
  const queue = usePlayer((state) => state.queue)
  const index = usePlayer((state) => state.index)
  const item = usePlayer((state) => state.item)
  const playing = usePlayer((state) => state.playing)
  const playAt = usePlayer((state) => state.playAt)
  const moveQueue = usePlayer((state) => state.moveQueue)
  const removeFromQueue = usePlayer((state) => state.removeFromQueue)
  const clearQueue = usePlayer((state) => state.clearQueue)
  const dragIndex = useRef<number | null>(null)

  const close = (): void => setQueueOpen(false)

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="drawer-scrim"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={close}
          key="queue-drawer"
        >
          <motion.aside
            className="drawer queue-drawer"
            role="dialog"
            aria-label="Playback queue"
            initial={{ x: 440, opacity: 0.6 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 440, opacity: 0.4 }}
            transition={{ type: 'spring', stiffness: 360, damping: 36 }}
            onClick={(event) => event.stopPropagation()}
          >
            <header className="drawer-head">
              <div>
                <span className="eyebrow">Up next</span>
                <h2>Playback queue</h2>
                <p>
                  {queue.length} {queue.length === 1 ? 'item' : 'items'}
                  {queue.length ? ` · ${formatTime(totalDuration(queue), true)}` : ''}
                </p>
              </div>
              <button className="round-button drawer-close" onClick={close} aria-label="Close queue">
                <X size={18} />
              </button>
            </header>

            <div className="drawer-body">
              {queue.length === 0 ? (
                <div className="drawer-empty">
                  <div className="drawer-empty-art">
                    <ListMusic size={26} />
                  </div>
                  <h3>Nothing queued</h3>
                  <p>Add a few titles and they will line up here.</p>
                  <button className="button primary small" onClick={() => void openMediaFiles()}>
                    <Plus size={15} /> Open media
                  </button>
                </div>
              ) : (
                <div className="drawer-list">
                  {queue.map((entry, queueIndex) => {
                    const current = queueIndex === index
                    return (
                      <div
                        key={`${entry.id}-${queueIndex}`}
                        className={`drawer-row ${current ? 'current' : ''}`}
                        draggable
                        onDragStart={(event) => {
                          dragIndex.current = queueIndex
                          event.dataTransfer.effectAllowed = 'move'
                          event.dataTransfer.setData('text/plain', String(queueIndex))
                        }}
                        onDragOver={(event) => {
                          event.preventDefault()
                          event.dataTransfer.dropEffect = 'move'
                        }}
                        onDrop={(event) => {
                          event.preventDefault()
                          const from = dragIndex.current ?? Number(event.dataTransfer.getData('text/plain'))
                          dragIndex.current = null
                          if (Number.isFinite(from) && from !== queueIndex) moveQueue(from, queueIndex)
                        }}
                        onDoubleClick={() => playAt(queueIndex)}
                      >
                        <span className="drawer-grip" aria-hidden="true">
                          <GripVertical size={14} />
                        </span>
                        <span className="drawer-index">
                          {current ? (
                            <span className={`eq-bars tiny ${playing ? 'playing' : ''}`}>
                              <i />
                              <i />
                              <i />
                            </span>
                          ) : (
                            queueIndex + 1
                          )}
                        </span>
                        <button
                          className="drawer-art"
                          onClick={() => playAt(queueIndex)}
                          aria-label={`Play ${entry.title}`}
                        >
                          <MediaArt item={entry} iconSize={16} />
                          <span className="drawer-art-play">
                            {current && playing ? <Pause size={13} fill="currentColor" /> : <Play size={13} fill="currentColor" />}
                          </span>
                        </button>
                        <div className="drawer-meta">
                          <strong title={entry.title}>{entry.title}</strong>
                          <span>
                            {[entry.tags?.artist, entry.width && entry.height ? `${entry.width}×${entry.height}` : null]
                              .filter(Boolean)
                              .join(' · ') || entry.container.split(',')[0]?.toUpperCase()}
                          </span>
                        </div>
                        <span className="drawer-duration">{formatTime(entry.duration)}</span>
                        <button
                          className="icon-button tiny drawer-remove"
                          aria-label={`Remove ${entry.title} from queue`}
                          onClick={() => removeFromQueue(entry.id)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <footer className="drawer-foot">
              <button className="button ghost small" onClick={() => void openMediaFiles()}>
                <Plus size={15} /> Add media
              </button>
              <span className="drawer-foot-note">
                {item ? `Playing ${index + 1} of ${queue.length}` : 'No active item'}
              </span>
              <button className="button ghost small danger-text" disabled={!queue.length} onClick={clearQueue}>
                Clear
              </button>
            </footer>
          </motion.aside>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
