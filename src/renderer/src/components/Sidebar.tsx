import {
  Folder,
  FolderPlus,
  Home,
  LibraryBig,
  ListMusic,
  Loader2,
  Plus,
  Radio,
  Settings2
} from 'lucide-react'
import type { MediaInfo } from '../../../shared/types'
import { useLibrary } from '../store/library'
import { usePlayer } from '../store/player'
import { useUi, type View } from '../store/ui'
import { addFolder } from '../lib/actions'

const NAV: Array<{ id: View; label: string; icon: typeof Home }> = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'library', label: 'Library', icon: LibraryBig },
  { id: 'queue', label: 'Queue', icon: ListMusic }
]

export function Sidebar(): React.JSX.Element {
  const view = useUi((state) => state.view)
  const setView = useUi((state) => state.setView)
  const setUrlOpen = useUi((state) => state.setUrlOpen)
  const libraryFolder = useUi((state) => state.libraryFolder)
  const setLibraryFolder = useUi((state) => state.setLibraryFolder)
  const showContextMenu = useUi((state) => state.showContextMenu)
  const folders = useLibrary((state) => state.folders)
  const items = useLibrary((state) => state.items)
  const queue = usePlayer((state) => state.queue)
  const scanning = useUi((state) => state.scanning)
  const progress = useUi((state) => state.scanProgress)

  const countFor = (folder: string): number =>
    items.filter((item) => item.path.toLowerCase().startsWith(folder.toLowerCase())).length

  return (
    <aside className="sidebar">
      <nav className="nav">
        <span className="nav-label">Browse</span>
        {NAV.map((entry) => {
          const Icon = entry.icon
          const active = view === entry.id
          return (
            <button
              key={entry.id}
              className={`nav-item ${active ? 'active' : ''}`}
              onClick={() => {
                setView(entry.id)
                if (entry.id !== 'library') setLibraryFolder(null)
              }}
            >
              <Icon size={19} strokeWidth={1.9} />
              <span>{entry.label}</span>
              {entry.id === 'queue' && queue.length > 0 ? (
                <span className="nav-badge">{queue.length}</span>
              ) : null}
            </button>
          )
        })}
        <button className="nav-item" onClick={() => setUrlOpen(true)}>
          <Radio size={19} strokeWidth={1.9} />
          <span>Open stream</span>
        </button>
      </nav>

      <div className="sidebar-section">
        <div className="sidebar-section-head">
          <span className="nav-label">Folders</span>
          <button className="icon-button tiny" title="Add folder" onClick={() => void addFolder()}>
            <Plus size={15} />
          </button>
        </div>
        <div className="folder-list">
          {folders.length === 0 ? (
            <button className="folder-empty" onClick={() => void addFolder()}>
              <FolderPlus size={17} />
              <span>Add your first folder</span>
            </button>
          ) : (
            folders.map((folder) => (
              <button
                key={folder}
                className={`folder-item ${libraryFolder === folder ? 'active' : ''}`}
                title={folder}
                onClick={() => {
                  setLibraryFolder(folder)
                  setView('library')
                }}
                onContextMenu={(event) => {
                  event.preventDefault()
                  showContextMenu({
                    x: event.clientX,
                    y: event.clientY,
                    items: [
                      {
                        label: 'Show in library',
                        icon: 'folder',
                        onSelect: () => {
                          setLibraryFolder(folder)
                          setView('library')
                        }
                      },
                      {
                        label: 'Remove from library',
                        icon: 'trash',
                        danger: true,
                        onSelect: () => void useLibrary.getState().removeFolder(folder)
                      }
                    ]
                  })
                }}
              >
                <Folder size={16} />
                <span className="folder-name">{folder.split(/[\\/]/).filter(Boolean).pop()}</span>
                <span className="folder-count">{countFor(folder)}</span>
              </button>
            ))
          )}
        </div>
      </div>

      <div className="sidebar-bottom">
        {scanning ? (
          <div className="scan-card">
            <div className="scan-row">
              <Loader2 size={14} className="spin" />
              <span>{scanLabel(progress?.phase)}</span>
              {progress?.total ? (
                <span className="scan-count">
                  {progress.done}/{progress.total}
                </span>
              ) : null}
            </div>
            <div className="scan-track">
              <div
                className="scan-fill"
                style={{
                  width: progress?.total ? `${Math.min((progress.done / progress.total) * 100, 100)}%` : '20%'
                }}
              />
            </div>
          </div>
        ) : null}
        <button className={`nav-item ${view === 'settings' ? 'active' : ''}`} onClick={() => setView('settings')}>
          <Settings2 size={19} strokeWidth={1.9} />
          <span>Settings</span>
        </button>
        <div className="sidebar-foot">
          <span>BetterVLC 1.0</span>
          <span className="dot" />
          <span>FFmpeg</span>
        </div>
      </div>
    </aside>
  )
}

function scanLabel(phase?: string): string {
  if (phase === 'thumbnails') return 'Creating artwork'
  if (phase === 'probing') return 'Reading media'
  return 'Scanning library'
}

export function folderName(item: MediaInfo): string {
  return item.folder?.split(/[\\/]/).filter(Boolean).pop() ?? ''
}
