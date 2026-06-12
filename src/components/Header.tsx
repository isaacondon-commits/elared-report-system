import { useState, useRef, useEffect, useMemo } from 'react';
import { LogOut, ChevronDown, ChevronRight, RefreshCw, Info } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useAuthContext } from '../contexts/AuthContext';
import { NOMBRES_ROLES, ROL_COLORS } from '../config/permisos';
import type { RolSistema } from '../types';
import VersionModal from './VersionModal';

interface HeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

const BREADCRUMB_PREFIX: Record<string, string[]> = {
  '/':                  [],
  '/ventas':            ['Análisis'],
  '/pausas-vicidial':   ['Análisis'],
  '/reloj':             ['Operaciones'],
  '/sanciones':         ['Operaciones'],
  '/config':            ['Sistema'],
  '/admin/usuarios':    ['Sistema'],
  '/comisiones-movil':  ['Comisiones'],
  '/comisiones-fibra':  ['Comisiones'],
  '/atencion-cliente':  ['Reportes Especiales'],
  '/back-office':       ['Reportes Especiales'],
  '/chips':             ['Reportes Especiales'],
};

function getInitials(nombre: string): string {
  return nombre.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('');
}

export default function Header({ title, subtitle, actions }: HeaderProps) {
  const { userDoc, userRoles, logout } = useAuthContext();
  const [open, setOpen]           = useState(false);
  const [showVersion, setShowVersion] = useState(false);
  const dropRef                   = useRef<HTMLDivElement>(null);
  const { pathname }        = useLocation();

  const prefixParts = BREADCRUMB_PREFIX[pathname] ?? [];

  const dateStr = useMemo(() => {
    return new Intl.DateTimeFormat('es-UY', {
      weekday: 'long',
      day:     'numeric',
      month:   'short',
      year:    'numeric',
    }).format(new Date());
  }, []);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  async function handleLogout() {
    setOpen(false);
    await logout();
  }

  return (
    <>
    {showVersion && <VersionModal onClose={() => setShowVersion(false)} />}
    <div className="bg-white border-b border-gray-200 px-6 flex items-center justify-between min-h-[60px] flex-shrink-0 sticky top-0 z-30">

      {/* Left: breadcrumb + title */}
      <div className="min-w-0">
        {prefixParts.length > 0 && (
          <div className="flex items-center gap-1 mb-0.5">
            {prefixParts.map((part, i) => (
              <span key={i} className="flex items-center gap-1">
                {i > 0 && <ChevronRight size={10} className="text-gray-300" />}
                <span className="text-[11px] text-gray-400 font-medium">{part}</span>
              </span>
            ))}
            <ChevronRight size={10} className="text-gray-300" />
          </div>
        )}
        <h1 className="text-[16px] font-bold text-[#1A1A2E] leading-tight truncate">{title}</h1>
        {subtitle && (
          <p className="text-[11px] text-gray-400 mt-0.5 truncate leading-tight">{subtitle}</p>
        )}
      </div>

      {/* Right: actions + date + avatar */}
      <div className="flex items-center gap-3 flex-shrink-0 ml-6">
        {actions && <div className="flex items-center gap-2">{actions}</div>}

        {actions && <div className="w-px h-5 bg-gray-200" />}

        <span className="text-[11px] text-gray-400 whitespace-nowrap capitalize hidden md:block">
          {dateStr}
        </span>

        {userDoc && (
          <>
            <div className="w-px h-5 bg-gray-200 hidden md:block" />
            <div className="relative" ref={dropRef}>
              <button
                onClick={() => setOpen(v => !v)}
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-gray-100 transition-colors"
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold select-none flex-shrink-0"
                  style={{ background: '#003DA5' }}
                >
                  {getInitials(userDoc.nombre)}
                </div>
                <span className="text-[13px] font-medium text-gray-700 hidden sm:block truncate max-w-[110px]">
                  {userDoc.nombre.split(' ')[0]}
                </span>
                <ChevronDown
                  size={13}
                  className={`text-gray-400 transition-transform flex-shrink-0 ${open ? 'rotate-180' : ''}`}
                />
              </button>

              {open && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100">
                    <div className="font-semibold text-gray-900 text-sm truncate">{userDoc.nombre}</div>
                    <div className="text-gray-400 text-xs truncate mb-2">{userDoc.email}</div>
                    <div className="flex flex-wrap gap-1">
                      {userRoles.map(rol => (
                        <span
                          key={rol}
                          className="inline-block text-white text-[10px] font-bold px-2 py-0.5 rounded-full"
                          style={{ background: ROL_COLORS[rol as RolSistema] ?? '#003DA5' }}
                        >
                          {NOMBRES_ROLES[rol as RolSistema] ?? rol}
                        </span>
                      ))}
                    </div>
                  </div>
                  {window.electronAPI && (
                    <>
                      <div className="border-t border-gray-100" />
                      <button
                        onClick={() => { setShowVersion(true); setOpen(false); }}
                        className="flex items-center gap-2.5 w-full px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        <Info size={15} className="text-gray-400" />
                        Acerca de / Versión
                      </button>
                      {window.electronAPI?.checkForUpdates && (
                        <button
                          onClick={() => { window.electronAPI?.checkForUpdates(); setOpen(false); }}
                          className="flex items-center gap-2.5 w-full px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          <RefreshCw size={15} className="text-gray-400" />
                          Buscar actualizaciones
                        </button>
                      )}
                    </>
                  )}
                  <div className="border-t border-gray-100" />
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-2.5 w-full px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <LogOut size={15} className="text-gray-400" />
                    Cerrar sesión
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
    </>
  );
}
