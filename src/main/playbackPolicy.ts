import type { MediaInfo } from '../shared/types'

export interface CopyDecisionOptions {
  deinterlace?: boolean
  forceTranscode?: boolean
}

/**
 * Probe and the stream server must agree on when a video track is copied
 * instead of re-encoded. `videoCopy` already includes the H.264 profile,
 * pixel format and HDR checks; these options only narrow it further.
 */
export function shouldCopyVideo(
  info: Pick<MediaInfo, 'videoCopy' | 'hdr'>,
  options: CopyDecisionOptions = {}
): boolean {
  if (!info.videoCopy || info.hdr) return false
  if (options.deinterlace || options.forceTranscode) return false
  return true
}
