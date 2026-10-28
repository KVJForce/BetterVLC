import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertCircle, Clipboard, Loader2, Radio, X } from 'lucide-react'
import { useUi } from '../store/ui'
import { openStream } from '../lib/actions'

const EXAMPLES = [
  { label: 'HLS', value: 'https://example.com/live/playlist.m3u8' },
  { label: 'RTSP', value: 'rtsp://example.com/live' },
  { label: 'HTTP', value: 'https://example.com/video.mp4' }
]

export function UrlModal(): React.JSX.Element {
  const open = useUi((state) => state.urlOpen)
  const setUrlOpen = useUi((state) => state.setUrlOpen)
  const [url, setUrl] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    setBusy(false)
    const timer = window.setTimeout(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    }, 40)
    return () => window.clearTimeout(timer)
  }, [open])

  const close = (): void => {
    if (busy) return
    setUrlOpen(false)
  }

  const submit = async (): Promise<void> => {
    const value = url.trim()
    if (!value || busy) return
    setBusy(true)
    setError(null)
    try {
      await openStream(value)
      setUrl('')
      setUrlOpen(false)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setBusy(false)
    }
  }

  const paste = async (): Promise<void> => {
    try {
      const text = await navigator.clipboard.readText()
      if (text.trim()) {
        setUrl(text.trim())
        setError(null)
        inputRef.current?.focus()
      }
    } catch {
      setError('Clipboard access is unavailable. Paste with Ctrl+V instead.')
    }
  }

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="modal-scrim"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          onClick={close}
          key="url-modal"
        >
          <motion.div
            className="modal url-modal"
            role="dialog"
            aria-label="Open a network stream"
            initial={{ opacity: 0, y: 18, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.99 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            onClick={(event) => event.stopPropagation()}
          >
            <header className="modal-head">
              <span className="modal-icon">
                <Radio size={20} />
              </span>
              <div>
                <h2>Open a stream</h2>
                <p>Paste a network address and BetterVLC will read it live.</p>
              </div>
              <button className="round-button" onClick={close} aria-label="Close" disabled={busy}>
                <X size={17} />
              </button>
            </header>

            <div className="url-input-wrap">
              <Radio size={17} />
              <input
                ref={inputRef}
                value={url}
                onChange={(event) => {
                  setUrl(event.target.value)
                  setError(null)
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    void submit()
                  } else if (event.key === 'Escape') {
                    event.preventDefault()
                    close()
                  }
                }}
                placeholder="https://, rtsp://, rtmp://, udp://"
                spellCheck={false}
                aria-label="Stream URL"
                disabled={busy}
              />
              <button className="icon-button tiny paste-button" onClick={() => void paste()} title="Paste from clipboard" disabled={busy}>
                <Clipboard size={15} />
              </button>
            </div>

            {error ? (
              <div className="url-error">
                <AlertCircle size={15} />
                <span>{error}</span>
              </div>
            ) : null}

            <div className="url-suggestions">
              <span>Try a format</span>
              {EXAMPLES.map((example) => (
                <button
                  key={example.label}
                  className="suggestion-chip"
                  onClick={() => {
                    setUrl(example.value)
                    setError(null)
                    inputRef.current?.focus()
                  }}
                  disabled={busy}
                >
                  {example.label}
                </button>
              ))}
            </div>

            <p className="modal-note">
              Live streams are played through the FFmpeg pipeline. Seeking and duration depend on the
              source. Credentials embedded in the URL stay on this machine.
            </p>

            <footer className="modal-actions">
              <button className="button ghost" onClick={close} disabled={busy}>
                Cancel
              </button>
              <button className="button primary" onClick={() => void submit()} disabled={!url.trim() || busy}>
                {busy ? <Loader2 size={16} className="spin" /> : <Radio size={16} />}
                {busy ? 'Connecting…' : 'Open stream'}
              </button>
            </footer>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
