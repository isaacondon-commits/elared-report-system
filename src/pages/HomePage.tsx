import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart2, Clock, AlertTriangle, ArrowRight, Shield,
  Smartphone, Wifi, Headphones, Briefcase, Cpu, Lock, PauseCircle, CheckCircle2,
} from 'lucide-react';
import { useAuthContext } from '../contexts/AuthContext';
import Header from '../components/Header';
import { getAllActivity, formatActivityDate } from '../utils/activityTracker';
import type { ModuloSistema } from '../config/permisos';
import { useAnalisisStore, formatFechaCarga } from '../store/analisisStore';

type StoreKey = 'ventas' | 'reloj' | 'sanciones' | 'vicidial' | 'atencion' | 'comisionesMovil' | 'comisionesFibra';

interface ModuleCard {
  to: string;
  icon: typeof BarChart2;
  title: string;
  desc: string;
  accent: string;
  bg: string;
  border: string;
  export?: string;
  modulo: ModuloSistema;
  storeKey: StoreKey;
}

interface ComingCard {
  to: string;
  icon: typeof BarChart2;
  title: string;
  accent: string;
  modulo: ModuloSistema;
}

const ACTIVE_MODULES: ModuleCard[] = [
  {
    to: '/ventas', icon: BarChart2, title: 'Ventas', modulo: 'ventas', storeKey: 'ventas',
    desc: 'Ranking de vendedores, cumplimiento de objetivos y evolución diaria.',
    accent: '#003DA5', bg: 'bg-blue-50', border: 'border-blue-200', export: 'PowerPoint',
  },
  {
    to: '/reloj', icon: Clock, title: 'Reloj', modulo: 'reloj', storeKey: 'reloj',
    desc: 'Tardanzas, ausencias y salidas anticipadas. Calendario mensual por funcionario.',
    accent: '#16a34a', bg: 'bg-green-50', border: 'border-green-200', export: 'Excel',
  },
  {
    to: '/sanciones', icon: AlertTriangle, title: 'Sanciones', modulo: 'sanciones', storeKey: 'sanciones',
    desc: 'Historial de advertencias y detección de patrones de reincidencia.',
    accent: '#E3000F', bg: 'bg-red-50', border: 'border-red-200', export: 'PDF',
  },
  {
    to: '/pausas-vicidial', icon: PauseCircle, title: 'Pausas Vicidial', modulo: 'pausas_vicidial', storeKey: 'vicidial',
    desc: 'Análisis de pausas por agente, eficiencia y alertas de excesos.',
    accent: '#7c3aed', bg: 'bg-purple-50', border: 'border-purple-200', export: 'Excel + PPT',
  },
  {
    to: '/atencion-cliente', icon: Headphones, title: 'Atención al Cliente', modulo: 'atencion_cliente', storeKey: 'atencion',
    desc: 'Tráfico de llamadas por grupo y hora, tasa de respuesta, abandono y calidad.',
    accent: '#0d9488', bg: 'bg-teal-50', border: 'border-teal-200', export: 'Excel + PPT',
  },
  {
    to: '/comisiones-movil', icon: Smartphone, title: 'Comisiones Móvil', modulo: 'comisiones_movil', storeKey: 'comisionesMovil',
    desc: 'Cálculo de comisiones por plan y condición, con calculadora de proyección.',
    accent: '#0066CC', bg: 'bg-sky-50', border: 'border-sky-200', export: 'Excel + PPT',
  },
  {
    to: '/comisiones-fibra', icon: Wifi, title: 'Comisiones Fibra', modulo: 'comisiones_fibra', storeKey: 'comisionesFibra',
    desc: 'Comisiones de fibra óptica por vendedor, plan y condición alcanzada.',
    accent: '#003DA5', bg: 'bg-indigo-50', border: 'border-indigo-200', export: 'Excel + PPT',
  },
];

const COMING_MODULES: ComingCard[] = [
  { to: '/back-office', icon: Briefcase, title: 'Back Office', accent: '#6f42c1', modulo: 'back_office' },
  { to: '/chips',       icon: Cpu,       title: 'Chips',       accent: '#fd7e14', modulo: 'chips'       },
];

export default function HomePage() {
  const { hasAccess } = useAuthContext();
  const activity = useMemo(() => getAllActivity(), []);
  const store = useAnalisisStore();

  const visibleActive = ACTIVE_MODULES.filter(m => hasAccess(m.modulo));
  const visibleComing = COMING_MODULES.filter(m => hasAccess(m.modulo));

  return (
    <div className="flex flex-col h-full">
      <Header title="Inicio" />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-5xl mx-auto space-y-8">

          {/* Hero */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#003DA5] to-[#0052CC] px-8 py-7 text-white">
            <div className="relative z-10">
              <div className="inline-flex items-center gap-2 bg-white/20 rounded-full px-3 py-1 text-xs font-medium mb-3">
                <Shield size={11} />
                Sistema interno · Todo procesado localmente en el navegador
              </div>
              <h1 className="text-2xl font-bold mb-1">EFICIENCIA</h1>
              <div className="text-blue-200/80 text-[11px] font-semibold tracking-widest mb-2">Sistema de Reportes · Elared S.A.</div>
              <p className="text-blue-100 text-sm max-w-lg leading-relaxed">
                Sistema de análisis automático de reportes del call center.
                Cargá un Excel y obtené análisis instantáneo sin configuración previa.
              </p>
            </div>
            <div className="absolute right-12 top-1/2 -translate-y-1/2 w-36 h-36 rounded-full bg-white/5 pointer-events-none" />
            <div className="absolute right-20 top-1/2 -translate-y-1/2 w-20 h-20 rounded-full bg-white/5 pointer-events-none" />
            <div className="absolute right-4 bottom-0 w-24 h-24 rounded-full bg-[#E3000F]/20 pointer-events-none" />
          </div>

          {/* Active modules */}
          {visibleActive.length > 0 && (
            <div>
              <h2 className="text-[13px] font-semibold text-gray-500 uppercase tracking-widest mb-3">
                Módulos activos
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {visibleActive.map(({ to, icon: Icon, title, desc, accent, bg, border, export: exp, modulo, storeKey }) => {
                  const act = activity[modulo];
                  const storeEntry = store[storeKey];
                  const hasData = storeEntry !== null;
                  return (
                    <Link
                      key={to}
                      to={to}
                      className={`${bg} ${border} border rounded-xl p-5 hover:shadow-md transition-all group hover:-translate-y-0.5 flex flex-col`}
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div
                          className="w-9 h-9 rounded-lg flex items-center justify-center text-white flex-shrink-0"
                          style={{ background: accent }}
                        >
                          <Icon size={18} />
                        </div>
                        {hasData && (
                          <CheckCircle2 size={16} className="text-emerald-500 flex-shrink-0" />
                        )}
                      </div>
                      <h3 className="font-bold text-gray-900 mb-1.5">{title}</h3>
                      <p className="text-gray-600 text-sm leading-relaxed mb-4 flex-1">{desc}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-xs bg-white/70 border border-gray-200 px-2 py-0.5 rounded-full text-gray-600 font-medium">
                          Exporta {exp}
                        </span>
                        <span className="flex items-center gap-1 text-xs font-semibold" style={{ color: accent }}>
                          {hasData ? 'Ver análisis' : 'Cargar archivo'}
                          <ArrowRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
                        </span>
                      </div>
                      {/* Store / activity info */}
                      <div className="mt-3 pt-3 border-t border-black/5">
                        {hasData ? (
                          <p className="text-[10px] text-emerald-600 font-medium flex items-center gap-1">
                            <CheckCircle2 size={10} />
                            {storeEntry.nombreArchivo} · {formatFechaCarga(storeEntry.fechaCarga)}
                          </p>
                        ) : act ? (
                          <p className="text-[10px] text-gray-400">
                            Último análisis: <span className="font-medium">{formatActivityDate(act.date)}</span>
                            {act.fileName && <span className="ml-1 truncate">· {act.fileName}</span>}
                          </p>
                        ) : (
                          <p className="text-[10px] text-gray-300">Sin datos cargados</p>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* Coming soon */}
          {visibleComing.length > 0 && (
            <div>
              <h2 className="text-[13px] font-semibold text-gray-500 uppercase tracking-widest mb-3">
                En desarrollo
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {visibleComing.map(({ to, icon: Icon, title, accent }) => (
                  <Link
                    key={to}
                    to={to}
                    className="bg-white border border-gray-200 rounded-xl p-4 hover:border-gray-300 hover:shadow-sm transition-all group text-center"
                  >
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center text-white mb-3 mx-auto opacity-80"
                      style={{ background: accent }}
                    >
                      <Icon size={17} />
                    </div>
                    <div className="text-[12px] font-semibold text-gray-700 leading-tight">{title}</div>
                    <div className="inline-flex items-center gap-1 mt-2 text-[10px] text-gray-400 font-medium">
                      <Lock size={9} />
                      Próximamente
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* How it works */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-[13px] font-semibold text-gray-500 uppercase tracking-widest mb-5">
              Cómo funciona
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
              {[
                { n: '1', t: 'Cargá el Excel',   d: 'Arrastrá o seleccioná el archivo de reporte' },
                { n: '2', t: 'Confirmá columnas', d: 'El sistema detecta la estructura automáticamente' },
                { n: '3', t: 'Analizá',           d: 'Gráficos, rankings y KPIs generados al instante' },
                { n: '4', t: 'Exportá',           d: 'PowerPoint, Excel o PDF según el módulo' },
              ].map(({ n, t, d }) => (
                <div key={n} className="text-center">
                  <div className="w-9 h-9 rounded-full bg-[#003DA5] text-white font-bold text-sm flex items-center justify-center mx-auto mb-2.5">
                    {n}
                  </div>
                  <div className="font-semibold text-gray-900 text-sm">{t}</div>
                  <div className="text-gray-400 text-xs mt-1 leading-relaxed">{d}</div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
