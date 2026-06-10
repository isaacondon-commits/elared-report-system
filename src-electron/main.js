const { app, BrowserWindow, ipcMain, protocol, net } = require('electron')
const { autoUpdater } = require('electron-updater')
const log = require('electron-log')
const path = require('path')

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { secure: true, standard: true, supportFetchAPI: true } },
])

autoUpdater.logger = log
autoUpdater.logger.transports.file.level = 'info'
autoUpdater.autoDownload = true
autoUpdater.autoInstallOnAppQuit = true

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
    win.loadURL('app://localhost/index.html')
    win.webContents.on('did-fail-load', (event, code, desc) => {
      log.error('Failed to load:', code, desc)
      setTimeout(() => win.loadURL('app://localhost/index.html'), 1000)
    })
  }

  ipcMain.handle('get-version', () => app.getVersion())
  ipcMain.on('install-update', () => { autoUpdater.quitAndInstall() })

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
      msg.includes('net::') ||
      msg.includes('ENOTFOUND') ||
      msg.includes('ECONNREFUSED')
    ) {
      log.info('No hay releases disponibles aun — ignorando')
      return
    }
    win.webContents.send('update-status', { status: 'error', message: 'Error de actualizacion' })
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
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
