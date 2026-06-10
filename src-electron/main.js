const { app, BrowserWindow, ipcMain } = require('electron')
const { autoUpdater } = require('electron-updater')
const log = require('electron-log')
const path = require('path')

// ── Logging ───────────────────────────────────────────────────────────────────
autoUpdater.logger = log
autoUpdater.logger.transports.file.level = 'info'

// ── Auto-update settings ──────────────────────────────────────────────────────
autoUpdater.autoDownload = true
autoUpdater.autoInstallOnAppQuit = true

// ── Window ────────────────────────────────────────────────────────────────────
function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    icon: path.join(__dirname, '../public/icon.png'),
    title: 'Elared · Sistema de Reportes',
    autoHideMenuBar: true,
    backgroundColor: '#003DA5',
  })

  if (process.env.NODE_ENV === 'development') {
    win.loadURL('http://localhost:5173')
  } else {
    const indexPath = path.join(__dirname, '../dist/index.html')
    win.loadFile(indexPath)

    win.webContents.on('did-fail-load', (event, code, desc) => {
      log.error('Failed to load:', code, desc)
      setTimeout(() => win.loadFile(indexPath), 1000)
    })
  }

  // ── IPC handlers ────────────────────────────────────────────────────────────
  ipcMain.handle('get-version', () => app.getVersion())

  ipcMain.on('install-update', () => {
    autoUpdater.quitAndInstall()
  })

  // ── Auto-update events → renderer ───────────────────────────────────────────
  if (process.env.NODE_ENV !== 'development') {
    setTimeout(() => {
      try {
        autoUpdater.checkForUpdates().catch(err => {
          log.info('Update check failed silently:', err.message)
        })
      } catch (e) {
        log.info('Update check failed silently:', e.message)
      }
    }, 3000)
  }

  autoUpdater.on('checking-for-update', () => {
    win.webContents.send('update-status', { status: 'checking' })
  })

  autoUpdater.on('update-available', (info) => {
    win.webContents.send('update-status', { status: 'available', version: info.version })
  })

  autoUpdater.on('update-not-available', () => {
    win.webContents.send('update-status', { status: 'up-to-date' })
  })

  autoUpdater.on('download-progress', (progress) => {
    win.setProgressBar(progress.percent / 100)
    win.webContents.send('update-status', {
      status: 'downloading',
      percent: Math.round(progress.percent),
      speed: progress.bytesPerSecond,
    })
  })

  autoUpdater.on('update-downloaded', () => {
    win.setProgressBar(-1)
    win.webContents.send('update-status', { status: 'downloaded' })
  })

  autoUpdater.on('error', (err) => {
    log.error('Auto-updater error:', err)
    const msg = err.message || ''
    if (
      msg.includes('No releases') ||
      msg.includes('404') ||
      msg.includes('Cannot find') ||
      msg.includes('HttpError') ||
      msg.includes('net::')
    ) {
      log.info('No hay releases disponibles aún — ignorando')
      return
    }
    win.webContents.send('update-status', { status: 'error', message: 'Error de actualización' })
  })

  return win
}

// ── App lifecycle ─────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
