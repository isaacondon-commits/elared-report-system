const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  onUpdateStatus: (callback) =>
    ipcRenderer.on('update-status', (_, data) => callback(data)),
  installUpdate: () =>
    ipcRenderer.send('install-update'),
  getVersion: () =>
    ipcRenderer.invoke('get-version'),
  checkForUpdates: () =>
    ipcRenderer.send('check-updates'),
})
