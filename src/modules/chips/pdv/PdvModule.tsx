import React, { useState, useMemo, useCallback } from 'react';
import {
  MapPin, Clock, AlertTriangle, TrendingUp,
  FileSpreadsheet, Download, RefreshCw,
  ChevronDown, ChevronRight, Upload, Loader2,
} from 'lucide-react';
import KPICard from '../../../components/KPICard';
import FileUploader from '../../../components/FileUploader';
import { parsePdv, type PdvData } from './pdvParser';
import {
  getDistribucionChiperos, getEstadosPdv,
  getAlertaInactividad, getAlertaVencimiento,
  getRendimientoChiperos, getNuevosPuntos,
  type PdvInactivo, type PdvVencimiento, type RendimientoRow,
} from './pdvAnalysis';
import { exportPdvExcel, exportPdvPDF, type PdvExportData } from './PdvExport';

type Stage = 'upload' | 'loading' | 'analysis';
type PeriodKey = 'todo' | 'u30' | 'u60' | 'estemes' | 'mesant' | 'custom';

// ── Helpers ───────────────────────────────────────────────────────────────────

function getRange(key: PeriodKey, desde: string, hasta: string): { desde?: Date; hasta?: Date } {
  const hoy = new Date();
  if (key === 'todo') return {};
  if (key === 'u30') { const d = new Date(hoy); d.setDate(d.getDate() - 30); return { desde: d, hasta: hoy }; }
  if (key === 'u60') { const d = new Date(hoy); d.setDate(d.getDate() - 60); return { desde: d, hasta: hoy }; }
  if (key === 'estemes') return { desde: new Date(hoy.getFullYear(), hoy.getMonth(), 1), hasta: hoy };
  if (key === 'mesant') {
    return { desde: new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1), hasta: new Date(hoy.getFullYear(), hoy.getMonth(), 0) };
  }
  if (key === 'custom') {
    return { desde: desde ? new Date(desde) : undefined, hasta: hasta ? new Date(hasta) : undefined };
  }
  return {};
}

function formatMes(mes: string): string {
  if (!mes) return '';
  const [y, m] = mes.split('-');
  const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  return `${meses[parseInt(m) - 1] ?? m} ${y}`;
}

const ESTADO_COLORS: Record<string, string> = {
  'Visitado': '#28a745',
  'Visita permanente': '#003DA5',
  'Visita de autor': '#17a2b8',
  'Pendiente': '#fd7e14',
  'Actualizar datos': '#E3000F',
  'Visita de autor suprimida': '#6c757d',
};

function EstadoBadge({ estado }: { estado: string }) {
  const color = ESTADO_COLORS[estado] ?? '#6c757d';
  return (
    <span className="inline-block px-2 py-0.5 rounded text-white text-xs font-semibold whitespace-nowrap"
      style={{ background: color }}>{estado}</span>
  );
}

function InacBadge({ dias }: { dias: number }) {
  const [bg, label] =
    dias >= 180 ? ['#7b0000', 'Crítico'] :
    dias >= 90  ? ['#E3000F', `${dias}d`] :
                  ['#fd7e14', `${dias}d`];
  return <span className="inline-block px-2 py-0.5 rounded text-white text-xs font-bold" style={{ background: bg }}>{label}</span>;
}

function VencBadge({ dias }: { dias: number }) {
  const [bg, label] =
    dias <= 7  ? ['#E3000F', 'Urgente'] :
    dias <= 15 ? ['#fd7e14', 'Pronto'] :
                 ['#ffc107', 'Atención'];
  const textColor = dias <= 15 ? '#fff' : '#212529';
  return <span className="inline-block px-2 py-0.5 rounded text-xs font-bold" style={{ background: bg, color: textColor }}>{label}</span>;
}

function RendBadge({ prom }: { prom: number }) {
  const [bg, label] =
    prom >= 10 ? ['#28a745', 'Alto'] :
    prom >= 6  ? ['#003DA5', 'Normal'] :
                 ['#fd7e14', 'Bajo'];
  return <span className="inline-block px-2 py-0.5 rounded text-white text-xs font-bold" style={{ background: bg }}>{label}</span>;
}

// ── Section wrapper — same visual as ChipsModule sections ─────────────────────

function SectionCard({ title, badge, children }: { title: string; badge?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100">
        <h2 className="font-semibold text-gray-800">
          {title}
          {badge && <span className="ml-2 text-sm font-normal text-gray-400">{badge}</span>}
        </h2>
      </div>
      <div className="p-5">
        {children}
      </div>
    </div>
  );
}

// ── Table header / cell style helpers ─────────────────────────────────────────

const TH = 'px-3 py-2.5 text-left text-xs font-semibold text-white bg-[#003DA5] whitespace-nowrap';
const TD = 'px-3 py-2 text-sm border-b border-gray-100';

function Pagination({ page, total, perPage, onChange }: { page: number; total: number; perPage: number; onChange: (p: number) => void }) {
  const pages = Math.ceil(total / perPage);
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-end gap-1 mt-3 text-sm">
      <button onClick={() => onChange(Math.max(1, page - 1))} disabled={page === 1}
        className="px-3 py-1 border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-40">‹</button>
      <span className="px-3 py-1 text-gray-500">{page} / {pages}</span>
      <button onClick={() => onChange(Math.min(pages, page + 1))} disabled={page === pages}
        className="px-3 py-1 border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-40">›</button>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

// PdvModule renders INSIDE ChipsModule's flex-1 overflow-y-auto p-6 scrollable area.
// It does NOT have its own outer container — it just returns content.

export default function PdvModule() {
  const [stage, setStage] = useState<Stage>('upload');
  const [data, setData] = useState<PdvData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [periodKey, setPeriodKey] = useState<PeriodKey>('todo');
  const [desdeStr, setDesdeStr] = useState('');
  const [hastaStr, setHastaStr] = useState('');

  const [inacSearch, setInacSearch] = useState('');
  const [inacDist, setInacDist] = useState('Todos');
  const [inacPage, setInacPage] = useState(1);

  const [vencTab, setVencTab] = useState<'porVencer' | 'yaVencidos'>('porVencer');
  const [vencPage, setVencPage] = useState(1);

  const [expandedRend, setExpandedRend] = useState<Set<string>>(new Set());

  const PER_PAGE = 20;
  const hoy = useMemo(() => new Date(), []);
  const range = useMemo(() => getRange(periodKey, desdeStr, hastaStr), [periodKey, desdeStr, hastaStr]);

  const distribucion = useMemo(() => data ? getDistribucionChiperos(data.rows) : [], [data]);
  const estados      = useMemo(() => data ? getEstadosPdv(data.rows) : [], [data]);
  const inactividad  = useMemo(() => data ? getAlertaInactividad(data.rows, hoy) : null, [data, hoy]);
  const vencimiento  = useMemo(() => data ? getAlertaVencimiento(data.rows, hoy) : null, [data, hoy]);
  const rendimiento  = useMemo(() => data ? getRendimientoChiperos(data.rows) : [], [data]);
  const nuevosPuntos = useMemo(() => data ? getNuevosPuntos(data.rows, range.desde, range.hasta) : null, [data, range]);

  const nuevosEsteMes = useMemo(() => {
    if (!data) return 0;
    const hoyDate = new Date();
    const mesKey = `${hoyDate.getFullYear()}-${String(hoyDate.getMonth() + 1).padStart(2, '0')}`;
    return getNuevosPuntos(data.rows).porMes.find(m => m.mes === mesKey)?.cantidad ?? 0;
  }, [data]);

  const inacFiltered = useMemo(() => {
    if (!inactividad) return [];
    return inactividad.puntos.filter(p => {
      const matchSearch = !inacSearch
        || p.nombre.toLowerCase().includes(inacSearch.toLowerCase())
        || p.distribuidor.toLowerCase().includes(inacSearch.toLowerCase());
      return matchSearch && (inacDist === 'Todos' || p.distribuidor === inacDist);
    });
  }, [inactividad, inacSearch, inacDist]);

  const inacPaged = useMemo(() => inacFiltered.slice((inacPage - 1) * PER_PAGE, inacPage * PER_PAGE), [inacFiltered, inacPage]);
  const vencList  = useMemo(() => vencimiento ? (vencTab === 'porVencer' ? vencimiento.porVencer.puntos : vencimiento.yaVencidos.puntos) : [], [vencimiento, vencTab]);
  const vencPaged = useMemo(() => vencList.slice((vencPage - 1) * PER_PAGE, vencPage * PER_PAGE), [vencList, vencPage]);

  const inacTop10    = useMemo(() => inactividad?.porDistribuidor.slice(0, 10) ?? [], [inactividad]);
  const inacTop10Max = inacTop10[0]?.cantidad ?? 1;

  const npMeses = useMemo(() => nuevosPuntos?.porMes ?? [], [nuevosPuntos]);
  const npMax   = useMemo(() => Math.max(1, ...npMeses.map(m => m.cantidad)), [npMeses]);

  const exportData = useMemo((): PdvExportData | null => {
    if (!inactividad || !vencimiento || !nuevosPuntos) return null;
    return { distribucion, estados, inactividad, vencimiento, rendimiento, nuevosPuntos };
  }, [distribucion, estados, inactividad, vencimiento, rendimiento, nuevosPuntos]);

  const handleFile = useCallback(async (file: File) => {
    setStage('loading');
    setError(null);
    try {
      const parsed = await parsePdv(file);
      setData(parsed);
      setStage('analysis');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al procesar el archivo');
      setStage('upload');
    }
  }, []);

  function handleReset() {
    setData(null); setStage('upload'); setError(null);
    setInacSearch(''); setInacDist('Todos'); setInacPage(1);
    setVencPage(1); setExpandedRend(new Set()); setPeriodKey('todo');
  }

  // ── Upload stage ──────────────────────────────────────────────────────────

  if (stage === 'upload') {
    return (
      <div className="max-w-xl mx-auto">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-100 rounded-2xl mb-3">
            <Upload size={28} className="text-[#003DA5]" />
          </div>
          <h2 className="text-xl font-bold text-gray-800">Cargar CSV de Puntos de Venta</h2>
          <p className="text-sm text-gray-500 mt-1">CSV separado por <code className="bg-gray-100 px-1 rounded">;</code>, codificación latin1/windows-1252</p>
        </div>
        <FileUploader onFile={handleFile} accept=".csv" label="Arrastrá tu archivo CSV aquí" sublabel="o hacé clic para seleccionarlo" />
        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 flex items-center gap-2">
            <AlertTriangle size={16} className="flex-shrink-0" /> {error}
          </div>
        )}
      </div>
    );
  }

  // ── Loading stage ─────────────────────────────────────────────────────────

  if (stage === 'loading') {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader2 size={36} className="animate-spin text-[#003DA5] mx-auto mb-3" />
          <p className="text-gray-500">Procesando archivo...</p>
        </div>
      </div>
    );
  }

  // ── Analysis stage ────────────────────────────────────────────────────────

  if (!data || !inactividad || !vencimiento || !nuevosPuntos || !exportData) return null;

  return (
    // Same content pattern as VentasModule analysis: space-y-6 div with sections
    <div className="space-y-6">

      {/* Action bar with export buttons — mirrors VentasModule's controls bar */}
      <div className="flex items-center justify-between flex-wrap gap-3 bg-white rounded-xl border border-gray-200 px-5 py-3">
        <div>
          <span className="font-semibold text-gray-800">Punto de Venta</span>
          <span className="ml-3 text-sm text-gray-400">
            {data.total.toLocaleString()} puntos · {data.distribuidores.length} distribuidores · cargado {new Date(data.fechaCarga).toLocaleDateString('es-UY')}
          </span>
        </div>
        <div className="flex gap-2">
          <button onClick={() => exportPdvExcel(data, exportData)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors">
            <FileSpreadsheet size={15} /> Excel
          </button>
          <button onClick={() => exportPdvPDF(data, exportData)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors">
            <Download size={15} /> PDF
          </button>
          <button onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition-colors">
            <RefreshCw size={15} /> Cambiar archivo
          </button>
        </div>
      </div>

      {/* Period filter bar */}
      <div className="flex gap-2 flex-wrap items-center bg-white rounded-xl border border-gray-200 px-5 py-3">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide mr-1">Período:</span>
        {(['todo', 'u30', 'u60', 'estemes', 'mesant', 'custom'] as PeriodKey[]).map(k => {
          const labels: Record<PeriodKey, string> = { todo: 'Todo', u30: 'Últimos 30d', u60: 'Últimos 60d', estemes: 'Este mes', mesant: 'Mes anterior', custom: 'Personalizado' };
          const active = periodKey === k;
          return (
            <button key={k} onClick={() => { setPeriodKey(k); setInacPage(1); setVencPage(1); }}
              className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                active ? 'bg-[#003DA5] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}>
              {labels[k]}
            </button>
          );
        })}
        {periodKey === 'custom' && (
          <div className="flex items-center gap-2">
            <input type="date" value={desdeStr} onChange={e => setDesdeStr(e.target.value)}
              className="border border-gray-200 rounded-lg px-2 py-1 text-sm" />
            <span className="text-gray-400">—</span>
            <input type="date" value={hastaStr} onChange={e => setHastaStr(e.target.value)}
              className="border border-gray-200 rounded-lg px-2 py-1 text-sm" />
          </div>
        )}
      </div>

      {/* KPI Cards — exact same grid pattern as VentasModule */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard label="Total PdV"           value={data.total.toLocaleString()}               icon={MapPin}        color="blue"  sub={`${data.distribuidores.length} distribuidores`} />
        <KPICard label="Inactivos +60d"      value={inactividad.total.toLocaleString()}         icon={Clock}         color="red"   sub="Sin visita reciente" />
        <KPICard label="Chips por vencer 30d" value={vencimiento.porVencer.total.toLocaleString()} icon={AlertTriangle} color="amber" sub={`Ya vencidos: ${vencimiento.yaVencidos.total}`} />
        <KPICard label="Nuevos este mes"     value={nuevosEsteMes.toLocaleString()}              icon={TrendingUp}    color="green" sub={`${nuevosPuntos.totalEnRango} en rango`} />
      </div>

      {/* Section 1: Distribución por chipero */}
      <SectionCard title="Distribución por Chipero">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[400px]">
            <thead>
              <tr>
                <th className={TH}>Distribuidor</th>
                <th className={`${TH} text-right w-24`}>Puntos</th>
                <th className={`${TH} text-right w-16`}>%</th>
                <th className={`${TH} min-w-[120px]`}></th>
              </tr>
            </thead>
            <tbody>
              {distribucion.map((d, i) => (
                <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}>
                  <td className={TD}>{d.distribuidor}</td>
                  <td className={`${TD} text-right font-semibold tabular-nums`}>{d.cantidad.toLocaleString()}</td>
                  <td className={`${TD} text-right tabular-nums`}>{d.porcentaje.toFixed(1)}%</td>
                  <td className={TD}>
                    <div className="h-2 bg-gray-200 rounded-full">
                      <div className="h-2 bg-[#003DA5] rounded-full" style={{ width: `${d.porcentaje}%` }} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* Section 2: Estados de visita */}
      <SectionCard title="Estados de Visita">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[320px]">
            <thead>
              <tr>
                <th className={TH}>Estado</th>
                <th className={`${TH} text-right w-24`}>Cantidad</th>
                <th className={`${TH} text-right w-16`}>%</th>
              </tr>
            </thead>
            <tbody>
              {estados.map((e, i) => (
                <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}>
                  <td className={TD}><EstadoBadge estado={e.estado} /></td>
                  <td className={`${TD} text-right font-semibold tabular-nums`}>{e.cantidad.toLocaleString()}</td>
                  <td className={`${TD} text-right tabular-nums`}>{e.porcentaje.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* Section 3: Alerta inactividad */}
      <SectionCard title="Alerta Inactividad" badge={`${inactividad.total.toLocaleString()} puntos sin visita +60 días`}>
        {/* Filters */}
        <div className="flex gap-3 mb-4 flex-wrap">
          <input type="text" placeholder="Buscar punto o distribuidor..."
            value={inacSearch} onChange={e => { setInacSearch(e.target.value); setInacPage(1); }}
            className="flex-1 min-w-48 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#003DA5]" />
          <select value={inacDist} onChange={e => { setInacDist(e.target.value); setInacPage(1); }}
            className="max-w-[220px] border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#003DA5]">
            <option>Todos</option>
            {data.distribuidores.map(d => <option key={d}>{d}</option>)}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[540px]">
            <thead>
              <tr>
                <th className={TH}>Punto de Venta</th>
                <th className={TH}>Distribuidor</th>
                <th className={TH}>Departamento</th>
                <th className={TH}>Última Visita</th>
                <th className={`${TH} w-24`}>Inactividad</th>
              </tr>
            </thead>
            <tbody>
              {inacPaged.map((p: PdvInactivo, i: number) => (
                <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}>
                  <td className={TD}>{p.nombre}</td>
                  <td className={TD}>{p.distribuidor}</td>
                  <td className={TD}>{p.departamento}</td>
                  <td className={TD}>{p.visitadoPorDistribuidor ?? 'Nunca'}</td>
                  <td className={TD}><InacBadge dias={p.diasInactivo} /></td>
                </tr>
              ))}
              {inacPaged.length === 0 && (
                <tr><td colSpan={5} className="px-3 py-6 text-center text-sm text-gray-400">Sin resultados</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={inacPage} total={inacFiltered.length} perPage={PER_PAGE} onChange={setInacPage} />

        {/* Top 10 horizontal bar chart */}
        {inacTop10.length > 0 && (
          <div className="mt-5 w-full overflow-hidden">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Top 10 distribuidores con más inactivos</p>
            {inacTop10.map((d, i) => (
              <div key={i} className="flex items-center gap-3 mb-2 w-full">
                <div className="w-32 text-xs text-gray-600 truncate shrink-0">{d.distribuidor}</div>
                <div className="flex-1 min-w-0 h-3 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-3 bg-red-500 rounded-full" style={{ width: `${(d.cantidad / inacTop10Max) * 100}%` }} />
                </div>
                <div className="w-10 text-xs font-bold text-red-600 text-right shrink-0 tabular-nums">{d.cantidad}</div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* Section 4: Alerta vencimiento */}
      <SectionCard title="Alerta Vencimiento de Chips">
        {/* Inner tabs */}
        <div className="flex border-b border-gray-200 mb-4">
          {(['porVencer', 'yaVencidos'] as const).map(t => {
            const labels = { porVencer: `Por vencer (${vencimiento.porVencer.total})`, yaVencidos: `Ya vencidos (${vencimiento.yaVencidos.total})` };
            const active = vencTab === t;
            return (
              <button key={t} onClick={() => { setVencTab(t); setVencPage(1); }}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  active ? 'border-[#003DA5] text-[#003DA5]' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}>
                {labels[t]}
              </button>
            );
          })}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[540px]">
            <thead>
              <tr>
                <th className={TH}>Punto de Venta</th>
                <th className={TH}>Distribuidor</th>
                <th className={TH}>Departamento</th>
                <th className={TH}>Fecha Vencimiento</th>
                <th className={`${TH} w-24`}>Urgencia</th>
              </tr>
            </thead>
            <tbody>
              {vencPaged.map((p: PdvVencimiento, i: number) => (
                <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}>
                  <td className={TD}>{p.nombre}</td>
                  <td className={TD}>{p.distribuidor}</td>
                  <td className={TD}>{p.departamento}</td>
                  <td className={TD}>{p.fechaVencimientoChipMasViejo ?? '—'}</td>
                  <td className={TD}>
                    {vencTab === 'porVencer'
                      ? <VencBadge dias={p.diasParaVencer} />
                      : <span className="inline-block px-2 py-0.5 rounded text-white text-xs font-bold" style={{ background: '#7b0000' }}>Vencido {Math.abs(p.diasParaVencer)}d</span>
                    }
                  </td>
                </tr>
              ))}
              {vencPaged.length === 0 && (
                <tr><td colSpan={5} className="px-3 py-6 text-center text-sm text-gray-400">Sin registros</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={vencPage} total={vencList.length} perPage={PER_PAGE} onChange={setVencPage} />
      </SectionCard>

      {/* Section 5: Rendimiento chiperos */}
      <SectionCard title="Rendimiento por Chipero">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[500px]">
            <thead>
              <tr>
                <th className={`${TH} w-8`}></th>
                <th className={TH}>Distribuidor</th>
                <th className={`${TH} text-right w-24`}>Días Activos</th>
                <th className={`${TH} text-right w-28`}>Total Visitas</th>
                <th className={`${TH} text-right w-32`}>Prom. Visitas/Día</th>
                <th className={`${TH} w-24`}>Rendimiento</th>
              </tr>
            </thead>
            <tbody>
              {rendimiento.map((r: RendimientoRow, i: number) => {
                const expanded = expandedRend.has(r.nombre);
                return (
                  <React.Fragment key={i}>
                    <tr className={`cursor-pointer hover:bg-blue-50/40 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}`}
                      onClick={() => setExpandedRend(prev => {
                        const next = new Set(prev);
                        next.has(r.nombre) ? next.delete(r.nombre) : next.add(r.nombre);
                        return next;
                      })}>
                      <td className={`${TD} text-center text-gray-400`}>{expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</td>
                      <td className={`${TD} font-medium text-gray-800`}>{r.nombre}</td>
                      <td className={`${TD} text-right tabular-nums`}>{r.diasActivos}</td>
                      <td className={`${TD} text-right tabular-nums font-semibold`}>{r.totalVisitas.toLocaleString()}</td>
                      <td className={`${TD} text-right tabular-nums`}>{r.promedioVisitasDia.toFixed(1)}</td>
                      <td className={TD}><RendBadge prom={r.promedioVisitasDia} /></td>
                    </tr>
                    {expanded && (
                      <tr>
                        <td colSpan={6} className="bg-blue-50/20 px-4 py-2">
                          <div className="overflow-x-auto rounded-lg border border-blue-100">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="bg-blue-100/60 text-blue-900">
                                  <th className="px-3 py-2 text-left font-semibold">Fecha</th>
                                  <th className="px-3 py-2 text-right font-semibold">Visitas</th>
                                </tr>
                              </thead>
                              <tbody>
                                {r.detalleDias.map((d, j) => (
                                  <tr key={j} className="border-t border-blue-100/60 bg-white">
                                    <td className="px-3 py-1.5 text-gray-700">{d.fecha}</td>
                                    <td className="px-3 py-1.5 text-right tabular-nums">{d.visitas}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
              {rendimiento.length === 0 && (
                <tr><td colSpan={6} className="px-3 py-6 text-center text-sm text-gray-400">Sin datos de visitas</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* Section 6: Nuevos puntos */}
      <SectionCard title="Nuevos Puntos de Venta">
        {npMeses.length === 0 ? (
          <p className="text-center text-sm text-gray-400 py-4">Sin datos en el rango seleccionado</p>
        ) : (
          <>
            {/* Vertical bar chart */}
            <div className="w-full overflow-x-auto">
            <div className="flex items-end gap-1.5 pb-2 mb-5" style={{ height: 140, minWidth: 'max-content' }}>
              {npMeses.map((m, i) => (
                <div key={i} className="flex flex-col items-center gap-1 shrink-0" style={{ minWidth: 42 }}>
                  <span className="text-[10px] font-bold text-[#003DA5]">{m.cantidad}</span>
                  <div className="w-8 bg-[#003DA5] rounded-t" style={{ height: `${Math.max(4, (m.cantidad / npMax) * 80)}px` }} />
                  <span className="text-[9px] text-gray-500 mt-1" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', whiteSpace: 'nowrap' }}>
                    {formatMes(m.mes)}
                  </span>
                </div>
              ))}
            </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[320px]">
                <thead>
                  <tr>
                    <th className={TH}>Mes</th>
                    <th className={`${TH} text-right w-28`}>Nuevos PdV</th>
                    <th className={`${TH} text-right w-32`}>VS Mes Anterior</th>
                  </tr>
                </thead>
                <tbody>
                  {npMeses.map((m, i) => {
                    const prev = i > 0 ? npMeses[i - 1].cantidad : null;
                    const cambio = prev !== null && prev > 0 ? (m.cantidad - prev) / prev * 100 : null;
                    const cambioStr = cambio !== null ? `${cambio >= 0 ? '+' : ''}${cambio.toFixed(1)}%` : '—';
                    const cambioColor = cambio === null ? 'text-gray-400' : cambio >= 0 ? 'text-green-600' : 'text-red-600';
                    return (
                      <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}>
                        <td className={TD}>{formatMes(m.mes)}</td>
                        <td className={`${TD} text-right font-semibold tabular-nums`}>{m.cantidad}</td>
                        <td className={`${TD} text-right font-semibold tabular-nums ${cambioColor}`}>{cambioStr}</td>
                      </tr>
                    );
                  })}
                  <tr className="bg-blue-50 border-t-2 border-blue-200">
                    <td className="px-3 py-2 text-sm font-bold text-gray-700">Total en rango</td>
                    <td className="px-3 py-2 text-right text-sm font-bold tabular-nums">{nuevosPuntos.totalEnRango.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right text-xs text-gray-400">Prom. mensual: {nuevosPuntos.promedioMensual}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </>
        )}
      </SectionCard>

    </div>
  );
}
