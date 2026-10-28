import { useEffect, useRef, useState } from 'react'
import { ChevronDown, FileVideo, FolderPlus, Plus, Radio, Search } from 'lucide-react'
import { useUi } from '../store/ui'
import { useLibrary } from '../store/library'
import { addFolder, openMediaFiles } from '../lib/actions'

export function TopBar(): React.JSX.Element {
  const setPaletteOpen = useUi((state) => state.setPaletteOpen)
  const setUrlOpen = useUi((state) => state.setUrlOpen)
  const scanning = useUi((state) => state.scanning)
  const items = useLibrary((state) => state.items)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const onDown = (event: MouseEvent): void => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false)
    }
    window.addEventListener('mousedown', onDown)
    return () => window.removeEventListener('mousedown', onDown)
  }, [menuOpen])

  return (
    <div className="topbar">
      <button className="search-pill" onClick={() => setPaletteOpen(true)}>
        <Search size={17} />
        <span>Search library, actions, anything…</span>
        <kbd>Ctrl K</kbd>
      </button>
      <div className="topbar-actions">
        {scanning ? (
          <div className="scan-pill">
            <span className="pulse-dot" />
            Scanning
          </div>
        ) : null}
        <span className="library-count">{items.length} items</span>
        <div className="add-wrap" ref={menuRef}>
          <button className="button primary add-button" onClick={() => setMenuOpen((open) => !open)}>
            <Plus size={17} />
            Add media
            <ChevronDown size={14} className={`chevron ${menuOpen ? 'open' : ''}`} />
          </button>
          {menuOpen ? (
            <div className="dropdown add-menu">
              <button
                className="dropdown-item"
                onClick={() => {
                  setMenuOpen(false)
                  void openMediaFiles()
                }}
              >
                <FileVideo size={17} />
                <span>
                  Open files
                  <small>Play anything from your computer</small>
                </span>
                <kbd>Ctrl O</kbd>
              </button>
              <button
                className="dropdown-item"
                onClick={() => {
                  setMenuOpen(false)
                  void addFolder()
                }}
              >
                <FolderPlus size={17} />
                <span>
                  Add a folder
                  <small>Build your library automatically</small>
                </span>
                <kbd>Ctrl ⇧ O</kbd>
              </button>
              <div className="dropdown-separator" />
              <button
                className="dropdown-item"
                onClick={() => {
                  setMenuOpen(false)
                  setUrlOpen(true)
                }}
              >
                <Radio size={17} />
                <span>
                  Open a stream
                  <small>HTTP, HLS, RTSP, RTMP, UDP</small>
                </span>
                <kbd>Ctrl U</kbd>
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
