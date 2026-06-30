import { useState, useMemo, useCallback } from 'react';
import {
  Upload, ChevronDown, ChevronRight, AlertTriangle,
  AlertCircle, Info, FileSpreadsheet, Download,
  RefreshCw, Package, Truck, Store, BarChart2,
} from 'lucide-react';
import Header from '../../components/Header';
import FileUploader from '../../components/FileUploader';
import { parseChips } from './chipsParser';
import type { ChipsData } from './chipsParser';
import { analyzeChips } from './chipAnalysis';
import type { ChipsAnalysis, EfectividadRow, ChiperoRow } from './chipAnalysis';
import { exportChipsExcel, exportChipsPDF } from './ChipsExport';
import { recordActivity } from '../../utils/activityTracker';
import PdvModule from './pdv/PdvModule';

type Stage = 'upload' | 'loading' | 'analysis';

const EMPRESA_ORDER = ['VOS', 'Phinternet', 'RELPONT'];

// ── Helpers ───────────────────────────────────────────────────────────────────

function pctColor(pct: number): string {
  if (pct >= 90) return '#28a745';
  if (pct >= 70) return '#003DA5';
  if (pct >= 50) return '#fd7e14';
  return '#dc3545';
}
function pctLabel(pct: number): string {
  if (pct >= 90) return 'Eficiente';
  if (pct >= 70) return 'Normal';
  if (pct >= 50) return 'Bajo';
  return 'Crítico';
}
function rendLabel(v: number): string {
  return v >= 7 ? 'Alto' : v >= 5 ? 'Normal' : 'Bajo';
}
function rendColor(v: number): string {
  return v >= 7 ? '#28a745' : v >= 5 ? '#003DA5' : '#fd7e14';
}
function fmt1(n: number): string {
  return n.toFixed(1);
}

// ── Sub-components ────────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, desglose, borderColor, icon, showDesglose,
}: {
  label: string;
  value: string | number;
  sub?: string;
  desglose?: Record<string, number>;
  borderColor: string;
  icon: React.ReactNode;
  showDesglose?: boolean;
}) {
  const displayValue = typeof value === 'number' ? value.toLocaleString() : value;
  const desgloseText = showDesglose && desglose
    ? Object.entries(desglose)
        .filter(([, n]) => n > 0)
        .sort((a, b) => {
          const ia = EMPRESA_ORDER.indexOf(a[0]);
          const ib = EMPRESA_ORDER.indexOf(b[0]);
          return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
        })
        .map(([e, n]) => `${e}: ${n.toLocaleString()}`)
        .join(' · ')
    : null;

  return (
    <div className="bg-white rounded-xl p-5 shadow-sm flex flex-col gap-1" style={{ borderTop: `4px solid ${borderColor}` }}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide leading-tight">{label}</span>
        <span style={{ color: borderColor }}>{icon}</span>
      </div>
      <div className="text-3xl font-bold text-gray-900 tabular-nums">{displayValue}</div>
      {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
      {desgloseText && (
        <div className="text-[11px] text-gray-500 mt-1.5 font-medium border-t border-gray-100 pt-1.5">
          {desgloseText}
        </div>
      )}
    </div>
  );
}

function EmpresaTabs({ empresas, tabCounts, active, onChange }: {
  empresas: string[]; tabCounts: Record<string, number>; active: string; onChange: (e: string) => void;
}) {
  const tabs = useMemo(() => {
    const known = ['Todas', ...EMPRESA_ORDER.filter(e => empresas.includes(e))];
    const extra = empresas.filter(e => !EMPRESA_ORDER.includes(e));
    return [...known, ...extra];
  }, [empresas]);

  return (
    <div className="flex gap-1.5 flex-wrap">
      {tabs.map(tab => (
        <button key={tab} onClick={() => onChange(tab)}
          className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
            active === tab
              ? 'bg-[#003DA5] text-white shadow-sm'
              : 'bg-white text-gray-600 border border-gray-200 hover:border-[#003DA5] hover:text-[#003DA5]'
          }`}
        >
          {tab}
          {tabCounts[tab] !== undefined && (
            <span className={`ml-1.5 text-xs ${active === tab ? 'text-blue-200' : 'text-gray-400'}`}>
              ({(tabCounts[tab] ?? 0).toLocaleString()})
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

function AlertasSection({ alertas }: { alertas: ChipsAnalysis['alertas'] }) {
  if (!alertas.length) return null;
  const cfg = {
    critico:    { bg: '#FEF2F2', border: '#dc3545', text: '#991b1b', Icon: AlertCircle },
    advertencia:{ bg: '#FFF8F0', border: '#fd7e14', text: '#b45309', Icon: AlertTriangle },
    info:       { bg: '#EFF6FF', border: '#003DA5', text: '#1e40af', Icon: Info },
  };
  return (
    <div className="flex flex-col gap-2">
      {alertas.map((a, i) => {
        const { bg, border, text, Icon } = cfg[a.nivel];
        return (
          <div key={i} className="flex items-start gap-3 rounded-xl px-4 py-3"
            style={{ backgroundColor: bg, borderLeft: `4px solid ${border}` }}>
            <Icon size={15} style={{ color: border }} className="mt-0.5 flex-shrink-0" />
            <span className="text-sm font-medium" style={{ color: text }}>{a.descripcion}</span>
          </div>
        );
      })}
    </div>
  );
}

function ProgressBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="h-1 bg-gray-200 rounded-full overflow-hidden w-full">
      <div className="h-full rounded-full"
        style={{ width: `${Math.min(Math.max(value, 0), 100)}%`, backgroundColor: color }} />
    </div>
  );
}

function EfectividadTable({ efectividad }: { efectividad: EfectividadRow[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  function toggle(nombre: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(nombre) ? next.delete(nombre) : next.add(nombre);
      return next;
    });
  }
  if (!efectividad.length) return <div className="text-center text-gray-400 py-8 text-sm">Sin datos de efectividad</div>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-[760px]">
        <thead>
          <tr className="bg-[#003DA5] text-white text-xs">
            <th className="px-3 py-2.5 text-center font-semibold w-8">#</th>
            <th className="px-3 py-2.5 text-left font-semibold">DISTRIBUIDOR</th>
            <th className="px-3 py-2.5 text-right font-semibold">DÍAS TRAB.</th>
            <th className="px-3 py-2.5 text-right font-semibold">CHIPS TOTAL</th>
            <th className="px-3 py-2.5 text-right font-semibold">PROM CHIPS/DÍA</th>
            <th className="px-3 py-2.5 text-right font-semibold">PROM PdV/DÍA</th>
            <th className="px-3 py-2.5 text-right font-semibold">CHIPS/COMERCIO</th>
            <th className="px-3 py-2.5 text-center font-semibold">RENDIMIENTO</th>
            <th className="px-3 py-2.5 w-6"></th>
          </tr>
        </thead>
        <tbody>
          {efectividad.map((e, i) => {
            const isOpen = expanded.has(e.nombre);
            const rColor = rendColor(e.promChipsPorComercio);
            return (
              <>
                <tr key={e.nombre}
                  className={`border-b border-gray-100 cursor-pointer hover:bg-blue-50/40 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}`}
                  onClick={() => toggle(e.nombre)}>
                  <td className="px-3 py-2.5 text-center text-gray-400 text-xs">{i + 1}</td>
                  <td className="px-3 py-2.5 font-medium text-gray-800">{e.nombre}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-gray-600">{e.diasTrabajados}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-gray-800">{e.totalChips.toLocaleString()}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-gray-600">{fmt1(e.promChipsPorDia)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-gray-600">{fmt1(e.promPdVPorDia)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums font-semibold" style={{ color: rColor }}>{fmt1(e.promChipsPorComercio)}</td>
                  <td className="px-3 py-2.5 text-center">
                    <span className="inline-block px-2.5 py-0.5 rounded-full text-white text-xs font-semibold" style={{ backgroundColor: rColor }}>
                      {rendLabel(e.promChipsPorComercio)}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-gray-400">{isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</td>
                </tr>
                {isOpen && (
                  <tr key={`${e.nombre}-detail`} className="bg-blue-50/20">
                    <td></td>
                    <td colSpan={8} className="px-4 py-3">
                      <div className="overflow-x-auto rounded-lg border border-blue-100">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-blue-100/60 text-blue-900">
                              <th className="px-3 py-2 text-left font-semibold">Fecha visita</th>
                              <th className="px-3 py-2 text-right font-semibold">PdV visitados</th>
                              <th className="px-3 py-2 text-right font-semibold">Chips entregados</th>
                              <th className="px-3 py-2 text-right font-semibold">Chips/comercio</th>
                            </tr>
                          </thead>
                          <tbody>
                            {e.detalleDias.map(d => (
                              <tr key={d.fecha} className="border-t border-blue-100/60 bg-white">
                                <td className="px-3 py-1.5 text-gray-700">{d.fecha}</td>
                                <td className="px-3 py-1.5 text-right tabular-nums text-gray-600">{d.pdvVisitados}</td>
                                <td className="px-3 py-1.5 text-right tabular-nums font-medium text-gray-800">{d.chipsEntregados}</td>
                                <td className="px-3 py-1.5 text-right tabular-nums font-semibold" style={{ color: rendColor(d.chipsPorComercio) }}>
                                  {fmt1(d.chipsPorComercio)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ChiperosTable({ chiperos }: { chiperos: ChiperoRow[] }) {
  if (!chiperos.length) return <div className="text-center text-gray-400 py-8 text-sm">Sin datos de distribuidores</div>;
  const totalRow = {
    total: chiperos.reduce((s, c) => s + c.total, 0),
    enTransito: chiperos.reduce((s, c) => s + c.enTransito, 0),
    enPdV: chiperos.reduce((s, c) => s + c.enPdV, 0),
  };
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-[700px]">
        <thead>
          <tr className="bg-gray-800 text-white text-xs">
            <th className="px-3 py-2.5 text-center font-semibold w-8">#</th>
            <th className="px-3 py-2.5 text-left font-semibold">DISTRIBUIDOR</th>
            <th className="px-3 py-2.5 text-right font-semibold">TOTAL</th>
            <th className="px-3 py-2.5 text-right font-semibold">EN TRÁNSITO</th>
            <th className="px-3 py-2.5 text-right font-semibold">EN PdV</th>
            <th className="px-3 py-2.5 text-left font-semibold min-w-[140px]">% COLOCADO</th>
            <th className="px-3 py-2.5 text-center font-semibold">ESTADO</th>
          </tr>
        </thead>
        <tbody>
          {chiperos.map((c, i) => {
            const color = pctColor(c.pctColocado);
            return (
              <tr key={c.nombre} className={`border-b border-gray-100 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}`}>
                <td className="px-3 py-2.5 text-center text-gray-400 text-xs">{i + 1}</td>
                <td className="px-3 py-2.5 font-medium text-gray-800">{c.nombre}</td>
                <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-gray-800">{c.total.toLocaleString()}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-orange-600">{c.enTransito.toLocaleString()}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-green-700 font-medium">{c.enPdV.toLocaleString()}</td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="flex-1"><ProgressBar value={c.pctColocado} color={color} /></div>
                    <span className="text-xs font-semibold tabular-nums w-11 text-right" style={{ color }}>
                      {fmt1(c.pctColocado)}%
                    </span>
                  </div>
                </td>
                <td className="px-3 py-2.5 text-center">
                  <span className="inline-block px-2.5 py-0.5 rounded-full text-white text-xs font-semibold" style={{ backgroundColor: color }}>
                    {pctLabel(c.pctColocado)}
                  </span>
                </td>
              </tr>
            );
          })}
          <tr className="bg-gray-100 border-t-2 border-gray-300 font-bold">
            <td className="px-3 py-2.5"></td>
            <td className="px-3 py-2.5 text-gray-700">TOTAL</td>
            <td className="px-3 py-2.5 text-right tabular-nums text-gray-800">{totalRow.total.toLocaleString()}</td>
            <td className="px-3 py-2.5 text-right tabular-nums text-orange-700">{totalRow.enTransito.toLocaleString()}</td>
            <td className="px-3 py-2.5 text-right tabular-nums text-green-800">{totalRow.enPdV.toLocaleString()}</td>
            <td className="px-3 py-2.5"></td>
            <td className="px-3 py-2.5"></td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ── Main Module ───────────────────────────────────────────────────────────────

export default function ChipsModule() {
  const [moduleTab, setModuleTab] = useState<'prepagos' | 'pdv'>('prepagos');
  const [stage, setStage] = useState<Stage>('upload');
  const [data, setData] = useState<ChipsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [empresaTab, setEmpresaTab] = useState('Todas');

  const analysis = useMemo(
    () => (data ? analyzeChips(data.rows, empresaTab) : null),
    [data, empresaTab],
  );

  const tabCounts = useMemo<Record<string, number>>(() => {
    if (!data) return {};
    const counts: Record<string, number> = { Todas: data.totalOK };
    for (const r of data.rows) counts[r.empresa] = (counts[r.empresa] ?? 0) + 1;
    return counts;
  }, [data]);

  const handleFile = useCallback(async (file: File) => {
    setStage('loading');
    setError(null);
    try {
      const result = await parseChips(file);
      setData(result);
      setEmpresaTab('Todas');
      recordActivity('chips', file.name);
      setStage('analysis');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al procesar el archivo');
      setStage('upload');
    }
  }, []);

  function handleReset() {
    setData(null);
    setEmpresaTab('Todas');
    setStage('upload');
  }

  const showDesglose = empresaTab === 'Todas';

  // Header subtitle and actions depend on active tab + stage
  const subtitle = moduleTab === 'pdv'
    ? 'Punto de Venta'
    : (stage === 'analysis' && data
        ? `${data.totalOK.toLocaleString()} chips OK · ${data.empresas.length} empresa${data.empresas.length !== 1 ? 's' : ''} · ${data.distribuidores.length} distribuidor${data.distribuidores.length !== 1 ? 'es' : ''}`
        : 'Gestión y reportes de chips SIM');

  const headerActions = (moduleTab === 'prepagos' && stage === 'analysis' && data && analysis) ? (
    <div className="flex gap-2">
      <button onClick={() => exportChipsExcel(data, analysis, empresaTab)}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors">
        <FileSpreadsheet size={15} /> Excel
      </button>
      <button onClick={() => exportChipsPDF(data, analysis, empresaTab)}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors">
        <Download size={15} /> PDF
      </button>
      <button onClick={handleReset}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition-colors">
        <RefreshCw size={15} /> Nuevo archivo
      </button>
    </div>
  ) : null;

  return (
    // Same root pattern as VentasModule: flex flex-col h-full
    <div className="flex flex-col h-full">

      <Header title="Chips" subtitle={subtitle} actions={headerActions} />

      {/* Module tab bar — between Header and scrollable content, never scrolls */}
      <div className="shrink-0 bg-white border-b border-gray-200 flex px-6">
        {(['prepagos', 'pdv'] as const).map(t => {
          const labels = { prepagos: 'CHIP — DESDE PREPAGOS', pdv: 'CHIP — PUNTO DE VENTA' };
          const active = moduleTab === t;
          return (
            <button key={t} onClick={() => setModuleTab(t)}
              className={`px-5 py-3 text-xs font-bold tracking-wide border-b-2 transition-colors ${
                active ? 'border-[#003DA5] text-[#003DA5]' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}>
              {labels[t]}
            </button>
          );
        })}
      </div>

      {/* Single scrollable content area — same as VentasModule's flex-1 overflow-y-auto p-6 */}
      <div className="flex-1 overflow-y-auto p-6">

        {/* ── PREPAGOS TAB ── */}
        {moduleTab === 'prepagos' && (
          <>
            {stage === 'upload' && (
              <div className="max-w-xl mx-auto">
                <div className="text-center mb-6">
                  <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-100 rounded-2xl mb-3">
                    <Upload size={28} className="text-[#003DA5]" />
                  </div>
                  <h2 className="text-xl font-bold text-gray-800">Cargar archivo de chips</h2>
                  <p className="text-sm text-gray-500 mt-1">
                    CSV con separador <code className="bg-gray-100 px-1 rounded">{';'}</code>, encoding latin1
                  </p>
                </div>
                <FileUploader onFile={handleFile} accept=".csv" label="Arrastrá tu archivo CSV aquí" sublabel="o hacé clic para seleccionarlo" />
                {error && (
                  <div className="mt-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 flex items-center gap-2">
                    <AlertTriangle size={16} className="flex-shrink-0" /> {error}
                  </div>
                )}
              </div>
            )}

            {stage === 'loading' && (
              <div className="flex items-center justify-center h-64">
                <div className="text-center">
                  <div className="w-12 h-12 border-4 border-[#003DA5] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                  <p className="text-gray-500 font-medium">Procesando archivo CSV...</p>
                  <p className="text-xs text-gray-400 mt-1">Esto puede tardar unos segundos</p>
                </div>
              </div>
            )}

            {stage === 'analysis' && data && analysis && (
              <div className="space-y-6">
                <EmpresaTabs empresas={data.empresas} tabCounts={tabCounts} active={empresaTab} onChange={setEmpresaTab} />

                {analysis.alertas.length > 0 && <AlertasSection alertas={analysis.alertas} />}

                {/* KPI Cards — same grid as VentasModule */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <KpiCard label="Chips Activos" value={analysis.chipsActivos.total}
                    sub="Con fecha asig. distribuidor" desglose={analysis.chipsActivos.porEmpresa}
                    borderColor="#28a745" icon={<BarChart2 size={20} />} showDesglose={showDesglose} />
                  <KpiCard label="Stock en Sistema" value={analysis.stockSistema.total}
                    sub="Sin distribuidor asignado" desglose={analysis.stockSistema.porEmpresa}
                    borderColor="#fd7e14" icon={<Package size={20} />} showDesglose={showDesglose} />
                  <KpiCard label="Stock en Tránsito" value={analysis.stockTransito.total}
                    sub="Con distribuidor, sin PdV" desglose={analysis.stockTransito.porEmpresa}
                    borderColor="#003DA5" icon={<Truck size={20} />} showDesglose={showDesglose} />
                  <KpiCard label="Efectividad Promedio" value={`${fmt1(analysis.promEquipoChipsPorComercio)} chips/comercio`}
                    sub="promedio de todos los distribuidores" borderColor="#6f42c1" icon={<Store size={20} />} />
                </div>

                {/* Efectividad de visita */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-100">
                    <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                      <Truck size={18} className="text-[#003DA5]" /> Efectividad de visita por distribuidor
                    </h2>
                    <p className="text-xs text-gray-400 mt-0.5">Click en una fila para ver el detalle por día · Ordenado por chips total</p>
                  </div>
                  <EfectividadTable efectividad={analysis.efectividad} />
                </div>

                {/* Stock por chipero */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-100">
                    <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                      <Store size={18} className="text-[#003DA5]" /> Stock por distribuidor ({analysis.chiperos.length})
                    </h2>
                    <p className="text-xs text-gray-400 mt-0.5">Ordenado por total desc</p>
                  </div>
                  <ChiperosTable chiperos={analysis.chiperos} />
                </div>
              </div>
            )}
          </>
        )}

        {/* ── PDV TAB — PdvModule renders its own content here ── */}
        {moduleTab === 'pdv' && <PdvModule />}

      </div>
    </div>
  );
}
