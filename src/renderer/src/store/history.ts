import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { shouldKeepProgress } from '../../../shared/resume'
import type { MediaInfo } from '../../../shared/types'

export interface HistoryEntry {
  position: number
  duration: number
  updatedAt: number
  fileKey?: string
}

type HistoryKeyed = Pick<MediaInfo, 'id' | 'fileKey'>

interface HistoryState {
  entries: Record<string, HistoryEntry>
  record: (item: HistoryKeyed, position: number, duration: number) => void
  clear: (id: string) => void
  forget: (item: HistoryKeyed) => void
  rekey: (items: MediaInfo[]) => void
  clearAll: () => void
}

const HISTORY_VERSION = 1

/**
 * History follows the file, not the path. `fileKey` is the filesystem
 * identity (device + inode); the path hash is only the fallback for streams
 * and filesystems that do not expose inodes.
 */
export function historyKey(item: HistoryKeyed): string {
  return item.fileKey ? `file:${item.fileKey}` : item.id
}

export function historyEntry(
  entries: Record<string, HistoryEntry>,
  item: HistoryKeyed
): HistoryEntry | undefined {
  return entries[historyKey(item)] ?? entries[item.id]
}

function migrateHistory(persisted: unknown): Pick<HistoryState, 'entries'> {
  const saved = (persisted ?? {}) as { entries?: Record<string, HistoryEntry> }
  const entries: Record<string, HistoryEntry> = {}
  for (const [id, entry] of Object.entries(saved.entries ?? {})) {
    if (!id || !entry) continue
    const position = Number(entry.position)
    const duration = Number(entry.duration)
    if (!Number.isFinite(position) || position <= 0) continue
    entries[id] = {
      position,
      duration: Number.isFinite(duration) && duration > 0 ? duration : 0,
      updatedAt: Number(entry.updatedAt) || 0,
      ...(typeof entry.fileKey === 'string' ? { fileKey: entry.fileKey } : {})
    }
  }
  return { entries }
}

export const useHistory = create<HistoryState>()(
  persist(
    (set) => ({
      entries: {},
      record: (item, position, duration) =>
        set((state) => {
          if (!item.id) return state
          if (!Number.isFinite(position) || position < 1) return state
          const entries = { ...state.entries }
          const key = historyKey(item)
          if (shouldKeepProgress(position, duration)) {
            entries[key] = {
              position,
              duration,
              updatedAt: Date.now(),
              ...(item.fileKey ? { fileKey: item.fileKey } : {})
            }
          } else {
            delete entries[key]
          }
          // Drop the pre-fileKey duplicate once the entry lives under its
          // stable key.
          if (key !== item.id) delete entries[item.id]
          const keys = Object.keys(entries)
          if (keys.length > 400) {
            keys
              .sort((a, b) => entries[a].updatedAt - entries[b].updatedAt)
              .slice(0, keys.length - 400)
              .forEach((entry) => delete entries[entry])
          }
          return { entries }
        }),
      clear: (id) =>
        set((state) => {
          const entries = { ...state.entries }
          delete entries[id]
          return { entries }
        }),
      forget: (item) =>
        set((state) => {
          const entries = { ...state.entries }
          delete entries[historyKey(item)]
          delete entries[item.id]
          return { entries }
        }),
      rekey: (items) =>
        set((state) => {
          if (!items.length) return state
          const legacyKeys = new Map<string, string>()
          for (const item of items) {
            if (item.fileKey) legacyKeys.set(item.id, historyKey(item))
          }
          let changed = false
          const entries: Record<string, HistoryEntry> = {}
          for (const [key, entry] of Object.entries(state.entries)) {
            let nextKey = key
            if (entry.fileKey) nextKey = `file:${entry.fileKey}`
            else nextKey = legacyKeys.get(key) ?? key
            if (nextKey !== key) changed = true
            const existing = entries[nextKey]
            if (!existing || entry.updatedAt >= existing.updatedAt) entries[nextKey] = entry
          }
          return changed ? { entries } : state
        }),
      clearAll: () => set({ entries: {} })
    }),
    {
      name: 'bettervlc-history',
      version: HISTORY_VERSION,
      migrate: (persisted) => migrateHistory(persisted) as HistoryState
    }
  )
)

export function progressOf(entry?: HistoryEntry): number {
  if (!entry || !entry.duration) return 0
  return Math.min(entry.position / entry.duration, 1)
}
