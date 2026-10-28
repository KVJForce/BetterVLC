import { useEffect, useRef } from 'react'
import { playback } from '../lib/playback'

export function Visualizer({ playing }: { playing: boolean }): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const context = canvas.getContext('2d')
    if (!context) return
    let frame = 0
    let width = 0
    let height = 0

    const resize = (): void => {
      const ratio = window.devicePixelRatio || 1
      const rect = canvas.getBoundingClientRect()
      width = rect.width
      height = rect.height
      canvas.width = Math.floor(width * ratio)
      canvas.height = Math.floor(height * ratio)
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(canvas)

    const bars = 72
    const smoothed = new Float32Array(bars)

    const draw = (): void => {
      frame = requestAnimationFrame(draw)
      context.clearRect(0, 0, width, height)
      const analyser = playback.getAnalyser()
      const data = new Uint8Array(analyser?.frequencyBinCount ?? 0)
      if (analyser && playing) analyser.getByteFrequencyData(data)

      const gradient = context.createLinearGradient(0, height, 0, height * 0.15)
      gradient.addColorStop(0, 'rgba(139, 92, 246, 0.95)')
      gradient.addColorStop(0.55, 'rgba(34, 211, 238, 0.75)')
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0.08)')

      const barWidth = width / bars
      const baseY = height
      for (let i = 0; i < bars; i += 1) {
        const index = Math.floor(Math.pow(i / bars, 1.7) * (data.length ? data.length * 0.72 : 1))
        const raw = analyser && playing ? (data[index] ?? 0) / 255 : 0
        const idle = 0.045 + Math.abs(Math.sin(Date.now() / 760 + i * 0.38)) * 0.045
        const target = raw > 0.02 ? raw : idle
        smoothed[i] += (target - smoothed[i]) * 0.22
        const barHeight = Math.max(3, smoothed[i] * height * 0.72)
        const x = i * barWidth + barWidth * 0.22
        const w = barWidth * 0.56
        context.fillStyle = gradient
        context.beginPath()
        context.roundRect(x, baseY - barHeight, w, barHeight, w / 2)
        context.fill()
        context.globalAlpha = 0.22
        context.beginPath()
        context.roundRect(x, baseY, w, Math.min(barHeight * 0.28, 14), w / 2)
        context.fill()
        context.globalAlpha = 1
      }
    }
    frame = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [playing])

  return <canvas className="visualizer" ref={canvasRef} />
}
