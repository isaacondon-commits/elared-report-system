const { app, BrowserWindow, ipcMain, protocol, net } = require('electron')
const { autoUpdater } = require('electron-updater')
const log = require('electron-log')
const path = require('path')

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { secure: true, standard: true, supportFetchAPI: true } },
])

let mainWindow = null

autoUpdater.logger = log
autoUpdater.logger.transports.file.level = 'debug'
autoUpdater.autoDownload = true
autoUpdater.autoInstallOnAppQuit = true
autoUpdater.allowDowngrade = false
autoUpdater.allowPrerelease = false

autoUpdater.setFeedURL({
  provider: 'github',
  owner: 'isaacondon-commits',
  repo: 'elared-report-system',
  private: false,
})

log.info('App starting. Version:', app.getVersion())

function doCheckForUpdates() {
  try {
    autoUpdater.checkForUpdatesAndNotify().catch(err => {
      log.info('Update check failed silently:', err.message)
    })
  } catch (e) {
    log.info('Update check exception silently:', e.message)
  }
}

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
    title: 'Eficiencia · Sistema de Reportes',
    autoHideMenuBar: true,
    backgroundColor: '#003DA5',
  })

  mainWindow = win

  if (process.env.NODE_ENV === 'development') {
    win.loadURL('http://localhost:5173')
  } else {
    win.loadURL('app://localhost/index.html')
    win.webContents.on('did-fail-load', (event, code, desc) => {
      log.error('Failed to load:', code, desc)
      setTimeout(() => win.loadURL('app://localhost/index.html'), 1000)
    })
  }

  ipcMain.handle('get-version', () => app.getVersion())
  ipcMain.on('install-update', () => { autoUpdater.quitAndInstall() })
  ipcMain.on('check-updates', () => {
    log.info('Manual update check requested')
    doCheckForUpdates()
  })

  autoUpdater.on('checking-for-update', () => {
    log.info('Checking for update...')
    win.webContents.send('update-status', { status: 'checking' })
  })
  autoUpdater.on('update-available', (info) => {
    log.info('Update available:', info.version)
    win.webContents.send('update-status', { status: 'available', version: info.version })
  })
  autoUpdater.on('update-not-available', (info) => {
    log.info('Update not available. Current version:', info.version)
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
  autoUpdater.on('update-downloaded', (info) => {
    log.info('Update downloaded:', info.version)
    win.setProgressBar(-1)
    win.webContents.send('update-status', { status: 'downloaded' })
  })
  autoUpdater.on('error', (err) => {
    log.error('Update error full:', err)
    if (mainWindow) {
      mainWindow.webContents.send('update-status', {
        status: 'error',
        message: err.message,
      })
    }
  })

  return win
}

app.whenReady().then(() => {
  protocol.handle('app', (request) => {
    const urlPath = request.url.slice('app://localhost/'.length)
    const decoded = decodeURIComponent(urlPath || 'index.html')
    const filePath = path.join(__dirname, '..', 'dist', decoded)
    return net.fetch(`file:///${filePath.replace(/\\/g, '/')}`)
  })

  createWindow()

  if (process.env.NODE_ENV !== 'development') {
    doCheckForUpdates()
    setInterval(doCheckForUpdates, 30 * 60 * 1000)
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
