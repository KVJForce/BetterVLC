import { useMemo, useRef, useState } from 'react'
import {
  ArrowDownWideNarrow,
  Grid2X2,
  List,
  MoreHorizontal,
  Music2,
  Play,
  Plus,
  RefreshCw,
  Search,
  X
} from 'lucide-react'
import type { MediaInfo } from '../../../shared/types'
import { useLibrary } from '../store/library'
import { useHistory, progressOf } from '../store/history'
import { usePlayer } from '../store/player'
import { useUi } from '../store/ui'
import { MediaArt, MediaCard } from '../components/MediaCard'
import { addFolder, openMediaFiles, playMedia } from '../lib/actions'
import { formatTime, resolutionLabel } from '../lib/format'

type Filter = 'all' | 'video' | 'audio'
type Sort = 'recent' | 'title' | 'duration' | 'played'

export function LibraryPage(): React.JSX.Element {
  const items = useLibrary((state) => state.items)
  const folders = useLibrary((state) => state.folders)
  const rescan = useLibrary((state) => state.rescan)
  const history = useHistory((state) => state.entries)
  const libraryFolder = useUi((state) => state.libraryFolder)
  const setLibraryFolder = useUi((state) => state.setLibraryFolder)
  const setView = useUi((state) => state.setView)
  const [filter, setFilter] = useState<Filter>('all')
  const [sort, setSort] = useState<Sort>('recent')
  const [layout, setLayout] = useState<'grid' | 'list'>('grid')
  const [query, setQuery] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    let list = items.filter((item) => {
      if (libraryFolder && !item.path.toLowerCase().startsWith(libraryFolder.toLowerCase())) return false
      if (filter !== 'all' && item.kind !== filter) return false
      if (!needle) return true
      const haystack = [item.title, item.name, item.tags?.artist, item.tags?.album, item.folder, item.container]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(needle)
    })
    list = [...list].sort((a, b) => {
      if (sort === 'title') return a.title.localeCompare(b.title)
      if (sort === 'duration') return b.duration - a.duration
      if (sort === 'played') {
        return (history[b.id]?.updatedAt ?? 0) - (history[a.id]?.updatedAt ?? 0)
      }
      return b.addedAt - a.addedAt
    })
    return list
  }, [items, libraryFolder, filter, query, sort, history])

  const totalTime = filtered.reduce((sum, item) => sum + item.duration, 0)
  const folderLabel = libraryFolder?.split(/[\\/]/).filter(Boolean).pop()

  return (
    <div className="page library-page">
      <header className="library-head">
        <div>
          <span className="eyebrow">Collection</span>
          <h1>Library</h1>
          <p>
            {filtered.length} {filtered.length === 1 ? 'title' : 'titles'}
            {totalTime ? ` · ${formatTime(totalTime, true)}` : ''}
            {folderLabel ? ` in ${folderLabel}` : ''}
          </p>
        </div>
        <div className="library-actions">
          <button className="button ghost" onClick={() => void rescan()}>
            <RefreshCw size={16} />
            Rescan
          </button>
          <button className="button primary" onClick={() => void addFolder()}>
            <Plus size={16} />
            Add folder
          </button>
        </div>
      </header>

      <div className="library-toolbar">
        <div className="search-field">
          <Search size={17} />
          <input
            ref={searchRef}
            value={query}
            placeholder="Filter your library…"
            onChange={(event) => setQuery(event.target.value)}
          />
          {query ? (
            <button className="icon-button tiny" onClick={() => setQuery('')} aria-label="Clear search">
              <X size={14} />
            </button>
          ) : null}
        </div>
        <div className="filter-chips">
          {(['all', 'video', 'audio'] as Filter[]).map((value) => (
            <button
              key={value}
              className={`chip-button ${filter === value ? 'active' : ''}`}
              onClick={() => setFilter(value)}
            >
              {value === 'all' ? 'All media' : value === 'video' ? 'Video' : 'Audio'}
            </button>
          ))}
          {libraryFolder ? (
            <button className="chip-button folder-chip active" onClick={() => setLibraryFolder(null)}>
              {folderLabel}
              <X size={13} />
            </button>
          ) : null}
        </div>
        <div className="toolbar-right">
          <label className="select-wrap">
            <ArrowDownWideNarrow size={15} />
            <select value={sort} onChange={(event) => setSort(event.target.value as Sort)}>
              <option value="recent">Recently added</option>
              <option value="title">Title A–Z</option>
              <option value="duration">Longest first</option>
              <option value="played">Recently played</option>
            </select>
          </label>
          <div className="layout-toggle">
            <button
              className={layout === 'grid' ? 'active' : ''}
              onClick={() => setLayout('grid')}
              aria-label="Grid view"
            >
              <Grid2X2 size={16} />
            </button>
            <button
              className={layout === 'list' ? 'active' : ''}
              onClick={() => setLayout('list')}
              aria-label="List view"
            >
              <List size={17} />
            </button>
          </div>
        </div>
      </div>

      {!items.length ? (
        <div className="empty-state">
          <div className="empty-art">
            <div className="empty-ring" />
            <Music2 size={38} />
          </div>
          <h2>Your library is waiting</h2>
          <p>Add a folder and BetterVLC will find the artwork, read every codec and keep your place.</p>
          <div className="empty-actions">
            <button className="button primary" onClick={() => void addFolder()}>
              <Plus size={16} /> Add folder
            </button>
            <button className="button ghost" onClick={() => void openMediaFiles()}>
              Open a file
            </button>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state compact">
          <Search size={30} />
          <h2>No matches</h2>
          <p>Try another search or clear the filters.</p>
          <button
            className="button ghost"
            onClick={() => {
              setQuery('')
              setFilter('all')
              setLibraryFolder(null)
            }}
          >
            Clear filters
          </button>
        </div>
      ) : layout === 'grid' ? (
        <div className="media-grid library-grid">
          {filtered.map((item) => (
            <MediaCard key={item.id} item={item} queue={filtered} />
          ))}
        </div>
      ) : (
        <div className="media-list">
          <div className="list-head">
            <span>Title</span>
            <span>Source</span>
            <span>Format</span>
            <span>Duration</span>
            <span />
          </div>
          {filtered.map((item) => (
            <LibraryRow key={item.id} item={item} queue={filtered} />
          ))}
        </div>
      )}

      {filtered.length ? (
        <footer className="library-foot">
          <span>{filtered.length} items</span>
          <span className="dot" />
          <span>{folders.length} folders</span>
          <button className="text-button" onClick={() => setView('home')}>
            Back to home
          </button>
        </footer>
      ) : null}
    </div>
  )
}

function LibraryRow({ item, queue }: { item: MediaInfo; queue: MediaInfo[] }): React.JSX.Element {
  const entry = useHistory((state) => state.entries[item.id])
  const progress = progressOf(entry)
  const showContextMenu = useUi((state) => state.showContextMenu)
  const addToQueue = usePlayer((state) => state.addToQueue)
  const toast = useUi((state) => state.toast)
  const resolution = resolutionLabel(item.width, item.height)

  const menu = (x: number, y: number): void => {
    showContextMenu({
      x,
      y,
      items: [
        { label: 'Play now', icon: 'play', onSelect: () => playMedia(item, queue) },
        {
          label: 'Add to queue',
          icon: 'queue',
          onSelect: () => {
            addToQueue([item])
            toast({ title: 'Added to queue', description: item.title })
          }
        },
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
          onSelect: () => void useLibrary.getState().removeItem(item.id)
        }
      ]
    })
  }

  return (
    <div
      className="media-row"
      onDoubleClick={() => playMedia(item, queue)}
      onContextMenu={(event) => {
        event.preventDefault()
        menu(event.clientX, event.clientY)
      }}
    >
      <div className="row-title">
        <button className="row-art" onClick={() => playMedia(item, queue)} aria-label={`Play ${item.title}`}>
          <MediaArt item={item} iconSize={18} />
          <span className="row-play">
            <Play size={15} fill="currentColor" />
          </span>
        </button>
        <div>
          <strong title={item.title}>{item.title}</strong>
          <span>{item.tags?.artist ?? item.name}</span>
          {progress > 0.01 ? (
            <div className="row-progress">
              <div style={{ width: `${progress * 100}%` }} />
            </div>
          ) : null}
        </div>
      </div>
      <span className="row-folder">{item.folder?.split(/[\\/]/).filter(Boolean).pop() ?? 'Stream'}</span>
      <span className="row-format">
        {resolution ?? item.container.split(',')[0]?.toUpperCase()}
        {item.videoCodec ? ` · ${item.videoCodec.toUpperCase()}` : ''}
      </span>
      <span className="row-duration">{formatTime(item.duration)}</span>
      <button
        className="icon-button"
        aria-label="More options"
        onClick={(event) => {
          const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
          menu(rect.right, rect.bottom + 4)
        }}
      >
        <MoreHorizontal size={17} />
      </button>
    </div>
  )
}
