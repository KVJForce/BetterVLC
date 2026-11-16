import { create } from 'zustand'
import type { MediaInfo, ScanProgress } from '../../../shared/types'
import { useHistory, historyKey } from './history'
import { useUi } from './ui'

interface LibraryState {
  items: MediaInfo[]
  folders: string[]
  loaded: boolean
  scanning: boolean
  progress: ScanProgress | null
  init: () => Promise<void>
  addFolder: (folder?: string) => Promise<void>
  rescan: () => Promise<void>
  removeItem: (id: string) => Promise<void>
  removeFolder: (folder: string) => Promise<void>
  upsert: (item: MediaInfo) => void
  removeLocal: (item: MediaInfo) => void
}

let initialized = false

function mergeItems(base: MediaInfo[], pushed: MediaInfo[]): MediaInfo[] {
  if (!pushed.length) return base
  const byId = new Map(base.map((item) => [item.id, item]))
  for (const item of pushed) byId.set(item.id, { ...byId.get(item.id), ...item })
  return [...byId.values()]
}

/** A rename produces a new path id but keeps the same file identity. */
function forgetUnlessShared(item: MediaInfo, items: MediaInfo[]): void {
  const key = historyKey(item)
  if (items.some((entry) => entry.id !== item.id && historyKey(entry) === key)) return
  useHistory.getState().forget(item)
}

export const useLibrary = create<LibraryState>((set, get) => ({
  items: [],
  folders: [],
  loaded: false,
  scanning: false,
  progress: null,

  init: async () => {
    if (initialized) return
    initialized = true

    // Subscribe before asking for the snapshot. A scan started before this
    // window existed can push items while library:get is in flight; buffering
    // them here means no item is lost in the gap.
    const buffered: MediaInfo[] = []
    const removed = new Set<string>()
    let snapshotReady = false
    window.api.on.libraryItem((item) => {
      if (!snapshotReady) {
        // A scan can delete and recreate the same id while the snapshot is in
        // flight; the later add must win over the earlier remove.
        removed.delete(item.id)
        buffered.push(item)
        return
      }
      get().upsert(item)
    })
    window.api.on.libraryRemove((item) => {
      if (!snapshotReady) removed.add(item.id)
      get().removeLocal(item)
    })
    window.api.on.libraryProgress((progress) => {
      set({ progress, scanning: progress.phase !== 'done' })
      useUi.getState().setScanProgress(progress)
      useUi.getState().setScanning(progress.phase !== 'done')
    })

    let snapshot: { items: MediaInfo[]; folders: string[] } = { items: [], folders: [] }
    try {
      snapshot = await window.api.library.get()
    } catch {
      /* Keep the buffered pushes even if the snapshot read failed. */
    }
    const items = mergeItems(snapshot.items, buffered).filter((item) => !removed.has(item.id))
    snapshotReady = true
    set({ items, folders: snapshot.folders, loaded: true })
    useHistory.getState().rekey(items)

    if (get().folders.length) {
      window.setTimeout(() => {
        void window.api.library.rescan().then((next) => {
          set({ items: next.items, folders: next.folders })
          useHistory.getState().rekey(next.items)
        })
      }, 1800)
    }
  },

  addFolder: async (folder) => {
    let target = folder
    if (!target) target = (await window.api.dialog.openFolder()) ?? undefined
    if (!target) return
    useUi.getState().setScanning(true)
    try {
      const snapshot = await window.api.library.addFolder(target)
      set({ items: snapshot.items, folders: snapshot.folders })
      useHistory.getState().rekey(snapshot.items)
      useUi.getState().toast({
        title: 'Folder added',
        description: target.split(/[\\/]/).pop() ?? target,
        tone: 'success'
      })
    } catch (error) {
      useUi.getState().toast({
        title: 'Could not add folder',
        description: error instanceof Error ? error.message : String(error),
        tone: 'error'
      })
    } finally {
      useUi.getState().setScanning(false)
    }
  },

  rescan: async () => {
    useUi.getState().setScanning(true)
    try {
      const snapshot = await window.api.library.rescan()
      set({ items: snapshot.items, folders: snapshot.folders })
      useHistory.getState().rekey(snapshot.items)
      useUi.getState().toast({ title: 'Library refreshed', tone: 'success' })
    } finally {
      useUi.getState().setScanning(false)
    }
  },

  removeItem: async (id) => {
    const item = get().items.find((entry) => entry.id === id)
    const snapshot = await window.api.library.removeItem(id)
    if (item) forgetUnlessShared(item, snapshot.items)
    else useHistory.getState().clear(id)
    set({ items: snapshot.items, folders: snapshot.folders })
    useHistory.getState().rekey(snapshot.items)
  },

  removeFolder: async (folder) => {
    const before = get().items
    const snapshot = await window.api.library.removeFolder(folder)
    const remaining = new Set(snapshot.items.map((entry) => entry.id))
    for (const item of before) {
      if (!remaining.has(item.id)) forgetUnlessShared(item, snapshot.items)
    }
    set({ items: snapshot.items, folders: snapshot.folders })
    useHistory.getState().rekey(snapshot.items)
  },

  upsert: (item) => {
    set((state) => {
      const index = state.items.findIndex((entry) => entry.id === item.id)
      if (index < 0) return { items: [item, ...state.items] }
      const items = [...state.items]
      items[index] = { ...items[index], ...item }
      return { items }
    })
    useHistory.getState().rekey([item])
  },

  removeLocal: (item) => {
    const existing = get().items.find((entry) => entry.id === item.id)
    if (existing) forgetUnlessShared(existing, get().items)
    else forgetUnlessShared(item, get().items)
    set((state) => ({ items: state.items.filter((entry) => entry.id !== item.id) }))
  }
}))
