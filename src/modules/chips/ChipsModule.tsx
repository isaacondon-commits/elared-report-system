import { useState, useMemo, useCallback } from 'react';
import {
  Upload, ChevronDown, ChevronRight, AlertTriangle,
  FileSpreadsheet, Download, RefreshCw, Package,
  Truck, Store, Activity,
} from 'lucide-react';
import Header from '../../components/Header';
import FileUploader from '../../components/FileUploader';
import { parseChips } from './chipsParser';
import type { ChipsData } from './chipsParser';
import { analyzeChips } from './chipAnalysis';
import type { ChipsAnalysis } from './chipAnalysis';
import { exportChipsExcel, exportChipsPDF } from './ChipsExport';
import { recordActivity } from '../../utils/activityTracker';

type Stage = 'upload' | 'loading' | 'analysis';

const EMPRESAS_TABS = ['Todas', 'VOS', 'Phinternet', 'RELPONT'];

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, icon, borderColor,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ReactNode;
  borderColor: string;
}) {
  return (
    <div
      className="bg-white rounded-xl p-5 shadow-sm flex flex-col gap-1"
      style={{ borderTop: `4px solid ${borderColor}` }}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</span>
        <span style={{ color: borderColor }}>{icon}</span>
      </div>
      <div className="text-3xl font-bold text-gray-900">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>
      {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
    </div>
  );
}

// ── Progress bar ──────────────────────────────────────────────────────────────

function ProgressBar({ value, color = '#003DA5' }: { value: number; color?: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${Math.min(value, 100)}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-xs font-semibold text-gray-600 w-10 text-right">{value}%</span>
    </div>
  );
}

// ── Empresa Tabs ──────────────────────────────────────────────────────────────

function EmpresaTabs({
  empresas, active, onChange,
}: {
  empresas: string[];
  active: string;
  onChange: (e: string) => void;
}) {
  const tabs = useMemo(() => {
    const known = EMPRESAS_TABS.filter(t => t === 'Todas' || empresas.includes(t));
    const extra = empresas.filter(e => !EMPRESAS_TABS.includes(e));
    return [...known, ...extra];
  }, [empresas]);

  return (
    <div className="flex gap-1 flex-wrap">
      {tabs.map(tab => (
        <button
          key={tab}
          onClick={() => onChange(tab)}
          className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
            active === tab
              ? 'bg-[#003DA5] text-white shadow-sm'
              : 'bg-white text-gray-600 border border-gray-200 hover:border-[#003DA5] hover:text-[#003DA5]'
          }`}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}

// ── Chiperos Table ────────────────────────────────────────────────────────────

function ChiperosTable({ chiperos }: { chiperos: ChipsAnalysis['chiperos'] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggle(nombre: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(nombre)) next.delete(nombre);
      else next.add(nombre);
      return next;
    });
  }

  if (!chiperos.length) {
    return <div className="text-center text-gray-400 py-8">Sin chiperos con datos</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-[#003DA5] text-white text-xs">
            <th className="px-3 py-2 text-left font-semibold w-6"></th>
            <th className="px-3 py-2 text-left font-semibold">Chipero</th>
            <th className="px-3 py-2 text-right font-semibold">Total</th>
            <th className="px-3 py-2 text-right font-semibold">En Tránsito</th>
            <th className="px-3 py-2 text-right font-semibold">En PdV</th>
            <th className="px-3 py-2 text-left font-semibold min-w-[160px]">% Colocado</th>
          </tr>
        </thead>
        <tbody>
          {chiperos.map((c, i) => {
            const isOpen = expanded.has(c.nombre);
            const pctColor = c.pctColocado >= 70 ? '#28a745' : c.pctColocado >= 40 ? '#fd7e14' : '#dc3545';
            return (
              <>
                <tr
                  key={c.nombre}
                  className={`border-b border-gray-100 cursor-pointer hover:bg-blue-50/40 transition-colors ${
                    i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                  }`}
                  onClick={() => toggle(c.nombre)}
                >
                  <td className="px-3 py-2.5 text-gray-400">
                    {c.pdvs.length > 0
                      ? isOpen
                        ? <ChevronDown size={14} />
                        : <ChevronRight size={14} />
                      : null}
                  </td>
                  <td className="px-3 py-2.5 font-medium text-gray-800">{c.nombre}</td>
                  <td className="px-3 py-2.5 text-right font-semibold text-gray-800">{c.total.toLocaleString()}</td>
                  <td className="px-3 py-2.5 text-right text-orange-600 font-medium">{c.enTransito.toLocaleString()}</td>
                  <td className="px-3 py-2.5 text-right text-green-700 font-medium">{c.enPdv.toLocaleString()}</td>
                  <td className="px-3 py-2.5">
                    <ProgressBar value={c.pctColocado} color={pctColor} />
                  </td>
                </tr>
                {isOpen && c.pdvs.length > 0 && (
                  <tr key={`${c.nombre}-pdvs`} className="bg-blue-50/30">
                    <td></td>
                    <td colSpan={5} className="px-4 py-3">
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                        {c.pdvs.map(pdv => (
                          <div
                            key={pdv.nombre}
                            className="flex items-center justify-between bg-white border border-blue-100 rounded-lg px-3 py-1.5"
                          >
                            <span className="text-xs text-gray-700 truncate flex-1">{pdv.nombre}</span>
                            <span className="text-xs font-bold text-[#003DA5] ml-2">{pdv.chips}</span>
                          </div>
                        ))}
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

// ── Efectividad Table ─────────────────────────────────────────────────────────

function EfectividadTable({ efectividad }: { efectividad: ChipsAnalysis['efectividad'] }) {
  const [showAll, setShowAll] = useState(false);
  const maxChips = efectividad[0]?.chips ?? 1;
  const visible = showAll ? efectividad : efectividad.slice(0, 20);

  if (!efectividad.length) {
    return <div className="text-center text-gray-400 py-6">Sin datos de efectividad</div>;
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-800 text-white text-xs">
              <th className="px-3 py-2 text-left font-semibold">Distribuidor</th>
              <th className="px-3 py-2 text-left font-semibold">Punto de Venta</th>
              <th className="px-3 py-2 text-right font-semibold">Chips</th>
              <th className="px-3 py-2 text-left font-semibold min-w-[100px]"></th>
            </tr>
          </thead>
          <tbody>
            {visible.map((e, i) => {
              const barW = Math.max(4, Math.round((e.chips / maxChips) * 100));
              return (
                <tr key={`${e.distribuidor}-${e.pdv}`} className={`border-b border-gray-100 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                  <td className="px-3 py-2 text-gray-700 font-medium">{e.distribuidor}</td>
                  <td className="px-3 py-2 text-gray-600">{e.pdv}</td>
                  <td className="px-3 py-2 text-right font-semibold text-[#003DA5]">{e.chips}</td>
                  <td className="px-3 py-2">
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-[#003DA5]" style={{ width: `${barW}%` }} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {efectividad.length > 20 && (
        <button
          onClick={() => setShowAll(v => !v)}
          className="mt-3 text-sm text-[#003DA5] font-medium hover:underline"
        >
          {showAll ? 'Ver menos' : `Ver todos (${efectividad.length})`}
        </button>
      )}
    </div>
  );
}

// ── Lotes Section (collapsible) ───────────────────────────────────────────────

function LotesSection({ lotes }: { lotes: ChipsAnalysis['lotes'] }) {
  const [open, setOpen] = useState(() => {
    try { return sessionStorage.getItem('elared_chips_lotes_open') === '1'; } catch { return false; }
  });

  function toggle() {
    setOpen(v => {
      try { sessionStorage.setItem('elared_chips_lotes_open', v ? '0' : '1'); } catch {}
      return !v;
    });
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <button
        onClick={toggle}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Package size={18} className="text-[#003DA5]" />
          <span className="font-semibold text-gray-800">Lotes ({lotes.length})</span>
        </div>
        {open ? <ChevronDown size={18} className="text-gray-400" /> : <ChevronRight size={18} className="text-gray-400" />}
      </button>
      {open && (
        <div className="border-t border-gray-100 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-xs text-gray-600">
                <th className="px-4 py-2.5 text-left font-semibold">Lote</th>
                <th className="px-4 py-2.5 text-left font-semibold">Sub-lote</th>
                <th className="px-4 py-2.5 text-right font-semibold">Total</th>
                <th className="px-4 py-2.5 text-right font-semibold">Con Distribuidor</th>
                <th className="px-4 py-2.5 text-right font-semibold">En PdV</th>
              </tr>
            </thead>
            <tbody>
              {lotes.map((l, i) => (
                <tr key={`${l.lote}-${l.subLote}`} className={`border-b border-gray-100 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}`}>
                  <td className="px-4 py-2 font-medium text-gray-800">{l.lote || '—'}</td>
                  <td className="px-4 py-2 text-gray-600">{l.subLote || '—'}</td>
                  <td className="px-4 py-2 text-right font-semibold text-gray-800">{l.total.toLocaleString()}</td>
                  <td className="px-4 py-2 text-right text-orange-600">{l.enDistribuidor.toLocaleString()}</td>
                  <td className="px-4 py-2 text-right text-green-700 font-medium">{l.enPdv.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Alertas Section ───────────────────────────────────────────────────────────

function AlertasSection({ alertas }: { alertas: ChipsAnalysis['alertas'] }) {
  if (!alertas.length) return null;

  const colorMap = {
    alta_transito: { bg: '#FFF3CD', border: '#ffc107', text: '#856404' },
    stock_alto: { bg: '#FFF8F0', border: '#fd7e14', text: '#b45309' },
    sin_pdv: { bg: '#FEF2F2', border: '#dc3545', text: '#991b1b' },
  };

  return (
    <div className="flex flex-col gap-2">
      {alertas.map((a, i) => {
        const colors = colorMap[a.tipo];
        return (
          <div
            key={i}
            className="flex items-start gap-3 rounded-xl px-4 py-3"
            style={{ backgroundColor: colors.bg, borderLeft: `4px solid ${colors.border}` }}
          >
            <AlertTriangle size={16} style={{ color: colors.border }} className="mt-0.5 flex-shrink-0" />
            <span className="text-sm font-medium" style={{ color: colors.text }}>{a.descripcion}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Main Module ───────────────────────────────────────────────────────────────

export default function ChipsModule() {
  const [stage, setStage] = useState<Stage>('upload');
  const [data, setData] = useState<ChipsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [empresaTab, setEmpresaTab] = useState('Todas');

  const analysis = useMemo(
    () => (data ? analyzeChips(data.rows, empresaTab) : null),
    [data, empresaTab],
  );

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

  // ── Upload stage ────────────────────────────────────────────────────────────
  if (stage === 'upload' || stage === 'loading') {
    return (
      <div className="flex flex-col min-h-screen">
        <Header
          title="Gestión de Chips"
          subtitle="Análisis de activación y distribución de chips SIM"
        />
        <div className="flex-1 flex flex-col items-center justify-center p-8">
          <div className="w-full max-w-xl">
            {stage === 'loading' ? (
              <div className="flex flex-col items-center gap-4 py-16">
                <div className="w-12 h-12 border-4 border-[#003DA5] border-t-transparent rounded-full animate-spin" />
                <span className="text-gray-500 font-medium">Procesando archivo CSV...</span>
              </div>
            ) : (
              <>
                <div className="text-center mb-6">
                  <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-100 rounded-2xl mb-3">
                    <Upload size={28} className="text-[#003DA5]" />
                  </div>
                  <h2 className="text-xl font-bold text-gray-800">Cargar archivo de chips</h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Archivo CSV con separador <code className="bg-gray-100 px-1 rounded">;</code> exportado del sistema
                  </p>
                </div>
                <FileUploader
                  onFile={handleFile}
                  accept=".csv"
                  label="Arrastrá tu archivo CSV aquí"
                  sublabel="o hacé clic para seleccionarlo"
                />
                {error && (
                  <div className="mt-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 flex items-center gap-2">
                    <AlertTriangle size={16} className="flex-shrink-0" />
                    {error}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Analysis stage ──────────────────────────────────────────────────────────
  if (!data || !analysis) return null;

  const pctColocado = analysis.chipsActivos > 0
    ? `${Math.round((analysis.totalConPdv / analysis.chipsActivos) * 100)}% colocado`
    : undefined;

  return (
    <div className="flex flex-col min-h-screen">
      <Header
        title="Gestión de Chips"
        subtitle={`${data.totalOK.toLocaleString()} chips OK · ${new Date(data.fechaCarga).toLocaleDateString('es-UY')}`}
        actions={
          <div className="flex gap-2">
            <button
              onClick={() => exportChipsExcel(data, analysis, empresaTab)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <FileSpreadsheet size={15} /> Excel
            </button>
            <button
              onClick={() => exportChipsPDF(data, analysis, empresaTab)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <Download size={15} /> PDF
            </button>
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition-colors"
            >
              <RefreshCw size={15} /> Nuevo archivo
            </button>
          </div>
        }
      />

      <div className="flex-1 p-6 space-y-6">
        {/* Empresa tabs */}
        <EmpresaTabs
          empresas={data.empresas}
          active={empresaTab}
          onChange={setEmpresaTab}
        />

        {/* Alertas */}
        {analysis.alertas.length > 0 && (
          <AlertasSection alertas={analysis.alertas} />
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="Chips Activos"
            value={analysis.chipsActivos}
            sub="Asignados a distribuidor"
            icon={<Activity size={20} />}
            borderColor="#28a745"
          />
          <KpiCard
            label="Stock en Sistema"
            value={analysis.stockSistema}
            sub="Sin distribuidor asignado"
            icon={<Package size={20} />}
            borderColor="#fd7e14"
          />
          <KpiCard
            label="En Tránsito"
            value={analysis.stockTransito}
            sub="Con distribuidor, sin PdV"
            icon={<Truck size={20} />}
            borderColor="#003DA5"
          />
          <KpiCard
            label="Colocados en PdV"
            value={analysis.totalConPdv}
            sub={pctColocado}
            icon={<Store size={20} />}
            borderColor="#6f42c1"
          />
        </div>

        {/* Chiperos Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800 flex items-center gap-2">
              <Truck size={18} className="text-[#003DA5]" />
              Tabla de Chiperos ({analysis.chiperos.length})
            </h2>
          </div>
          <ChiperosTable chiperos={analysis.chiperos} />
        </div>

        {/* Efectividad */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800 flex items-center gap-2">
              <Store size={18} className="text-[#003DA5]" />
              Efectividad por Punto de Venta
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">Chips colocados por distribuidor y PdV</p>
          </div>
          <div className="p-5">
            <EfectividadTable efectividad={analysis.efectividad} />
          </div>
        </div>

        {/* Lotes */}
        <LotesSection lotes={analysis.lotes} />
      </div>
    </div>
  );
}
