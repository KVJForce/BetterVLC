import { MoreHorizontal, Music2, Play, Film } from 'lucide-react'
import type { MediaInfo } from '../../../shared/types'
import { formatTime, resolutionLabel } from '../lib/format'
import { useHistory, progressOf } from '../store/history'
import { usePlayer } from '../store/player'
import { useLibrary } from '../store/library'
import { useUi } from '../store/ui'
import { playMedia } from '../lib/actions'

export function thumbSrc(item: MediaInfo): string | undefined {
  return item.thumb ? `${window.api.baseUrl}/thumb/${item.thumb}` : undefined
}

export function toneFor(id: string): number {
  let hash = 0
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  return hash % 6
}

export function MediaArt({
  item,
  className = '',
  iconSize = 34
}: {
  item: MediaInfo
  className?: string
  iconSize?: number
}): React.JSX.Element {
  const src = thumbSrc(item)
  return (
    <div className={`media-art ${className} tone-${toneFor(item.id)}`}>
      {src ? <img src={src} alt="" loading="lazy" draggable={false} /> : null}
      {!src ? (
        <div className="art-fallback">
          {item.kind === 'audio' ? <Music2 size={iconSize} /> : <Film size={iconSize} />}
          <span>{item.title.slice(0, 1).toUpperCase()}</span>
        </div>
      ) : null}
    </div>
  )
}

export function MediaCard({
  item,
  queue,
  wide = false
}: {
  item: MediaInfo
  queue?: MediaInfo[]
  wide?: boolean
}): React.JSX.Element {
  const history = useHistory((state) => state.entries[item.id])
  const progress = progressOf(history)
  const addToQueue = usePlayer((state) => state.addToQueue)
  const showContextMenu = useUi((state) => state.showContextMenu)
  const toast = useUi((state) => state.toast)
  const resolution = resolutionLabel(item.width, item.height)
  const meta =
    item.kind === 'audio'
      ? [item.tags?.artist, formatTime(item.duration)].filter(Boolean).join(' · ')
      : [resolution, item.container.split(',')[0]?.toUpperCase(), formatTime(item.duration)]
          .filter(Boolean)
          .join(' · ')

  const openMenu = (x: number, y: number): void => {
    showContextMenu({
      x,
      y,
      items: [
        { label: 'Play now', icon: 'play', onSelect: () => playMedia(item, queue) },
        {
          label: 'Play next',
          icon: 'next',
          onSelect: () => {
            addToQueue([item], true)
            toast({ title: 'Playing next', description: item.title })
          }
        },
        {
          label: 'Add to queue',
          icon: 'queue',
          onSelect: () => {
            addToQueue([item])
            toast({ title: 'Added to queue', description: item.title })
          }
        },
        { label: '', separator: true },
        {
          label: 'Show in Explorer',
          icon: 'folder',
          disabled: item.isStream,
          onSelect: () => void window.api.library.reveal(item.path)
        },
        {
          label: 'Remove from library',
          icon: 'trash',
          danger: true,
          onSelect: () => {
            void useLibrary.getState().removeItem(item.id)
            toast({ title: 'Removed from library', description: item.title })
          }
        }
      ]
    })
  }

  return (
    <article
      className={`media-card ${wide ? 'wide' : ''}`}
      onContextMenu={(event) => {
        event.preventDefault()
        openMenu(event.clientX, event.clientY)
      }}
      onClick={() => playMedia(item, queue)}
    >
      <div className="card-art-wrap">
        <MediaArt item={item} className="card-art" iconSize={wide ? 46 : 32} />
        <div className="card-shade" />
        <div className="card-top">
          {item.hdr ? <span className="chip hdr">HDR</span> : null}
          {resolution ? <span className="chip">{resolution}</span> : null}
          {item.kind === 'audio' ? <span className="chip">AUDIO</span> : null}
        </div>
        <span className="card-duration">{formatTime(item.duration)}</span>
        <button
          className="card-more"
          aria-label="More options"
          onClick={(event) => {
            event.stopPropagation()
            const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
            openMenu(rect.right, rect.bottom + 6)
          }}
        >
          <MoreHorizontal size={17} />
        </button>
        <button
          className="card-play"
          aria-label={`Play ${item.title}`}
          onClick={(event) => {
            event.stopPropagation()
            playMedia(item, queue)
          }}
        >
          <Play size={20} fill="currentColor" />
        </button>
        {progress > 0.01 ? (
          <div className="card-progress">
            <div style={{ width: `${Math.min(progress * 100, 100)}%` }} />
          </div>
        ) : null}
      </div>
      <div className="card-info">
        <h3 title={item.title}>{item.title}</h3>
        <p>{meta}</p>
      </div>
    </article>
  )
}
