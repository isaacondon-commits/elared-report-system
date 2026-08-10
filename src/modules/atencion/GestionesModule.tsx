import { useState, useCallback, useMemo } from 'react';
import {
  ClipboardList, Users, MessageSquare, AlertTriangle, CheckCircle2, Calendar,
  Download, Loader2, ChevronDown, ChevronRight, Search, Bug,
} from 'lucide-react';
import {
  BarChart, Bar, Cell, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import FileUploader from '../../components/FileUploader';
import Header from '../../components/Header';
import PDFModal from '../../components/PDFModal';
import { recordActivity } from '../../utils/activityTracker';
import { useAnalisisStore, formatFechaCarga } from '../../store/analisisStore';
import { parseGestiones, type Gestion, type GestionesData } from './gestionesParser';
import { exportGestionesExcel } from './GestionesExport';

// ── Paleta ────────────────────────────────────────────────────────────────────
const P = {
  azul: '#003DA5', azulMedio: '#0052CC', rojo: '#E3000F', verde: '#28a745',
  naranja: '#fd7e14', violeta: '#6f42c1', gris: '#6c757d',
};

// ── Badges ────────────────────────────────────────────────────────────────────
const ESTADO_BADGE: Record<string, { bg: string; fg: string; color: string; desc: string }> = {
  SOLUCIONADO: { bg: '#d4edda', fg: '#155724', color: P.verde, desc: 'Gestión resuelta y cerrada' },
  SUPERVISION: { bg: '#ffe5d0', fg: '#9a5b13', color: P.naranja, desc: 'En revisión por un supervisor' },
  ANTEL: { bg: '#cfe2ff', fg: '#084298', color: P.azul, desc: 'Derivada a ANTEL' },
  COMERCIAL: { bg: '#e7d6f5', fg: '#5a2a82', color: P.violeta, desc: 'Derivada al área comercial' },
  RECHAZADO: { bg: '#f8d7da', fg: '#842029', color: P.rojo, desc: 'Gestión rechazada' },
  LLAMAR: { bg: '#e2e3e5', fg: '#41464b', color: P.gris, desc: 'Pendiente de volver a llamar' },
};
function estadoBadge(estado: string) {
  return ESTADO_BADGE[estado] ?? { bg: '#e2e3e5', fg: '#41464b', color: P.gris, desc: '' };
}
function pctSolucionadosBadge(pct: number) {
  if (pct >= 90) return { bg: '#d4edda', fg: '#155724' };
  if (pct >= 70) return { bg: '#cfe2ff', fg: '#084298' };
  return { bg: '#ffe5d0', fg: '#9a5b13' };
}
function pctReclamosBadge(pct: number) {
  if (pct < 20) return { bg: '#d4edda', fg: '#155724' };
  if (pct <= 35) return { bg: '#ffe5d0', fg: '#9a5b13' };
  return { bg: '#f8d7da', fg: '#842029' };
}

function formatFecha(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}
function formatFechaCorta(iso: string): string {
  if (!iso) return '';
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

// ── Lógica de negocio ─────────────────────────────────────────────────────────

export interface OperadorStat {
  operador: string; empresa: string; rol: string; total: number;
  consultas: number; reclamos: number; solicitudes: number; solucionados: number;
  pctSolucionados: number;
  porEstado: { estado: string; count: number }[];
  porMotivo: { motivo: string; count: number }[];
  porDia: { fecha: string; count: number }[];
}
export interface MotivoStat { motivo: string; empresa: string; consultas: number; reclamos: number; solicitudes: number; total: number; pct: number }
export interface EstadoStat { estado: string; empresa: string; count: number; pct: number }
export interface DiaStat { fecha: string; consultas: number; reclamos: number; solicitudes: number; total: number; porEmpresa: Record<string, number> }
export interface PlanEquipoStat { nombre: string; empresa: string; count: number; pct: number }
export interface EmpresaStat {
  empresa: string; total: number; consultas: number; reclamos: number; solicitudes: number;
  pctReclamos: number; solucionados: number;
}
export interface TiempoResolucionStat { nombre: string; empresa: string; promedioDias: number; n: number }

export interface GestionesStats {
  total: number;
  consultas: number; reclamos: number; solicitudes: number;
  solucionados: number; supervision: number;
  operadoresActivos: number;
  empresasList: string[];
  fechaMin: string; fechaMax: string;
  byOperador: OperadorStat[];
  byMotivo: MotivoStat[];
  byEstado: EstadoStat[];
  byDia: DiaStat[];
  byPlan: PlanEquipoStat[];
  byEquipo: PlanEquipoStat[];
  byEmpresa: EmpresaStat[];
  tiempoResolucionOperador: TiempoResolucionStat[];
  tiempoResolucionMotivo: TiempoResolucionStat[];
  casosConFechaCierre: number;
}

// Todas las agrupaciones (operador, motivo, estado, plan, router, tiempo de
// resolución) usan clave compuesta "nombre||empresa" — cada fila de las
// tablas queda separada por empresa en vez de mezclar todas las compañías.
const SIN_ESPECIFICAR = 'Sin especificar';
function claveCompuesta(nombre: string, empresa: string): string {
  return `${nombre}||${empresa || SIN_ESPECIFICAR}`;
}

export function computeGestionesStats(rows: Gestion[]): GestionesStats {
  const total = rows.length;
  let consultas = 0, reclamos = 0, solicitudes = 0, solucionados = 0, supervision = 0;

  interface OpAcc {
    operador: string; empresa: string; rol: string; total: number;
    consultas: number; reclamos: number; solicitudes: number; solucionados: number;
    estados: Map<string, number>; motivos: Map<string, number>; dias: Map<string, number>;
  }
  const operadorMap = new Map<string, OpAcc>();
  const motivoMap = new Map<string, { motivo: string; empresa: string; consultas: number; reclamos: number; solicitudes: number; total: number }>();
  const estadoMap = new Map<string, { estado: string; empresa: string; count: number }>();
  const diaMap = new Map<string, { consultas: number; reclamos: number; solicitudes: number; total: number; porEmpresa: Record<string, number> }>();
  const planMap = new Map<string, { nombre: string; empresa: string; count: number }>();
  const equipoMap = new Map<string, { nombre: string; empresa: string; count: number }>();
  const empresaMap = new Map<string, { total: number; consultas: number; reclamos: number; solicitudes: number; solucionados: number }>();
  const resolucionOperadorMap = new Map<string, { operador: string; empresa: string; sumaDias: number; n: number }>();
  const resolucionMotivoMap = new Map<string, { motivo: string; empresa: string; sumaDias: number; n: number }>();
  let casosConFechaCierre = 0;

  for (const r of rows) {
    const isConsulta = r.concepto === 'CONSULTA';
    const isReclamo = r.concepto === 'RECLAMO';
    const isSolicitud = r.concepto === 'SOLICITUD';
    const empKey = r.empresa || SIN_ESPECIFICAR;
    if (isConsulta) consultas++;
    if (isReclamo) reclamos++;
    if (isSolicitud) solicitudes++;
    if (r.estado === 'SOLUCIONADO') solucionados++;
    if (r.estado === 'SUPERVISION') supervision++;

    if (r.operador) {
      const opKey = claveCompuesta(r.operador, r.empresa);
      if (!operadorMap.has(opKey)) {
        operadorMap.set(opKey, {
          operador: r.operador, empresa: empKey, rol: r.rol, total: 0,
          consultas: 0, reclamos: 0, solicitudes: 0, solucionados: 0,
          estados: new Map(), motivos: new Map(), dias: new Map(),
        });
      }
      const o = operadorMap.get(opKey)!;
      o.total++;
      if (isConsulta) o.consultas++;
      if (isReclamo) o.reclamos++;
      if (isSolicitud) o.solicitudes++;
      if (r.estado === 'SOLUCIONADO') o.solucionados++;
      if (r.rol) o.rol = r.rol;
      if (r.estado) o.estados.set(r.estado, (o.estados.get(r.estado) ?? 0) + 1);
      if (r.lugarContacto) o.motivos.set(r.lugarContacto, (o.motivos.get(r.lugarContacto) ?? 0) + 1);
      if (r.fechaCreacion) o.dias.set(r.fechaCreacion, (o.dias.get(r.fechaCreacion) ?? 0) + 1);
    }

    const motivoNombre = r.lugarContacto || SIN_ESPECIFICAR;
    const motivoKey = claveCompuesta(motivoNombre, r.empresa);
    if (!motivoMap.has(motivoKey)) motivoMap.set(motivoKey, { motivo: motivoNombre, empresa: empKey, consultas: 0, reclamos: 0, solicitudes: 0, total: 0 });
    const m = motivoMap.get(motivoKey)!;
    m.total++; if (isConsulta) m.consultas++; if (isReclamo) m.reclamos++; if (isSolicitud) m.solicitudes++;

    if (r.estado) {
      const estadoKey = claveCompuesta(r.estado, r.empresa);
      if (!estadoMap.has(estadoKey)) estadoMap.set(estadoKey, { estado: r.estado, empresa: empKey, count: 0 });
      estadoMap.get(estadoKey)!.count++;
    }

    if (r.fechaCreacion) {
      if (!diaMap.has(r.fechaCreacion)) diaMap.set(r.fechaCreacion, { consultas: 0, reclamos: 0, solicitudes: 0, total: 0, porEmpresa: {} });
      const d = diaMap.get(r.fechaCreacion)!;
      d.total++; if (isConsulta) d.consultas++; if (isReclamo) d.reclamos++; if (isSolicitud) d.solicitudes++;
      d.porEmpresa[empKey] = (d.porEmpresa[empKey] ?? 0) + 1;
    }

    if (r.plan) {
      const planKey = claveCompuesta(r.plan, r.empresa);
      if (!planMap.has(planKey)) planMap.set(planKey, { nombre: r.plan, empresa: empKey, count: 0 });
      planMap.get(planKey)!.count++;
    }
    if (r.equipo) {
      const equipoKey = claveCompuesta(r.equipo, r.empresa);
      if (!equipoMap.has(equipoKey)) equipoMap.set(equipoKey, { nombre: r.equipo, empresa: empKey, count: 0 });
      equipoMap.get(equipoKey)!.count++;
    }

    if (!empresaMap.has(empKey)) empresaMap.set(empKey, { total: 0, consultas: 0, reclamos: 0, solicitudes: 0, solucionados: 0 });
    const e = empresaMap.get(empKey)!;
    e.total++; if (isConsulta) e.consultas++; if (isReclamo) e.reclamos++; if (isSolicitud) e.solicitudes++;
    if (r.estado === 'SOLUCIONADO') e.solucionados++;

    // Tiempo de resolución = Fecha de cierre − Fecha de creación (solo si hay ambas)
    if (r.fechaCreacion && r.fechaCierre) {
      const dias = (new Date(r.fechaCierre).getTime() - new Date(r.fechaCreacion).getTime()) / 86400000;
      if (Number.isFinite(dias) && dias >= 0) {
        casosConFechaCierre++;
        if (r.operador) {
          const opResKey = claveCompuesta(r.operador, r.empresa);
          const prevOp = resolucionOperadorMap.get(opResKey) ?? { operador: r.operador, empresa: empKey, sumaDias: 0, n: 0 };
          resolucionOperadorMap.set(opResKey, { ...prevOp, sumaDias: prevOp.sumaDias + dias, n: prevOp.n + 1 });
        }
        const prevMot = resolucionMotivoMap.get(motivoKey) ?? { motivo: motivoNombre, empresa: empKey, sumaDias: 0, n: 0 };
        resolucionMotivoMap.set(motivoKey, { ...prevMot, sumaDias: prevMot.sumaDias + dias, n: prevMot.n + 1 });
      }
    }
  }

  const byOperador: OperadorStat[] = Array.from(operadorMap.values()).map(o => ({
    operador: o.operador, empresa: o.empresa, rol: o.rol, total: o.total, consultas: o.consultas, reclamos: o.reclamos, solicitudes: o.solicitudes,
    solucionados: o.solucionados, pctSolucionados: o.total > 0 ? (o.solucionados / o.total) * 100 : 0,
    porEstado: Array.from(o.estados.entries()).map(([estado, count]) => ({ estado, count })).sort((a, b) => b.count - a.count),
    porMotivo: Array.from(o.motivos.entries()).map(([motivo, count]) => ({ motivo, count })).sort((a, b) => b.count - a.count).slice(0, 10),
    porDia: Array.from(o.dias.entries()).map(([fecha, count]) => ({ fecha, count })).sort((a, b) => a.fecha.localeCompare(b.fecha)),
  })).sort((a, b) => b.total - a.total);

  const byMotivo: MotivoStat[] = Array.from(motivoMap.values())
    .map(v => ({ ...v, pct: total > 0 ? (v.total / total) * 100 : 0 }))
    .sort((a, b) => b.total - a.total);
  const byEstado: EstadoStat[] = Array.from(estadoMap.values())
    .map(v => ({ ...v, pct: total > 0 ? (v.count / total) * 100 : 0 }))
    .sort((a, b) => b.count - a.count);
  const byDia: DiaStat[] = Array.from(diaMap.entries()).map(([fecha, v]) => ({ fecha, ...v })).sort((a, b) => b.fecha.localeCompare(a.fecha));
  const byPlan: PlanEquipoStat[] = Array.from(planMap.values()).map(v => ({ ...v, pct: total > 0 ? (v.count / total) * 100 : 0 })).sort((a, b) => b.count - a.count);
  const byEquipo: PlanEquipoStat[] = Array.from(equipoMap.values()).map(v => ({ ...v, pct: total > 0 ? (v.count / total) * 100 : 0 })).sort((a, b) => b.count - a.count);
  const byEmpresa: EmpresaStat[] = Array.from(empresaMap.entries()).map(([empresa, v]) => ({
    empresa, total: v.total, consultas: v.consultas, reclamos: v.reclamos, solicitudes: v.solicitudes,
    pctReclamos: v.total > 0 ? (v.reclamos / v.total) * 100 : 0, solucionados: v.solucionados,
  })).sort((a, b) => b.total - a.total);

  const tiempoResolucionOperador: TiempoResolucionStat[] = Array.from(resolucionOperadorMap.values())
    .map(v => ({ nombre: v.operador, empresa: v.empresa, promedioDias: v.sumaDias / v.n, n: v.n }))
    .sort((a, b) => b.promedioDias - a.promedioDias);
  const tiempoResolucionMotivo: TiempoResolucionStat[] = Array.from(resolucionMotivoMap.values())
    .map(v => ({ nombre: v.motivo, empresa: v.empresa, promedioDias: v.sumaDias / v.n, n: v.n }))
    .sort((a, b) => b.promedioDias - a.promedioDias);

  const fechas = rows.map(r => r.fechaCreacion).filter(Boolean).sort();
  const empresasList = Array.from(empresaMap.keys()).sort();

  return {
    total, consultas, reclamos, solicitudes, solucionados, supervision,
    operadoresActivos: new Set(Array.from(operadorMap.values()).map(o => o.operador)).size,
    empresasList,
    fechaMin: fechas[0] ?? '', fechaMax: fechas[fechas.length - 1] ?? '',
    byOperador, byMotivo, byEstado, byDia, byPlan, byEquipo, byEmpresa,
    tiempoResolucionOperador, tiempoResolucionMotivo, casosConFechaCierre,
  };
}

// ── KPI card ──────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, icon: Icon, color }: { label: string; value: string; sub?: string; icon: React.ComponentType<{ size?: number }>; color: string }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 flex items-start gap-3 shadow-sm" style={{ borderTop: `4px solid ${color}` }}>
      <div className="p-2 rounded-lg flex-shrink-0 mt-0.5" style={{ background: `${color}18` }}>
        <Icon size={20} />
      </div>
      <div className="min-w-0">
        <div className="font-semibold uppercase tracking-wider text-gray-500" style={{ fontSize: 11, letterSpacing: '0.06em' }}>{label}</div>
        <div className="font-bold leading-none mt-1 truncate" style={{ fontSize: 26, color }}>{value}</div>
        {sub && <div className="text-xs text-gray-400 mt-1 truncate">{sub}</div>}
      </div>
    </div>
  );
}

// ── Sección 1: Gestiones por operador ─────────────────────────────────────────
type OpSortKey = 'operador' | 'total' | 'consultas' | 'reclamos' | 'solicitudes' | 'solucionados' | 'pctSolucionados';
type DetailTab = 'estado' | 'motivo' | 'dia';

function OperadorDetail({ op }: { op: OperadorStat }) {
  const [tab, setTab] = useState<DetailTab>('estado');
  return (
    <div className="bg-gray-50 border-t border-gray-100 p-4">
      <div className="flex gap-2 mb-3">
        {([['estado', 'Por estado'], ['motivo', 'Por motivo'], ['dia', 'Por día']] as [DetailTab, string][]).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${tab === id ? 'bg-[#003DA5] text-white' : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-100'}`}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'estado' && (
        <div className="flex flex-wrap gap-2">
          {op.porEstado.map(e => {
            const b = estadoBadge(e.estado);
            return <span key={e.estado} className="text-xs font-semibold px-2 py-1 rounded-full" style={{ background: b.bg, color: b.fg }}>{e.estado}: {e.count}</span>;
          })}
        </div>
      )}
      {tab === 'motivo' && (
        <table className="w-full text-xs">
          <tbody>
            {op.porMotivo.map(m => (
              <tr key={m.motivo} className="border-t border-gray-200">
                <td className="py-1 text-gray-700">{m.motivo}</td>
                <td className="py-1 text-right font-semibold text-[#003DA5] w-16">{m.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {tab === 'dia' && (
        <table className="w-full text-xs">
          <tbody>
            {op.porDia.map(d => (
              <tr key={d.fecha} className="border-t border-gray-200">
                <td className="py-1 font-mono text-gray-600">{formatFecha(d.fecha)}</td>
                <td className="py-1 text-right font-semibold text-[#003DA5] w-16">{d.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function SeccionOperadores({ stats }: { stats: GestionesStats }) {
  const [sortKey, setSortKey] = useState<OpSortKey>('total');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [expandido, setExpandido] = useState<string | null>(null);

  const rows = useMemo(() => {
    const arr = [...stats.byOperador];
    arr.sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey];
      const cmp = typeof av === 'string' ? av.localeCompare(String(bv)) : (av as number) - (bv as number);
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [stats.byOperador, sortKey, sortDir]);

  function handleSort(key: OpSortKey) {
    if (sortKey === key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('desc'); }
  }

  const cols: { key: OpSortKey; label: string }[] = [
    { key: 'operador', label: 'Operador' }, { key: 'total', label: 'Total' },
    { key: 'consultas', label: 'Consultas' }, { key: 'reclamos', label: 'Reclamos' },
    { key: 'solicitudes', label: 'Solicitudes' }, { key: 'solucionados', label: 'Solucionados' },
    { key: 'pctSolucionados', label: '% Soluc.' },
  ];

  const top10 = [...stats.byOperador].slice(0, 10).map(o => ({
    nombre: `${o.operador.length > 14 ? o.operador.slice(0, 13) + '…' : o.operador} · ${o.empresa}`,
    total: o.total,
  }));

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="font-semibold text-gray-900 mb-4">Gestiones por operador</h3>
      <div className="overflow-x-auto mb-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#003DA5] text-white">
              <th className="px-2 py-2 text-center text-xs font-semibold w-8">#</th>
              <th className="px-3 py-2 text-left text-xs font-semibold">Rol</th>
              <th className="px-3 py-2 text-left text-xs font-semibold">Empresa</th>
              {cols.map(c => (
                <th key={c.key} onClick={() => handleSort(c.key)}
                  className={`px-3 py-2 text-xs font-semibold cursor-pointer select-none whitespace-nowrap ${c.key === 'operador' ? 'text-left' : 'text-right'}`}>
                  {c.label} {sortKey === c.key ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((o, i) => {
              const rowKey = `${o.operador}||${o.empresa}`;
              const isOpen = expandido === rowKey;
              const badge = pctSolucionadosBadge(o.pctSolucionados);
              return (
                <>
                  <tr key={rowKey} onClick={() => setExpandido(isOpen ? null : rowKey)}
                    className={`border-t border-gray-100 cursor-pointer hover:bg-blue-50 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                    <td className="px-2 py-2 text-center text-xs text-gray-400">{i + 1}</td>
                    <td className="px-3 py-2 text-xs text-gray-500">{o.rol.includes('Supervisor') ? 'Supervisor' : 'Operador'}</td>
                    <td className="px-3 py-2 text-xs text-gray-500">{o.empresa}</td>
                    <td className="px-3 py-2 font-medium text-gray-800">
                      <span className="inline-flex items-center gap-1">
                        {isOpen ? <ChevronDown size={13} className="text-gray-400" /> : <ChevronRight size={13} className="text-gray-400" />}
                        {o.operador}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right font-bold text-[#003DA5]">{o.total}</td>
                    <td className="px-3 py-2 text-right text-gray-600">{o.consultas}</td>
                    <td className="px-3 py-2 text-right text-red-600">{o.reclamos}</td>
                    <td className="px-3 py-2 text-right text-green-700">{o.solicitudes}</td>
                    <td className="px-3 py-2 text-right text-gray-600">{o.solucionados}</td>
                    <td className="px-3 py-2 text-right">
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: badge.bg, color: badge.fg }}>{o.pctSolucionados.toFixed(1)}%</span>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr key={`${rowKey}-detail`}>
                      <td colSpan={10} className="p-0"><OperadorDetail op={o} /></td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>
      {top10.length > 0 && (
        <ResponsiveContainer width="100%" height={Math.max(top10.length * 32 + 30, 200)}>
          <BarChart data={top10} layout="vertical" margin={{ top: 0, right: 40, left: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
            <YAxis dataKey="nombre" type="category" tick={{ fontSize: 10 }} width={170} />
            <Tooltip formatter={(v: unknown) => [Number(v).toLocaleString(), 'Gestiones']} />
            <Bar dataKey="total" fill={P.azul} radius={[0, 4, 4, 0]}>
              <LabelList dataKey="total" position="right" style={{ fontSize: 10, fontWeight: 600, fill: '#334155' }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

// ── Tiempo de resolución (Fecha de cierre − Fecha de creación) ────────────────
function TablaTiempoResolucion({ titulo, data }: { titulo: string; data: TiempoResolucionStat[] }) {
  if (data.length === 0) return (
    <div>
      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{titulo}</h4>
      <p className="text-sm text-gray-400">Sin datos.</p>
    </div>
  );
  return (
    <div>
      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{titulo}</h4>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#003DA5] text-white">
              <th className="px-3 py-2 text-left text-xs font-semibold">{titulo}</th>
              <th className="px-3 py-2 text-left text-xs font-semibold">Empresa</th>
              <th className="px-3 py-2 text-right text-xs font-semibold">Prom. días</th>
              <th className="px-3 py-2 text-right text-xs font-semibold">Casos</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d, i) => (
              <tr key={`${d.nombre}||${d.empresa}`} className={`border-t border-gray-100 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                <td className="px-3 py-1.5 text-gray-800">{d.nombre}</td>
                <td className="px-3 py-1.5 text-gray-500 text-xs">{d.empresa}</td>
                <td className="px-3 py-1.5 text-right font-bold text-[#003DA5]">{d.promedioDias.toFixed(1)}</td>
                <td className="px-3 py-1.5 text-right text-gray-500 text-xs">{d.n}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SeccionTiempoResolucion({ stats }: { stats: GestionesStats }) {
  if (stats.casosConFechaCierre === 0) return null;
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="font-semibold text-gray-900">Tiempo de resolución</h3>
      <p className="text-xs text-gray-400 mb-4">
        Promedio de días entre Fecha de creación y Fecha de cierre · {stats.casosConFechaCierre.toLocaleString()} de {stats.total.toLocaleString()} gestiones tienen fecha de cierre registrada
      </p>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TablaTiempoResolucion titulo="Por operador" data={stats.tiempoResolucionOperador} />
        <TablaTiempoResolucion titulo="Por tipo de contacto" data={stats.tiempoResolucionMotivo} />
      </div>
    </div>
  );
}

// ── Sección 2: Distribución por concepto ──────────────────────────────────────
function SeccionConcepto({ stats }: { stats: GestionesStats }) {
  const items = [
    { label: 'CONSULTA', value: stats.consultas, color: P.azul },
    { label: 'RECLAMO', value: stats.reclamos, color: P.rojo },
    { label: 'SOLICITUD', value: stats.solicitudes, color: P.verde },
  ];

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="font-semibold text-gray-900 mb-4">Distribución por concepto</h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {items.map(it => {
          const pct = stats.total > 0 ? (it.value / stats.total) * 100 : 0;
          return (
            <div key={it.label} className="border border-gray-200 rounded-xl p-4">
              <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: it.color }}>{it.label}</div>
              <div className="text-3xl font-bold mt-1" style={{ color: it.color }}>{it.value.toLocaleString()}</div>
              <div className="text-xs text-gray-400 mb-2">{pct.toFixed(1)}% del total</div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div className="h-2 rounded-full" style={{ width: `${pct}%`, background: it.color }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Sección 3: Motivos de contacto ────────────────────────────────────────────
function SeccionMotivos({ stats }: { stats: GestionesStats }) {
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const PER_PAGE = 15;

  const filtered = useMemo(() => {
    if (!search.trim()) return stats.byMotivo;
    const q = search.trim().toLowerCase();
    return stats.byMotivo.filter(m => m.motivo.toLowerCase().includes(q));
  }, [stats.byMotivo, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const paged = filtered.slice(page * PER_PAGE, (page + 1) * PER_PAGE);

  const top15 = stats.byMotivo.slice(0, 15).map(m => ({
    nombre: `${m.motivo.length > 18 ? m.motivo.slice(0, 17) + '…' : m.motivo} · ${m.empresa}`,
    total: m.total,
  }));

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="font-semibold text-gray-900 mb-4">Lugares / Motivos de contacto</h3>

      <div className="mb-3 relative max-w-xs">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input type="text" placeholder="Buscar motivo..." value={search}
          onChange={e => { setSearch(e.target.value); setPage(0); }}
          className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#003DA5]" />
      </div>

      <div className="overflow-x-auto mb-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#003DA5] text-white">
              <th className="px-3 py-2 text-left text-xs font-semibold">Motivo</th>
              <th className="px-3 py-2 text-left text-xs font-semibold">Empresa</th>
              <th className="px-3 py-2 text-right text-xs font-semibold">Consultas</th>
              <th className="px-3 py-2 text-right text-xs font-semibold">Reclamos</th>
              <th className="px-3 py-2 text-right text-xs font-semibold">Solicitudes</th>
              <th className="px-3 py-2 text-right text-xs font-semibold">Total</th>
              <th className="px-3 py-2 text-right text-xs font-semibold">%</th>
            </tr>
          </thead>
          <tbody>
            {paged.map((m, i) => (
              <tr key={`${m.motivo}||${m.empresa}`} className={`border-t border-gray-100 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                <td className="px-3 py-1.5 text-gray-800">{m.motivo}</td>
                <td className="px-3 py-1.5 text-gray-500 text-xs">{m.empresa}</td>
                <td className="px-3 py-1.5 text-right text-gray-600">{m.consultas}</td>
                <td className="px-3 py-1.5 text-right text-red-600">{m.reclamos}</td>
                <td className="px-3 py-1.5 text-right text-green-700">{m.solicitudes}</td>
                <td className="px-3 py-1.5 text-right font-bold text-[#003DA5]">{m.total}</td>
                <td className="px-3 py-1.5 text-right text-gray-500 text-xs">{m.pct.toFixed(1)}%</td>
              </tr>
            ))}
            {paged.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-gray-400 text-sm">Sin resultados</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mb-6 text-sm">
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
            className="px-3 py-1 border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-40">‹</button>
          <span className="px-2 text-gray-500">{page + 1} / {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
            className="px-3 py-1 border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-40">›</button>
        </div>
      )}

      <ResponsiveContainer width="100%" height={Math.max(top15.length * 26 + 30, 240)}>
        <BarChart data={top15} layout="vertical" margin={{ top: 0, right: 40, left: 10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
          <YAxis dataKey="nombre" type="category" tick={{ fontSize: 10 }} width={150} />
          <Tooltip formatter={(v: unknown) => [Number(v).toLocaleString(), 'Gestiones']} />
          <Bar dataKey="total" fill={P.azul} radius={[0, 4, 4, 0]}>
            <LabelList dataKey="total" position="right" style={{ fontSize: 10, fontWeight: 600, fill: '#334155' }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Sección 4: Distribución por estado ────────────────────────────────────────
function SeccionEstado({ stats }: { stats: GestionesStats }) {
  const data = stats.byEstado.map(e => ({ ...e, color: estadoBadge(e.estado).color, label: `${e.estado} · ${e.empresa}` }));
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="font-semibold text-gray-900 mb-4">Distribución por estado</h3>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#003DA5] text-white">
                <th className="px-3 py-2 text-left text-xs font-semibold">Estado</th>
                <th className="px-3 py-2 text-left text-xs font-semibold">Empresa</th>
                <th className="px-3 py-2 text-right text-xs font-semibold">Cantidad</th>
                <th className="px-3 py-2 text-right text-xs font-semibold">%</th>
                <th className="px-3 py-2 text-left text-xs font-semibold">Descripción</th>
              </tr>
            </thead>
            <tbody>
              {data.map((e, i) => {
                const b = estadoBadge(e.estado);
                return (
                  <tr key={`${e.estado}||${e.empresa}`} className={`border-t border-gray-100 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                    <td className="px-3 py-2">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: b.bg, color: b.fg }}>{e.estado}</span>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-500">{e.empresa}</td>
                    <td className="px-3 py-2 text-right font-bold text-[#003DA5]">{e.count.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right text-gray-500 text-xs">{e.pct.toFixed(1)}%</td>
                    <td className="px-3 py-2 text-xs text-gray-500">{b.desc}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <ResponsiveContainer width="100%" height={Math.max(data.length * 34 + 30, 200)}>
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 40, left: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
            <YAxis dataKey="label" type="category" tick={{ fontSize: 10 }} width={140} />
            <Tooltip formatter={(v: unknown) => [Number(v).toLocaleString(), '']} />
            <Bar dataKey="count" radius={[0, 4, 4, 0]}>
              <LabelList dataKey="count" position="right" style={{ fontSize: 10, fontWeight: 600, fill: '#334155' }} />
              {data.map((d, i) => <Cell key={i} fill={d.color} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ── Sección 5: Evolución temporal ─────────────────────────────────────────────
function SeccionEvolucion({ stats }: { stats: GestionesStats }) {
  if (stats.byDia.length === 0) return null;
  const chartData = [...stats.byDia].reverse().map(d => ({ ...d, label: formatFechaCorta(d.fecha) }));

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="font-semibold text-gray-900 mb-4">Evolución temporal</h3>
      {chartData.length > 1 && (
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="label" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip
              labelFormatter={(_: unknown, payload: readonly { payload?: { fecha?: string } }[]) => {
                const f = payload?.[0]?.payload?.fecha;
                if (!f) return '';
                try { return format(parseISO(f), 'dd/MM/yyyy'); } catch { return f; }
              }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="consultas" name="Consultas" stroke={P.azul} strokeWidth={2} dot={{ r: 2 }} />
            <Line type="monotone" dataKey="reclamos" name="Reclamos" stroke={P.rojo} strokeWidth={2} dot={{ r: 2 }} />
            <Line type="monotone" dataKey="solicitudes" name="Solicitudes" stroke={P.verde} strokeWidth={2} dot={{ r: 2 }} />
          </LineChart>
        </ResponsiveContainer>
      )}
      <div className="overflow-x-auto mt-4 max-h-72 overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0">
            <tr className="bg-[#003DA5] text-white">
              <th className="px-3 py-2 text-left text-xs font-semibold">Fecha</th>
              <th className="px-3 py-2 text-right text-xs font-semibold">Consultas</th>
              <th className="px-3 py-2 text-right text-xs font-semibold">Reclamos</th>
              <th className="px-3 py-2 text-right text-xs font-semibold">Solicitudes</th>
              <th className="px-3 py-2 text-right text-xs font-semibold">Total</th>
              {stats.empresasList.map(emp => (
                <th key={emp} className="px-3 py-2 text-right text-xs font-semibold whitespace-nowrap">{emp}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {stats.byDia.map((d, i) => (
              <tr key={d.fecha} className={`border-t border-gray-100 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                <td className="px-3 py-1.5 font-mono text-xs text-gray-600">{formatFecha(d.fecha)}</td>
                <td className="px-3 py-1.5 text-right text-gray-600">{d.consultas}</td>
                <td className="px-3 py-1.5 text-right text-red-600">{d.reclamos}</td>
                <td className="px-3 py-1.5 text-right text-green-700">{d.solicitudes}</td>
                <td className="px-3 py-1.5 text-right font-bold text-[#003DA5]">{d.total}</td>
                {stats.empresasList.map(emp => {
                  const v = d.porEmpresa[emp] ?? 0;
                  return (
                    <td key={emp} className="px-3 py-1.5 text-right whitespace-nowrap">
                      {v === 0 ? <span className="text-gray-300">—</span> : <span className="text-gray-600">{v}</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Sección 6: Plan / Equipo ───────────────────────────────────────────────────
function TablaPlanEquipo({ titulo, data }: { titulo: string; data: PlanEquipoStat[] }) {
  if (data.length === 0) return (
    <div>
      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{titulo}</h4>
      <p className="text-sm text-gray-400">Sin datos.</p>
    </div>
  );
  return (
    <div>
      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{titulo}</h4>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#003DA5] text-white">
              <th className="px-3 py-2 text-left text-xs font-semibold">{titulo}</th>
              <th className="px-3 py-2 text-left text-xs font-semibold">Empresa</th>
              <th className="px-3 py-2 text-right text-xs font-semibold">Cantidad</th>
              <th className="px-3 py-2 text-right text-xs font-semibold">%</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d, i) => (
              <tr key={`${d.nombre}||${d.empresa}`} className={`border-t border-gray-100 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                <td className="px-3 py-1.5 text-gray-800">{d.nombre}</td>
                <td className="px-3 py-1.5 text-gray-500 text-xs">{d.empresa}</td>
                <td className="px-3 py-1.5 text-right font-bold text-[#003DA5]">{d.count.toLocaleString()}</td>
                <td className="px-3 py-1.5 text-right text-gray-500 text-xs">{d.pct.toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SeccionPlanEquipo({ stats }: { stats: GestionesStats }) {
  if (stats.byPlan.length === 0 && stats.byEquipo.length === 0) return null;
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="font-semibold text-gray-900 mb-4">Distribución por plan / router</h3>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TablaPlanEquipo titulo="Plan" data={stats.byPlan} />
        <TablaPlanEquipo titulo="Router" data={stats.byEquipo} />
      </div>
    </div>
  );
}

// ── Sección 7: Análisis por empresa ───────────────────────────────────────────
function SeccionEmpresa({ stats }: { stats: GestionesStats }) {
  if (stats.byEmpresa.length === 0) return null;
  const chartData = stats.byEmpresa.map(e => ({ nombre: e.empresa, Consultas: e.consultas, Reclamos: e.reclamos, Solicitudes: e.solicitudes }));

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="font-semibold text-gray-900 mb-4">Análisis por empresa</h3>
      <div className="overflow-x-auto mb-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#003DA5] text-white">
              <th className="px-3 py-2 text-left text-xs font-semibold">Empresa</th>
              <th className="px-3 py-2 text-right text-xs font-semibold">Total</th>
              <th className="px-3 py-2 text-right text-xs font-semibold">Consultas</th>
              <th className="px-3 py-2 text-right text-xs font-semibold">Reclamos</th>
              <th className="px-3 py-2 text-right text-xs font-semibold">Solicitudes</th>
              <th className="px-3 py-2 text-right text-xs font-semibold">% Reclamos</th>
              <th className="px-3 py-2 text-right text-xs font-semibold">Solucionados</th>
            </tr>
          </thead>
          <tbody>
            {stats.byEmpresa.map((e, i) => {
              const badge = pctReclamosBadge(e.pctReclamos);
              return (
                <tr key={e.empresa} className={`border-t border-gray-100 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                  <td className="px-3 py-2 font-medium text-gray-800">{e.empresa}</td>
                  <td className="px-3 py-2 text-right font-bold text-[#003DA5]">{e.total.toLocaleString()}</td>
                  <td className="px-3 py-2 text-right text-gray-600">{e.consultas}</td>
                  <td className="px-3 py-2 text-right text-red-600">{e.reclamos}</td>
                  <td className="px-3 py-2 text-right text-green-700">{e.solicitudes}</td>
                  <td className="px-3 py-2 text-right">
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: badge.bg, color: badge.fg }}>{e.pctReclamos.toFixed(1)}%</span>
                  </td>
                  <td className="px-3 py-2 text-right text-gray-600">{e.solucionados}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <ResponsiveContainer width="100%" height={Math.max(chartData.length * 40 + 40, 200)}>
        <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 20, left: 10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
          <YAxis dataKey="nombre" type="category" tick={{ fontSize: 10 }} width={100} />
          <Tooltip formatter={(v: unknown) => [Number(v).toLocaleString(), '']} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="Consultas" stackId="a" fill={P.azul} />
          <Bar dataKey="Reclamos" stackId="a" fill={P.rojo} />
          <Bar dataKey="Solicitudes" stackId="a" fill={P.verde} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Panel de debug de columnas detectadas ─────────────────────────────────────
function DebugPanel({ data }: { data: GestionesData }) {
  const [open, setOpen] = useState(data.total === 0);
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {data.total === 0 && (
        <div className="flex items-start gap-2 bg-red-50 border-b border-red-200 text-red-700 px-5 py-3 text-sm">
          <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
          <span>
            No se detectó ninguna gestión válida en el archivo. Revisá abajo qué columna
            (si alguna) se mapeó a cada campo — si dice "no detectada" en Estado, Concepto
            u Operador, es probable que los valores reales sean distintos a los esperados.
          </span>
        </div>
      )}
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between px-5 py-3 text-left" style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
        <span className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <Bug size={14} className="text-gray-400" /> Columnas detectadas automáticamente
          {data.skippedRows > 0 && <span className="text-xs text-amber-600 font-normal">· {data.skippedRows} filas descartadas por formato</span>}
        </span>
        {open ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
      </button>
      {open && (
        <div className="px-5 pb-4 border-t border-gray-100 pt-3">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-500">
                <th className="text-left py-1">Campo</th>
                <th className="text-left py-1">Columna origen</th>
                <th className="text-left py-1">Ejemplos</th>
              </tr>
            </thead>
            <tbody>
              {data.debug.map(d => (
                <tr key={d.field} className="border-t border-gray-100">
                  <td className="py-1.5 font-medium text-gray-700">{d.field}</td>
                  <td className="py-1.5 text-gray-500">{d.columnIndex === null ? <span className="text-red-500">no detectada</span> : d.sample[0]}</td>
                  <td className="py-1.5 text-gray-400">{d.sample.slice(1).join(' · ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Módulo principal ──────────────────────────────────────────────────────────

type Stage = 'upload' | 'loading' | 'analysis';

export default function GestionesModule() {
  const { gestiones: storeEntry, setGestiones: saveToStore, clearGestiones } = useAnalisisStore();

  const [stage, setStage] = useState<Stage>(() => storeEntry ? 'analysis' : 'upload');
  const [data, setData] = useState<GestionesData | null>(() => storeEntry?.data ?? null);
  const [error, setError] = useState('');
  const [showPDFModal, setShowPDFModal] = useState(false);

  const [empresaF, setEmpresaF] = useState('');
  const [conceptoF, setConceptoF] = useState('');
  const [estadoF, setEstadoF] = useState('');
  const [operadorF, setOperadorF] = useState('');
  const [tipoContactoF, setTipoContactoF] = useState('');
  const [search, setSearch] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');

  const handleFile = useCallback(async (file: File) => {
    setError(''); setStage('loading');
    clearGestiones();
    try {
      const result = await parseGestiones(file);
      setData(result);
      recordActivity('atencion_cliente', file.name);
      saveToStore({ data: result, nombreArchivo: file.name });
      setStage('analysis');
    } catch (e) {
      setError((e as Error).message);
      setStage('upload');
    }
  }, [clearGestiones, saveToStore]);

  const reset = () => {
    clearGestiones();
    setData(null); setStage('upload'); setError('');
    setEmpresaF(''); setConceptoF(''); setEstadoF(''); setOperadorF(''); setTipoContactoF('');
    setSearch(''); setDesde(''); setHasta('');
  };

  const estadosDisponibles = useMemo(() => data ? [...new Set(data.rows.map(r => r.estado).filter(Boolean))].sort() : [], [data]);
  // "Tipo de contacto" se mapea al campo lugarContacto: la columna real con ese
  // nombre viene siempre vacía en el export, mientras que lugarContacto trae el
  // motivo del contacto y es lo que efectivamente sirve para ver "qué operador
  // atiende qué cosa".
  const tiposContactoDisponibles = useMemo(() => data ? [...new Set(data.rows.map(r => r.lugarContacto).filter(Boolean))].sort() : [], [data]);

  const filteredRows = useMemo(() => {
    if (!data) return [];
    let rows = data.rows;
    if (empresaF) rows = rows.filter(r => r.empresa === empresaF);
    if (conceptoF) rows = rows.filter(r => r.concepto === conceptoF);
    if (estadoF) rows = rows.filter(r => r.estado === estadoF);
    if (operadorF) rows = rows.filter(r => r.operador === operadorF);
    if (tipoContactoF) rows = rows.filter(r => r.lugarContacto === tipoContactoF);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter(r =>
        r.lugarContacto.toLowerCase().includes(q) || r.observaciones.toLowerCase().includes(q) ||
        r.numeroTramite.toLowerCase().includes(q) || r.plan.toLowerCase().includes(q) || r.equipo.toLowerCase().includes(q));
    }
    if (desde) rows = rows.filter(r => r.fechaCreacion >= desde);
    if (hasta) rows = rows.filter(r => r.fechaCreacion <= hasta);
    return rows;
  }, [data, empresaF, conceptoF, estadoF, operadorF, tipoContactoF, search, desde, hasta]);

  const stats = useMemo(() => computeGestionesStats(filteredRows), [filteredRows]);

  const hayFiltros = Boolean(empresaF || conceptoF || estadoF || operadorF || tipoContactoF || search || desde || hasta);
  function limpiarFiltros() {
    setEmpresaF(''); setConceptoF(''); setEstadoF(''); setOperadorF(''); setTipoContactoF('');
    setSearch(''); setDesde(''); setHasta('');
  }

  const subtitle = useMemo(() => {
    if (!data) return 'Análisis de gestiones y reclamos de Atención al Cliente';
    const base = `${stats.total.toLocaleString()} de ${data.total.toLocaleString()} gestiones`;
    return storeEntry ? `${base} · ${storeEntry.nombreArchivo} · ${formatFechaCarga(storeEntry.fechaCarga)}` : base;
  }, [data, stats.total, storeEntry]);

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Gestiones"
        subtitle={subtitle}
        actions={
          stage === 'analysis' && data ? (
            <div className="flex gap-2">
              <button onClick={reset} className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
                Cargar otro archivo
              </button>
              <button onClick={() => exportGestionesExcel(stats, filteredRows)}
                className="flex items-center gap-2 px-4 py-1.5 text-sm text-white rounded-lg hover:opacity-90" style={{ background: '#1D6F42' }}>
                <Download size={15} /> Excel
              </button>
              <button onClick={() => setShowPDFModal(true)}
                className="flex items-center gap-2 px-4 py-1.5 text-sm text-white rounded-lg hover:opacity-90" style={{ background: '#E3000F' }}>
                <Download size={15} /> PDF
              </button>
            </div>
          ) : null
        }
      />

      <div className="flex-1 overflow-y-auto p-6">

        {stage === 'upload' && (
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-8">
              <div className="inline-flex bg-teal-50 rounded-full p-4 mb-4">
                <ClipboardList size={36} className="text-teal-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Análisis de Gestiones</h2>
              <p className="text-gray-500 mt-2 text-sm">Cargá el archivo de gestiones de Atención al Cliente (.csv o .xlsx)</p>
            </div>
            {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}
            <FileUploader onFile={handleFile} label="Arrastrá el archivo de gestiones aquí" />
          </div>
        )}

        {stage === 'loading' && (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <Loader2 size={36} className="animate-spin text-teal-600 mx-auto mb-3" />
              <p className="text-gray-500">Procesando archivo...</p>
            </div>
          </div>
        )}

        {stage === 'analysis' && data && (
          <div id="gestiones-content" className="space-y-6">

            <DebugPanel data={data} />

            {/* Filtros */}
            <div className="bg-white rounded-xl border border-gray-200 px-5 py-4">
              <div className="flex flex-wrap gap-3 items-center">
                <select value={empresaF} onChange={e => setEmpresaF(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-[#003DA5]">
                  <option value="">Empresa (todas)</option>
                  {data.empresas.map(v => <option key={v}>{v}</option>)}
                </select>
                <select value={conceptoF} onChange={e => setConceptoF(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-[#003DA5]">
                  <option value="">Concepto (todos)</option>
                  <option value="CONSULTA">Consulta</option>
                  <option value="RECLAMO">Reclamo</option>
                  <option value="SOLICITUD">Solicitud</option>
                </select>
                <select value={estadoF} onChange={e => setEstadoF(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-[#003DA5]">
                  <option value="">Estado (todos)</option>
                  {estadosDisponibles.map(v => <option key={v}>{v}</option>)}
                </select>
                <select value={operadorF} onChange={e => setOperadorF(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-[#003DA5] max-w-[200px]">
                  <option value="">Operador (todos)</option>
                  {data.operadores.map(v => <option key={v}>{v}</option>)}
                </select>
                <select value={tipoContactoF} onChange={e => setTipoContactoF(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-[#003DA5] max-w-[200px]">
                  <option value="">Tipo de contacto (todos)</option>
                  {tiposContactoDisponibles.map(v => <option key={v}>{v}</option>)}
                </select>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type="text" placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)}
                    className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#003DA5] min-w-[160px]" />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-gray-400">Desde</span>
                  <input type="date" value={desde} onChange={e => setDesde(e.target.value)} className="border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-[#003DA5]" />
                  <span className="text-xs text-gray-400">Hasta</span>
                  <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} className="border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-[#003DA5]" />
                </div>
                <span className="text-sm text-gray-400 whitespace-nowrap font-medium ml-auto">{stats.total.toLocaleString()} gestiones</span>
                {hayFiltros && <button onClick={limpiarFiltros} className="text-xs text-[#003DA5] hover:underline whitespace-nowrap">Limpiar filtros</button>}
              </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KpiCard label="Total Gestiones" value={stats.total.toLocaleString()} icon={ClipboardList} color={P.azul} />
              <KpiCard label="Consultas" value={stats.consultas.toLocaleString()} sub={`${stats.total > 0 ? ((stats.consultas / stats.total) * 100).toFixed(1) : 0}% del total`} icon={MessageSquare} color={P.azulMedio} />
              <KpiCard label="Reclamos" value={stats.reclamos.toLocaleString()} sub={`${stats.total > 0 ? ((stats.reclamos / stats.total) * 100).toFixed(1) : 0}% del total`} icon={AlertTriangle} color={P.rojo} />
              <KpiCard label="Solicitudes" value={stats.solicitudes.toLocaleString()} sub={`${stats.total > 0 ? ((stats.solicitudes / stats.total) * 100).toFixed(1) : 0}% del total`} icon={CheckCircle2} color={P.verde} />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KpiCard label="Solucionados" value={stats.solucionados.toLocaleString()} sub={`${stats.total > 0 ? ((stats.solucionados / stats.total) * 100).toFixed(1) : 0}% del total`} icon={CheckCircle2} color={P.verde} />
              <KpiCard label="En Supervisión" value={stats.supervision.toLocaleString()} icon={AlertTriangle} color={P.naranja} />
              <KpiCard label="Operadores Activos" value={stats.operadoresActivos.toLocaleString()} icon={Users} color={P.violeta} />
              <KpiCard label="Período" value={stats.fechaMin ? `${formatFechaCorta(stats.fechaMin)} – ${formatFechaCorta(stats.fechaMax)}` : '—'} icon={Calendar} color={P.gris} />
            </div>

            <SeccionOperadores stats={stats} />
            <SeccionTiempoResolucion stats={stats} />
            <SeccionConcepto stats={stats} />
            <SeccionMotivos stats={stats} />
            <SeccionEstado stats={stats} />
            <SeccionEvolucion stats={stats} />
            <SeccionPlanEquipo stats={stats} />
            <SeccionEmpresa stats={stats} />

          </div>
        )}
      </div>

      {showPDFModal && (
        <PDFModal
          elementId="gestiones-content"
          titulo="Gestiones — Atención al Cliente"
          nombreArchivo={`Gestiones_${new Date().toLocaleDateString('es-UY').replace(/\//g, '-')}`}
          onClose={() => setShowPDFModal(false)}
        />
      )}
    </div>
  );
}
