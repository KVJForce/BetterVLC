import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ExternalLink,
  FolderOpen,
  Heart,
  Info,
  ListMusic,
  Play,
  SkipForward,
  Trash2,
  type LucideIcon
} from 'lucide-react'
import { useUi, type MenuItem } from '../store/ui'

const ICONS: Record<NonNullable<MenuItem['icon']>, LucideIcon> = {
  play: Play,
  next: SkipForward,
  queue: ListMusic,
  folder: FolderOpen,
  trash: Trash2,
  info: Info,
  heart: Heart,
  link: ExternalLink
}

export function ContextMenu(): React.JSX.Element {
  const menu = useUi((state) => state.contextMenu)
  const hide = useUi((state) => state.hideContextMenu)
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)

  useEffect(() => {
    setPos(null)
  }, [menu])

  useLayoutEffect(() => {
    if (!menu || !ref.current) return
    const rect = ref.current.getBoundingClientRect()
    const pad = 8
    setPos({
      x: Math.max(pad, Math.min(menu.x, window.innerWidth - rect.width - pad)),
      y: Math.max(pad, Math.min(menu.y, window.innerHeight - rect.height - pad))
    })
  }, [menu])

  useEffect(() => {
    if (!menu) return
    const onDown = (event: MouseEvent): void => {
      if (ref.current?.contains(event.target as Node)) return
      hide()
    }
    const onScroll = (): void => hide()
    const onResize = (): void => hide()
    window.addEventListener('mousedown', onDown)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onResize)
    window.addEventListener('blur', onScroll)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('blur', onScroll)
    }
  }, [menu, hide])

  return (
    <AnimatePresence>
      {menu ? (
        <motion.div
          ref={ref}
          className="context-menu"
          role="menu"
          style={{
            left: pos?.x ?? menu.x,
            top: pos?.y ?? menu.y,
            visibility: pos ? 'visible' : 'hidden'
          }}
          initial={{ opacity: 0, scale: 0.97, y: -4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98, y: -2 }}
          transition={{ duration: 0.12 }}
          key="context-menu"
          onContextMenu={(event) => event.preventDefault()}
        >
          {menu.items.map((item, index) => {
            if (item.separator) return <div className="context-separator" key={`sep-${index}`} />
            const Icon = item.icon ? ICONS[item.icon] : null
            return (
              <button
                key={`${item.label}-${index}`}
                className={`context-item ${item.danger ? 'danger' : ''}`}
                role="menuitem"
                disabled={item.disabled}
                onClick={() => {
                  hide()
                  item.onSelect?.()
                }}
              >
                <span className="context-icon">{Icon ? <Icon size={15} /> : null}</span>
                {item.label}
              </button>
            )
          })}
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
