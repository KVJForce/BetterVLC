import { useEffect, useState } from 'react'
import {
  AudioLines,
  Captions,
  FolderOpen,
  Info,
  LibraryBig,
  Monitor,
  Palette,
  PlayCircle,
  RefreshCw,
  RotateCcw,
  Trash2,
  Volume2
} from 'lucide-react'
import type { AppInfo } from '../../../shared/types'
import { EQ_FREQUENCIES, EQ_PRESETS, useSettings, type Accent, type ThemeMode } from '../store/settings'
import { useLibrary } from '../store/library'
import { useHistory } from '../store/history'
import { useUi } from '../store/ui'
import { addFolder } from '../lib/actions'

const SECTIONS = [
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'playback', label: 'Playback', icon: PlayCircle },
  { id: 'subtitles', label: 'Subtitles', icon: Captions },
  { id: 'audio', label: 'Audio', icon: AudioLines },
  { id: 'library', label: 'Library', icon: LibraryBig },
  { id: 'about', label: 'About', icon: Info }
]

const ACCENTS: Array<{ id: Accent; label: string }> = [
  { id: 'violet', label: 'Iris' },
  { id: 'cyan', label: 'Cyan' },
  { id: 'amber', label: 'Amber' },
  { id: 'rose', label: 'Rose' },
  { id: 'emerald', label: 'Emerald' }
]

export function SettingsPage(): React.JSX.Element {
  const section = useUi((state) => state.settingsSection)
  const setSection = useUi((state) => state.setSettingsSection)
  const settings = useSettings()
  const items = useLibrary((state) => state.items)
  const folders = useLibrary((state) => state.folders)
  const removeFolder = useLibrary((state) => state.removeFolder)
  const rescan = useLibrary((state) => state.rescan)
  const clearHistory = useHistory((state) => state.clearAll)
  const toast = useUi((state) => state.toast)
  const [info, setInfo] = useState<AppInfo | null>(null)

  useEffect(() => {
    void window.api.app.info().then(setInfo)
  }, [])

  return (
    <div className="page settings-page">
      <header className="library-head">
        <div>
          <span className="eyebrow">Preferences</span>
          <h1>Settings</h1>
          <p>Make BetterVLC feel like yours.</p>
        </div>
      </header>

      <div className="settings-layout">
        <nav className="settings-nav">
          {SECTIONS.map((entry) => {
            const Icon = entry.icon
            return (
              <button
                key={entry.id}
                className={`settings-nav-item ${section === entry.id ? 'active' : ''}`}
                onClick={() => setSection(entry.id)}
              >
                <Icon size={17} />
                {entry.label}
              </button>
            )
          })}
        </nav>

        <div className="settings-content">
          {section === 'appearance' ? (
            <>
              <SettingsCard title="Theme" description="A dark room or a bright morning — your call.">
                <Segmented<ThemeMode>
                  value={settings.theme}
                  options={[
                    { value: 'dark', label: 'Dark', icon: <Monitor size={14} /> },
                    { value: 'light', label: 'Light', icon: <Monitor size={14} /> },
                    { value: 'system', label: 'System', icon: <Monitor size={14} /> }
                  ]}
                  onChange={(value) => settings.update({ theme: value })}
                />
              </SettingsCard>
              <SettingsCard title="Accent" description="The color that follows you through the app.">
                <div className="accent-row">
                  {ACCENTS.map((accent) => (
                    <button
                      key={accent.id}
                      className={`accent-swatch accent-${accent.id} ${settings.accent === accent.id ? 'active' : ''}`}
                      onClick={() => settings.update({ accent: accent.id })}
                      title={accent.label}
                    >
                      <span />
                      {accent.label}
                    </button>
                  ))}
                </div>
              </SettingsCard>
              <SettingsCard title="Motion" description="Reduce interface animation for a calmer feel.">
                <Toggle
                  checked={settings.reduceMotion}
                  onChange={(value) => settings.update({ reduceMotion: value })}
                />
              </SettingsCard>
            </>
          ) : null}

          {section === 'playback' ? (
            <>
              <SettingsCard title="Session" description="How playback begins.">
                <SettingRow label="Autoplay" description="Start playing as soon as a file opens.">
                  <Toggle checked={settings.autoplay} onChange={(value) => settings.update({ autoplay: value })} />
                </SettingRow>
                <SettingRow label="Resume playback" description="Continue from where you stopped last time.">
                  <Toggle checked={settings.resume} onChange={(value) => settings.update({ resume: value })} />
                </SettingRow>
                <SettingRow label="Skip duration" description="How far the arrow keys jump.">
                  <Select
                    value={String(settings.skipSeconds)}
                    options={[
                      { value: '5', label: '5 seconds' },
                      { value: '10', label: '10 seconds' },
                      { value: '15', label: '15 seconds' },
                      { value: '30', label: '30 seconds' }
                    ]}
                    onChange={(value) => settings.update({ skipSeconds: Number(value) })}
                  />
                </SettingRow>
                <SettingRow label="Default speed" description="Playback rate for new sessions.">
                  <Select
                    value={String(settings.defaultSpeed)}
                    options={[0.5, 0.75, 1, 1.25, 1.5, 2].map((rate) => ({
                      value: String(rate),
                      label: `${rate}×`
                    }))}
                    onChange={(value) => settings.update({ defaultSpeed: Number(value) })}
                  />
                </SettingRow>
              </SettingsCard>
              <SettingsCard title="Video" description="Quality and performance of the compatibility pipeline.">
                <SettingRow label="Maximum resolution" description="Transcodes are scaled to this height. Copies stay untouched.">
                  <Select
                    value={String(settings.maxHeight)}
                    options={[
                      { value: '720', label: '720p' },
                      { value: '1080', label: '1080p' },
                      { value: '1440', label: '1440p' },
                      { value: '2160', label: '2160p' }
                    ]}
                    onChange={(value) => settings.update({ maxHeight: Number(value) })}
                  />
                </SettingRow>
                <SettingRow label="Hardware acceleration" description="Let the GPU help with decoding.">
                  <Toggle checked={settings.hwDecode} onChange={(value) => settings.update({ hwDecode: value })} />
                </SettingRow>
                <SettingRow label="Deinterlace" description="Smooth out interlaced footage from older discs and broadcasts.">
                  <Toggle
                    checked={settings.deinterlace}
                    onChange={(value) => settings.update({ deinterlace: value })}
                  />
                </SettingRow>
              </SettingsCard>
            </>
          ) : null}

          {section === 'subtitles' ? (
            <>
              <SettingsCard title="Behavior" description="What happens when subtitles are available.">
                <SettingRow label="Load subtitles automatically" description="Pick the default track when a file opens.">
                  <Toggle
                    checked={settings.subtitle.auto}
                    onChange={(value) => settings.updateSubtitle({ auto: value })}
                  />
                </SettingRow>
                <SettingRow label="Preferred language" description="Language code, for example en, fr or ja.">
                  <input
                    className="text-input compact"
                    value={settings.subtitle.language}
                    placeholder="en"
                    onChange={(event) => settings.updateSubtitle({ language: event.target.value })}
                  />
                </SettingRow>
                <SettingRow label="Subtitle delay" description="Shift all cues forward or backward.">
                  <div className="inline-slider">
                    <input
                      type="range"
                      min={-10}
                      max={10}
                      step={0.1}
                      value={settings.subtitle.delay}
                      onChange={(event) => settings.updateSubtitle({ delay: Number(event.target.value) })}
                    />
                    <span>{settings.subtitle.delay > 0 ? '+' : ''}{settings.subtitle.delay.toFixed(1)}s</span>
                  </div>
                </SettingRow>
              </SettingsCard>
              <SettingsCard title="Style" description="Typography that reads beautifully over any frame.">
                <div className="subtitle-preview" style={{ fontFamily: settings.subtitle.fontFamily }}>
                  <span
                    style={{
                      color: settings.subtitle.color,
                      background: `rgba(0, 0, 0, ${settings.subtitle.background})`,
                      fontSize: `${settings.subtitle.size * 0.21}px`,
                      textShadow: `0 1px ${settings.subtitle.outline * 2}px rgba(0,0,0,0.9), 0 0 ${settings.subtitle.outline * 3}px rgba(0,0,0,0.65)`
                    }}
                  >
                    This is how your subtitles will look.
                  </span>
                </div>
                <SettingRow label="Font" description="A typeface with a little personality.">
                  <Select
                    value={settings.subtitle.fontFamily}
                    options={[
                      { value: 'Inter Variable', label: 'Inter' },
                      { value: 'Space Grotesk Variable', label: 'Space Grotesk' },
                      { value: 'Segoe UI', label: 'Segoe UI' },
                      { value: 'Georgia', label: 'Georgia' },
                      { value: 'Arial', label: 'Arial' }
                    ]}
                    onChange={(value) => settings.updateSubtitle({ fontFamily: value })}
                  />
                </SettingRow>
                <SettingRow label="Size" description="Scale of the subtitle text.">
                  <div className="inline-slider">
                    <input
                      type="range"
                      min={60}
                      max={180}
                      value={settings.subtitle.size}
                      onChange={(event) => settings.updateSubtitle({ size: Number(event.target.value) })}
                    />
                    <span>{settings.subtitle.size}%</span>
                  </div>
                </SettingRow>
                <SettingRow label="Text color" description="Pure white works almost everywhere.">
                  <div className="color-row">
                    {['#FFFFFF', '#F5E6C8', '#FFE066', '#9BE7FF', '#FFB3C7'].map((color) => (
                      <button
                        key={color}
                        className={`color-swatch ${settings.subtitle.color === color ? 'active' : ''}`}
                        style={{ background: color }}
                        onClick={() => settings.updateSubtitle({ color })}
                        aria-label={`Subtitle color ${color}`}
                      />
                    ))}
                    <input
                      type="color"
                      value={settings.subtitle.color}
                      onChange={(event) => settings.updateSubtitle({ color: event.target.value })}
                    />
                  </div>
                </SettingRow>
                <SettingRow label="Background" description="A soft plate keeps text legible over bright scenes.">
                  <div className="inline-slider">
                    <input
                      type="range"
                      min={0}
                      max={0.9}
                      step={0.05}
                      value={settings.subtitle.background}
                      onChange={(event) => settings.updateSubtitle({ background: Number(event.target.value) })}
                    />
                    <span>{Math.round(settings.subtitle.background * 100)}%</span>
                  </div>
                </SettingRow>
                <SettingRow label="Outline" description="Depth around each letter.">
                  <div className="inline-slider">
                    <input
                      type="range"
                      min={0}
                      max={4}
                      step={0.5}
                      value={settings.subtitle.outline}
                      onChange={(event) => settings.updateSubtitle({ outline: Number(event.target.value) })}
                    />
                    <span>{settings.subtitle.outline.toFixed(1)}</span>
                  </div>
                </SettingRow>
                <SettingRow label="Vertical position" description="Distance from the top of the video.">
                  <div className="inline-slider">
                    <input
                      type="range"
                      min={40}
                      max={95}
                      value={settings.subtitle.position}
                      onChange={(event) => settings.updateSubtitle({ position: Number(event.target.value) })}
                    />
                    <span>{settings.subtitle.position}%</span>
                  </div>
                </SettingRow>
              </SettingsCard>
            </>
          ) : null}

          {section === 'audio' ? (
            <>
              <SettingsCard title="Equalizer" description="Ten bands of tone shaping, applied in real time.">
                <SettingRow label="Enable equalizer" description="A flat curve by default.">
                  <Toggle checked={settings.eq.enabled} onChange={(value) => settings.updateEq({ enabled: value })} />
                </SettingRow>
                <SettingRow label="Preset" description="Start from a curve and make it yours.">
                  <Select
                    value={settings.eq.preset}
                    options={Object.keys(EQ_PRESETS).map((preset) => ({ value: preset, label: preset }))}
                    onChange={(value) => settings.updateEq({ preset: value, bands: [...EQ_PRESETS[value]] })}
                  />
                </SettingRow>
                <div className={`eq-panel ${settings.eq.enabled ? '' : 'disabled'}`}>
                  {EQ_FREQUENCIES.map((frequency, index) => (
                    <div className="eq-band" key={frequency}>
                      <span className="eq-value">
                        {settings.eq.bands[index] > 0 ? '+' : ''}
                        {settings.eq.bands[index]?.toFixed(0) ?? 0}
                      </span>
                      <input
                        type="range"
                        min={-12}
                        max={12}
                        step={1}
                        value={settings.eq.bands[index] ?? 0}
                        onChange={(event) => {
                          const bands = [...settings.eq.bands]
                          bands[index] = Number(event.target.value)
                          settings.updateEq({ bands, preset: 'Custom' })
                        }}
                      />
                      <span className="eq-freq">
                        {frequency >= 1000 ? `${frequency / 1000}k` : frequency}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="eq-actions">
                  <button
                    className="button ghost small"
                    onClick={() => settings.updateEq({ bands: [...EQ_PRESETS.Flat], preset: 'Flat' })}
                  >
                    <RotateCcw size={14} /> Flatten
                  </button>
                  <button
                    className="button ghost small"
                    onClick={() =>
                      settings.updateEq({
                        enabled: !settings.eq.enabled
                      })
                    }
                  >
                    <Volume2 size={14} /> {settings.eq.enabled ? 'Bypass EQ' : 'Enable EQ'}
                  </button>
                </div>
              </SettingsCard>
              <SettingsCard title="Output" description="Playback uses the default Windows output device.">
                <p className="settings-note">
                  BetterVLC routes audio through a Web Audio graph for the equalizer, volume and the live
                  visualizer. Multi-channel tracks are downmixed to stereo in the compatibility pipeline.
                </p>
              </SettingsCard>
            </>
          ) : null}

          {section === 'library' ? (
            <>
              <SettingsCard title="Folders" description="Everything BetterVLC watches for new media.">
                {folders.length === 0 ? (
                  <div className="empty-inline">
                    <FolderOpen size={18} />
                    No folders yet.
                  </div>
                ) : (
                  <div className="folder-settings-list">
                    {folders.map((folder) => (
                      <div className="folder-settings-row" key={folder}>
                        <FolderOpen size={16} />
                        <div>
                          <strong>{folder.split(/[\\/]/).filter(Boolean).pop()}</strong>
                          <span>{folder}</span>
                        </div>
                        <span className="folder-settings-count">
                          {items.filter((item) => item.path.toLowerCase().startsWith(folder.toLowerCase())).length}
                        </span>
                        <button
                          className="icon-button tiny"
                          title="Remove folder"
                          onClick={() => void removeFolder(folder)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="settings-actions">
                  <button className="button primary small" onClick={() => void addFolder()}>
                    <FolderOpen size={15} /> Add folder
                  </button>
                  <button className="button ghost small" onClick={() => void rescan()}>
                    <RefreshCw size={14} /> Rescan library
                  </button>
                </div>
              </SettingsCard>
              <SettingsCard title="History" description="Resume points and recently played items.">
                <SettingRow label="Clear watch history" description="Removes every resume point. Files are untouched.">
                  <button
                    className="button ghost small danger-text"
                    onClick={() => {
                      clearHistory()
                      toast({ title: 'Watch history cleared', tone: 'success' })
                    }}
                  >
                    Clear history
                  </button>
                </SettingRow>
              </SettingsCard>
            </>
          ) : null}

          {section === 'about' ? (
            <>
              <SettingsCard title="BetterVLC" description="A modern face for the world's most capable media engine.">
                <div className="about-hero">
                  <div className="about-mark">▶</div>
                  <div>
                    <h2>BetterVLC 1.0</h2>
                    <p>Everything plays. Beautifully.</p>
                  </div>
                </div>
                <div className="about-grid">
                  <div><span>Electron</span><strong>{info?.electron ?? '—'}</strong></div>
                  <div><span>Platform</span><strong>{info?.platform ?? '—'}</strong></div>
                  <div className="wide"><span>FFmpeg</span><strong className="path-text">{info?.ffmpeg ?? '—'}</strong></div>
                </div>
              </SettingsCard>
              <SettingsCard title="Credits" description="Standing on the shoulders of giants.">
                <p className="settings-note">
                  Playback, probing and conversion are powered by FFmpeg. The interface is built with
                  Electron, React and Framer Motion. BetterVLC is an independent project inspired by the
                  legendary VLC media player and is not affiliated with or endorsed by VideoLAN.
                </p>
                <div className="credit-chips">
                  {['FFmpeg', 'Electron', 'React', 'Vite', 'VideoLAN-inspired'].map((credit) => (
                    <span key={credit}>{credit}</span>
                  ))}
                </div>
              </SettingsCard>
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function SettingsCard({
  title,
  description,
  children
}: {
  title: string
  description?: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <section className="settings-card">
      <header>
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </header>
      <div className="settings-card-body">{children}</div>
    </section>
  )
}

function SettingRow({
  label,
  description,
  children
}: {
  label: string
  description?: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="setting-row">
      <div>
        <strong>{label}</strong>
        {description ? <span>{description}</span> : null}
      </div>
      <div className="setting-control">{children}</div>
    </div>
  )
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }): React.JSX.Element {
  return (
    <button
      className={`toggle ${checked ? 'on' : ''}`}
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
    >
      <span className="toggle-knob" />
    </button>
  )
}

function Select({
  value,
  options,
  onChange
}: {
  value: string
  options: Array<{ value: string; label: string }>
  onChange: (value: string) => void
}): React.JSX.Element {
  return (
    <select className="select-input" value={value} onChange={(event) => onChange(event.target.value)}>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  )
}

function Segmented<T extends string>({
  value,
  options,
  onChange
}: {
  value: T
  options: Array<{ value: T; label: string; icon?: React.ReactNode }>
  onChange: (value: T) => void
}): React.JSX.Element {
  return (
    <div className="segmented">
      {options.map((option) => (
        <button
          key={option.value}
          className={value === option.value ? 'active' : ''}
          onClick={() => onChange(option.value)}
        >
          {option.icon}
          {option.label}
        </button>
      ))}
    </div>
  )
}
