import { useEffect, useState } from 'react'
import { Copy, Minus, Square, X } from 'lucide-react'
import { Logo } from './Logo'

export function TitleBar(): React.JSX.Element {
  const [maximized, setMaximized] = useState(false)

  useEffect(() => {
    void window.api.window.isMaximized().then(setMaximized)
    const onResize = (): void => {
      void window.api.window.isMaximized().then(setMaximized)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  return (
    <header className="titlebar">
      <div className="titlebar-brand">
        <Logo size={26} />
        <span className="wordmark">
          Better<span>VLC</span>
        </span>
        <span className="beta-pill">BETA</span>
      </div>
      <div className="titlebar-drag" />
      <div className="titlebar-controls">
        <button
          className="window-button"
          aria-label="Minimize"
          onClick={() => void window.api.window.minimize()}
        >
          <Minus size={15} />
        </button>
        <button
          className="window-button"
          aria-label={maximized ? 'Restore' : 'Maximize'}
          onClick={() => {
            void window.api.window.maximize().then(setMaximized)
          }}
        >
          {maximized ? <Copy size={13} /> : <Square size={12} />}
        </button>
        <button
          className="window-button window-close"
          aria-label="Close"
          onClick={() => void window.api.window.close()}
        >
          <X size={15} />
        </button>
      </div>
    </header>
  )
}
