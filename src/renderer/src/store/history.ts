import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface HistoryEntry {
  position: number
  duration: number
  updatedAt: number
}

interface HistoryState {
  entries: Record<string, HistoryEntry>
  record: (id: string, position: number, duration: number) => void
  clear: (id: string) => void
  clearAll: () => void
}

export const useHistory = create<HistoryState>()(
  persist(
    (set) => ({
      entries: {},
      record: (id, position, duration) =>
        set((state) => {
          if (!id) return state
          if (!Number.isFinite(position) || position < 1) return state
          const entries = { ...state.entries }
          if (duration > 0 && position >= duration - 2) {
            delete entries[id]
          } else {
            entries[id] = { position, duration, updatedAt: Date.now() }
          }
          const keys = Object.keys(entries)
          if (keys.length > 400) {
            keys
              .sort((a, b) => entries[a].updatedAt - entries[b].updatedAt)
              .slice(0, keys.length - 400)
              .forEach((key) => delete entries[key])
          }
          return { entries }
        }),
      clear: (id) =>
        set((state) => {
          const entries = { ...state.entries }
          delete entries[id]
          return { entries }
        }),
      clearAll: () => set({ entries: {} })
    }),
    { name: 'bettervlc-history' }
  )
)

export function progressOf(entry?: HistoryEntry): number {
  if (!entry || !entry.duration) return 0
  return Math.min(entry.position / entry.duration, 1)
}
