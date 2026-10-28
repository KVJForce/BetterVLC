import { EventEmitter } from 'node:events'
import path from 'node:path'
import fs from 'node:fs'
import { app } from 'electron'
import { isMediaFile, userDir } from './config'
import { probeMedia } from './probe'
import { rememberSource } from './registry'
import { ensureThumbnail, removeThumbnail, thumbFileName, thumbPath } from './thumbnails'
import type { LibrarySnapshot, MediaInfo, ScanProgress } from '../shared/types'

interface LibraryFile {
  version: number
  folders: string[]
  items: MediaInfo[]
}

const SKIP_DIRS = new Set([
  'node_modules', '$recycle.bin', 'system volume information', 'windows',
  'program files', 'program files (x86)', 'programdata', 'appdata'
])

const MAX_FILES = 20000
const MAX_DEPTH = 12

export class Library extends EventEmitter {
  folders: string[] = []
  items = new Map<string, MediaInfo>()
  private watchers = new Map<string, fs.FSWatcher>()
  private watchTimers = new Map<string, NodeJS.Timeout>()
  private scanning = false
  private queuedScan: { folders: string[]; prune: boolean } | null = null
  private saveTimer: NodeJS.Timeout | null = null
  private file: string

  constructor() {
    super()
    this.file = path.join(userDir(), 'library.json')
    this.load()
  }

  private load(): void {
    try {
      if (!fs.existsSync(this.file)) return
      const raw = JSON.parse(fs.readFileSync(this.file, 'utf8')) as LibraryFile
      this.folders = Array.isArray(raw.folders) ? raw.folders.filter((f) => typeof f === 'string') : []
      for (const item of raw.items ?? []) {
        if (!item?.id || !item?.path) continue
        if (!fs.existsSync(item.path)) continue
        const thumb = thumbPath(item)
        item.thumb = fs.existsSync(thumb) ? thumbFileName(item) : undefined
        this.items.set(item.id, item)
        rememberSource(item)
      }
      for (const folder of this.folders) this.watch(folder)
    } catch (error) {
      console.error('Failed to load library', error)
    }
  }

  snapshot(): LibrarySnapshot {
    return {
      folders: [...this.folders],
      items: [...this.items.values()].sort((a, b) => b.addedAt - a.addedAt)
    }
  }

  get(id: string): MediaInfo | undefined {
    return this.items.get(id)
  }

  private saveSoon(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer)
    this.saveTimer = setTimeout(() => this.save(), 400)
  }

  save(): void {
    try {
      const payload: LibraryFile = {
        version: 1,
        folders: this.folders,
        items: [...this.items.values()]
      }
      const tmp = `${this.file}.tmp`
      fs.writeFileSync(tmp, JSON.stringify(payload, null, 1))
      fs.renameSync(tmp, this.file)
    } catch (error) {
      console.error('Failed to save library', error)
    }
  }

  async addFolder(folder: string): Promise<LibrarySnapshot> {
    const resolved = path.resolve(folder)
    if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
      throw new Error('That folder does not exist')
    }
    if (!this.folders.includes(resolved)) {
      this.folders.push(resolved)
      this.watch(resolved)
      this.saveSoon()
    }
    await this.scan([resolved], false)
    return this.snapshot()
  }

  removeFolder(folder: string): LibrarySnapshot {
    const resolved = path.resolve(folder)
    this.folders = this.folders.filter((f) => path.resolve(f) !== resolved)
    this.unwatch(resolved)
    for (const [id, item] of this.items) {
      if (item.path && isInside(item.path, resolved)) {
        removeThumbnail(item)
        this.items.delete(id)
      }
    }
    this.saveSoon()
    return this.snapshot()
  }

  removeItem(id: string): LibrarySnapshot {
    const item = this.items.get(id)
    if (item) {
      removeThumbnail(item)
      this.items.delete(id)
      this.saveSoon()
    }
    return this.snapshot()
  }

  rescan(): Promise<LibrarySnapshot> {
    return this.scan(this.folders, true).then(() => this.snapshot())
  }

  async scan(folders: string[], prune: boolean): Promise<void> {
    if (this.scanning) {
      this.queuedScan = { folders: [...new Set([...(this.queuedScan?.folders ?? []), ...folders])], prune }
      return
    }
    this.scanning = true
    try {
      const files: string[] = []
      for (const folder of folders) {
        if (!fs.existsSync(folder)) continue
        await walk(folder, files, 0)
      }
      const unique = [...new Set(files.map((f) => path.resolve(f)))]
      const byPath = new Map([...this.items.values()].map((item) => [path.resolve(item.path), item]))
      const progress: ScanProgress = { phase: 'probing', done: 0, total: unique.length }
      this.emit('progress', progress)

      const found = new Set<string>()
      const fresh: MediaInfo[] = []
      let done = 0
      await mapLimit(unique, 3, async (file) => {
        found.add(path.resolve(file))
        const existing = byPath.get(path.resolve(file))
        if (existing) {
          try {
            const stat = fs.statSync(file)
            if (Math.abs(existing.mtime - stat.mtimeMs) < 1000) {
              progress.done = ++done
              this.emit('progress', { ...progress, current: path.basename(file) })
              return
            }
          } catch {
            /* fall through */
          }
        }
        try {
          const info = await probeMedia(file)
          const thumb = thumbPath(info)
          info.thumb = fs.existsSync(thumb) ? thumbFileName(info) : undefined
          rememberSource(info)
          this.items.set(info.id, info)
          fresh.push(info)
          this.emit('item', info)
        } catch (error) {
          console.warn('Skipping unreadable media', file, error)
        }
        progress.done = ++done
        this.emit('progress', { ...progress, current: path.basename(file) })
      })

      if (prune) {
        for (const [id, item] of this.items) {
          const inScanned = folders.some((f) => item.path && isInside(item.path, f))
          if (inScanned && !found.has(path.resolve(item.path))) {
            removeThumbnail(item)
            this.items.delete(id)
          }
        }
      }
      this.saveSoon()
      this.emit('progress', { phase: 'done', done: unique.length, total: unique.length })

      // Thumbnails run in the background so the library appears immediately.
      void this.generateThumbnails(fresh.length ? fresh : [...this.items.values()])
    } finally {
      this.scanning = false
      const next = this.queuedScan
      this.queuedScan = null
      if (next) void this.scan(next.folders, next.prune)
    }
  }

  private async generateThumbnails(items: MediaInfo[]): Promise<void> {
    const pending = items.filter((item) => !item.thumb && !item.isStream)
    if (!pending.length) return
    const progress: ScanProgress = { phase: 'thumbnails', done: 0, total: pending.length }
    this.emit('progress', progress)
    await mapLimit(pending, 2, async (item) => {
      const thumb = await ensureThumbnail(item)
      if (thumb) {
        const updated = { ...item, thumb: thumbFileName(item) }
        this.items.set(item.id, updated)
        rememberSource(updated)
        this.emit('item', updated)
        this.saveSoon()
      }
      progress.done += 1
      this.emit('progress', { ...progress, current: item.title })
    })
    this.emit('progress', { phase: 'done', done: progress.total, total: progress.total })
  }

  private watch(folder: string): void {
    if (this.watchers.has(folder)) return
    try {
      const watcher = fs.watch(folder, { recursive: true }, (_event, filename) => {
        if (filename && !isMediaFile(String(filename)) && !String(filename).toLowerCase().endsWith('.srt')) {
          return
        }
        const existing = this.watchTimers.get(folder)
        if (existing) clearTimeout(existing)
        this.watchTimers.set(
          folder,
          setTimeout(() => {
            this.watchTimers.delete(folder)
            void this.scan([folder], true)
          }, 2500)
        )
      })
      watcher.on('error', () => this.unwatch(folder))
      this.watchers.set(folder, watcher)
    } catch {
      /* Folder watching is a convenience, not a requirement. */
    }
  }

  private unwatch(folder: string): void {
    this.watchers.get(folder)?.close()
    this.watchers.delete(folder)
    const timer = this.watchTimers.get(folder)
    if (timer) clearTimeout(timer)
    this.watchTimers.delete(folder)
  }

  dispose(): void {
    for (const folder of [...this.watchers.keys()]) this.unwatch(folder)
    this.save()
  }
}

function isInside(child: string, parent: string): boolean {
  const rel = path.relative(parent, child)
  return !!rel && !rel.startsWith('..') && !path.isAbsolute(rel)
}

async function walk(dir: string, out: string[], depth: number): Promise<void> {
  if (depth > MAX_DEPTH || out.length >= MAX_FILES) return
  let entries: fs.Dirent[]
  try {
    entries = await fs.promises.readdir(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const entry of entries) {
    if (out.length >= MAX_FILES) return
    if (entry.name.startsWith('.')) continue
    if (entry.isSymbolicLink()) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name.toLowerCase())) continue
      await walk(full, out, depth + 1)
    } else if (entry.isFile() && isMediaFile(entry.name)) {
      out.push(full)
    }
  }
}

async function mapLimit<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  let cursor = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++
      await fn(items[index])
    }
  })
  await Promise.all(workers)
}

export function libraryFilePath(): string {
  return path.join(app.getPath('userData'), 'library.json')
}
