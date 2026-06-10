interface ElectronAPI {
  onUpdateStatus: (callback: (data: UpdateStatusData) => void) => void
  installUpdate: () => void
  getVersion: () => Promise<string>
}

interface UpdateStatusData {
  status: 'checking' | 'available' | 'downloading' | 'downloaded' | 'up-to-date' | 'error'
  version?: string
  percent?: number
  speed?: number
  message?: string
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }
}

export {}
