import type { MediaInfo } from '../shared/types'

const sources = new Map<string, MediaInfo>()

export function rememberSource(info: MediaInfo): void {
  sources.set(info.id, info)
}

export function getSource(id: string): MediaInfo | undefined {
  return sources.get(id)
}

export function forgetSource(id: string): void {
  sources.delete(id)
}
