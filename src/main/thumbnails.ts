import { spawn } from 'node:child_process'
import path from 'node:path'
import fs from 'node:fs'
import { binaryPath, cacheDir } from './config'
import type { MediaInfo } from '../shared/types'

function run(args: string[], timeoutMs = 30000): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(binaryPath('ffmpeg'), ['-hide_banner', '-loglevel', 'error', '-y', ...args], {
      windowsHide: true
    })
    let err = ''
    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      reject(new Error('Thumbnail generation timed out'))
    }, timeoutMs)
    child.stderr.on('data', (d) => (err += d.toString()))
    child.on('error', (e) => {
      clearTimeout(timer)
      reject(e)
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      if (code === 0) resolve()
      else reject(new Error(err.trim() || `ffmpeg exited with code ${code}`))
    })
  })
}

export function thumbFileName(info: MediaInfo): string {
  const stamp = Math.round(info.mtime || info.addedAt)
  return `${info.id}-${stamp}.jpg`
}

export function thumbPath(info: MediaInfo): string {
  return path.join(cacheDir('thumbs'), thumbFileName(info))
}

export async function ensureThumbnail(info: MediaInfo): Promise<string | null> {
  if (info.isStream) return null
  const out = thumbPath(info)
  if (fs.existsSync(out) && fs.statSync(out).size > 1000) return out

  const seek =
    info.kind === 'video'
      ? Math.min(Math.max(info.duration * 0.12, 2), 180)
      : 0

  try {
    if (info.kind === 'video') {
      await run([
        '-ss', seek.toFixed(2),
        '-i', info.path,
        '-map', '0:v:0',
        '-frames:v', '1',
        '-vf', 'scale=720:-2',
        '-q:v', '4',
        out
      ])
    } else {
      // Try embedded cover art first, then fall back to a flat tone frame.
      try {
        await run(['-i', info.path, '-map', '0:v:0', '-frames:v', '1', '-vf', 'scale=720:-2', '-q:v', '4', out])
      } catch {
        await run([
          '-f', 'lavfi',
          '-i', 'color=c=0x1b1c24:s=720x720:d=1',
          '-frames:v', '1',
          '-q:v', '5',
          out
        ])
      }
    }
    return fs.existsSync(out) ? out : null
  } catch {
    return null
  }
}

export function removeThumbnail(info: MediaInfo): void {
  try {
    fs.rmSync(thumbPath(info), { force: true })
  } catch {
    /* ignore */
  }
}
