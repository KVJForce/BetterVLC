import type { MediaInfo } from '../../../shared/types'
import { useLibrary } from '../store/library'
import { usePlayer } from '../store/player'
import { useUi } from '../store/ui'

export async function openMediaFiles(): Promise<void> {
  const paths = await window.api.dialog.openFiles()
  if (!paths.length) return
  await openDroppedPaths(paths)
}

export async function addFolder(): Promise<void> {
  await useLibrary.getState().addFolder()
}

export async function openDroppedPaths(paths: string[]): Promise<void> {
  if (!paths.length) return
  const ui = useUi.getState()
  try {
    const result = await window.api.media.openDropped(paths)
    for (const folder of result.folders) {
      await useLibrary.getState().addFolder(folder)
    }
    if (result.items.length) {
      usePlayer.getState().playItem(result.items[0], result.items)
      if (result.items.length > 1) {
        ui.toast({
          title: 'Queued for playback',
          description: `${result.items.length} items added to your queue`,
          tone: 'success'
        })
      }
    } else if (!result.folders.length) {
      ui.toast({
        title: 'Nothing to play',
        description: 'Those files do not contain supported media.',
        tone: 'error'
      })
    }
  } catch (error) {
    ui.toast({
      title: 'Could not open media',
      description: error instanceof Error ? error.message : String(error),
      tone: 'error'
    })
  }
}

export async function openStream(url: string): Promise<void> {
  const ui = useUi.getState()
  try {
    const item = await window.api.media.probeUrl(url)
    usePlayer.getState().playItem(item, [item])
    ui.toast({ title: 'Stream opened', description: item.title, tone: 'success' })
  } catch (error) {
    ui.toast({
      title: 'Stream unavailable',
      description: error instanceof Error ? error.message : String(error),
      tone: 'error'
    })
    throw error
  }
}

export function playMedia(item: MediaInfo, queue?: MediaInfo[]): void {
  usePlayer.getState().playItem(item, queue)
}

export function subtitleFor(item: MediaInfo): string {
  const parts: string[] = []
  if (item.tags?.artist) parts.push(item.tags.artist)
  if (item.width && item.height) parts.push(`${item.width}×${item.height}`)
  if (item.kind === 'audio' && item.audioTracks[0]) {
    parts.push(`${item.audioTracks[0].codec.toUpperCase()}`)
  }
  if (item.isStream) parts.push('Live stream')
  return parts.join(' · ')
}
