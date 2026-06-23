import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  BarChart2, Users, Calendar, Download, Loader2,
  ArrowUpRight, Layers, Repeat, CheckCircle, XCircle, EyeOff,
} from 'lucide-react';
import FileUploader from '../../components/FileUploader';
import ColumnMapper from '../../components/ColumnMapper';
import KPICard from '../../components/KPICard';
import Header from '../../components/Header';
import { parseExcel, normalizeEstado, normalizeFechaVenta, type ParseResult, type EstadoVenta } from '../../utils/smartParser';
import VentasCharts, { TemporalChart } from './VentasCharts';
import FiltroPeriodo, { type FiltroState } from '../../components/ventas/FiltroPeriodo';
import VentasPerformanceTable from './VentasPerformanceTable';
import { exportVentasPptx, exportVentasExcel } from './VentasExport';
import PDFModal from '../../components/PDFModal';
import { useConfig } from '../../hooks/useConfig';
import { recordActivity } from '../../utils/activityTracker';
import { useAnalisisStore, formatFechaCarga } from '../../store/analisisStore';

export type { EstadoVenta };

// ── Colores por estado real ───────────────────────────────────────────────────
export const ESTADO_COLORS_RAW: Record<string, string> = {
  'VENDIDO':               '#28a745',
  'CONTROL ANTEL':         '#003DA5',
  'ACTIVAR':               '#fd7e14',
  'DISTRIBUIR':            '#20c997',
  'RECHAZADO':             '#E3000F',
  'NO FIRMA':              '#6f42c1',
  'CANCELADO POR CLIENTE': '#6c757d',
  'LLAMAR':                '#4D94FF',
  'TELELINK':              '#ffc107',
};
export function getEstadoColor(estado: string): string {
  return ESTADO_COLORS_RAW[estado] ?? '#adb5bd';
}

// ── ColumnMapper fields ───────────────────────────────────────────────────────
const VENTAS_FIELDS = [
  { key: 'funcionario',  label: 'Vendedor / Funcionario',   required: true  },
  { key: 'fecha',        label: 'Fecha de venta',            required: false },
  { key: 'motivo',       label: 'Motivo / Tipo de gestión',  required: false },
  { key: 'nuevoPlan',    label: 'Nuevo Plan / Producto',     required: false },
  { key: 'planAnterior', label: 'Plan Anterior',              required: false },
  { key: 'empresa',      label: 'Empresa / Línea',            required: false },
  { key: 'estado',       label: 'Estado',                    required: false },
  { key: 'backOffice',   label: 'Back Office',               required: false },
  { key: 'departamento', label: 'Departamento',              required: false },
  { key: 'modalidad',    label: 'Modalidad de venta',        required: false },
];

type Stage = 'upload' | 'mapping' | 'loading' | 'analysis';

// ── Tipos de datos ────────────────────────────────────────────────────────────

export const EMPTY_ESTADOS: Record<EstadoVenta, number> = {
  'Vendido': 0, 'Control Antel': 0, 'Activar': 0, 'Rechazo': 0, 'Otro': 0,
};

export interface FuncionarioDia {
  fecha: string;
  ventas: number;
  acumulado: number;
}

export interface DiaStat {
  fecha: string;
  vendedoresActivos: number;
  ventas: number;
  promVendedor: number;
}

export interface FuncionarioStat {
  nombre: string;
  total: number;
  renovaciones: number;
  altas: number;
  cambios: number;
  otros: number;
  estados: Record<EstadoVenta, number>;
  estadosRaw: Record<string, number>;
  diasActivos: number;
  rechazos: number;
  ventasPorDia: FuncionarioDia[];
  promVentasDia: number;
  diaMasProductivo: { fecha: string; ventas: number } | null;
}

export interface EstadoKpis {
  vendido: number;  vendidoPct: number;
  control: number;
  activar: number;
  rechazo: number;  rechazoPct: number;
}

export interface VentasStats {
  byFuncionario:   FuncionarioStat[];
  byPlan:          { nombre: string; ventas: number }[];
  byFecha:         { fecha: string;  ventas: number }[];
  byMotivo:        { motivo: string; count: number  }[];
  byEstado:        { estado: EstadoVenta; count: number }[];
  byEstadoRaw:     { estado: string; count: number }[];
  byDepartamento:  { departamento: string; count: number; vendidos: number }[];
  byModalidad:     { modalidad: string; count: number; vendidos: number }[];
  byBackOffice:    { nombre: string; count: number; estados: Record<string, number> }[];
  byDia:           DiaStat[];
  total: number;
  renovaciones: number;
  altas: number;
  cambios: number;
  promedio: number;
  mejor: string;
  diasConDatos: number;
  planesDistintos: number;
  fechaMin: string;
  fechaMax: string;
  totalVendedores: number;
  hasEstado: boolean;
  hasBackOffice: boolean;
  hasDepartamento: boolean;
  hasModalidad: boolean;
  estadoKpis: EstadoKpis | null;
  sinBackOffice: number;
  tasaRechazoEquipo: number | null;
  promedioEquipoDia: number;
  empresaActiva: string;
}

// ── Constantes localStorage / sessionStorage ──────────────────────────────────
const OCULTOS_KEY       = 'elared_vendedores_ocultos';
const SESSION_FILTRO_KEY = 'elared_ventas_filtro_periodo';

function loadOcultos(): Set<string> {
  try {
    const raw = localStorage.getItem(OCULTOS_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch { return new Set(); }
}

function saveOcultos(s: Set<string>) {
  try {
    if (s.size === 0) localStorage.removeItem(OCULTOS_KEY);
    else localStorage.setItem(OCULTOS_KEY, JSON.stringify([...s]));
  } catch {}
}

function loadFiltroPeriodo(): FiltroState {
  try {
    const raw = sessionStorage.getItem(SESSION_FILTRO_KEY);
    return raw ? JSON.parse(raw) : { desde: null, hasta: null, label: null };
  } catch { return { desde: null, hasta: null, label: null }; }
}

function saveFiltroPeriodo(f: FiltroState) {
  try {
    if (f.desde) sessionStorage.setItem(SESSION_FILTRO_KEY, JSON.stringify(f));
    else sessionStorage.removeItem(SESSION_FILTRO_KEY);
  } catch {}
}

// Aplica filtro de período sobre rows ya filtrados por empresa/ocultos
function applyPeriodFilter(
  rows: Record<string, unknown>[],
  mapping: Record<string, string>,
  filtro: FiltroState,
): Record<string, unknown>[] {
  if (!filtro.desde || !filtro.hasta || !mapping.fecha) return rows;
  return rows.filter(r => {
    const f = normalizeFechaVenta(String(r[mapping.fecha] ?? '')).substring(0, 10);
    return f >= filtro.desde! && f <= filtro.hasta!;
  });
}

// ── Lógica de negocio ─────────────────────────────────────────────────────────

const MOTIVO_RENOVACION = ['renovacion', 'renovación', 'renov', 'renewal'];
const MOTIVO_ALTA       = ['nuevo servicio', 'alta nueva', 'nuevo cliente', 'new service'];
const MOTIVO_CAMBIO     = ['cambio de plan', 'cambio plan', 'plan change'];

function classifyMotivo(raw: string): 'renovacion' | 'alta' | 'cambio' | 'otro' {
  const n = raw.toLowerCase().trim().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (MOTIVO_RENOVACION.some(k => n.includes(k))) return 'renovacion';
  if (MOTIVO_ALTA.some(k => n.includes(k)))       return 'alta';
  if (MOTIVO_CAMBIO.some(k => n.includes(k)))     return 'cambio';
  return 'otro';
}

export function getEmpresas(
  rows: Record<string, unknown>[],
  mapping: Record<string, string>,
): { nombre: string; count: number }[] {
  if (!mapping.empresa) return [{ nombre: 'Todas', count: rows.length }];
  const map = new Map<string, number>();
  for (const r of rows) {
    const e = String(r[mapping.empresa] ?? '').trim();
    if (e) map.set(e, (map.get(e) ?? 0) + 1);
  }
  const list = Array.from(map.entries())
    .map(([nombre, count]) => ({ nombre, count }))
    .sort((a, b) => b.count - a.count);
  return [{ nombre: 'Todas', count: rows.length }, ...list];
}

export function getFilteredRows(
  rows: Record<string, unknown>[],
  mapping: Record<string, string>,
  empresa: string,
): Record<string, unknown>[] {
  if (empresa === 'Todas' || !mapping.empresa) return rows;
  return rows.filter(r => String(r[mapping.empresa] ?? '').trim() === empresa);
}

function applyOcultosFilter(
  rows: Record<string, unknown>[],
  mapping: Record<string, string>,
  ocultos: Set<string>,
): Record<string, unknown>[] {
  if (!ocultos.size || !mapping.funcionario) return rows;
  return rows.filter(r => !ocultos.has(String(r[mapping.funcionario] ?? '').trim()));
}

export function processVentas(
  rows: Record<string, unknown>[],
  mapping: Record<string, string>,
  empresaActiva = 'Todas',
): VentasStats {
  const hasEstado      = Boolean(mapping.estado);
  const hasBackOffice  = Boolean(mapping.backOffice);
  const hasDepartamento = Boolean(mapping.departamento);
  const hasModalidad   = Boolean(mapping.modalidad);

  // Accumulators
  interface FuncAcc {
    nombre: string; total: number; renovaciones: number; altas: number;
    cambios: number; otros: number; estados: Record<EstadoVenta, number>;
    estadosRaw: Record<string, number>; rechazos: number;
  }
  const funcMap    = new Map<string, FuncAcc>();
  const funcDiaVentas = new Map<string, Map<string, number>>(); // nombre → fecha → count
  const planMap    = new Map<string, number>();
  const fechaMap   = new Map<string, number>();
  const motivoMap  = new Map<string, number>();
  const estadoNormMap = new Map<EstadoVenta, number>();
  const estadoRawMap  = new Map<string, number>();
  const depMap     = new Map<string, { count: number; vendidos: number }>();
  const modalMap   = new Map<string, { count: number; vendidos: number }>();
  const boMap      = new Map<string, { count: number; estados: Record<string, number> }>();
  const diaVendedores = new Map<string, Set<string>>();

  for (const r of rows) {
    const nombre = String(r[mapping.funcionario] ?? '').trim();
    if (!nombre) continue;

    const motivoRaw  = mapping.motivo ? String(r[mapping.motivo] ?? '') : '';
    const tipo       = classifyMotivo(motivoRaw);
    const motivoLabel = motivoRaw.trim() || 'Sin motivo';

    const estadoRawVal = (mapping.estado ? String(r[mapping.estado] ?? '') : '').trim();
    const estadoNorm   = hasEstado ? normalizeEstado(estadoRawVal) : 'Otro';
    const esVendido    = estadoRawVal === 'VENDIDO' || estadoNorm === 'Vendido';
    const esRechazo    = estadoRawVal === 'RECHAZADO' || estadoNorm === 'Rechazo';

    // Departamento
    if (hasDepartamento) {
      const dep = String(r[mapping.departamento] ?? '').trim() || 'Sin departamento';
      const prev = depMap.get(dep) ?? { count: 0, vendidos: 0 };
      depMap.set(dep, { count: prev.count + 1, vendidos: prev.vendidos + (esVendido ? 1 : 0) });
    }

    // Modalidad
    if (hasModalidad) {
      const mod = String(r[mapping.modalidad] ?? '').trim() || 'Sin modalidad';
      const prev = modalMap.get(mod) ?? { count: 0, vendidos: 0 };
      modalMap.set(mod, { count: prev.count + 1, vendidos: prev.vendidos + (esVendido ? 1 : 0) });
    }

    // Back Office
    if (hasBackOffice) {
      const boRaw = String(r[mapping.backOffice] ?? '').trim();
      const boKey = (!boRaw || /^\s*$/.test(boRaw)) ? 'Sin asignar' : boRaw;
      const prev  = boMap.get(boKey) ?? { count: 0, estados: {} };
      const key   = estadoRawVal || 'Sin estado';
      boMap.set(boKey, { count: prev.count + 1, estados: { ...prev.estados, [key]: (prev.estados[key] ?? 0) + 1 } });
    }

    // Funcionario accumulator
    const prev = funcMap.get(nombre) ?? {
      nombre, total: 0, renovaciones: 0, altas: 0, cambios: 0, otros: 0,
      estados: { ...EMPTY_ESTADOS }, estadosRaw: {}, rechazos: 0,
    };
    const newEstadosNorm = { ...prev.estados };
    const newEstadosRaw  = { ...prev.estadosRaw };
    if (hasEstado) {
      newEstadosNorm[estadoNorm] = (newEstadosNorm[estadoNorm] ?? 0) + 1;
      if (estadoRawVal) newEstadosRaw[estadoRawVal] = (newEstadosRaw[estadoRawVal] ?? 0) + 1;
    }
    funcMap.set(nombre, {
      nombre,
      total:        prev.total + 1,
      renovaciones: prev.renovaciones + (tipo === 'renovacion' ? 1 : 0),
      altas:        prev.altas        + (tipo === 'alta'       ? 1 : 0),
      cambios:      prev.cambios      + (tipo === 'cambio'     ? 1 : 0),
      otros:        prev.otros        + (tipo === 'otro'       ? 1 : 0),
      estados:      newEstadosNorm,
      estadosRaw:   newEstadosRaw,
      rechazos:     prev.rechazos + (esRechazo ? 1 : 0),
    });

    // Plan
    if (mapping.nuevoPlan) {
      const plan = String(r[mapping.nuevoPlan] ?? '').trim();
      if (plan) planMap.set(plan, (planMap.get(plan) ?? 0) + 1);
    }

    // Fecha
    if (mapping.fecha) {
      const fechaStr = normalizeFechaVenta(String(r[mapping.fecha] ?? '')).substring(0, 10);
      if (fechaStr && /^\d{4}-\d{2}-\d{2}$/.test(fechaStr)) {
        fechaMap.set(fechaStr, (fechaMap.get(fechaStr) ?? 0) + 1);
        if (!funcDiaVentas.has(nombre)) funcDiaVentas.set(nombre, new Map());
        const dv = funcDiaVentas.get(nombre)!;
        dv.set(fechaStr, (dv.get(fechaStr) ?? 0) + 1);
        if (!diaVendedores.has(fechaStr)) diaVendedores.set(fechaStr, new Set());
        diaVendedores.get(fechaStr)!.add(nombre);
      }
    }

    // Motivo
    motivoMap.set(motivoLabel, (motivoMap.get(motivoLabel) ?? 0) + 1);

    // Estado maps
    if (hasEstado) {
      estadoNormMap.set(estadoNorm, (estadoNormMap.get(estadoNorm) ?? 0) + 1);
      if (estadoRawVal) estadoRawMap.set(estadoRawVal, (estadoRawMap.get(estadoRawVal) ?? 0) + 1);
    }
  }

  // Build byFuncionario with derived fields
  const byFuncionario: FuncionarioStat[] = Array.from(funcMap.values()).map(f => {
    const diaMap = funcDiaVentas.get(f.nombre);
    const diasActivos = diaMap?.size ?? 0;
    const ventasPorDia: FuncionarioDia[] = [];
    let diaMasProductivo: { fecha: string; ventas: number } | null = null;

    if (diaMap && diaMap.size > 0) {
      let acum = 0;
      let maxV = 0;
      const sorted = [...diaMap.entries()].sort(([a], [b]) => a.localeCompare(b));
      for (const [fecha, ventas] of sorted) {
        acum += ventas;
        ventasPorDia.push({ fecha, ventas, acumulado: acum });
        if (ventas > maxV) { maxV = ventas; diaMasProductivo = { fecha, ventas }; }
      }
    }
    return {
      ...f, diasActivos, ventasPorDia,
      promVentasDia: diasActivos > 0 ? f.total / diasActivos : 0,
      diaMasProductivo,
    };
  }).sort((a, b) => b.total - a.total);

  // byDia: team daily metrics, sorted desc
  const byDia: DiaStat[] = [...diaVendedores.entries()]
    .map(([fecha, vendSet]) => {
      const ventas = fechaMap.get(fecha) ?? 0;
      const vActivos = vendSet.size;
      return { fecha, vendedoresActivos: vActivos, ventas, promVendedor: vActivos > 0 ? ventas / vActivos : 0 };
    })
    .sort((a, b) => b.fecha.localeCompare(a.fecha));

  const promedioEquipoDia = byDia.length > 0
    ? byDia.reduce((s, d) => s + d.promVendedor, 0) / byDia.length : 0;

  const byPlan    = Array.from(planMap.entries()).map(([nombre, ventas]) => ({ nombre, ventas })).sort((a, b) => b.ventas - a.ventas);
  const byFecha   = Array.from(fechaMap.entries()).map(([fecha, ventas]) => ({ fecha, ventas })).sort((a, b) => a.fecha.localeCompare(b.fecha));
  const byMotivo  = Array.from(motivoMap.entries()).map(([motivo, count]) => ({ motivo, count })).sort((a, b) => b.count - a.count);
  const byEstado  = Array.from(estadoNormMap.entries()).map(([estado, count]) => ({ estado, count })).sort((a, b) => b.count - a.count);
  const byEstadoRaw = Array.from(estadoRawMap.entries()).map(([estado, count]) => ({ estado, count })).sort((a, b) => b.count - a.count);
  const byDepartamento = Array.from(depMap.entries()).map(([departamento, v]) => ({ departamento, ...v })).sort((a, b) => b.count - a.count);
  const byModalidad    = Array.from(modalMap.entries()).map(([modalidad, v]) => ({ modalidad, ...v })).sort((a, b) => b.count - a.count);
  const byBackOffice   = Array.from(boMap.entries())
    .map(([nombre, v]) => ({ nombre, ...v }))
    .sort((a, b) => (a.nombre === 'Sin asignar' ? 1 : b.nombre === 'Sin asignar' ? -1 : b.count - a.count));

  const total        = byFuncionario.reduce((s, f) => s + f.total, 0);
  const renovaciones = byFuncionario.reduce((s, f) => s + f.renovaciones, 0);
  const altas        = byFuncionario.reduce((s, f) => s + f.altas, 0);
  const cambios      = byFuncionario.reduce((s, f) => s + f.cambios, 0);
  const promedio     = byFuncionario.length > 0 ? Math.round(total / byFuncionario.length) : 0;
  const mejor        = byFuncionario[0]?.nombre ?? '—';
  const fechas       = [...fechaMap.keys()].sort();
  const sinBackOffice = boMap.get('Sin asignar')?.count ?? 0;
  const totalRechazos = byFuncionario.reduce((s, f) => s + f.rechazos, 0);
  const tasaRechazoEquipo = hasEstado && total > 0 ? (totalRechazos / total) * 100 : null;

  let estadoKpis: EstadoKpis | null = null;
  if (hasEstado) {
    const vendido = estadoNormMap.get('Vendido') ?? 0;
    const rechazo = estadoNormMap.get('Rechazo') ?? 0;
    estadoKpis = {
      vendido,  vendidoPct: total > 0 ? Math.round((vendido / total) * 100) : 0,
      control:  estadoNormMap.get('Control Antel') ?? 0,
      activar:  estadoNormMap.get('Activar') ?? 0,
      rechazo,  rechazoPct: total > 0 ? Math.round((rechazo / total) * 100) : 0,
    };
  }

  return {
    byFuncionario, byPlan, byFecha, byMotivo, byEstado, byEstadoRaw,
    byDepartamento, byModalidad, byBackOffice, byDia,
    total, renovaciones, altas, cambios, promedio, mejor,
    diasConDatos:    fechaMap.size,
    planesDistintos: planMap.size,
    fechaMin: fechas[0] ?? '',
    fechaMax: fechas[fechas.length - 1] ?? '',
    totalVendedores: byFuncionario.length,
    hasEstado, hasBackOffice, hasDepartamento, hasModalidad,
    estadoKpis, sinBackOffice, tasaRechazoEquipo, promedioEquipoDia,
    empresaActiva,
  };
}

// ── UI helpers ────────────────────────────────────────────────────────────────

function formatFecha(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

interface EmpresaTabsProps {
  empresas: { nombre: string; count: number }[];
  active: string;
  onChange: (e: string) => void;
}
function EmpresaTabs({ empresas, active, onChange }: EmpresaTabsProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Filtrar por empresa</div>
      <div className="flex flex-wrap gap-2">
        {empresas.map(e => {
          const isActive = e.nombre === active;
          return (
            <button key={e.nombre} onClick={() => onChange(e.nombre)} style={{
              padding: '6px 18px', borderRadius: 20, fontSize: 13, fontWeight: 500,
              border: '1.5px solid #003DA5',
              background: isActive ? '#003DA5' : '#fff',
              color: isActive ? '#fff' : '#003DA5',
              cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap',
            }}>
              {e.nombre}
              <span style={{ marginLeft: 6, fontSize: 11, opacity: 0.75, fontWeight: 400 }}>
                ({e.count.toLocaleString()})
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Sección per-vendedor (Mejora 3) ───────────────────────────────────────────
function VendedorActivoSection({ vendedor }: { vendedor: FuncionarioStat }) {
  return (
    <div className="bg-white rounded-xl border border-[#003DA5] border-l-4 p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-bold text-gray-900">{vendedor.nombre}</h3>
          <span className="text-xs text-gray-400">Actividad individual</span>
        </div>
        <div className="flex gap-4">
          <div className="text-center">
            <div className="text-lg font-bold text-[#003DA5]">
              {vendedor.promVentasDia.toFixed(1)}
            </div>
            <div className="text-[10px] text-gray-400 uppercase tracking-wide">ventas/día</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-gray-800">{vendedor.diasActivos}</div>
            <div className="text-[10px] text-gray-400 uppercase tracking-wide">días activos</div>
          </div>
          {vendedor.diaMasProductivo && (
            <div className="text-center">
              <div className="text-lg font-bold text-green-700">
                {formatFecha(vendedor.diaMasProductivo.fecha).slice(0, 5)} · {vendedor.diaMasProductivo.ventas}
              </div>
              <div className="text-[10px] text-gray-400 uppercase tracking-wide">mejor día</div>
            </div>
          )}
        </div>
      </div>
      {vendedor.ventasPorDia.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Fecha</th>
                <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500">Ventas ese día</th>
                <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500">Acumulado</th>
              </tr>
            </thead>
            <tbody>
              {[...vendedor.ventasPorDia].reverse().map(d => (
                <tr key={d.fecha} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-3 py-1.5 text-gray-700 font-mono text-xs">{formatFecha(d.fecha)}</td>
                  <td className="px-3 py-1.5 text-right font-bold text-[#003DA5]">{d.ventas}</td>
                  <td className="px-3 py-1.5 text-right text-gray-500">{d.acumulado}</td>
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

export default function VentasModule() {
  const { config } = useConfig();
  const { ventas: storeEntry, setVentas: saveToStore, clearVentas } = useAnalisisStore();

  const [stage, setStage]       = useState<Stage>(() => storeEntry ? 'analysis' : 'upload');
  const [parsed, setParsed]     = useState<ParseResult | null>(() => storeEntry?.parsed ?? null);
  const [mapping, setMapping]   = useState<Record<string, string>>(() => storeEntry?.mapping ?? {});
  const [empresas, setEmpresas] = useState<{ nombre: string; count: number }[]>(() => storeEntry?.empresas ?? []);
  const [empresaActiva, setEmpresaActiva] = useState(() => storeEntry?.empresaActiva ?? 'Todas');
  const [stats, setStats]       = useState<VentasStats | null>(() => storeEntry?.data ?? null);
  const [error, setError]       = useState('');
  const [sessionKey, setSessionKey] = useState(0);
  const [vendedoresOcultos, setVendedoresOcultos] = useState<Set<string>>(loadOcultos);
  const [vendedorActivo, setVendedorActivo]       = useState<string | null>(null);
  const [showPDFModal, setShowPDFModal]           = useState(false);
  const [filtroPeriodo, setFiltroPeriodo]         = useState<FiltroState>(loadFiltroPeriodo);
  const [mesSeleccionado, setMesSeleccionado]     = useState<string | null>(null);
  const initDoneRef = useRef(false);

  // Detección del mes predominante y todos los meses presentes en el archivo
  const { mesPredominante, mesesDisponibles } = useMemo(() => {
    if (!parsed || !mapping.fecha) return { mesPredominante: null, mesesDisponibles: [] };
    const mesesMap = new Map<string, number>();
    for (const r of parsed.rows) {
      const f = normalizeFechaVenta(String(r[mapping.fecha] ?? '')).substring(0, 7);
      if (f && /^\d{4}-\d{2}$/.test(f)) mesesMap.set(f, (mesesMap.get(f) ?? 0) + 1);
    }
    if (mesesMap.size === 0) return { mesPredominante: null, mesesDisponibles: [] };
    const entries = [...mesesMap.entries()].sort((a, b) => b[1] - a[1]);
    return {
      mesPredominante: entries[0][0],
      mesesDisponibles: entries.map(e => e[0]).sort(),
    };
  }, [parsed, mapping.fecha]);

  // Inicializar mesSeleccionado cuando se carga un nuevo archivo
  useEffect(() => {
    if (mesPredominante && !mesSeleccionado) setMesSeleccionado(mesPredominante);
  }, [mesPredominante]); // eslint-disable-line react-hooks/exhaustive-deps

  // Al restaurar desde store: re-aplicar filtro de sessionStorage si existe
  useEffect(() => {
    if (initDoneRef.current || !parsed || stage !== 'analysis' || !filtroPeriodo.desde) return;
    initDoneRef.current = true;
    const s = processVentas(
      getRows(parsed.rows, empresaActiva, vendedoresOcultos, filtroPeriodo),
      mapping,
      empresaActiva,
    );
    setStats(s);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, parsed]);

  const getRows = useCallback((
    allRows: Record<string, unknown>[],
    emp: string,
    ocultos: Set<string>,
    filtro: FiltroState,
  ) => {
    let rows = getFilteredRows(allRows, mapping, emp);
    rows = applyOcultosFilter(rows, mapping, ocultos);
    return applyPeriodFilter(rows, mapping, filtro);
  }, [mapping]);

  const handleFile = useCallback(async (file: File) => {
    setError(''); setStage('loading');
    clearVentas();
    setSessionKey(k => k + 1);
    setFiltroPeriodo({ desde: null, hasta: null, label: null });
    setMesSeleccionado(null);
    saveFiltroPeriodo({ desde: null, hasta: null, label: null });
    try {
      const result = await parseExcel(file, 'ventas');
      setParsed(result);
      setMapping(result.columnMap);
      setStage('mapping');
    } catch (e) {
      setError((e as Error).message);
      setStage('upload');
    }
  }, [clearVentas]);

  const handleConfirm = useCallback(() => {
    if (!parsed) return;
    setStage('loading');
    setTimeout(() => {
      const empList = getEmpresas(parsed.rows, mapping);
      setEmpresas(empList);
      const defaultEmpresa = empList.length > 1 ? empList[1].nombre : 'Todas';
      setEmpresaActiva(defaultEmpresa);
      const s = processVentas(getRows(parsed.rows, defaultEmpresa, vendedoresOcultos, filtroPeriodo), mapping, defaultEmpresa);
      setStats(s);
      recordActivity('ventas', parsed.fileName);
      saveToStore({ data: s, parsed, mapping, empresas: empList, empresaActiva: defaultEmpresa, nombreArchivo: parsed.fileName });
      setStage('analysis');
    }, 300);
  }, [parsed, mapping, vendedoresOcultos, filtroPeriodo, getRows, saveToStore]);

  const handleEmpresaChange = useCallback((empresa: string) => {
    if (!parsed) return;
    setEmpresaActiva(empresa);
    setVendedorActivo(null);
    const s = processVentas(getRows(parsed.rows, empresa, vendedoresOcultos, filtroPeriodo), mapping, empresa);
    setStats(s);
    saveToStore({ data: s, parsed, mapping, empresas, empresaActiva: empresa, nombreArchivo: parsed.fileName });
  }, [parsed, mapping, empresas, vendedoresOcultos, filtroPeriodo, getRows, saveToStore]);

  const handleHideVendedor = useCallback((nombre: string) => {
    if (!parsed) return;
    const next = new Set(vendedoresOcultos);
    next.add(nombre);
    setVendedoresOcultos(next);
    saveOcultos(next);
    if (vendedorActivo === nombre) setVendedorActivo(null);
    const s = processVentas(getRows(parsed.rows, empresaActiva, next, filtroPeriodo), mapping, empresaActiva);
    setStats(s);
    saveToStore({ data: s, parsed, mapping, empresas, empresaActiva, nombreArchivo: parsed.fileName });
  }, [parsed, mapping, empresas, empresaActiva, vendedoresOcultos, vendedorActivo, filtroPeriodo, getRows, saveToStore]);

  const handleShowAll = useCallback(() => {
    if (!parsed) return;
    const next = new Set<string>();
    setVendedoresOcultos(next);
    saveOcultos(next);
    const s = processVentas(getRows(parsed.rows, empresaActiva, next, filtroPeriodo), mapping, empresaActiva);
    setStats(s);
    saveToStore({ data: s, parsed, mapping, empresas, empresaActiva, nombreArchivo: parsed.fileName });
  }, [parsed, mapping, empresas, empresaActiva, filtroPeriodo, getRows, saveToStore]);

  const handleFiltroPeriodo = useCallback((nuevo: FiltroState) => {
    if (!parsed) return;
    setFiltroPeriodo(nuevo);
    saveFiltroPeriodo(nuevo);
    const s = processVentas(
      getRows(parsed.rows, empresaActiva, vendedoresOcultos, nuevo),
      mapping,
      empresaActiva,
    );
    setStats(s);
    saveToStore({ data: s, parsed, mapping, empresas, empresaActiva, nombreArchivo: parsed.fileName });
  }, [parsed, mapping, empresas, empresaActiva, vendedoresOcultos, getRows, saveToStore]);

  const handleMesChange = useCallback((mes: string) => {
    setMesSeleccionado(mes);
    if (!filtroPeriodo.desde) return;
    const limpio: FiltroState = { desde: null, hasta: null, label: null };
    setFiltroPeriodo(limpio);
    saveFiltroPeriodo(limpio);
    if (!parsed) return;
    const s = processVentas(
      getRows(parsed.rows, empresaActiva, vendedoresOcultos, limpio),
      mapping,
      empresaActiva,
    );
    setStats(s);
    saveToStore({ data: s, parsed, mapping, empresas, empresaActiva, nombreArchivo: parsed.fileName });
  }, [filtroPeriodo, parsed, mapping, empresas, empresaActiva, vendedoresOcultos, getRows, saveToStore]);

  const handleExport = useCallback(() => {
    if (!stats) return;
    exportVentasPptx(stats, config, empresaActiva);
  }, [stats, config, empresaActiva]);

  const handleExportExcel = useCallback(() => {
    if (!stats) return;
    exportVentasExcel(stats, empresaActiva);
  }, [stats, empresaActiva]);

  const reset = () => {
    clearVentas();
    setSessionKey(k => k + 1);
    setStage('upload'); setParsed(null); setStats(null);
    setEmpresas([]); setEmpresaActiva('Todas'); setError('');
    setVendedorActivo(null);
    const limpio: FiltroState = { desde: null, hasta: null, label: null };
    setFiltroPeriodo(limpio);
    setMesSeleccionado(null);
    saveFiltroPeriodo(limpio);
    initDoneRef.current = false;
  };

  // Total sin filtro de período (empresa+ocultos aplicados, período no)
  const totalSinFiltro = useMemo(() => {
    if (!parsed || stage !== 'analysis') return stats?.total ?? 0;
    return getRows(parsed.rows, empresaActiva, vendedoresOcultos, { desde: null, hasta: null, label: null }).length;
  }, [parsed, empresaActiva, vendedoresOcultos, getRows, stage]);

  const subtitle = useMemo(() => {
    if (!stats) return 'Análisis de rendimiento de vendedores';
    if (filtroPeriodo.desde && filtroPeriodo.hasta) {
      const dd = (iso: string) => { const [, m, d] = iso.split('-'); return `${d}/${m}`; };
      const rangoStr = filtroPeriodo.label
        ? `${filtroPeriodo.label}: ${dd(filtroPeriodo.desde)} – ${dd(filtroPeriodo.hasta)}`
        : `${formatFecha(filtroPeriodo.desde)} – ${formatFecha(filtroPeriodo.hasta)}`;
      const base = `${stats.total.toLocaleString()} de ${totalSinFiltro.toLocaleString()} registros · ${rangoStr}`;
      return storeEntry ? `${base} · ${storeEntry.nombreArchivo}` : base;
    }
    if (!stats.fechaMin) return 'Análisis de rendimiento de vendedores';
    const base = `${stats.total.toLocaleString()} registros · ${formatFecha(stats.fechaMin)} – ${formatFecha(stats.fechaMax)}`;
    return storeEntry ? `${base} · ${storeEntry.nombreArchivo} · ${formatFechaCarga(storeEntry.fechaCarga)}` : base;
  }, [stats, storeEntry, filtroPeriodo, totalSinFiltro]);

  const vendedorData = vendedorActivo ? (stats?.byFuncionario.find(f => f.nombre === vendedorActivo) ?? null) : null;

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Módulo Ventas"
        subtitle={subtitle}
        actions={
          stage === 'analysis' && stats ? (
            <div className="flex gap-2">
              <button onClick={reset} className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
                Cargar otro archivo
              </button>
              <button onClick={handleExport}
                className="flex items-center gap-2 px-4 py-1.5 text-sm text-white rounded-lg hover:opacity-90"
                style={{ background: '#C43B1C' }}>
                <Download size={15} /> PowerPoint
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
              <div className="inline-flex bg-blue-50 rounded-full p-4 mb-4">
                <BarChart2 size={36} className="text-[#003DA5]" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Análisis de Ventas</h2>
              <p className="text-gray-500 mt-2 text-sm">
                Cargá un archivo Excel o CSV con datos de ventas. Se detectan columnas automáticamente.
              </p>
            </div>
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
            )}
            <FileUploader onFile={handleFile} />
          </div>
        )}

        {/* ── LOADING ── */}
        {stage === 'loading' && (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <Loader2 size={36} className="animate-spin text-[#003DA5] mx-auto mb-3" />
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
              fields={VENTAS_FIELDS}
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
          <div id="ventas-content" key={sessionKey} className="space-y-6">

            {/* 1. KPI Cards — fila 1: totales por motivo */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KPICard label="Total Ventas"    value={stats.total.toLocaleString()}       icon={BarChart2}    color="blue"  />
              <KPICard label="Renovaciones"    value={stats.renovaciones.toLocaleString()} icon={Repeat}       color="green" />
              <KPICard label="Altas"           value={stats.altas.toLocaleString()}        icon={ArrowUpRight} color="blue"  />
              <KPICard label="Cambios de Plan" value={stats.cambios.toLocaleString()}      icon={Layers}       color="amber" />
            </div>

            {/* KPI Cards — fila 2: estado + métricas adicionales */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {stats.hasEstado && stats.estadoKpis && (
                <>
                  <KPICard size="small" color="green" icon={CheckCircle}
                    label="Vendidos"
                    value={`${stats.estadoKpis.vendido.toLocaleString()} (${stats.estadoKpis.vendidoPct}%)`} />
                  <KPICard size="small" color="red" icon={XCircle}
                    label="Rechazos"
                    value={stats.tasaRechazoEquipo !== null
                      ? `${stats.estadoKpis.rechazo} (${stats.tasaRechazoEquipo.toFixed(1)}%)`
                      : stats.estadoKpis.rechazo.toLocaleString()} />
                </>
              )}
              {stats.byDia.length > 0 && (
                <KPICard size="small" color="blue" icon={Calendar}
                  label="Prom. equipo/día"
                  value={`${stats.promedioEquipoDia.toFixed(1)} v/vend/día`} />
              )}
              {stats.hasBackOffice && stats.sinBackOffice > 0 && (
                <KPICard size="small" color="amber" icon={Users}
                  label="Sin Back Office"
                  value={stats.sinBackOffice.toLocaleString()} />
              )}
              {!stats.hasEstado && (
                <>
                  <KPICard size="small" label="Mejor Vendedor"      value={stats.mejor}                     icon={Users}     color="blue" />
                  <KPICard size="small" label="Promedio / Vendedor"  value={stats.promedio.toLocaleString()}  icon={BarChart2} color="gray" />
                  <KPICard size="small" label="Días con Datos"       value={stats.diasConDatos}               icon={Calendar}  color="gray" />
                  <KPICard size="small" label="Planes Distintos"     value={stats.planesDistintos}            icon={Layers}    color="gray" />
                </>
              )}
            </div>

            {/* 2. Empresa tabs + controles */}
            <EmpresaTabs empresas={empresas} active={empresaActiva} onChange={handleEmpresaChange} />

            {/* Filtro de período */}
            <FiltroPeriodo
              filtro={filtroPeriodo}
              onChange={handleFiltroPeriodo}
              mesSeleccionado={mesSeleccionado}
              onMesChange={handleMesChange}
              mesesDisponibles={mesesDisponibles}
              totalVentas={stats.total}
              totalSinFiltro={totalSinFiltro}
            />

            {/* Controls bar */}
            <div className="flex items-center gap-3 flex-wrap bg-white rounded-xl border border-gray-200 px-4 py-3">
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Vendedor:</label>
                <select
                  value={vendedorActivo ?? ''}
                  onChange={e => setVendedorActivo(e.target.value || null)}
                  className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#003DA5]"
                >
                  <option value="">Todos</option>
                  {stats.byFuncionario.map(f => (
                    <option key={f.nombre} value={f.nombre}>{f.nombre}</option>
                  ))}
                </select>
              </div>
              {vendedoresOcultos.size > 0 && (
                <button
                  onClick={handleShowAll}
                  className="flex items-center gap-1.5 text-xs text-orange-600 hover:text-orange-800 font-medium border border-orange-300 rounded-lg px-3 py-1.5 hover:bg-orange-50"
                >
                  <EyeOff size={12} />
                  {vendedoresOcultos.size} vendedor{vendedoresOcultos.size > 1 ? 'es' : ''} oculto{vendedoresOcultos.size > 1 ? 's' : ''} · Mostrar todos
                </button>
              )}
              <div className="ml-auto text-xs text-gray-400">
                {stats.totalVendedores} vendedores · {stats.diasConDatos} días
              </div>
            </div>

            {/* Per-vendedor section (Mejora 3) */}
            {vendedorActivo && vendedorData && (
              <VendedorActivoSection vendedor={vendedorData} />
            )}

            {/* 3–10. Gráficos */}
            <VentasCharts
              stats={stats}
              vendedoresOcultos={vendedoresOcultos}
              onHideVendedor={handleHideVendedor}
              vendedorActivo={vendedorActivo}
            />

            {/* 11. Tabla performance */}
            <VentasPerformanceTable stats={stats} onHideVendedor={handleHideVendedor} />

            {/* 12. Evolución temporal */}
            {stats.byFecha.length > 1 && (
              <TemporalChart
                key={`temporal-${stats.byFecha.length}-${stats.fechaMin}-${stats.fechaMax}`}
                stats={stats}
              />
            )}

          </div>
        )}
      </div>
      {showPDFModal && (
        <PDFModal
          elementId="ventas-content"
          titulo="Ventas"
          nombreArchivo={`Ventas_${new Date().toLocaleDateString('es-UY').replace(/\//g, '-')}`}
          onClose={() => setShowPDFModal(false)}
          personaElementId={vendedorActivo ? `ventas-vendedor-${vendedorActivo}` : undefined}
          personaNombre={vendedorActivo ?? undefined}
        />
      )}
    </div>
  );
}
