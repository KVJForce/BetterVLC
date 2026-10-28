export interface Cue {
  start: number
  end: number
  text: string
  line?: number
  align?: 'start' | 'center' | 'end' | 'left' | 'right'
}

function parseTimestamp(value: string): number {
  const clean = value.trim().replace(',', '.')
  const parts = clean.split(':')
  if (parts.length === 3) {
    return Number(parts[0]) * 3600 + Number(parts[1]) * 60 + Number(parts[2])
  }
  if (parts.length === 2) return Number(parts[0]) * 60 + Number(parts[1])
  return 0
}

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

function cleanText(value: string): string {
  return decodeEntities(
    value
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/\{\\[^}]*\}/g, '')
      .replace(/\r/g, '')
  ).trim()
}

export function parseVtt(input: string): Cue[] {
  const text = input.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n')
  const blocks = text.split(/\n{2,}/)
  const cues: Cue[] = []
  for (const block of blocks) {
    const lines = block.split('\n')
    if (!lines.length) continue
    const first = lines[0].trim()
    if (!first || first === 'WEBVTT' || first.startsWith('NOTE') || first.startsWith('STYLE') || first.startsWith('REGION')) {
      continue
    }
    let timingIndex = 0
    if (!first.includes('-->')) {
      if (lines[1]?.includes('-->')) timingIndex = 1
      else continue
    }
    const timing = lines[timingIndex]
    const match = /^([\d:.,]+)\s*-->\s*([\d:.,]+)(.*)$/.exec(timing)
    if (!match) continue
    const start = parseTimestamp(match[1])
    const end = parseTimestamp(match[2])
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue
    const settings = match[3] ?? ''
    const lineMatch = /line:(-?[\d.]+)(%?)/.exec(settings)
    const alignMatch = /align:(start|center|end|left|right)/.exec(settings)
    const body = cleanText(lines.slice(timingIndex + 1).join('\n'))
    if (!body) continue
    cues.push({
      start,
      end,
      text: body,
      line: lineMatch ? Number(lineMatch[1]) : undefined,
      align: alignMatch ? (alignMatch[1] as Cue['align']) : undefined
    })
  }
  cues.sort((a, b) => a.start - b.start)
  return cues
}

export function cueAt(cues: Cue[], time: number, delay: number): Cue | null {
  const t = time - delay
  // Cues are sorted; a linear scan from the active region is fine for typical subtitle sizes.
  let low = 0
  let high = cues.length - 1
  let candidate = -1
  while (low <= high) {
    const mid = (low + high) >> 1
    if (cues[mid].start <= t) {
      candidate = mid
      low = mid + 1
    } else {
      high = mid - 1
    }
  }
  if (candidate < 0) return null
  for (let i = candidate; i >= 0 && i > candidate - 4; i -= 1) {
    const cue = cues[i]
    if (t >= cue.start && t <= cue.end) return cue
    if (cue.end < t) break
  }
  return null
}
