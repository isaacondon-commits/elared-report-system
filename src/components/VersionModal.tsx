import { useState, useEffect, useRef } from 'react';
import { X, RefreshCw, CheckCircle, AlertTriangle, Download, Loader } from 'lucide-react';

interface Props {
  onClose: () => void;
}

type CheckState = 'idle' | 'checking' | 'up-to-date' | 'available' | 'downloading' | 'downloaded' | 'error';

function semverGt(a: string, b: string): boolean {
  const parse = (v: string) => v.replace(/^v/, '').split('.').map(Number);
  const [aMaj, aMin, aPat] = parse(a);
  const [bMaj, bMin, bPat] = parse(b);
  if (aMaj !== bMaj) return aMaj > bMaj;
  if (aMin !== bMin) return aMin > bMin;
  return aPat > bPat;
}

export default function VersionModal({ onClose }: Props) {
  const [currentVersion, setCurrentVersion] = useState<string | null>(null);
  const [latestVersion, setLatestVersion] = useState<string | null>(null);
  const [checkState, setCheckState] = useState<CheckState>('idle');
  const [downloadPercent, setDownloadPercent] = useState(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    window.electronAPI?.getVersion().then(v => {
      if (mountedRef.current) setCurrentVersion(v);
    });
  }, []);

  useEffect(() => {
    if (!window.electronAPI) return;
    window.electronAPI.onUpdateStatus((data) => {
      if (!mountedRef.current) return;
      if (data.status === 'checking') {
        setCheckState('checking');
      } else if (data.status === 'available' && data.version) {
        setLatestVersion(data.version);
        setCheckState('available');
      } else if (data.status === 'downloading') {
        setCheckState('downloading');
        setDownloadPercent(data.percent ?? 0);
      } else if (data.status === 'downloaded') {
        setCheckState('downloaded');
      } else if (data.status === 'up-to-date') {
        setCheckState('up-to-date');
      } else if (data.status === 'error') {
        setCheckState('error');
      }
    });
    // Trigger check immediately on modal open
    setCheckState('checking');
    window.electronAPI.checkForUpdates();
  }, []);

  const isNewer = latestVersion && currentVersion ? semverGt(latestVersion, currentVersion) : false;

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}
    >
      <div
        style={{ background: '#fff', borderRadius: 14, width: 360, boxShadow: '0 20px 60px rgba(0,0,0,0.25)', overflow: 'hidden' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px 14px', borderBottom: '1px solid #f0f0f0' }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#111827' }}>Acerca de</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex', alignItems: 'center', color: '#9ca3af' }}>
            <X size={18} />
          </button>
        </div>

        {/* App info */}
        <div style={{ padding: '20px', borderBottom: '1px solid #f0f0f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div style={{ width: 44, height: 44, borderRadius: 10, background: '#003DA5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: '#fff', fontWeight: 800, fontSize: 13, letterSpacing: 1 }}>EF</span>
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#111827' }}>Eficiencia Reportes</div>
              <div style={{ fontSize: 12, color: '#6b7280' }}>Elared S.A.</div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: '#f9fafb', borderRadius: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: '#6b7280' }}>Versión instalada</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#111827', fontVariantNumeric: 'tabular-nums' }}>
              {currentVersion ? `v${currentVersion}` : '—'}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: '#f9fafb', borderRadius: 8 }}>
            <span style={{ fontSize: 12, color: '#6b7280' }}>Última versión</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#111827', fontVariantNumeric: 'tabular-nums' }}>
              {latestVersion ? `v${latestVersion}` : (checkState === 'checking' ? '…' : '—')}
            </span>
          </div>
        </div>

        {/* Status */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f0f0f0' }}>
          {checkState === 'idle' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#9ca3af', fontSize: 13 }}>
              <RefreshCw size={15} />
              Sin verificar
            </div>
          )}
          {checkState === 'checking' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#6b7280', fontSize: 13 }}>
              <Loader size={15} style={{ animation: 'spin 1s linear infinite' }} />
              Verificando actualizaciones...
            </div>
          )}
          {checkState === 'up-to-date' && !isNewer && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#16a34a', fontSize: 13 }}>
              <CheckCircle size={15} />
              Estás en la última versión
            </div>
          )}
          {(checkState === 'available' || checkState === 'downloading' || checkState === 'downloaded') && isNewer && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#d97706', fontSize: 13, marginBottom: checkState === 'downloading' ? 10 : 0 }}>
                <AlertTriangle size={15} />
                Hay una versión nueva: v{latestVersion}
              </div>
              {checkState === 'downloading' && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 11, color: '#6b7280' }}>Descargando...</span>
                    <span style={{ fontSize: 11, color: '#6b7280' }}>{downloadPercent}%</span>
                  </div>
                  <div style={{ height: 4, background: '#e5e7eb', borderRadius: 9999 }}>
                    <div style={{ height: '100%', background: '#003DA5', borderRadius: 9999, width: `${downloadPercent}%`, transition: 'width 0.3s' }} />
                  </div>
                </div>
              )}
              {checkState === 'downloaded' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#16a34a', fontSize: 13, marginTop: 6 }}>
                  <CheckCircle size={14} />
                  Descargada — se instalará al cerrar
                </div>
              )}
            </div>
          )}
          {checkState === 'error' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#dc2626', fontSize: 13 }}>
              <AlertTriangle size={15} />
              No se pudo verificar. Revisa la conexión.
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ padding: '14px 20px', display: 'flex', gap: 8 }}>
          {checkState === 'downloaded' ? (
            <button
              onClick={() => window.electronAPI?.installUpdate()}
              style={{ flex: 1, padding: '9px 14px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
            >
              <Download size={14} />
              Instalar ahora
            </button>
          ) : (
            <button
              onClick={() => { setCheckState('checking'); window.electronAPI?.checkForUpdates(); }}
              disabled={checkState === 'checking' || checkState === 'downloading'}
              style={{
                flex: 1, padding: '9px 14px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13,
                background: '#fff', color: '#374151', cursor: (checkState === 'checking' || checkState === 'downloading') ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                opacity: (checkState === 'checking' || checkState === 'downloading') ? 0.5 : 1,
              }}
            >
              <RefreshCw size={14} />
              Buscar actualizaciones
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
