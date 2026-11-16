import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter'
import '@fontsource-variable/space-grotesk'
import './styles/global.css'
import { App } from './App'
import { resolveTheme, useSettings } from './store/settings'

const settings = useSettings.getState()
const root = document.documentElement
root.dataset.theme = resolveTheme(settings.theme)
root.dataset.accent = settings.accent
root.dataset.motion = settings.reduceMotion ? 'reduced' : 'full'

const container = document.getElementById('root')
if (!container) throw new Error('Root element not found')

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>
)
