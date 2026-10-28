import { useEffect, useRef, useState } from 'react'
import type { ChapterInfo } from '../../../shared/types'
import { playback } from '../lib/playback'
import { formatTime } from '../lib/format'

interface ScrubberProps {
  time: number
  duration: number
  chapters: ChapterInfo[]
  abLoop: { a: number | null; b: number | null }
  onSeek: (time: number) => void
  live?: boolean
}

export function Scrubber({ time, duration, chapters, abLoop, onSeek, live }: ScrubberProps): React.JSX.Element {
  const trackRef = useRef<HTMLDivElement>(null)
  const [hover, setHover] = useState<{ x: number; time: number } | null>(null)
  const [dragging, setDragging] = useState(false)
  const [preview, setPreview] = useState<number | null>(null)
  const [buffered, setBuffered] = useState<Array<{ start: number; end: number }>>([])

  useEffect(() => {
    const update = (): void => setBuffered(playback.getBuffered())
    update()
    const timer = window.setInterval(update, 500)
    return () => window.clearInterval(timer)
  }, [time])

  const displayTime = preview ?? time
  const percent = duration > 0 ? Math.min((displayTime / duration) * 100, 100) : 0

  const timeAt = (clientX: number): number => {
    const rect = trackRef.current?.getBoundingClientRect()
    if (!rect || !duration) return 0
    const ratio = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1)
    return ratio * duration
  }

  const chapterAt = (value: number): ChapterInfo | undefined => {
    let found: ChapterInfo | undefined
    for (const chapter of chapters) {
      if (chapter.start <= value) found = chapter
      else break
    }
    return found
  }

  return (
    <div
      className={`scrubber ${dragging ? 'dragging' : ''} ${live ? 'live' : ''}`}
      onPointerMove={(event) => {
        const value = timeAt(event.clientX)
        const rect = trackRef.current?.getBoundingClientRect()
        setHover(rect ? { x: event.clientX - rect.left, time: value } : null)
        if (dragging) setPreview(value)
      }}
      onPointerLeave={() => {
        if (!dragging) setHover(null)
      }}
      onPointerDown={(event) => {
        if (live || !duration) return
        event.currentTarget.setPointerCapture(event.pointerId)
        setDragging(true)
        setPreview(timeAt(event.clientX))
      }}
      onPointerUp={(event) => {
        if (!dragging) return
        const value = timeAt(event.clientX)
        setDragging(false)
        setPreview(null)
        onSeek(value)
        event.currentTarget.releasePointerCapture(event.pointerId)
      }}
      onPointerCancel={() => {
        setDragging(false)
        setPreview(null)
      }}
    >
      <div className="scrubber-hit" ref={trackRef}>
        <div className="scrubber-track">
          {buffered.map((range, index) => {
            if (!duration) return null
            const start = Math.max((range.start / duration) * 100, 0)
            const end = Math.min((range.end / duration) * 100, 100)
            if (end <= start) return null
            return (
              <div
                key={index}
                className="scrubber-buffered"
                style={{ left: `${start}%`, width: `${end - start}%` }}
              />
            )
          })}
          {duration > 0
            ? chapters.map((chapter, index) => {
                const left = (chapter.start / duration) * 100
                if (left < 0.5 || left > 99.5) return null
                return <div key={index} className="scrubber-chapter" style={{ left: `${left}%` }} />
              })
            : null}
          {abLoop.a !== null && duration ? (
            <div className="scrubber-ab" style={{ left: `${(abLoop.a / duration) * 100}%` }}>A</div>
          ) : null}
          {abLoop.b !== null && duration ? (
            <div className="scrubber-ab" style={{ left: `${(abLoop.b / duration) * 100}%` }}>B</div>
          ) : null}
          <div className="scrubber-played" style={{ width: `${percent}%` }} />
          <div className="scrubber-knob" style={{ left: `${percent}%` }} />
        </div>
      </div>
      {live ? (
        <div className="scrubber-live">
          <span className="live-dot" /> Live
        </div>
      ) : null}
      {hover && !live ? (
        <div
          className="scrubber-tooltip"
          style={{ left: `clamp(44px, ${hover.x}px, calc(100% - 44px))` }}
        >
          <strong>{formatTime(hover.time)}</strong>
          {chapterAt(hover.time) ? <span>{chapterAt(hover.time)?.title}</span> : null}
        </div>
      ) : null}
      {live ? (
        <div className="scrubber-tooltip live-tip">
          <strong>Live stream</strong>
          <span>Elapsed {formatTime(time)}</span>
        </div>
      ) : null}
    </div>
  )
}
