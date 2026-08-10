import { useState, useCallback, useMemo } from 'react';
import {
  Briefcase, CheckCircle, Clock, XCircle, Users, Download, Loader2, AlertTriangle, ChevronDown, ChevronRight,
} from 'lucide-react';
import FileUploader from '../../components/FileUploader';
import ColumnMapper from '../../components/ColumnMapper';
import Header from '../../components/Header';
import PDFModal from '../../components/PDFModal';
import { parseExcel, normalizeFechaVenta, getEquivalente, getEquivalenteColor, type ParseResult } from '../../utils/smartParser';
import { getEmpresas, getFilteredRows } from '../ventas/VentasModule';
import { useAnalisisStore, formatFechaCarga } from '../../store/analisisStore';
import { recordActivity } from '../../utils/activityTracker';
import BackOfficeCharts from './BackOfficeCharts';
import { exportBackOfficeExcel } from './BackOfficeExport';

// ── Paleta ────────────────────────────────────────────────────────────────────
const P = {
  azul:    '#003DA5',
  verde:   '#28a745',
  rojo:    '#E3000F',
  naranja: '#fd7e14',
  violeta: '#6f42c1',
};

// ── ColumnMapper fields ───────────────────────────────────────────────────────
const BACKOFFICE_FIELDS = [
  { key: 'backOffice',      label: 'Back Office',              required: true  },
  { key: 'fechaBackOffice', label: 'Fecha de Back Office',     required: true  },
  { key: 'estado',          label: 'Estado',                    required: true  },
  { key: 'empresa',         label: 'Empresa / Línea',           required: false },
  { key: 'funcionario',     label: 'Vendedor',                  required: false },
  { key: 'nuevoPlan',       label: 'Nuevo Plan',                required: false },
  { key: 'motivo',          label: 'Motivo de cambio de plan',  required: false },
  { key: 'fecha',           label: 'Fecha de venta',            required: false },
];

type Stage = 'upload' | 'mapping' | 'loading' | 'analysis';

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface BODiaRow {
  fecha: string;
  porBackOffice: Record<string, number>;
  total: number;
}

export interface BOEstadoDetalle {
  estado: string;
  equivalente: string | null;
  count: number;
  pct: number;
}

export interface BORechazoDetalle {
  fecha: string;
  vendedor: string;
  estado: string;
  plan: string;
}

export interface BOVendedorRechazo {
  backOffice: string;
  vendedor: string;
  rechazos: number;
  total: number;
  pctRechazo: number;
}

export interface BackOfficeStat {
  nombre: string;
  total: number;
  activos: number;
  pendientes: number;
  procesados: number;
  rechazos: number;
  pctRechazo: number;
  diasActivos: number;
  promDia: number;
  rechazoPromDia: number;
  estadosDetalle: BOEstadoDetalle[];
  rechazosDetalle: BORechazoDetalle[];
  tendencia: 'mejorando' | 'empeorando' | 'estable';
}

export interface SinAsignarRow {
  fecha: string;
  vendedor: string;
  plan: string;
  empresa: string;
  estado: string;
}

export interface BackOfficeStats {
  totalContratos: number;
  procesadosHoy: number;
  rechazosTotales: number;
  rechazosPct: number;
  sinAsignarCount: number;
  backOfficesActivos: number;
  byBackOffice: BackOfficeStat[];
  backOfficesList: string[];
  byDia: BODiaRow[];
  porVendedor: BOVendedorRechazo[];
  sinAsignarRows: SinAsignarRow[];
  diasConActividad: number;
  promedioRechazoDiario: number;
  fechaMin: string;
  fechaMax: string;
  empresaActiva: string;
  hasEstado: boolean;
  hasFuncionario: boolean;
  hasFechaBO: boolean;
}

// ── Lógica de negocio ─────────────────────────────────────────────────────────

export function processBackOffice(
  rows: Record<string, unknown>[],
  mapping: Record<string, string>,
  empresaActiva = 'Todas',
): BackOfficeStats {
  const hasEstado      = Boolean(mapping.estado);
  const hasFuncionario = Boolean(mapping.funcionario);
  const hasFechaBO     = Boolean(mapping.fechaBackOffice);

  // ── Sección 3: dataset COMPLETO (sin filtro de back office) ──
  const sinAsignarRows: SinAsignarRow[] = [];
  for (const r of rows) {
    const estadoRaw = mapping.estado ? String(r[mapping.estado] ?? '').trim() : '';
    const boRaw      = mapping.backOffice ? String(r[mapping.backOffice] ?? '').trim() : '';
    if (estadoRaw.toUpperCase() === 'VENDIDO' && !boRaw) {
      sinAsignarRows.push({
        fecha:    mapping.fecha ? normalizeFechaVenta(String(r[mapping.fecha] ?? '')) : '',
        vendedor: mapping.funcionario ? String(r[mapping.funcionario] ?? '').trim() : '',
        plan:     mapping.nuevoPlan ? String(r[mapping.nuevoPlan] ?? '').trim() : '',
        empresa:  mapping.empresa ? String(r[mapping.empresa] ?? '').trim() : '',
        estado:   estadoRaw,
      });
    }
  }
  sinAsignarRows.sort((a, b) => b.fecha.localeCompare(a.fecha));

  // ── Filtro base: SOLO filas con Back-office asignado ──
  const rowsBO = rows.filter(r => {
    const bo = mapping.backOffice ? String(r[mapping.backOffice] ?? '').trim() : '';
    return bo !== '' && bo !== 'Sin asignar';
  });

  interface BOAcc {
    nombre: string;
    total: number; activos: number; pendientes: number; procesados: number; rechazos: number;
    estadosRaw: Map<string, number>;
    porDia: Map<string, { total: number; rechazos: number }>;
    porVendedor: Map<string, { total: number; rechazos: number }>;
    rechazosDetalle: BORechazoDetalle[];
  }
  const boMap  = new Map<string, BOAcc>();
  const diaMap = new Map<string, Map<string, number>>(); // fecha → bo → count
  const todayISO = new Date().toISOString().substring(0, 10);
  let procesadosHoy = 0;

  for (const r of rowsBO) {
    const nombre     = String(r[mapping.backOffice] ?? '').trim();
    const estadoRaw  = hasEstado ? String(r[mapping.estado] ?? '').trim() : '';
    const equivalente = estadoRaw ? getEquivalente(estadoRaw) : null;
    const fechaBO    = hasFechaBO ? normalizeFechaVenta(String(r[mapping.fechaBackOffice] ?? '')) : '';
    const vendedor   = hasFuncionario ? (String(r[mapping.funcionario] ?? '').trim() || 'Sin vendedor') : 'Sin vendedor';
    const plan       = mapping.nuevoPlan ? String(r[mapping.nuevoPlan] ?? '').trim() : '';

    if (!boMap.has(nombre)) {
      boMap.set(nombre, {
        nombre, total: 0, activos: 0, pendientes: 0, procesados: 0, rechazos: 0,
        estadosRaw: new Map(), porDia: new Map(), porVendedor: new Map(), rechazosDetalle: [],
      });
    }
    const acc = boMap.get(nombre)!;
    acc.total++;
    const esRechazo = equivalente === 'Rechazado';
    if (equivalente === 'Activo') acc.activos++;
    else if (equivalente === 'Pendiente') acc.pendientes++;
    else if (equivalente === 'Back Office') acc.procesados++;
    else if (esRechazo) acc.rechazos++;

    if (estadoRaw) acc.estadosRaw.set(estadoRaw, (acc.estadosRaw.get(estadoRaw) ?? 0) + 1);

    if (fechaBO && /^\d{4}-\d{2}-\d{2}$/.test(fechaBO)) {
      if (fechaBO === todayISO) procesadosHoy++;
      const prevDia = acc.porDia.get(fechaBO) ?? { total: 0, rechazos: 0 };
      acc.porDia.set(fechaBO, { total: prevDia.total + 1, rechazos: prevDia.rechazos + (esRechazo ? 1 : 0) });
      if (!diaMap.has(fechaBO)) diaMap.set(fechaBO, new Map());
      const dm = diaMap.get(fechaBO)!;
      dm.set(nombre, (dm.get(nombre) ?? 0) + 1);
    }

    const prevVend = acc.porVendedor.get(vendedor) ?? { total: 0, rechazos: 0 };
    acc.porVendedor.set(vendedor, { total: prevVend.total + 1, rechazos: prevVend.rechazos + (esRechazo ? 1 : 0) });

    if (esRechazo) acc.rechazosDetalle.push({ fecha: fechaBO, vendedor, estado: estadoRaw, plan });
  }

  // byDia (tabla + gráfico sección 1)
  const byDia: BODiaRow[] = Array.from(diaMap.entries())
    .map(([fecha, boCountMap]) => ({
      fecha,
      porBackOffice: Object.fromEntries(boCountMap),
      total: Array.from(boCountMap.values()).reduce((s, v) => s + v, 0),
    }))
    .sort((a, b) => b.fecha.localeCompare(a.fecha));

  const backOfficesList = Array.from(boMap.values()).sort((a, b) => b.total - a.total).map(b => b.nombre);

  const byBackOffice: BackOfficeStat[] = Array.from(boMap.values()).map(acc => {
    const pctRechazo    = acc.total > 0 ? (acc.rechazos / acc.total) * 100 : 0;
    const diasActivos   = acc.porDia.size;
    const promDia       = diasActivos > 0 ? acc.total / diasActivos : 0;
    const rechazoPromDia = diasActivos > 0 ? acc.rechazos / diasActivos : 0;

    const estadosDetalle: BOEstadoDetalle[] = Array.from(acc.estadosRaw.entries())
      .map(([estado, count]) => ({ estado, equivalente: getEquivalente(estado), count, pct: acc.total > 0 ? (count / acc.total) * 100 : 0 }))
      .sort((a, b) => b.count - a.count);

    // Tendencia: primera mitad vs segunda mitad del período (por días activos)
    const diasSorted = Array.from(acc.porDia.entries()).sort(([a], [b]) => a.localeCompare(b));
    let tendencia: 'mejorando' | 'empeorando' | 'estable' = 'estable';
    if (diasSorted.length >= 4) {
      const mid = Math.floor(diasSorted.length / 2);
      const sum = (arr: typeof diasSorted, key: 'total' | 'rechazos') => arr.reduce((s, [, v]) => s + v[key], 0);
      const primera = diasSorted.slice(0, mid);
      const segunda = diasSorted.slice(mid);
      const totalP = sum(primera, 'total'), rechP = sum(primera, 'rechazos');
      const totalS = sum(segunda, 'total'), rechS = sum(segunda, 'rechazos');
      const tasaP = totalP > 0 ? (rechP / totalP) * 100 : 0;
      const tasaS = totalS > 0 ? (rechS / totalS) * 100 : 0;
      const diff = tasaS - tasaP;
      if (diff <= -2) tendencia = 'mejorando';
      else if (diff >= 2) tendencia = 'empeorando';
    }

    return {
      nombre: acc.nombre, total: acc.total, activos: acc.activos, pendientes: acc.pendientes,
      procesados: acc.procesados, rechazos: acc.rechazos, pctRechazo, diasActivos, promDia, rechazoPromDia,
      estadosDetalle,
      rechazosDetalle: [...acc.rechazosDetalle].sort((a, b) => b.fecha.localeCompare(a.fecha)),
      tendencia,
    };
  }).sort((a, b) => b.total - a.total);

  const porVendedor: BOVendedorRechazo[] = [];
  for (const acc of boMap.values()) {
    for (const [vendedor, v] of acc.porVendedor.entries()) {
      if (v.rechazos > 0) {
        porVendedor.push({ backOffice: acc.nombre, vendedor, rechazos: v.rechazos, total: v.total, pctRechazo: v.total > 0 ? (v.rechazos / v.total) * 100 : 0 });
      }
    }
  }
  porVendedor.sort((a, b) => b.rechazos - a.rechazos);

  const totalContratos       = rowsBO.length;
  const rechazosTotales      = byBackOffice.reduce((s, b) => s + b.rechazos, 0);
  const rechazosPct          = totalContratos > 0 ? (rechazosTotales / totalContratos) * 100 : 0;
  const diasConActividad     = byDia.length;
  const promedioRechazoDiario = diasConActividad > 0 ? rechazosTotales / diasConActividad : 0;
  const fechas                = byDia.map(d => d.fecha).sort();

  return {
    totalContratos, procesadosHoy, rechazosTotales, rechazosPct,
    sinAsignarCount: sinAsignarRows.length,
    backOfficesActivos: boMap.size,
    byBackOffice, backOfficesList, byDia, porVendedor, sinAsignarRows,
    diasConActividad, promedioRechazoDiario,
    fechaMin: fechas[0] ?? '', fechaMax: fechas[fechas.length - 1] ?? '',
    empresaActiva, hasEstado, hasFuncionario, hasFechaBO,
  };
}

// ── UI helpers ────────────────────────────────────────────────────────────────

function formatFecha(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export function riesgoRechazoBadge(pct: number): { label: string; bg: string; fg: string } {
  if (pct < 5) return { label: 'Bajo', bg: '#d4edda', fg: '#155724' };
  if (pct <= 15) return { label: 'Medio', bg: '#ffe5d0', fg: '#9a5b13' };
  return { label: 'Alto', bg: '#f8d7da', fg: '#842029' };
}

export function rendimientoBadge(pctRechazo: number, promDia: number): { label: string; bg: string; fg: string } {
  if (pctRechazo < 5 && promDia > 10) return { label: 'Excelente', bg: '#d4edda', fg: '#155724' };
  if (pctRechazo < 10) return { label: 'Bueno', bg: '#cfe2ff', fg: '#084298' };
  if (pctRechazo < 20) return { label: 'Regular', bg: '#ffe5d0', fg: '#9a5b13' };
  return { label: 'Crítico', bg: '#f8d7da', fg: '#842029' };
}

function tendenciaLabel(t: 'mejorando' | 'empeorando' | 'estable'): { label: string; color: string } {
  if (t === 'mejorando') return { label: '↓ bajando', color: '#28a745' };
  if (t === 'empeorando') return { label: '↑ subiendo', color: '#E3000F' };
  return { label: '→ estable', color: '#6c757d' };
}

// ── KPI Card local (bordes exactos según spec) ─────────────────────────────────
function BOKpiCard({ label, value, sub, icon: Icon, color }: { label: string; value: string; sub?: string; icon: React.ComponentType<{ size?: number; className?: string }>; color: string }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 flex items-start gap-3 shadow-sm" style={{ borderTop: `4px solid ${color}` }}>
      <div className="p-2 rounded-lg flex-shrink-0 mt-0.5" style={{ background: `${color}18` }}>
        <Icon size={20} className="" />
      </div>
      <div className="min-w-0">
        <div className="font-semibold uppercase tracking-wider text-gray-500" style={{ fontSize: 11, letterSpacing: '0.06em' }}>{label}</div>
        <div className="font-bold leading-none mt-1 truncate" style={{ fontSize: 28, color }}>{value}</div>
        {sub && <div className="text-xs text-gray-400 mt-1 truncate">{sub}</div>}
      </div>
    </div>
  );
}

// ── Selector de empresa ───────────────────────────────────────────────────────
function EmpresaTabs({ empresas, active, onChange }: { empresas: { nombre: string; count: number }[]; active: string; onChange: (e: string) => void }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Filtrar por empresa</div>
      <div className="flex flex-wrap gap-2">
        {empresas.map(e => {
          const isActive = e.nombre === active;
          return (
            <button key={e.nombre} onClick={() => onChange(e.nombre)} style={{
              padding: '6px 18px', borderRadius: 20, fontSize: 13, fontWeight: 500,
              border: '1.5px solid #6f42c1',
              background: isActive ? '#6f42c1' : '#fff',
              color: isActive ? '#fff' : '#6f42c1',
              cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap',
            }}>
              {e.nombre}
              <span style={{ marginLeft: 6, fontSize: 11, opacity: 0.75, fontWeight: 400 }}>({e.count.toLocaleString()})</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Sección 1: Contratos subidos por día ──────────────────────────────────────
function SeccionPorDia({ stats }: { stats: BackOfficeStats }) {
  if (stats.byDia.length === 0) return null;
  const bos = stats.backOfficesList;
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="font-semibold text-gray-900">Contratos subidos por día</h3>
      <p className="text-xs text-gray-400 mb-4">Basado en la columna Fecha de back-office</p>
      <div className="overflow-x-auto">
        <table className="text-sm min-w-full">
          <thead>
            <tr className="bg-[#003DA5] text-white">
              <th className="px-3 py-2 text-left text-xs font-semibold whitespace-nowrap">Fecha</th>
              {bos.map(bo => (
                <th key={bo} className="px-3 py-2 text-right text-xs font-semibold whitespace-nowrap">{bo}</th>
              ))}
              <th className="px-3 py-2 text-right text-xs font-semibold whitespace-nowrap">Total día</th>
            </tr>
          </thead>
          <tbody>
            {stats.byDia.map((d, i) => (
              <tr key={d.fecha} className={`border-t border-gray-100 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                <td className="px-3 py-1.5 font-mono text-xs text-gray-600 whitespace-nowrap">{formatFecha(d.fecha)}</td>
                {bos.map(bo => {
                  const v = d.porBackOffice[bo] ?? 0;
                  return (
                    <td key={bo} className="px-3 py-1.5 text-right whitespace-nowrap">
                      {v === 0 ? <span className="text-gray-300">—</span> : <span className="font-semibold text-[#003DA5]">{v}</span>}
                    </td>
                  );
                })}
                <td className="px-3 py-1.5 text-right font-bold text-gray-800 whitespace-nowrap">{d.total}</td>
              </tr>
            ))}
            <tr className="border-t-2 border-gray-300" style={{ background: '#f1f5f9' }}>
              <td className="px-3 py-2 font-bold text-gray-700 whitespace-nowrap">TOTAL</td>
              {bos.map(bo => {
                const total = stats.byDia.reduce((s, d) => s + (d.porBackOffice[bo] ?? 0), 0);
                return <td key={bo} className="px-3 py-2 text-right font-bold text-gray-800 whitespace-nowrap">{total}</td>;
              })}
              <td className="px-3 py-2 text-right font-bold text-gray-900 whitespace-nowrap">{stats.byDia.reduce((s, d) => s + d.total, 0)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Sección 2: Estados por back office ────────────────────────────────────────
function SeccionEstados({ stats }: { stats: BackOfficeStats }) {
  const [expandido, setExpandido] = useState<string | null>(null);
  if (stats.byBackOffice.length === 0) return null;
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="font-semibold text-gray-900 mb-4">Estados por back office</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#003DA5] text-white">
              <th className="px-2 py-2 text-center text-xs font-semibold w-8">#</th>
              <th className="px-3 py-2 text-left text-xs font-semibold">Back Office</th>
              <th className="px-3 py-2 text-right text-xs font-semibold">Total</th>
              <th className="px-3 py-2 text-right text-xs font-semibold">Activos</th>
              <th className="px-3 py-2 text-right text-xs font-semibold">Pendientes</th>
              <th className="px-3 py-2 text-right text-xs font-semibold">Procesados</th>
              <th className="px-3 py-2 text-right text-xs font-semibold">Rechazos</th>
              <th className="px-3 py-2 text-center text-xs font-semibold">% Rechazo</th>
            </tr>
          </thead>
          <tbody>
            {stats.byBackOffice.map((b, i) => {
              const isOpen = expandido === b.nombre;
              const badge = riesgoRechazoBadge(b.pctRechazo);
              return (
                <>
                  <tr key={b.nombre}
                    onClick={() => setExpandido(isOpen ? null : b.nombre)}
                    className={`border-t border-gray-100 cursor-pointer hover:bg-blue-50 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                    <td className="px-2 py-2 text-center text-xs text-gray-400">{i + 1}</td>
                    <td className="px-3 py-2 font-medium text-gray-800">
                      <span className="inline-flex items-center gap-1">
                        {isOpen ? <ChevronDown size={13} className="text-gray-400" /> : <ChevronRight size={13} className="text-gray-400" />}
                        {b.nombre}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right font-bold text-[#003DA5]">{b.total.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right text-green-700">{b.activos.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right text-orange-600">{b.pendientes.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right text-blue-700">{b.procesados.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right text-red-600 font-semibold">{b.rechazos.toLocaleString()}</td>
                    <td className="px-3 py-2 text-center">
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: badge.bg, color: badge.fg }}>
                        {b.pctRechazo.toFixed(1)}% · {badge.label}
                      </span>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr key={`${b.nombre}-detalle`}>
                      <td colSpan={8} className="px-3 py-3 bg-gray-50 border-t border-gray-100">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-gray-500">
                              <th className="px-2 py-1 text-left font-semibold">Estado</th>
                              <th className="px-2 py-1 text-left font-semibold">Equivalente</th>
                              <th className="px-2 py-1 text-right font-semibold">Cantidad</th>
                              <th className="px-2 py-1 text-right font-semibold">%</th>
                            </tr>
                          </thead>
                          <tbody>
                            {b.estadosDetalle.map(e => (
                              <tr key={e.estado} className="border-t border-gray-200">
                                <td className="px-2 py-1 text-gray-700">{e.estado}</td>
                                <td className="px-2 py-1">
                                  {e.equivalente ? (
                                    <span className="inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded-full text-white" style={{ background: getEquivalenteColor(e.equivalente) }}>{e.equivalente}</span>
                                  ) : <span className="text-gray-300">—</span>}
                                </td>
                                <td className="px-2 py-1 text-right font-semibold text-gray-700">{e.count.toLocaleString()}</td>
                                <td className="px-2 py-1 text-right text-gray-500">{e.pct.toFixed(1)}%</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Sección 3: Vendidos sin asignar ───────────────────────────────────────────
function SeccionSinAsignar({ stats }: { stats: BackOfficeStats }) {
  const rows = stats.sinAsignarRows;
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="font-semibold text-gray-900 mb-4">⚠ Contratos VENDIDO sin back office asignado</h3>
      {rows.length === 0 ? (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-3 text-sm font-medium">
          <CheckCircle size={16} /> Todos los contratos VENDIDO tienen back office asignado
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 bg-orange-50 border border-orange-300 text-orange-700 rounded-lg px-4 py-3 text-sm font-medium mb-4">
            <AlertTriangle size={16} />
            {rows.length.toLocaleString()} contrato{rows.length > 1 ? 's' : ''} en estado VENDIDO sin back office asignado — requieren atención
          </div>
          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0">
                <tr className="bg-[#E3000F] text-white">
                  <th className="px-3 py-2 text-left text-xs font-semibold">Fecha Venta</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold">Vendedor</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold">Plan</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold">Empresa</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold">Estado</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className={`border-t border-gray-100 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                    <td className="px-3 py-1.5 font-mono text-xs text-gray-600">{formatFecha(r.fecha)}</td>
                    <td className="px-3 py-1.5 text-gray-800">{r.vendedor || '—'}</td>
                    <td className="px-3 py-1.5 text-gray-600">{r.plan || '—'}</td>
                    <td className="px-3 py-1.5 text-gray-600">{r.empresa || '—'}</td>
                    <td className="px-3 py-1.5">
                      <span className="text-xs font-semibold text-white px-2 py-0.5 rounded-full" style={{ background: '#28a745' }}>{r.estado}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ── Sección 4: Rechazos por back office ───────────────────────────────────────
function SeccionRechazos({ stats }: { stats: BackOfficeStats }) {
  const [expandido, setExpandido] = useState<string | null>(null);

  const porVendedorPorBO = useMemo(() => {
    const map = new Map<string, BOVendedorRechazo[]>();
    for (const v of stats.porVendedor) {
      if (!map.has(v.backOffice)) map.set(v.backOffice, []);
      map.get(v.backOffice)!.push(v);
    }
    return map;
  }, [stats.porVendedor]);

  const boConRechazos = stats.byBackOffice.filter(b => b.rechazos > 0);

  return (
    <div className="space-y-6">
      {/* KPIs adicionales */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <BOKpiCard
          label="% Rechazo General"
          value={`${stats.rechazosPct.toFixed(1)}%`}
          sub={`${stats.rechazosTotales.toLocaleString()} de ${stats.totalContratos.toLocaleString()} contratos`}
          icon={XCircle}
          color={stats.rechazosPct < 5 ? P.verde : stats.rechazosPct <= 10 ? P.naranja : P.rojo}
        />
        <BOKpiCard
          label="Promedio Rechazo Diario"
          value={`${stats.promedioRechazoDiario.toFixed(1)} rechazos/día`}
          sub={`${stats.diasConActividad} días con actividad`}
          icon={Clock}
          color={P.naranja}
        />
      </div>

      {/* Tabla rechazos por back office y vendedor */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="font-semibold text-gray-900 mb-4">Análisis de rechazos por back office</h3>
        {boConRechazos.length === 0 ? (
          <p className="text-sm text-gray-400">Sin rechazos registrados.</p>
        ) : (
          <div className="space-y-3">
            {boConRechazos.map(b => {
              const isOpen = expandido === b.nombre;
              const vendedores = (porVendedorPorBO.get(b.nombre) ?? []).sort((a, c) => c.rechazos - a.rechazos);
              return (
                <div key={b.nombre} className="border border-gray-200 rounded-lg overflow-hidden">
                  <button
                    onClick={() => setExpandido(isOpen ? null : b.nombre)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 text-left"
                    style={{ border: 'none', cursor: 'pointer' }}
                  >
                    <span className="flex items-center gap-2 font-semibold text-gray-800 text-sm">
                      {isOpen ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
                      {b.nombre}
                    </span>
                    <span className="flex items-center gap-3 text-xs">
                      <span className="text-red-600 font-bold">{b.rechazos} rechazos</span>
                      <span className="text-gray-400">de {b.total} contratos</span>
                      <span className="font-bold px-2 py-0.5 rounded-full" style={{ background: riesgoRechazoBadge(b.pctRechazo).bg, color: riesgoRechazoBadge(b.pctRechazo).fg }}>
                        {b.pctRechazo.toFixed(1)}%
                      </span>
                    </span>
                  </button>
                  <div className="px-4 py-3">
                    <table className="w-full text-xs mb-2">
                      <thead>
                        <tr className="text-gray-500">
                          <th className="px-2 py-1 text-left font-semibold">Vendedor</th>
                          <th className="px-2 py-1 text-right font-semibold">Rechazos</th>
                          <th className="px-2 py-1 text-right font-semibold">Total Contratos</th>
                          <th className="px-2 py-1 text-right font-semibold">% Rechazo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {vendedores.map(v => (
                          <tr key={v.vendedor} className="border-t border-gray-100">
                            <td className="px-2 py-1 text-gray-700">{v.vendedor}</td>
                            <td className="px-2 py-1 text-right font-semibold text-red-600">{v.rechazos}</td>
                            <td className="px-2 py-1 text-right text-gray-500">{v.total}</td>
                            <td className="px-2 py-1 text-right text-gray-500">{v.pctRechazo.toFixed(1)}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {isOpen && (
                      <div className="mt-3 border-t border-gray-100 pt-3">
                        <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Detalle de rechazos</div>
                        <div className="overflow-x-auto max-h-64 overflow-y-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-gray-500">
                                <th className="px-2 py-1 text-left font-semibold">Fecha</th>
                                <th className="px-2 py-1 text-left font-semibold">Vendedor</th>
                                <th className="px-2 py-1 text-left font-semibold">Estado</th>
                                <th className="px-2 py-1 text-left font-semibold">Plan</th>
                              </tr>
                            </thead>
                            <tbody>
                              {b.rechazosDetalle.map((r, i) => (
                                <tr key={i} className="border-t border-gray-100">
                                  <td className="px-2 py-1 font-mono text-gray-600">{formatFecha(r.fecha)}</td>
                                  <td className="px-2 py-1 text-gray-700">{r.vendedor}</td>
                                  <td className="px-2 py-1 text-red-600">{r.estado}</td>
                                  <td className="px-2 py-1 text-gray-600">{r.plan || '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Ranking por % rechazo */}
      <BackOfficeCharts.RankingRechazos stats={stats} />

      {/* Tabla promedio rechazo diario */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="font-semibold text-gray-900 mb-4">Promedio de rechazo diario por back office</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#003DA5] text-white">
                <th className="px-3 py-2 text-left text-xs font-semibold">Back Office</th>
                <th className="px-3 py-2 text-right text-xs font-semibold">Días Activos</th>
                <th className="px-3 py-2 text-right text-xs font-semibold">Rechazos Totales</th>
                <th className="px-3 py-2 text-right text-xs font-semibold">Prom/Día</th>
                <th className="px-3 py-2 text-center text-xs font-semibold">Tendencia</th>
              </tr>
            </thead>
            <tbody>
              {stats.byBackOffice.map((b, i) => {
                const tend = tendenciaLabel(b.tendencia);
                return (
                  <tr key={b.nombre} className={`border-t border-gray-100 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                    <td className="px-3 py-2 font-medium text-gray-800">{b.nombre}</td>
                    <td className="px-3 py-2 text-right text-gray-600">{b.diasActivos}</td>
                    <td className="px-3 py-2 text-right font-semibold text-red-600">{b.rechazos}</td>
                    <td className="px-3 py-2 text-right text-gray-700">{b.rechazoPromDia.toFixed(1)}</td>
                    <td className="px-3 py-2 text-center font-semibold" style={{ color: tend.color }}>{tend.label}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Sección 5: Rendimiento general ────────────────────────────────────────────
type SortKey = 'nombre' | 'total' | 'promDia' | 'activos' | 'pendientes' | 'procesados' | 'rechazos' | 'pctRechazo';

function SeccionRendimiento({ stats }: { stats: BackOfficeStats }) {
  const [sortKey, setSortKey] = useState<SortKey>('total');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const rows = useMemo(() => {
    const arr = [...stats.byBackOffice];
    arr.sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey];
      const cmp = typeof av === 'string' ? av.localeCompare(String(bv)) : (av as number) - (bv as number);
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [stats.byBackOffice, sortKey, sortDir]);

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('desc'); }
  }

  const cols: { key: SortKey; label: string }[] = [
    { key: 'nombre', label: 'Back Office' },
    { key: 'total', label: 'Total' },
    { key: 'promDia', label: 'Por Día Prom' },
    { key: 'activos', label: 'Activos' },
    { key: 'pendientes', label: 'Pendientes' },
    { key: 'procesados', label: 'Procesados' },
    { key: 'rechazos', label: 'Rechazos' },
    { key: 'pctRechazo', label: '% Rechazo' },
  ];

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="font-semibold text-gray-900 mb-4">Resumen de rendimiento</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#003DA5] text-white">
              {cols.map(c => (
                <th key={c.key} onClick={() => handleSort(c.key)}
                  className={`px-3 py-2 text-xs font-semibold cursor-pointer select-none whitespace-nowrap ${c.key === 'nombre' ? 'text-left' : 'text-right'}`}>
                  {c.label} {sortKey === c.key ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                </th>
              ))}
              <th className="px-3 py-2 text-center text-xs font-semibold">Rendimiento</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((b, i) => {
              const badge = rendimientoBadge(b.pctRechazo, b.promDia);
              return (
                <tr key={b.nombre} className={`border-t border-gray-100 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                  <td className="px-3 py-2 font-medium text-gray-800">{b.nombre}</td>
                  <td className="px-3 py-2 text-right font-bold text-[#003DA5]">{b.total.toLocaleString()}</td>
                  <td className="px-3 py-2 text-right text-gray-600">{b.promDia.toFixed(1)}</td>
                  <td className="px-3 py-2 text-right text-green-700">{b.activos.toLocaleString()}</td>
                  <td className="px-3 py-2 text-right text-orange-600">{b.pendientes.toLocaleString()}</td>
                  <td className="px-3 py-2 text-right text-blue-700">{b.procesados.toLocaleString()}</td>
                  <td className="px-3 py-2 text-right text-red-600 font-semibold">{b.rechazos.toLocaleString()}</td>
                  <td className="px-3 py-2 text-right text-gray-700">{b.pctRechazo.toFixed(1)}%</td>
                  <td className="px-3 py-2 text-center">
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: badge.bg, color: badge.fg }}>{badge.label}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Módulo principal ──────────────────────────────────────────────────────────

export default function BackOfficeModule() {
  const { backOffice: storeEntry, setBackOffice: saveToStore, clearBackOffice } = useAnalisisStore();

  const [stage, setStage]       = useState<Stage>(() => storeEntry ? 'analysis' : 'upload');
  const [parsed, setParsed]     = useState<ParseResult | null>(() => storeEntry?.parsed ?? null);
  const [mapping, setMapping]   = useState<Record<string, string>>(() => storeEntry?.mapping ?? {});
  const [empresas, setEmpresas] = useState<{ nombre: string; count: number }[]>(() => storeEntry?.empresas ?? []);
  const [empresaActiva, setEmpresaActiva] = useState(() => storeEntry?.empresaActiva ?? 'Todas');
  const [stats, setStats]       = useState<BackOfficeStats | null>(() => storeEntry?.data ?? null);
  const [error, setError]       = useState('');
  const [sessionKey, setSessionKey] = useState(0);
  const [showPDFModal, setShowPDFModal] = useState(false);

  const handleFile = useCallback(async (file: File) => {
    setError(''); setStage('loading');
    clearBackOffice();
    setSessionKey(k => k + 1);
    try {
      const result = await parseExcel(file, 'ventas');
      setParsed(result);
      setMapping(result.columnMap);
      setStage('mapping');
    } catch (e) {
      setError((e as Error).message);
      setStage('upload');
    }
  }, [clearBackOffice]);

  const handleConfirm = useCallback(() => {
    if (!parsed) return;
    setStage('loading');
    setTimeout(() => {
      const empList = getEmpresas(parsed.rows, mapping);
      setEmpresas(empList);
      const defaultEmpresa = empList.length > 1 ? empList[1].nombre : 'Todas';
      setEmpresaActiva(defaultEmpresa);
      const rows = getFilteredRows(parsed.rows, mapping, defaultEmpresa);
      const s = processBackOffice(rows, mapping, defaultEmpresa);
      setStats(s);
      recordActivity('back_office', parsed.fileName);
      saveToStore({ data: s, parsed, mapping, empresas: empList, empresaActiva: defaultEmpresa, nombreArchivo: parsed.fileName });
      setStage('analysis');
    }, 300);
  }, [parsed, mapping, saveToStore]);

  const handleEmpresaChange = useCallback((empresa: string) => {
    if (!parsed) return;
    setEmpresaActiva(empresa);
    const rows = getFilteredRows(parsed.rows, mapping, empresa);
    const s = processBackOffice(rows, mapping, empresa);
    setStats(s);
    saveToStore({ data: s, parsed, mapping, empresas, empresaActiva: empresa, nombreArchivo: parsed.fileName });
  }, [parsed, mapping, empresas, saveToStore]);

  const handleExportExcel = useCallback(() => {
    if (!stats) return;
    exportBackOfficeExcel(stats, empresaActiva);
  }, [stats, empresaActiva]);

  const reset = () => {
    clearBackOffice();
    setSessionKey(k => k + 1);
    setStage('upload'); setParsed(null); setStats(null);
    setEmpresas([]); setEmpresaActiva('Todas'); setError('');
  };

  const subtitle = useMemo(() => {
    if (!stats) return 'Análisis de gestión desde la perspectiva del back office';
    const base = `${stats.totalContratos.toLocaleString()} contratos${stats.fechaMin ? ` · ${formatFecha(stats.fechaMin)} – ${formatFecha(stats.fechaMax)}` : ''}`;
    return storeEntry ? `${base} · ${storeEntry.nombreArchivo} · ${formatFechaCarga(storeEntry.fechaCarga)}` : base;
  }, [stats, storeEntry]);

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Módulo Back Office"
        subtitle={subtitle}
        actions={
          stage === 'analysis' && stats ? (
            <div className="flex gap-2">
              <button onClick={reset} className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
                Cargar otro archivo
              </button>
              <button onClick={handleExportExcel}
                className="flex items-center gap-2 px-4 py-1.5 text-sm text-white rounded-lg hover:opacity-90"
                style={{ background: '#1D6F42' }}>
                <Download size={15} /> Excel
              </button>
              <button onClick={() => setShowPDFModal(true)}
                className="flex items-center gap-2 px-4 py-1.5 text-sm text-white rounded-lg hover:opacity-90"
                style={{ background: '#E3000F' }}>
                <Download size={15} /> PDF
              </button>
            </div>
          ) : null
        }
      />

      <div className="flex-1 overflow-y-auto p-6">

        {/* ── UPLOAD ── */}
        {stage === 'upload' && (
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-8">
              <div className="inline-flex bg-purple-50 rounded-full p-4 mb-4">
                <Briefcase size={36} className="text-[#6f42c1]" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Análisis de Back Office</h2>
              <p className="text-gray-500 mt-2 text-sm">
                Cargá el mismo archivo Excel o CSV de Ventas. Se analizan solo las filas con Back-office asignado.
              </p>
            </div>
            {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}
            <FileUploader onFile={handleFile} label="Arrastrá tu reporte de ventas / back office aquí" />
          </div>
        )}

        {/* ── LOADING ── */}
        {stage === 'loading' && (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <Loader2 size={36} className="animate-spin text-[#6f42c1] mx-auto mb-3" />
              <p className="text-gray-500">Procesando archivo...</p>
            </div>
          </div>
        )}

        {/* ── MAPPING ── */}
        {stage === 'mapping' && parsed && (
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-900 mb-3">
                Vista previa — {parsed.fileName}
                <span className="ml-2 text-sm font-normal text-gray-500">({parsed.rowCount.toLocaleString()} filas)</span>
              </h3>
              <div className="overflow-x-auto">
                <table className="text-xs w-full">
                  <thead>
                    <tr>
                      {parsed.headers.map(h => (
                        <th key={h} className="px-3 py-2 bg-gray-100 text-left font-medium text-gray-700 border-r border-gray-200 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.rows.slice(0, 5).map((row, i) => (
                      <tr key={i} className="border-t border-gray-100">
                        {parsed.headers.map(h => (
                          <td key={h} className="px-3 py-1.5 text-gray-600 border-r border-gray-100 whitespace-nowrap">{String(row[h] ?? '')}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <ColumnMapper
              fields={BACKOFFICE_FIELDS}
              headers={parsed.headers}
              mapping={mapping}
              onChange={(key, val) => setMapping(m => ({ ...m, [key]: val }))}
              onConfirm={handleConfirm}
              confidence={parsed.confidence}
            />
          </div>
        )}

        {/* ── ANALYSIS ── */}
        {stage === 'analysis' && stats && (
          <div id="backoffice-content" key={sessionKey} className="space-y-6">

            {/* KPI Cards — fila de 5 */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              <BOKpiCard label="Total Contratos" value={stats.totalContratos.toLocaleString()} icon={Briefcase} color={P.azul} />
              <BOKpiCard label="Procesados Hoy" value={stats.procesadosHoy.toLocaleString()} sub="fecha de back-office de hoy" icon={CheckCircle} color={P.verde} />
              <BOKpiCard label="Rechazos Totales" value={stats.rechazosTotales.toLocaleString()} sub={`${stats.rechazosPct.toFixed(1)}% del total`} icon={XCircle} color={P.rojo} />
              <BOKpiCard label="Sin Asignar" value={stats.sinAsignarCount.toLocaleString()} sub="contratos VENDIDO sin back office" icon={AlertTriangle} color={P.naranja} />
              <BOKpiCard label="Back Offices Activos" value={stats.backOfficesActivos.toLocaleString()} icon={Users} color={P.violeta} />
            </div>

            {/* Selector de empresa */}
            <EmpresaTabs empresas={empresas} active={empresaActiva} onChange={handleEmpresaChange} />

            {/* Sección 1 */}
            <SeccionPorDia stats={stats} />
            <BackOfficeCharts.Evolucion stats={stats} />

            {/* Sección 2 */}
            <SeccionEstados stats={stats} />
            <BackOfficeCharts.Stacked stats={stats} />

            {/* Sección 3 */}
            <SeccionSinAsignar stats={stats} />

            {/* Sección 4 */}
            <SeccionRechazos stats={stats} />

            {/* Sección 5 */}
            <SeccionRendimiento stats={stats} />

          </div>
        )}
      </div>

      {showPDFModal && (
        <PDFModal
          elementId="backoffice-content"
          titulo="Back Office"
          nombreArchivo={`BackOffice_${new Date().toLocaleDateString('es-UY').replace(/\//g, '-')}`}
          onClose={() => setShowPDFModal(false)}
        />
      )}
    </div>
  );
}
