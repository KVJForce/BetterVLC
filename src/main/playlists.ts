import fs from 'node:fs'
import path from 'node:path'

export interface PlaylistEntry {
  source: string
  title?: string
}

export function readPlaylist(file: string): PlaylistEntry[] {
  const ext = path.extname(file).toLowerCase()
  const raw = fs.readFileSync(file, 'utf8')
  const dir = path.dirname(file)
  if (ext === '.pls') {
    return raw
      .split(/\r?\n/)
      .map((line) => /^File\d+=(.+)$/i.exec(line.trim())?.[1])
      .filter((value): value is string => !!value)
      .map((value) => ({ source: resolve(value, dir) }))
  }
  if (ext === '.xspf') {
    return [...raw.matchAll(/<location>([^<]+)<\/location>/gi)].map((match) => ({
      source: resolve(decodeXml(match[1]), dir)
    }))
  }
  const entries: PlaylistEntry[] = []
  let pendingTitle: string | undefined
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed) continue
    if (trimmed.startsWith('#EXTINF:')) {
      pendingTitle = trimmed.split(',').slice(1).join(',').trim() || undefined
      continue
    }
    if (trimmed.startsWith('#')) continue
    entries.push({ source: resolve(trimmed, dir), title: pendingTitle })
    pendingTitle = undefined
  }
  return entries
}

function resolve(value: string, dir: string): string {
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(value) || path.isAbsolute(value)) return value
  return path.resolve(dir, value)
}

function decodeXml(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}
