import { app, BrowserWindow, dialog } from 'electron'
import type { MessageBoxOptions } from 'electron'
import electronUpdater from 'electron-updater'
import type { AppUpdater } from 'electron-updater'

const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000

let updater: AppUpdater | null = null
let started = false
let promptedVersion = ''
let lastNotifiedVersion = ''

/**
 * GitHub Releases auto-update. Every push to main is built and published as a
 * new version by .github/workflows/release.yml, so the release version is the
 * source of truth: if it is newer than app.getVersion(), the installed build is
 * behind the repository.
 *
 * Portable builds run from a temporary extraction directory, so installing an
 * update there would be lost on exit. They are deliberately excluded.
 */
export function startUpdates(getWindow: () => BrowserWindow | null): void {
  if (started || !app.isPackaged || process.env['PORTABLE_EXECUTABLE_DIR']) return
  started = true

  // electron-updater is CommonJS and exposes autoUpdater through a getter that
  // Node's ESM named-export detection misses, so import the default object.
  const autoUpdater = electronUpdater.autoUpdater
  updater = autoUpdater
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('error', (error) => {
    console.warn('[update] check failed:', error instanceof Error ? error.message : error)
  })

  autoUpdater.on('update-available', (info) => {
    if (info.version === lastNotifiedVersion) return
    lastNotifiedVersion = info.version
    console.info('[update] downloading', info.version)
  })

  autoUpdater.on('update-downloaded', (info) => {
    void promptRestart(getWindow, info.version)
  })

  void check()
  const timer = setInterval(() => void check(), CHECK_INTERVAL_MS)
  timer.unref()
}

async function check(): Promise<void> {
  if (!updater) return
  try {
    await updater.checkForUpdates()
  } catch (error) {
    // Offline launches and GitHub outages are expected; keep the player usable.
    console.warn('[update] request failed:', error instanceof Error ? error.message : error)
  }
}

async function promptRestart(
  getWindow: () => BrowserWindow | null,
  version: string
): Promise<void> {
  if (promptedVersion === version) return
  promptedVersion = version

  const window = getWindow()
  const options: MessageBoxOptions = {
    type: 'info',
    title: 'Update ready',
    message: `BetterVLC ${version} has been downloaded.`,
    detail: 'Restart to finish installing. Choosing Later installs it the next time you quit.',
    buttons: ['Restart now', 'Later'],
    defaultId: 0,
    cancelId: 1,
    noLink: true
  }

  const { response } =
    window && !window.isDestroyed()
      ? await dialog.showMessageBox(window, options)
      : await dialog.showMessageBox(options)

  if (response === 0) {
    setImmediate(() => updater?.quitAndInstall(true, true))
  }
}
