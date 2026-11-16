import type { MediaInfo } from './types'

/**
 * One resume/finish policy for history writes, Continue watching and the
 * player's initial seek. Keeping the thresholds here stops the three call
 * sites from drifting apart again.
 */

export const RESUME_MIN_POSITION = 5
export const FINISHED_RATIO = 0.95
export const FINISHED_TAIL_SECONDS = 2
export const CONTINUE_MIN_RATIO = 0.01

export interface ResumeState {
  position: number
  duration: number
}

type MediaDuration = Pick<MediaInfo, 'duration'>

export function effectiveDuration(entry: ResumeState | undefined, item: MediaDuration): number {
  return entry && entry.duration > 0 ? entry.duration : item.duration
}

export function isFinished(position: number, duration: number): boolean {
  if (!Number.isFinite(position) || position <= 0) return false
  if (!Number.isFinite(duration) || duration <= 0) return false
  return position >= duration - FINISHED_TAIL_SECONDS || position / duration >= FINISHED_RATIO
}

export function shouldKeepProgress(position: number, duration: number): boolean {
  if (!Number.isFinite(position) || position < 1) return false
  return !isFinished(position, duration)
}

export function resumePoint(
  entry: ResumeState | undefined,
  item: MediaDuration & Pick<MediaInfo, 'isStream'>,
  enabled: boolean
): number {
  if (!enabled || item.isStream || !entry) return 0
  if (entry.position <= RESUME_MIN_POSITION) return 0
  if (isFinished(entry.position, effectiveDuration(entry, item))) return 0
  return entry.position
}

export function isContinueWatching(
  entry: ResumeState | undefined,
  item: MediaDuration
): boolean {
  if (!entry) return false
  const duration = effectiveDuration(entry, item)
  if (duration <= 0) return false
  return entry.position / duration > CONTINUE_MIN_RATIO && !isFinished(entry.position, duration)
}
