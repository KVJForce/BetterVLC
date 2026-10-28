import { create } from 'zustand'
import type { ScanProgress } from '../../../shared/types'

export type View = 'home' | 'library' | 'queue' | 'settings'
export type ToastTone = 'default' | 'success' | 'error'

export interface Toast {
  id: number
  title: string
  description?: string
  tone?: ToastTone
  actionLabel?: string
  onAction?: () => void
  duration?: number
}

export interface MenuItem {
  label: string
  icon?: 'play' | 'next' | 'queue' | 'folder' | 'trash' | 'info' | 'heart' | 'link'
  danger?: boolean
  disabled?: boolean
  separator?: boolean
  onSelect?: () => void
}

export interface ContextMenuState {
  x: number
  y: number
  items: MenuItem[]
}

interface UiState {
  view: View
  previousView: View
  libraryFolder: string | null
  playerOpen: boolean
  queueOpen: boolean
  infoOpen: boolean
  paletteOpen: boolean
  urlOpen: boolean
  settingsSection: string
  fullscreen: boolean
  scanning: boolean
  scanProgress: ScanProgress | null
  toasts: Toast[]
  contextMenu: ContextMenuState | null
  setView: (view: View) => void
  setLibraryFolder: (folder: string | null) => void
  openPlayer: () => void
  closePlayer: () => void
  setQueueOpen: (open: boolean) => void
  setInfoOpen: (open: boolean) => void
  setPaletteOpen: (open: boolean) => void
  setUrlOpen: (open: boolean) => void
  setSettingsSection: (section: string) => void
  setFullscreen: (value: boolean) => void
  setScanning: (value: boolean) => void
  setScanProgress: (progress: ScanProgress | null) => void
  toast: (toast: Omit<Toast, 'id'>) => void
  dismissToast: (id: number) => void
  showContextMenu: (menu: ContextMenuState) => void
  hideContextMenu: () => void
}

let toastId = 0

export const useUi = create<UiState>((set) => ({
  view: 'home',
  previousView: 'home',
  libraryFolder: null,
  playerOpen: false,
  queueOpen: false,
  infoOpen: false,
  paletteOpen: false,
  urlOpen: false,
  settingsSection: 'appearance',
  fullscreen: false,
  scanning: false,
  scanProgress: null,
  toasts: [],
  contextMenu: null,
  setView: (view) =>
    set((state) => ({
      view,
      previousView: state.view,
      paletteOpen: false,
      contextMenu: null
    })),
  setLibraryFolder: (folder) => set({ libraryFolder: folder }),
  openPlayer: () => set({ playerOpen: true, queueOpen: false, infoOpen: false }),
  closePlayer: () => set({ playerOpen: false, queueOpen: false, infoOpen: false }),
  setQueueOpen: (open) => set({ queueOpen: open, infoOpen: false }),
  setInfoOpen: (open) => set({ infoOpen: open, queueOpen: false }),
  setPaletteOpen: (open) => set({ paletteOpen: open }),
  setUrlOpen: (open) => set({ urlOpen: open }),
  setSettingsSection: (section) => set({ settingsSection: section }),
  setFullscreen: (value) => set({ fullscreen: value }),
  setScanning: (value) => set({ scanning: value }),
  setScanProgress: (progress) => set({ scanProgress: progress }),
  toast: (toast) => {
    const id = ++toastId
    set((state) => ({ toasts: [...state.toasts.slice(-3), { ...toast, id }] }))
    const duration = toast.duration ?? 4200
    if (duration > 0) {
      window.setTimeout(() => {
        set((state) => ({ toasts: state.toasts.filter((item) => item.id !== id) }))
      }, duration)
    }
  },
  dismissToast: (id) => set((state) => ({ toasts: state.toasts.filter((item) => item.id !== id) })),
  showContextMenu: (menu) => set({ contextMenu: menu }),
  hideContextMenu: () => set({ contextMenu: null })
}))
