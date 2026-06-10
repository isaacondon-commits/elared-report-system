import { useEffect, useState } from 'react'
import { Download, CheckCircle, XCircle, RefreshCw } from 'lucide-react'

interface UpdateStatusData {
  status: 'checking' | 'available' | 'downloading' | 'downloaded' | 'up-to-date' | 'error'
  version?: string
  percent?: number
  message?: string
}

export function UpdateNotification() {
  const [update, setUpdate] = useState<UpdateStatusData | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!window.electronAPI) return

    window.electronAPI.onUpdateStatus((data) => {
      setUpdate(data)
      if (['available', 'downloading', 'downloaded', 'error'].includes(data.status)) {
        setVisible(true)
      }
    })
  }, [])

  if (!visible || !update) return null

  const { status, version, percent } = update

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 rounded-xl shadow-2xl border border-slate-200 bg-white overflow-hidden">
      {status === 'available' && (
        <div className="flex items-start gap-3 p-4 border-l-4 border-blue-600">
          <Download className="mt-0.5 shrink-0 text-blue-600" size={18} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-800">
              Nueva versión {version} disponible
            </p>
            <p className="text-xs text-slate-500 mt-0.5">Descargando automáticamente...</p>
          </div>
        </div>
      )}

      {status === 'downloading' && (
        <div className="p-4 border-l-4 border-blue-600">
          <div className="flex items-center gap-2 mb-2">
            <RefreshCw size={16} className="animate-spin text-blue-600" />
            <p className="text-sm font-medium text-slate-800">
              Descargando actualización... {percent}%
            </p>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-1.5">
            <div
              className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${percent ?? 0}%` }}
            />
          </div>
        </div>
      )}

      {status === 'downloaded' && (
        <div className="p-4 border-l-4 border-green-500">
          <div className="flex items-start gap-3">
            <CheckCircle className="mt-0.5 shrink-0 text-green-500" size={18} />
            <div className="flex-1">
              <p className="text-sm font-semibold text-slate-800">¡Actualización lista!</p>
              <p className="text-xs text-slate-500 mt-0.5">Se instalará al cerrar la app</p>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => window.electronAPI?.installUpdate()}
                  className="flex-1 rounded-lg bg-[#003DA5] text-white text-xs font-medium py-1.5 px-3 hover:bg-blue-700 transition-colors"
                >
                  Instalar ahora
                </button>
                <button
                  onClick={() => setVisible(false)}
                  className="rounded-lg border border-slate-200 text-slate-600 text-xs font-medium py-1.5 px-3 hover:bg-slate-50 transition-colors"
                >
                  Después
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {status === 'error' && (
        <div className="flex items-start gap-3 p-4 border-l-4 border-red-500">
          <XCircle className="mt-0.5 shrink-0 text-red-500" size={18} />
          <div className="flex-1">
            <p className="text-sm font-medium text-slate-800">Error al verificar actualizaciones</p>
            <button
              onClick={() => setVisible(false)}
              className="mt-2 text-xs text-slate-500 hover:text-slate-700 underline"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
