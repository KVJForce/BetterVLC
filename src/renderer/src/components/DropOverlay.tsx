import { AnimatePresence, motion } from 'framer-motion'
import { Film, Music2, UploadCloud } from 'lucide-react'

export function DropOverlay({ active }: { active: boolean }): React.JSX.Element {
  return (
    <AnimatePresence>
      {active ? (
        <motion.div
          className="drop-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          key="drop-overlay"
        >
          <motion.div
            className="drop-card"
            initial={{ scale: 0.96, y: 12 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.98, y: 8 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
          >
            <div className="drop-orbit orbit-one" />
            <div className="drop-orbit orbit-two" />
            <span className="drop-icon">
              <UploadCloud size={34} />
            </span>
            <h2>Drop it. It plays.</h2>
            <p>Release files, folders or a playlist anywhere in the window.</p>
            <div className="drop-formats">
              <span>
                <Film size={14} /> MKV · HEVC · AVI · TS
              </span>
              <span>
                <Music2 size={14} /> FLAC · DTS · Opus
              </span>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
