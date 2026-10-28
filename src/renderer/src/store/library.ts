import { create } from 'zustand'
import type { MediaInfo, ScanProgress } from '../../../shared/types'
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
}

let initialized = false

export const useLibrary = create<LibraryState>((set, get) => ({
  items: [],
  folders: [],
  loaded: false,
  scanning: false,
  progress: null,

  init: async () => {
    if (initialized) return
    initialized = true
    try {
      const snapshot = await window.api.library.get()
      set({ items: snapshot.items, folders: snapshot.folders, loaded: true })
    } catch {
      set({ loaded: true })
    }
    window.api.on.libraryItem((item) => get().upsert(item))
    window.api.on.libraryProgress((progress) => {
      set({
        progress,
        scanning: progress.phase !== 'done',
        ...(progress.phase === 'done' ? {} : {})
      })
      useUi.getState().setScanProgress(progress)
      useUi.getState().setScanning(progress.phase !== 'done')
    })
    if (get().folders.length) {
      window.setTimeout(() => {
        void window.api.library.rescan().then((snapshot) => {
          set({ items: snapshot.items, folders: snapshot.folders })
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
      useUi.getState().toast({ title: 'Library refreshed', tone: 'success' })
    } finally {
      useUi.getState().setScanning(false)
    }
  },

  removeItem: async (id) => {
    const snapshot = await window.api.library.removeItem(id)
    set({ items: snapshot.items, folders: snapshot.folders })
  },

  removeFolder: async (folder) => {
    const snapshot = await window.api.library.removeFolder(folder)
    set({ items: snapshot.items, folders: snapshot.folders })
  },

  upsert: (item) => {
    set((state) => {
      const index = state.items.findIndex((entry) => entry.id === item.id)
      if (index < 0) return { items: [item, ...state.items] }
      const items = [...state.items]
      items[index] = { ...items[index], ...item }
      return { items }
    })
  }
}))
