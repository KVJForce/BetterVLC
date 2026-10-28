import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react'
import { useUi, type Toast } from '../store/ui'

const ICONS = {
  default: Info,
  success: CheckCircle2,
  error: AlertTriangle
}

export function Toasts(): React.JSX.Element {
  const toasts = useUi((state) => state.toasts)
  const dismiss = useUi((state) => state.dismissToast)

  return (
    <div className="toast-stack" aria-live="polite" aria-atomic="false">
      <AnimatePresence initial={false}>
        {toasts.map((toast) => (
          <ToastCard key={toast.id} toast={toast} onDismiss={() => dismiss(toast.id)} />
        ))}
      </AnimatePresence>
    </div>
  )
}

function ToastCard({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }): React.JSX.Element {
  const Icon = ICONS[toast.tone ?? 'default']
  return (
    <motion.div
      className={`toast tone-${toast.tone ?? 'default'}`}
      layout
      initial={{ opacity: 0, y: -12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 30, scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 420, damping: 34 }}
    >
      <span className="toast-icon">
        <Icon size={17} />
      </span>
      <div className="toast-body">
        <strong>{toast.title}</strong>
        {toast.description ? <span>{toast.description}</span> : null}
        {toast.actionLabel && toast.onAction ? (
          <button
            className="toast-action"
            onClick={() => {
              toast.onAction?.()
              onDismiss()
            }}
          >
            {toast.actionLabel}
          </button>
        ) : null}
      </div>
      <button className="toast-close" onClick={onDismiss} aria-label="Dismiss notification">
        <X size={14} />
      </button>
    </motion.div>
  )
}
