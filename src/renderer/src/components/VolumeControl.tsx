import { useState } from 'react'
import { Volume, Volume1, Volume2, VolumeX } from 'lucide-react'
import { usePlayer } from '../store/player'

export function VolumeControl(): React.JSX.Element {
  const volume = usePlayer((state) => state.volume)
  const muted = usePlayer((state) => state.muted)
  const setVolume = usePlayer((state) => state.setVolume)
  const toggleMute = usePlayer((state) => state.toggleMute)
  const [focused, setFocused] = useState(false)
  const Icon = muted || volume === 0 ? VolumeX : volume < 0.35 ? Volume : volume < 0.7 ? Volume1 : Volume2

  return (
    <div
      className={`volume-control ${focused ? 'focused' : ''}`}
      onMouseEnter={() => setFocused(true)}
      onMouseLeave={() => setFocused(false)}
    >
      <button className="control-button" onClick={toggleMute} aria-label={muted ? 'Unmute' : 'Mute'} data-tip={muted ? 'Unmute (M)' : 'Mute (M)'}>
        <Icon size={19} />
      </button>
      <div className="volume-slider-wrap">
        <input
          className="volume-slider"
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={muted ? 0 : volume}
          aria-label="Volume"
          onChange={(event) => setVolume(Number(event.target.value))}
          style={{ backgroundSize: `${(muted ? 0 : volume) * 100}% 100%` }}
        />
        <span className="volume-value">{Math.round((muted ? 0 : volume) * 100)}</span>
      </div>
    </div>
  )
}
