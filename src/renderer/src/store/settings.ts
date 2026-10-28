import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ThemeMode = 'dark' | 'light' | 'system'
export type Accent = 'violet' | 'cyan' | 'amber' | 'rose' | 'emerald'

export interface SubtitleSettings {
  enabled: boolean
  auto: boolean
  language: string
  fontFamily: string
  size: number
  color: string
  background: number
  outline: number
  position: number
  delay: number
}

export interface EqSettings {
  enabled: boolean
  preset: string
  bands: number[]
}

export interface SettingsState {
  theme: ThemeMode
  accent: Accent
  reduceMotion: boolean
  volume: number
  autoplay: boolean
  resume: boolean
  skipSeconds: number
  defaultSpeed: number
  maxHeight: number
  deinterlace: boolean
  hwDecode: boolean
  rememberQueue: boolean
  miniPlayer: boolean
  visualizer: boolean
  subtitle: SubtitleSettings
  eq: EqSettings
  update: (patch: Partial<Omit<SettingsState, 'update' | 'updateSubtitle' | 'updateEq' | 'reset'>>) => void
  updateSubtitle: (patch: Partial<SubtitleSettings>) => void
  updateEq: (patch: Partial<EqSettings>) => void
  reset: () => void
}

export const EQ_FREQUENCIES = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000]

export const EQ_PRESETS: Record<string, number[]> = {
  Flat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  'Bass boost': [7, 6, 4, 2, 0, 0, 0, 0, 0, 0],
  'Treble boost': [0, 0, 0, 0, 0, 0, 2, 4, 6, 7],
  Rock: [5, 4, 2, -1, -2, -1, 2, 4, 5, 5],
  Pop: [-1, 0, 2, 4, 4, 2, 0, -1, -1, -1],
  Jazz: [4, 3, 1, 2, -1, -1, 0, 1, 3, 4],
  Classical: [4, 3, 2, 1, -1, -1, 0, 2, 3, 4],
  Vocal: [-2, -1, 0, 2, 5, 5, 3, 1, 0, -1],
  Electronic: [5, 4, 2, 0, -2, 2, 1, 2, 5, 6],
  'Late night': [-3, -2, -1, 0, 2, 3, 3, 1, -1, -2]
}

const defaultSubtitle: SubtitleSettings = {
  enabled: true,
  auto: true,
  language: '',
  fontFamily: 'Inter Variable',
  size: 100,
  color: '#FFFFFF',
  background: 0.55,
  outline: 1,
  position: 86,
  delay: 0
}

const defaultEq: EqSettings = {
  enabled: false,
  preset: 'Flat',
  bands: [...EQ_PRESETS.Flat]
}

const baseSettings = {
  theme: 'dark' as ThemeMode,
  accent: 'violet' as Accent,
  reduceMotion: false,
  volume: 0.8,
  autoplay: true,
  resume: true,
  skipSeconds: 10,
  defaultSpeed: 1,
  maxHeight: 1080,
  deinterlace: false,
  hwDecode: true,
  rememberQueue: true,
  miniPlayer: true,
  visualizer: true,
  subtitle: defaultSubtitle,
  eq: defaultEq
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      ...baseSettings,
      update: (patch) => set(patch),
      updateSubtitle: (patch) => set((state) => ({ subtitle: { ...state.subtitle, ...patch } })),
      updateEq: (patch) => set((state) => ({ eq: { ...state.eq, ...patch } })),
      reset: () =>
        set({
          ...baseSettings,
          subtitle: { ...defaultSubtitle },
          eq: { ...defaultEq, bands: [...EQ_PRESETS.Flat] }
        })
    }),
    {
      name: 'bettervlc-settings',
      version: 1,
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<SettingsState>
        return {
          ...current,
          ...saved,
          subtitle: { ...current.subtitle, ...(saved.subtitle ?? {}) },
          eq: { ...current.eq, ...(saved.eq ?? {}) }
        }
      }
    }
  )
)

export function resolveTheme(mode: ThemeMode): 'dark' | 'light' {
  if (mode === 'system') {
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
  }
  return mode
}
