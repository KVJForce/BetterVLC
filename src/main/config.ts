import { app } from 'electron'
import path from 'node:path'
import fs from 'node:fs'

export const isDev = !app.isPackaged

export function binaryPath(name: 'ffmpeg' | 'ffprobe'): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'bin', `${name}.exe`)
  }
  if (name === 'ffmpeg') {
    return path.join(app.getAppPath(), 'node_modules', 'ffmpeg-static', 'ffmpeg.exe')
  }
  return path.join(
    app.getAppPath(),
    'node_modules',
    'ffprobe-static',
    'bin',
    'win32',
    'x64',
    'ffprobe.exe'
  )
}

export function ensureDir(dir: string): string {
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

export function userDir(...parts: string[]): string {
  return ensureDir(path.join(app.getPath('userData'), ...parts))
}

export function cacheDir(...parts: string[]): string {
  return ensureDir(path.join(userDir('cache'), ...parts))
}

export const VIDEO_EXTENSIONS = new Set([
  'mp4', 'm4v', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm', 'mpg', 'mpeg',
  'm2v', 'ts', 'mts', 'm2ts', 'ogv', '3gp', '3g2', 'vob', 'divx', 'rm',
  'rmvb', 'asf', 'f4v', 'mxf', 'dv'
])

export const AUDIO_EXTENSIONS = new Set([
  'mp3', 'flac', 'wav', 'm4a', 'aac', 'ogg', 'oga', 'opus', 'wma', 'aiff',
  'aif', 'ape', 'alac', 'wv', 'mka', 'mid', 'midi'
])

export const SUBTITLE_EXTENSIONS = new Set(['srt', 'ass', 'ssa', 'vtt', 'sub', 'smi'])

export function isMediaFile(file: string): boolean {
  const ext = path.extname(file).slice(1).toLowerCase()
  return VIDEO_EXTENSIONS.has(ext) || AUDIO_EXTENSIONS.has(ext)
}

export function isSubtitleFile(file: string): boolean {
  return SUBTITLE_EXTENSIONS.has(path.extname(file).slice(1).toLowerCase())
}
