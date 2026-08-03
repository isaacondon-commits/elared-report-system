import { useState, useMemo, useCallback, useRef } from 'react';
import type { ReactNode } from 'react';
import {
  AlertTriangle, FileSpreadsheet, Download, RefreshCw, Upload, Loader2,
  ChevronUp, ChevronDown, Info, X,
} from 'lucide-react';
import Header from '../../components/Header';
import FileUploader from '../../components/FileUploader';
import {
  parseChips, type ChipResult, type ParseResult,
  readAoaFromFile, classifyDesempenoFile, defaultDesempenoPeriod, parseDesempeno,
  type DesempenoResult, type DistribuidorRow,
  parseTab3, runTab3Analysis, niceCeil3,
  type Tab3Cols, type Tab3Result,
} from './chipsParser';
import { exportChipsExcel, exportChipsPDF, exportEliminadosExcel, exportTab3Excel, exportTab3PDF } from './ChipsExport';

type Stage = 'upload' | 'loading' | 'analysis' | 'error';
type ModuleTab = 'asignar' | 'desempeno' | 'tab3';

// ── Situation colors ──────────────────────────────────────────────────────────

const SITU: Record<string, { bg: string; color: string }> = {
  ok:            { bg: '#16a34a', color: '#fff' },
  'amber-plain': { bg: '#fd7e14', color: '#fff' },
  expiring:      { bg: '#fd7e14', color: '#fff' },
  expired:       { bg: '#E3000F', color: '#fff' },
  expired_noact: { bg: '#374151', color: '#fff' },
  checkup:       { bg: '#20c997', color: '#fff' },
};

function SituBadge({ r }: { r: ChipResult }) {
  const c = r.yaPendiente ? { bg: '#6b7280', color: '#fff' } : (SITU[r.situacion] ?? { bg: '#6b7280', color: '#fff' });
  return (
    <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold whitespace-nowrap"
      style={{ background: c.bg, color: c.color }}>
      {r.situacionLabel}
    </span>
  );
}

function TendBadge({ r }: { r: ChipResult }) {
  if (!r.alerta) return <span className="text-gray-300 text-xs">—</span>;
  if (r.alerta === 'baja') {
    const pct = r.alertaPct !== null ? ` ${Math.round(r.alertaPct * 100)}%` : '';
    return (
      <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold whitespace-nowrap"
        style={{ background: '#FBE7E2', color: '#B3402F' }}>
        🔻 Baja{pct}
      </span>
    );
  }
  const pct = r.alertaPct !== null ? ` +${Math.round(r.alertaPct * 100)}%` : '';
  return (
    <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold whitespace-nowrap"
      style={{ background: '#E6F1E8', color: '#3D7A4D' }}>
      📈 Suba{pct}
    </span>
  );
}

function fmt(d: Date | null): string {
  if (!d) return '—';
  return d.toLocaleDateString('es-UY');
}

function pctStr(v: number): string {
  return `${Math.round(v * 100)}%`;
}

function toInputDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ── KPI card ─────────────────────────────────────────────────────────────────

function KpiBox({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-white" style={{ padding: '14px 16px', borderRadius: 8, border: '1px solid #E2E8F0' }}>
      <div style={{ fontSize: 28, fontWeight: 700, lineHeight: 1, color }}>
        {value.toLocaleString('es-UY')}
      </div>
      <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.4px', color: '#6c757d', marginTop: 2 }}>
        {label}
      </div>
    </div>
  );
}

// ── Collapsible footnote ───────────────────────────────────────────────────────

function InfoFootnote() {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-3 text-left"
      >
        <span className="text-sm font-semibold text-gray-700">ℹ️ Cómo se calculan los valores</span>
        {open ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
      </button>
      {open && (
        <div className="px-5 pb-4 text-xs text-gray-500 leading-relaxed space-y-2 border-t border-gray-100 pt-3">
          <p><b>8m</b> = ventana móvil de los últimos 8 meses desde la fecha de referencia, sobre la fecha de asignación al punto de venta.</p>
          <p><b>Última entrega:</b> agrupa las líneas con la fecha de asignación más reciente para ese punto.</p>
          <p><b>Sugerencia de reposición:</b> si el chip más viejo vence en ≤30 días (o ya venció): si la última entrega tuvo alguna activación, se sugiere el mínimo de sub-lotes de 5 que cubra lo vendido. Si no activó nada con más de 2 visitas, se marca sin actividad. Si tiene 2 visitas o menos, se sugiere lote mínimo de 5 a prueba.</p>
          <p>Si no hay vencimiento próximo: el remanente se calcula con entregas de los últimos 2 meses. Se proyecta consumo de 2 meses según ritmo reciente.</p>
          <p>* Ritmo calculado sobre 8 meses por falta de datos de comisión recientes.</p>
        </div>
      )}
    </div>
  );
}

// ── Table column definitions ──────────────────────────────────────────────────

type ColDef = { key: keyof ChipResult; label: string; minWidth: number };

const COLS: ColDef[] = [
  { key: 'empresa',           label: 'Empresa',                     minWidth: 80 },
  { key: 'distribuidor',      label: 'Distribuidor',                minWidth: 120 },
  { key: 'idDistribuidor',    label: 'ID Distribuidor',             minWidth: 100 },
  { key: 'pdvNombre',         label: 'Punto de venta',              minWidth: 180 },
  { key: 'pdvId',             label: 'ID punto',                    minWidth: 90 },
  { key: 'departamento',      label: 'Depto.',                      minWidth: 100 },
  { key: 'visitas8m',         label: 'Visitas 8m',                  minWidth: 80 },
  { key: 'asignados8m',       label: 'Asignados 8m',                minWidth: 90 },
  { key: 'activaciones8m',    label: 'Activados 8m',                minWidth: 90 },
  { key: 'pct8m',             label: '% activ. 8m',                 minWidth: 80 },
  { key: 'ritmoReciente',     label: 'Ritmo reciente (chips/mes)',  minWidth: 120 },
  { key: 'alerta',            label: 'Alerta',                      minWidth: 100 },
  { key: 'ultimaAsignacion',  label: 'Última entrega',              minWidth: 100 },
  { key: 'ultimaQty',         label: 'Chips últ. entrega',          minWidth: 80 },
  { key: 'ultimaActivos',     label: 'Activ. últ. entrega',         minWidth: 80 },
  { key: 'ultimaPct',         label: '% últ. entrega',              minWidth: 80 },
  { key: 'estadoVisita',      label: 'Estado visita',               minWidth: 110 },
  { key: 'fechaCambioEstado', label: 'Último cambio de estado',     minWidth: 110 },
  { key: 'vencimiento',       label: 'Vencimiento',                 minWidth: 100 },
  { key: 'situacion',         label: 'Situación',                   minWidth: 130 },
  { key: 'sugerido',          label: 'Sugerido',                    minWidth: 80 },
];

const STICKY_LEFT: Partial<Record<keyof ChipResult, number>> = { empresa: 0, distribuidor: 80 };
const STICKY_SHADOW = '2px 0 4px rgba(0,0,0,0.08)';

function sortResults(rows: ChipResult[], key: keyof ChipResult, dir: 'asc' | 'desc'): ChipResult[] {
  return [...rows].sort((a, b) => {
    const av = a[key] as unknown;
    const bv = b[key] as unknown;
    if (av === null || av === undefined) return 1;
    if (bv === null || bv === undefined) return -1;
    let cmp: number;
    if (av instanceof Date && bv instanceof Date) cmp = av.getTime() - bv.getTime();
    else if (typeof av === 'number' && typeof bv === 'number') cmp = av - bv;
    else cmp = String(av).localeCompare(String(bv), 'es');
    return dir === 'asc' ? cmp : -cmp;
  });
}

// ── Component ─────────────────────────────────────────────────────────────────

const PER_PAGE = 20;

export default function ChipsModule() {
  const [moduleTab, setModuleTab]       = useState<ModuleTab>('asignar');

  const [stage, setStage]               = useState<Stage>('upload');
  const [parseResult, setParseResult]   = useState<ParseResult | null>(null);
  const [errorMsg, setErrorMsg]         = useState('');
  const [lastFile, setLastFile]         = useState<File | null>(null);
  const [refDateStr, setRefDateStr]     = useState('');
  const [pendingDate, setPendingDate]   = useState('');
  const [recalc, setRecalc]             = useState(false);

  const [filtEmpresa, setFiltEmpresa]   = useState('');
  const [filtDist, setFiltDist]         = useState('');
  const [filtDepto, setFiltDepto]       = useState('');
  const [filtEstado, setFiltEstado]     = useState('');
  const [filtSearch, setFiltSearch]     = useState('');
  const [filtSolo, setFiltSolo]         = useState(true);

  const [sortKey, setSortKey]           = useState<keyof ChipResult>('sugerido');
  const [sortDir, setSortDir]           = useState<'asc' | 'desc'>('desc');
  const [page, setPage]                 = useState(1);

  const [toast, setToast]               = useState<string | null>(null);
  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(null), 3000); }

  const [showCriterios, setShowCriterios] = useState(false);

  const results = parseResult?.results ?? [];

  const empresas = useMemo(() => [...new Set(results.map(r => r.empresa).filter(Boolean))].sort(), [results]);
  const dists    = useMemo(() => [...new Set(results.map(r => r.distribuidor).filter(Boolean))].sort(), [results]);
  const deptos   = useMemo(() => [...new Set(results.map(r => r.departamento).filter(Boolean))].sort(), [results]);
  const estados  = useMemo(() => [...new Set(results.map(r => r.estadoVisita).filter(Boolean))].sort(), [results]);

  // KPIs — siempre sobre `results` (sin filtrar), igual que el HTML
  const kpiPuntos    = results.length;
  const kpiVisitar   = useMemo(() => results.filter(r => r.sugerido > 0 || r.situacion === 'checkup' || r.situacion === 'expired_noact').length, [results]);
  const kpiVencidos  = useMemo(() => results.filter(r => r.situacion === 'expired').length, [results]);
  const kpiPorVencer = useMemo(() => results.filter(r => r.situacion === 'expiring').length, [results]);
  const kpiChips     = useMemo(() => results.reduce((s, r) => s + r.sugerido, 0), [results]);

  const filtered = useMemo(() => {
    let r = results;
    if (filtEmpresa) r = r.filter(x => x.empresa     === filtEmpresa);
    if (filtDist)    r = r.filter(x => x.distribuidor === filtDist);
    if (filtDepto)   r = r.filter(x => x.departamento === filtDepto);
    if (filtEstado)  r = r.filter(x => x.estadoVisita === filtEstado);
    if (filtSearch) {
      const q = filtSearch.toLowerCase();
      r = r.filter(x => x.pdvNombre.toLowerCase().includes(q) || x.pdvId.includes(q));
    }
    if (filtSolo) r = r.filter(x => x.sugerido > 0 || x.situacion === 'checkup' || x.situacion === 'expired_noact');
    return sortResults(r, sortKey, sortDir);
  }, [results, filtEmpresa, filtDist, filtDepto, filtEstado, filtSearch, filtSolo, sortKey, sortDir]);

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paged = useMemo(() => filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE), [filtered, page]);

  function handleSort(key: keyof ChipResult) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
    setPage(1);
  }

  function resetFilters() {
    setFiltEmpresa(''); setFiltDist(''); setFiltDepto('');
    setFiltEstado(''); setFiltSearch(''); setFiltSolo(true);
    setPage(1);
  }

  const handleFile = useCallback(async (file: File) => {
    setStage('loading');
    setErrorMsg('');
    setLastFile(file);
    try {
      const pr = await parseChips(file);
      setParseResult(pr);
      const d = pr.detectedDate;
      const s = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      setRefDateStr(s); setPendingDate(s);
      setStage('analysis');
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Error al procesar el archivo');
      setStage('error');
    }
  }, []);

  async function handleRecalculate() {
    if (!lastFile || !pendingDate) return;
    setRecalc(true);
    try {
      const override = new Date(pendingDate + 'T12:00:00');
      const pr = await parseChips(lastFile, override);
      setParseResult(pr); setRefDateStr(pendingDate); setPage(1);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Error al recalcular');
    }
    setRecalc(false);
  }

  function handleReset() {
    setStage('upload'); setParseResult(null); setLastFile(null); setErrorMsg('');
    resetFilters(); setSortKey('sugerido'); setSortDir('desc');
  }

  function handleExportEliminados() {
    if (!parseResult || parseResult.eliminados.length === 0) {
      showToast('No hay puntos eliminados en la ventana de 8 meses');
      return;
    }
    exportEliminadosExcel(parseResult.eliminados);
  }

  // Dynamic subtitle
  const subtitle = useMemo(() => {
    if (!parseResult) return undefined;
    const ws = parseResult.windowStart.toLocaleDateString('es-UY');
    const we = parseResult.windowEnd.toLocaleDateString('es-UY');
    return `${results.length} puntos analizados · Ventana: ${ws} – ${we}`;
  }, [parseResult, results.length]);

  const headerActions = (moduleTab === 'asignar' && stage === 'analysis') ? (
    <>
      <button onClick={() => exportChipsExcel(filtered)}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors">
        <FileSpreadsheet size={15} /> Excel
      </button>
      <button onClick={() => exportChipsPDF(filtered)}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors">
        <Download size={15} /> PDF
      </button>
      <button onClick={handleExportEliminados}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-800 text-white text-sm font-medium rounded-lg transition-colors">
        <FileSpreadsheet size={15} /> Puntos eliminados (Excel)
      </button>
      <button onClick={handleReset}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition-colors">
        <RefreshCw size={15} /> Cambiar archivo
      </button>
    </>
  ) : undefined;

  return (
    <div className="flex flex-col h-full min-w-0">
      <Header title="Chips" subtitle={subtitle} actions={headerActions} />

      <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)', overflow: 'hidden', minWidth: 0 }}>

        {/* PARTE FIJA — tabs (no scrollea) */}
        <div style={{ flexShrink: 0 }} className="bg-white border-b border-gray-200 px-6 pt-3 flex gap-2">
          <button
            onClick={() => setModuleTab('asignar')}
            className={`px-4 py-2 rounded-t-lg text-sm font-semibold transition-colors ${
              moduleTab === 'asignar' ? 'bg-[#1A1A2E] text-white' : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            Asignar visitas
          </button>
          <button
            onClick={() => setModuleTab('desempeno')}
            className={`px-4 py-2 rounded-t-lg text-sm font-semibold transition-colors ${
              moduleTab === 'desempeno' ? 'bg-[#1A1A2E] text-white' : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            Desempeño de distribuidores
          </button>
          <button
            onClick={() => setModuleTab('tab3')}
            className={`px-4 py-2 rounded-t-lg text-sm font-semibold transition-colors ${
              moduleTab === 'tab3' ? 'bg-[#1A1A2E] text-white' : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            Activaciones por empresa
          </button>
          <button
            onClick={() => setShowCriterios(true)}
            className="ml-auto mb-2 flex items-center gap-1.5 px-3 py-1.5 text-xs border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors self-center"
          >
            <Info size={13} /> Criterios del sistema
          </button>
        </div>

        {/* ── Tab 1: Asignar visitas ── */}
        <div
          style={moduleTab === 'asignar' ? { display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, minWidth: 0, overflow: 'hidden' } : { display: 'none' }}
        >
          {(stage === 'upload' || stage === 'error') && (
            <div className="flex-1 overflow-y-auto p-6">
              <div className="max-w-xl mx-auto">
                <div className="text-center mb-6">
                  <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-100 rounded-2xl mb-3">
                    <Upload size={28} className="text-[#003DA5]" />
                  </div>
                  <h2 className="text-xl font-bold text-gray-800">Módulo Chips</h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Cargá el Excel con las hojas:{' '}
                    <strong>Activaciones</strong>, <strong>Comisiones</strong> y <strong>Puntos de Venta</strong>
                  </p>
                </div>
                <FileUploader
                  onFile={handleFile}
                  accept=".xlsx"
                  label="Arrastrá tu archivo Excel aquí"
                  sublabel="o hacé clic para seleccionarlo"
                />
                {stage === 'error' && errorMsg && (
                  <div className="mt-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 whitespace-pre-line flex items-start gap-2">
                    <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
                    <span>{errorMsg}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {stage === 'loading' && (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <Loader2 size={36} className="animate-spin text-[#003DA5] mx-auto mb-3" />
                <p className="text-gray-500">Procesando archivo...</p>
              </div>
            </div>
          )}

          {stage === 'analysis' && parseResult && (
            <>
              {/* PARTE FIJA — fecha, KPIs, filtros */}
              <div style={{ flexShrink: 0 }} className="px-6 pt-4">

                {/* Fecha de referencia */}
                <div className="flex flex-wrap items-center gap-3 bg-white rounded-xl border border-gray-200 px-5 py-3 mb-3">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Fecha de referencia:</span>
                  <input
                    type="date"
                    value={pendingDate}
                    onChange={e => setPendingDate(e.target.value)}
                    className="border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-[#003DA5]"
                  />
                  <button
                    onClick={handleRecalculate}
                    disabled={recalc || pendingDate === refDateStr}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#003DA5] hover:bg-blue-800 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    {recalc ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                    Recalcular
                  </button>
                  {pendingDate !== refDateStr && (
                    <span className="text-xs text-amber-600 font-medium">Cambios sin aplicar</span>
                  )}
                </div>

                {/* KPI cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 8, marginBottom: 12 }}>
                  <KpiBox label="Puntos analizados"        value={kpiPuntos}    color="#20c997" />
                  <KpiBox label="Necesitan visita"         value={kpiVisitar}   color="#E3000F" />
                  <KpiBox label="Chips vencidos"           value={kpiVencidos}  color="#E3000F" />
                  <KpiBox label="Vencen en 30 días"        value={kpiPorVencer} color="#fd7e14" />
                  <KpiBox label="Chips sugeridos a llevar" value={kpiChips}     color="#20c997" />
                </div>

                {/* Filters */}
                <div className="bg-white rounded-xl border border-gray-200 px-5 py-4">
                  <div className="flex flex-wrap gap-3 items-center">
                    <select value={filtEmpresa} onChange={e => { setFiltEmpresa(e.target.value); setPage(1); }}
                      className="max-w-[180px] border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-[#003DA5]">
                      <option value="">Empresa (todas)</option>
                      {empresas.map(v => <option key={v}>{v}</option>)}
                    </select>
                    <select value={filtDist} onChange={e => { setFiltDist(e.target.value); setPage(1); }}
                      className="max-w-[210px] border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-[#003DA5]">
                      <option value="">Distribuidor (todos)</option>
                      {dists.map(v => <option key={v}>{v}</option>)}
                    </select>
                    <select value={filtDepto} onChange={e => { setFiltDepto(e.target.value); setPage(1); }}
                      className="max-w-[180px] border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-[#003DA5]">
                      <option value="">Departamento (todos)</option>
                      {deptos.map(v => <option key={v}>{v}</option>)}
                    </select>
                    <select value={filtEstado} onChange={e => { setFiltEstado(e.target.value); setPage(1); }}
                      className="max-w-[180px] border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-[#003DA5]">
                      <option value="">Estado visita (todos)</option>
                      {estados.map(v => <option key={v}>{v}</option>)}
                    </select>
                    <input
                      type="text"
                      placeholder="🔍 Buscar punto..."
                      value={filtSearch}
                      onChange={e => { setFiltSearch(e.target.value); setPage(1); }}
                      className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-[#003DA5] min-w-[160px] flex-1"
                    />
                    <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={filtSolo}
                        onChange={e => { setFiltSolo(e.target.checked); setPage(1); }}
                        className="w-4 h-4 accent-[#003DA5]"
                      />
                      Solo puntos a visitar
                    </label>
                    <span className="text-sm text-gray-400 whitespace-nowrap font-medium">{filtered.length} puntos</span>
                    {(filtEmpresa || filtDist || filtDepto || filtEstado || filtSearch || !filtSolo) && (
                      <button onClick={resetFilters} className="text-xs text-[#003DA5] hover:underline whitespace-nowrap">
                        Limpiar filtros
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* TABLA — scroll propio */}
              <div style={{
                flex: 1, minHeight: 0, minWidth: 0, overflowY: 'auto', overflowX: 'auto',
                border: '1px solid #E2E8F0', borderRadius: 8, margin: '12px 24px',
              }}>
                <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }} className="text-sm">
                  <thead style={{ position: 'sticky', top: 0, zIndex: 3, backgroundColor: '#003DA5' }}>
                    <tr>
                      {COLS.map(col => {
                        const left = STICKY_LEFT[col.key];
                        const isSticky = left !== undefined;
                        return (
                          <th
                            key={col.key}
                            onClick={() => handleSort(col.key)}
                            style={{
                              minWidth: col.minWidth,
                              ...(isSticky ? { position: 'sticky', left, zIndex: 4, backgroundColor: '#003DA5', boxShadow: STICKY_SHADOW } : {}),
                            }}
                            className="px-3 py-2.5 text-left text-[11px] font-semibold text-white bg-[#003DA5] whitespace-nowrap cursor-pointer hover:bg-[#002d7a] select-none"
                          >
                            <span className="flex items-center gap-0.5">
                              {col.label}
                              {sortKey === col.key
                                ? (sortDir === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />)
                                : <span className="w-3 inline-block" />}
                            </span>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {paged.map((r, i) => {
                      const rowBg = i % 2 === 0 ? '#ffffff' : '#F9FAFB';
                      return (
                      <tr key={r.pdvId + '-' + i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                        <td className="px-3 py-2 border-b border-gray-100 text-xs" style={{ position: 'sticky', left: 0, zIndex: 2, backgroundColor: rowBg, minWidth: COLS[0].minWidth, boxShadow: STICKY_SHADOW }}>{r.empresa || '—'}</td>
                        <td className="px-3 py-2 border-b border-gray-100 text-xs" style={{ position: 'sticky', left: 80, zIndex: 2, backgroundColor: rowBg, minWidth: COLS[1].minWidth, boxShadow: STICKY_SHADOW }}>{r.distribuidor || '—'}</td>
                        <td className="px-3 py-2 border-b border-gray-100 text-xs text-gray-400" style={{ minWidth: COLS[2].minWidth }}>{r.idDistribuidor || '—'}</td>
                        <td className="px-3 py-2 border-b border-gray-100 text-xs font-medium max-w-[220px] truncate" style={{ minWidth: COLS[3].minWidth }}>{r.pdvNombre || r.pdvId}</td>
                        <td className="px-3 py-2 border-b border-gray-100 text-xs text-gray-400" style={{ minWidth: COLS[4].minWidth }}>{r.pdvId}</td>
                        <td className="px-3 py-2 border-b border-gray-100 text-xs" style={{ minWidth: COLS[5].minWidth }}>{r.departamento || '—'}</td>
                        <td className="px-3 py-2 border-b border-gray-100 text-xs text-right tabular-nums" style={{ minWidth: COLS[6].minWidth }}>{r.visitas8m}</td>
                        <td className="px-3 py-2 border-b border-gray-100 text-xs text-right tabular-nums" style={{ minWidth: COLS[7].minWidth }}>{r.asignados8m}</td>
                        <td className="px-3 py-2 border-b border-gray-100 text-xs text-right tabular-nums" style={{ minWidth: COLS[8].minWidth }}>{r.activaciones8m}</td>
                        <td className="px-3 py-2 border-b border-gray-100 text-xs text-right tabular-nums" style={{ minWidth: COLS[9].minWidth }}>{pctStr(r.pct8m)}</td>
                        <td className="px-3 py-2 border-b border-gray-100 text-xs text-right tabular-nums" style={{ minWidth: COLS[10].minWidth }}>
                          {r.ritmoReciente.toFixed(2)}
                          {!r.tieneDatosRecientes && <span className="text-gray-300 ml-0.5 text-[10px]">*</span>}
                        </td>
                        <td className="px-3 py-2 border-b border-gray-100" style={{ minWidth: COLS[11].minWidth }}><TendBadge r={r} /></td>
                        <td className="px-3 py-2 border-b border-gray-100 text-xs text-gray-500" style={{ minWidth: COLS[12].minWidth }}>{fmt(r.ultimaAsignacion)}</td>
                        <td className="px-3 py-2 border-b border-gray-100 text-xs text-right tabular-nums" style={{ minWidth: COLS[13].minWidth }}>{r.ultimaQty}</td>
                        <td className="px-3 py-2 border-b border-gray-100 text-xs text-right tabular-nums" style={{ minWidth: COLS[14].minWidth }}>{r.ultimaActivos}</td>
                        <td className="px-3 py-2 border-b border-gray-100 text-xs text-right tabular-nums" style={{ minWidth: COLS[15].minWidth }}>{pctStr(r.ultimaPct)}</td>
                        <td className="px-3 py-2 border-b border-gray-100 text-xs" style={{ minWidth: COLS[16].minWidth }}>{r.estadoVisita || '—'}</td>
                        <td className="px-3 py-2 border-b border-gray-100 text-xs text-gray-500" style={{ minWidth: COLS[17].minWidth }}>{fmt(r.fechaCambioEstado)}</td>
                        <td className="px-3 py-2 border-b border-gray-100 text-xs text-gray-500" style={{ minWidth: COLS[18].minWidth }}>{fmt(r.vencimiento)}</td>
                        <td className="px-3 py-2 border-b border-gray-100" style={{ minWidth: COLS[19].minWidth }}><SituBadge r={r} /></td>
                        <td className="px-3 py-2 border-b border-gray-100 text-right tabular-nums font-bold text-sm" style={{ minWidth: COLS[20].minWidth }}>
                          {r.sugerido > 0
                            ? <span style={{ color: '#d97706' }}>{r.sugerido}</span>
                            : <span className="text-gray-300 font-normal">—</span>}
                        </td>
                      </tr>
                      );
                    })}
                    {paged.length === 0 && (
                      <tr>
                        <td colSpan={COLS.length} className="px-4 py-10 text-center text-sm text-gray-400">
                          Sin resultados con los filtros actuales
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* PARTE FIJA — paginación + nota */}
              <div style={{ flexShrink: 0 }} className="px-6 pb-4 flex items-center justify-between flex-wrap gap-3">
                <p className="text-[11px] text-gray-400">
                  * Ritmo calculado sobre 8 meses por falta de datos de comisión recientes
                </p>
                {totalPages > 1 && (
                  <div className="flex items-center gap-1 text-sm">
                    <button
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="px-3 py-1 border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-40"
                    >‹</button>
                    <span className="px-3 py-1 text-gray-500">{page} / {totalPages}</span>
                    <button
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="px-3 py-1 border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-40"
                    >›</button>
                  </div>
                )}
              </div>
              <div style={{ flexShrink: 0 }} className="px-6 pb-4">
                <InfoFootnote />
              </div>
            </>
          )}
        </div>

        {/* ── Tab 2: Desempeño de distribuidores ── */}
        <div
          style={moduleTab === 'desempeno' ? { display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, minWidth: 0, overflow: 'hidden' } : { display: 'none' }}
        >
          <DesempenoTab />
        </div>

        {/* ── Tab 3: Activaciones por empresa ── */}
        <div
          style={moduleTab === 'tab3' ? { display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, minWidth: 0, overflow: 'hidden' } : { display: 'none' }}
        >
          <Tab3Panel />
        </div>

      </div>

      {showCriterios && <CriteriosModal onClose={() => setShowCriterios(false)} />}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-sm font-medium px-5 py-2.5 rounded-xl shadow-lg flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
          {toast}
        </div>
      )}
    </div>
  );
}

// ── Criterios del sistema ───────────────────────────────────────────────────────

function CriteriosModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto p-7" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-1">
          <h2 className="font-bold text-gray-900 text-lg">Criterios del sistema</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <p className="text-xs text-gray-400 mb-5">Solo lectura — esto documenta cómo calcula el panel, no se puede editar desde acá.</p>

        <h3 className="font-bold text-gray-800 text-sm mb-2">Asignar visitas</h3>
        <ul className="text-[13px] text-gray-600 leading-relaxed list-disc pl-5 space-y-1.5 mb-5">
          <li><strong>Fecha de referencia (&quot;hoy&quot;):</strong> por defecto la fecha más reciente que aparece en tus datos, pero se puede fijar manualmente arriba.</li>
          <li><strong>Ventana de 8 meses:</strong> muestra el comportamiento/potencial de fondo del punto (asignados, activados, % activación). No cambia con las reglas nuevas.</li>
          <li><strong>Filtro de calidad:</strong> solo se cuentan chips con Estado de activación = OK. Los que fallaron se excluyen.</li>
          <li><strong>Puntos dados de baja:</strong> si un punto aparece en activaciones pero ya no existe en la hoja de puntos de venta, se excluye del todo (no se sugiere visitarlo).</li>
          <li><strong>Ritmo reciente (chips/mes):</strong> usa la fecha real de la planilla de comisiones — cuenta activaciones de los últimos 3 meses ÷ 3. Si no hay fechas de comisión utilizables, usa el promedio de 8 meses como respaldo (marcado con &quot;*&quot;).</li>
          <li><strong>Alerta de suba/baja:</strong> compara los últimos 3 meses contra los 3 anteriores (por fecha de comisión). Con al menos 3 chips activados entre ambas ventanas: caída ≥45% → Baja; suba ≥45% → Suba.</li>
          <li><strong>Puntos eliminados (Excel):</strong> puntos con fecha de &quot;Eliminado&quot; dentro de la ventana de 8 meses, con la empresa cruzada por nombre de distribuidor contra activaciones.</li>
          <li><strong>Vencimiento:</strong> si el chip más viejo vence en ≤30 días (o ya venció): si activó algo en la última entrega → sugiere el mínimo de sub-lotes de 5 que cubra lo vendido (ej: vendió 6 → sugiere 10), no el remanente completo. Sin activaciones y ≤2 visitas → lote mínimo de 5, a prueba. Sin activaciones y &gt;2 visitas → &quot;sin actividad&quot;, solo retirar, sin dejar nuevos.</li>
          <li><strong>Reposición por stock bajo:</strong> el remanente suma el stock sin activar de todas las entregas de los últimos 2 meses (no solo la última), para contar los chips recién entregados como stock físico real aunque su comisión no se haya reportado todavía. Proyección = ritmo reciente × 2 meses − remanente, redondeado a múltiplos de 5.</li>
          <li><strong>Visitar (chequeo):</strong> puntos &quot;buenos&quot; (% activación 8m ≥ 60% y ritmo reciente ≥ 3 chips/mes) sin cambio de estado hace más de 30 días se marcan para visitar como control preventivo, aunque el stock esté bien.</li>
        </ul>

        <h3 className="font-bold text-gray-800 text-sm mb-2">Desempeño de distribuidores</h3>
        <ul className="text-[13px] text-gray-600 leading-relaxed list-disc pl-5 space-y-1.5 mb-5">
          <li><strong>Chips asignados (período):</strong> filas cuya Fecha asignación distribuidor cae dentro del período elegido.</li>
          <li><strong>Con/sin punto de venta:</strong> de esos chips, si tienen o no Id de Punto de venta cargado.</li>
          <li><strong>Prom. chips/día a PDV:</strong> chips con Fecha asignación punto venta en el período ÷ días distintos con al menos una entrega.</li>
          <li><strong>Puntos pendientes / con chip por vencer:</strong> foto actual, no se filtran por período. Cruce con distribuidor por nombre (esos archivos no traen ID de distribuidor).</li>
          <li><strong>Total puntos activos:</strong> cantidad de puntos de venta asignados al distribuidor en la planilla de puntos de venta, excluyendo los que tienen fecha en la columna &quot;Eliminado&quot;.</li>
          <li><strong>Departamentos principales:</strong> departamentos con 5% o más del total de puntos activos del distribuidor; los de menor peso se descartan por considerarse asignaciones viejas.</li>
          <li><strong>Stock le alcanza para:</strong> chips sin punto de venta asignado ÷ promedio diario a PDV. Rojo ≤7 días, ámbar ≤15 días.</li>
          <li><strong>Resumen por empresa:</strong> chips armados = Fecha de activación en el período. Activados = Estado de activación = OK dentro de esos armados.</li>
          <li><strong>Visitas por distribuidor:</strong> sale del archivo de visitas (Fecha visita), excluyendo filas con Estado Cancelado, Pendiente, Visita de autor suprimida o Visita permanente, para cada uno de los últimos 6 días, siempre relativo a la fecha real de hoy.</li>
        </ul>

        <h3 className="font-bold text-gray-800 text-sm mb-2">Activaciones por empresa</h3>
        <ul className="text-[13px] text-gray-600 leading-relaxed list-disc pl-5 space-y-1.5">
          <li><strong>Fecha de referencia:</strong> por defecto la fecha de asignación a PDV más reciente en el archivo; se puede fijar manualmente y recalcular.</li>
          <li><strong>Períodos comparables (6 meses):</strong> el mes de la fecha de referencia y los 5 anteriores.</li>
          <li><strong>Corte por día:</strong> en cada uno de los 6 meses solo se cuentan los chips asignados entre el día 1 y el mismo día del mes de la fecha de referencia, para comparar parejo un mes en curso (incompleto) contra meses ya cerrados.</li>
          <li><strong>Chips excluidos:</strong> los que no tienen fecha de asignación a punto de venta, los que caen fuera de la ventana de 6 meses, o los que caen después del día de corte en su mes.</li>
          <li><strong>Por empresa:</strong> agrupa la cantidad de chips por Empresa y mes dentro de la ventana 1–día de corte, con una gráfica de barras agrupadas para comparar el ritmo de asignación de cada empresa mes a mes.</li>
          <li><strong>Total general:</strong> suma de todas las empresas en cada uno de los 6 períodos, para ver la tendencia global.</li>
          <li><strong>Variación último mes vs. anterior:</strong> compara el total del último período contra el del período previo, ambos ya recortados al mismo rango de días.</li>
        </ul>
      </div>
    </div>
  );
}

// ── Tab 2: Desempeño de distribuidores ─────────────────────────────────────────

function DesempenoFootnote() {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-4">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-3 text-left"
      >
        <span className="text-sm font-semibold text-gray-700">ℹ️ Cómo se calcula</span>
        {open ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
      </button>
      {open && (
        <div className="px-5 pb-4 text-xs text-gray-500 leading-relaxed space-y-2 border-t border-gray-100 pt-3">
          <p><b>Chips asignados:</b> cuenta filas cuya Fecha asignación distribuidor cae dentro del período elegido.</p>
          <p><b>Con/sin punto de venta:</b> mira si esas filas tienen Id de Punto de venta cargado.</p>
          <p><b>Prom. chips/día a PDV:</b> toma las filas cuya Fecha asignación punto venta cae en el período, y divide el total entre la cantidad de días distintos en que hubo al menos una entrega.</p>
          <p><b>Puntos pendientes y con chip por vencer:</b> no se filtran por período — son el estado actual.</p>
          <p><b>Puntos creados:</b> usa la columna Creado de la planilla de puntos de venta, dentro del período.</p>
          <p><b>Total puntos activos:</b> puntos del distribuidor sin fecha en Eliminado.</p>
          <p><b>Departamentos principales:</b> departamentos que representan 5% o más del total de puntos activos.</p>
          <p><b>Visitas por distribuidor:</b> sale del archivo de visitas, contando las filas con Fecha visita en cada día. Se excluyen filas con Estado Cancelado, Pendiente, Visita de autor suprimida o Visita permanente. Estas 6 columnas miran los últimos 6 días desde hoy.</p>
          <p><b>Stock le alcanza para:</b> chips sin punto de venta dividido el promedio diario de entrega. Rojo = 7 días o menos, ámbar = 15 días o menos.</p>
        </div>
      )}
    </div>
  );
}

function StockBadge({ r }: { r: DistribuidorRow }) {
  if (r.diasStock !== null) {
    const d = Math.round(r.diasStock);
    let bg = '#E6F1E8', color = '#3D7A4D', label = `${d} días`;
    if (d <= 7) { bg = '#FBE7E2'; color = '#B3402F'; label = `${d} días — crítico`; }
    else if (d <= 15) { bg = '#FBF0DD'; color = '#C6821F'; }
    return <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold whitespace-nowrap" style={{ background: bg, color }}>{label}</span>;
  }
  if (r.sinPdv === 0) {
    return <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold whitespace-nowrap" style={{ background: '#E6F1E8', color: '#3D7A4D' }}>Sin stock pendiente</span>;
  }
  return <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold whitespace-nowrap" style={{ background: '#EEF0F3', color: '#6B7180' }}>Sin datos</span>;
}

const DIST_COLS: { key: keyof DistribuidorRow; label: string }[] = [
  { key: 'nombre',      label: 'Distribuidor' },
  { key: 'empresa',     label: 'Empresa' },
  { key: 'asignados',   label: 'Chips asignados (período)' },
  { key: 'conPdv',      label: 'Con punto de venta' },
  { key: 'sinPdv',      label: 'Sin punto de venta' },
  { key: 'promedioDia', label: 'Prom. chips/día a PDV' },
  { key: 'pendientes',  label: 'Puntos pendientes' },
  { key: 'porVencer',   label: 'Vence en próximos 30d' },
  { key: 'creados',     label: 'Puntos creados (período)' },
  { key: 'totalPuntos', label: 'Total puntos activos' },
  { key: 'departamentosPrincipales', label: 'Departamentos principales' },
  { key: 'diasStock',   label: 'Stock le alcanza para' },
];

function DesempenoTab() {
  const [chipsAoa, setChipsAoa]     = useState<unknown[][] | null>(null);
  const [pdvAoa, setPdvAoa]         = useState<unknown[][] | null>(null);
  const [visitasAoa, setVisitasAoa] = useState<unknown[][] | null>(null);
  const [fileNames, setFileNames]   = useState<string[]>([]);
  const [status2, setStatus2]       = useState('');
  const [dragging2, setDragging2]   = useState(false);

  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd]     = useState('');
  const [desemp, setDesemp]           = useState<DesempenoResult | null>(null);

  const [searchDist, setSearchDist] = useState('');
  const [sortKey2, setSortKey2]     = useState<keyof DistribuidorRow>('asignados');
  const [sortDir2, setSortDir2]     = useState<'asc' | 'desc'>('desc');

  const inputRef2 = useRef<HTMLInputElement>(null);

  const handleFiles2 = useCallback(async (fileList: FileList) => {
    setStatus2('Leyendo archivos...');
    let localChips = chipsAoa, localPdv = pdvAoa, localVisitas = visitasAoa;
    const names: string[] = [];
    for (const file of Array.from(fileList)) {
      names.push(file.name);
      try {
        const aoa = await readAoaFromFile(file);
        if (!aoa || aoa.length < 2) continue;
        const kind = classifyDesempenoFile(aoa);
        if (kind === 'chips') localChips = aoa;
        else if (kind === 'pdv') localPdv = aoa;
        else if (kind === 'visitas') localVisitas = aoa;
      } catch (e) {
        setStatus2(`Error leyendo ${file.name}: ${e instanceof Error ? e.message : 'error'}`);
        return;
      }
    }
    setChipsAoa(localChips); setPdvAoa(localPdv); setVisitasAoa(localVisitas);
    setFileNames(prev => [...new Set([...prev, ...names])]);

    if (localChips && localPdv) {
      const { start, end } = defaultDesempenoPeriod(localChips);
      const s = toInputDate(start), e = toInputDate(end);
      setPeriodStart(s); setPeriodEnd(e);
      setStatus2(
        `Cargado: ${localChips.length - 1} chips, ${localPdv.length - 1} puntos de venta` +
        (localVisitas ? `, ${localVisitas.length - 1} visitas.` : '. Falta el archivo de visitas (Fecha visita) — sin él no se puede calcular "Visitas por distribuidor".')
      );
      setDesemp(parseDesempeno(localChips, localPdv, localVisitas, new Date(s + 'T00:00:00'), new Date(e + 'T23:59:59')));
    } else {
      setStatus2(`Falta el archivo de ${localChips ? 'puntos de venta' : 'distribuidor (a nivel de chip)'}.`);
    }
  }, [chipsAoa, pdvAoa, visitasAoa]);

  function handleCalcular() {
    if (!chipsAoa || !pdvAoa || !periodStart || !periodEnd) return;
    setDesemp(parseDesempeno(chipsAoa, pdvAoa, visitasAoa, new Date(periodStart + 'T00:00:00'), new Date(periodEnd + 'T23:59:59')));
  }

  function handleReset2() {
    setChipsAoa(null); setPdvAoa(null); setVisitasAoa(null);
    setDesemp(null); setFileNames([]); setStatus2('');
    setPeriodStart(''); setPeriodEnd(''); setSearchDist('');
  }

  function handleSort2(key: keyof DistribuidorRow) {
    if (sortKey2 === key) setSortDir2(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey2(key); setSortDir2('desc'); }
  }

  const filteredDist = useMemo(() => {
    if (!desemp) return [];
    let rows = desemp.distRows;
    if (searchDist) {
      const q = searchDist.toLowerCase();
      rows = rows.filter(r => r.nombre.toLowerCase().includes(q));
    }
    return [...rows].sort((a, b) => {
      const av = a[sortKey2], bv = b[sortKey2];
      let cmp: number;
      if (typeof av === 'number' && typeof bv === 'number') cmp = av - bv;
      else cmp = String(av ?? '').localeCompare(String(bv ?? ''), 'es');
      return sortDir2 === 'asc' ? cmp : -cmp;
    });
  }, [desemp, searchDist, sortKey2, sortDir2]);

  const dayCols = useMemo(() => {
    const today = new Date();
    return [5, 4, 3, 2, 1, 0].map(daysAgo => {
      const d = new Date(today); d.setDate(d.getDate() - daysAgo);
      const label = daysAgo === 0 ? 'Hoy' : daysAgo === 1 ? 'Ayer' : `Hace ${daysAgo} días`;
      return { daysAgo, label, dateStr: d.toLocaleDateString('es-UY') };
    });
  }, []);

  if (!desemp) {
    return (
      <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-xl mx-auto">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-100 rounded-2xl mb-3">
            <Upload size={28} className="text-[#003DA5]" />
          </div>
          <h2 className="text-xl font-bold text-gray-800">Desempeño de distribuidores</h2>
          <p className="text-sm text-gray-500 mt-1">
            Subí el archivo a nivel de chip (<strong>MID</strong>, Id Distribuidor, Fecha asignación distribuidor, etc.),
            el de puntos de venta (<strong>Departamento</strong>, Estado última visita, Fecha vencimiento, Creado)
            y opcionalmente el de visitas (Distribuidor, Estado, Fecha visita). Podés arrastrar los tres juntos.
          </p>
        </div>

        <div
          onDragOver={e => { e.preventDefault(); setDragging2(true); }}
          onDragLeave={() => setDragging2(false)}
          onDrop={e => { e.preventDefault(); setDragging2(false); if (e.dataTransfer.files.length) handleFiles2(e.dataTransfer.files); }}
          onClick={() => inputRef2.current?.click()}
          className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${
            dragging2 ? 'border-[#003DA5] bg-blue-50' : 'border-gray-300 hover:border-[#003DA5] hover:bg-blue-50/30'
          }`}
        >
          <input
            ref={inputRef2} type="file" accept=".xlsx,.xls,.csv" multiple className="hidden"
            onChange={e => { if (e.target.files?.length) handleFiles2(e.target.files); }}
          />
          <div className="flex justify-center mb-4">
            <div className={`p-4 rounded-full ${dragging2 ? 'bg-blue-100' : 'bg-gray-100'}`}>
              <Upload size={32} className={dragging2 ? 'text-[#003DA5]' : 'text-gray-400'} />
            </div>
          </div>
          <p className="font-semibold text-gray-700 text-lg">Arrastrá los archivos aquí</p>
          <p className="text-gray-400 text-sm mt-1">o hacé clic para seleccionarlos</p>
          <p className="text-gray-400 text-xs mt-2">Formatos: .xlsx, .xls, .csv</p>
        </div>

        {fileNames.length > 0 && <div className="text-xs text-gray-500 mt-2 font-mono">{fileNames.join(', ')}</div>}
        {status2 && (
          <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700 flex items-start gap-2">
            <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
            <span>{status2}</span>
          </div>
        )}
      </div>
      </div>
    );
  }

  return (
    <>
      {/* PARTE FIJA — período, búsqueda */}
      <div style={{ flexShrink: 0 }} className="px-6 pt-4">
        <div className="flex flex-wrap items-center gap-3 bg-white rounded-xl border border-gray-200 px-5 py-3 mb-3">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Período — desde:</span>
          <input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)}
            className="border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-[#003DA5]" />
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">hasta:</span>
          <input type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)}
            className="border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-[#003DA5]" />
          <button onClick={handleCalcular}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#003DA5] hover:bg-blue-800 text-white text-sm font-medium rounded-lg transition-colors">
            <RefreshCw size={14} /> Calcular
          </button>
          <button onClick={handleReset2}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition-colors">
            <RefreshCw size={14} /> Cambiar archivos
          </button>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 px-5 py-4 flex flex-wrap gap-3 items-center">
          <input
            type="text" placeholder="🔍 Buscar distribuidor..." value={searchDist}
            onChange={e => setSearchDist(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-[#003DA5] min-w-[220px]"
          />
          <span className="text-sm text-gray-400 whitespace-nowrap font-medium ml-auto">{filteredDist.length} distribuidores</span>
        </div>
      </div>

      {/* TABLAS — scroll propio */}
      <div style={{
        flex: 1, minHeight: 0, minWidth: 0, overflowY: 'auto', overflowX: 'auto',
        border: '1px solid #E2E8F0', borderRadius: 8, margin: '12px 24px',
        padding: '0 16px',
      }}>

      {/* Resumen por empresa */}
      <div className="pt-4">
        <h3 className="text-sm font-bold text-gray-700 mb-2">Resumen por empresa (período)</h3>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-6">
            <table style={{ width: '100%', borderCollapse: 'collapse' }} className="text-sm">
              <thead style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: '#003DA5' }}>
                <tr>
                  {['Empresa', 'Chips armados', 'Activados', '% no OK', 'Sin distribuidor asignado'].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left text-[11px] font-semibold text-white bg-[#003DA5] whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {desemp.empresaRows.map((r, i) => (
                  <tr key={r.empresa} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                    <td className="px-3 py-2 border-b border-gray-100 text-xs font-medium">{r.empresa}</td>
                    <td className="px-3 py-2 border-b border-gray-100 text-xs text-right tabular-nums">{r.armados}</td>
                    <td className="px-3 py-2 border-b border-gray-100 text-xs text-right tabular-nums">{r.activados}</td>
                    <td className="px-3 py-2 border-b border-gray-100 text-xs text-right tabular-nums">{(r.noOkPct * 100).toFixed(2)}%</td>
                    <td className="px-3 py-2 border-b border-gray-100 text-xs text-right tabular-nums">{r.sinDistribuidor}</td>
                  </tr>
                ))}
                {desemp.empresaRows.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-6 text-center text-sm text-gray-400">Sin datos en el período elegido</td></tr>
                )}
              </tbody>
            </table>
        </div>
      </div>

      {/* Visitas por distribuidor */}
      <div>
        <h3 className="text-sm font-bold text-gray-700 mb-2">Visitas por distribuidor (últimos 6 días)</h3>
        {!desemp.hasVisitas && (
          <p className="text-xs text-amber-600 mb-2">Falta el archivo de visitas — no se puede calcular esta tabla.</p>
        )}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-6">
            <table style={{ width: '100%', borderCollapse: 'collapse' }} className="text-sm">
              <thead style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: '#003DA5' }}>
                <tr>
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-white bg-[#003DA5] whitespace-nowrap">Distribuidor</th>
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-white bg-[#003DA5] whitespace-nowrap">Empresa</th>
                  {dayCols.map(c => (
                    <th key={c.daysAgo} className="px-3 py-2.5 text-left text-[11px] font-semibold text-white bg-[#003DA5] whitespace-nowrap">
                      {c.label}<br /><span className="font-normal text-[10px] text-blue-200">{c.dateStr}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {desemp.distRows.map((r, i) => (
                  <tr key={r.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                    <td className="px-3 py-2 border-b border-gray-100 text-xs font-medium">{r.nombre}</td>
                    <td className="px-3 py-2 border-b border-gray-100 text-xs">{r.empresa}</td>
                    {dayCols.map(c => {
                      const valor = r.diasCount[c.daysAgo];
                      const priorActivity = c.daysAgo <= 1 && r.diasCount
                        .slice(c.daysAgo + 1)
                        .some(v => v > 0);
                      const inactivo = valor === 0 && priorActivity;
                      return (
                        <td
                          key={c.daysAgo}
                          className={`px-3 py-2 border-b border-gray-100 text-xs text-right tabular-nums ${inactivo ? 'font-bold' : ''}`}
                          style={inactivo ? { color: '#E3000F' } : undefined}
                        >
                          {valor}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {desemp.distRows.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-6 text-center text-sm text-gray-400">Sin distribuidores</td></tr>
                )}
              </tbody>
            </table>
        </div>
      </div>

      {/* Por distribuidor (detalle) */}
      <div>
        <h3 className="text-sm font-bold text-gray-700 mb-2">Por distribuidor</h3>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-4">
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1200 }} className="text-sm">
              <thead style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: '#003DA5' }}>
                <tr>
                  {DIST_COLS.map(col => (
                    <th
                      key={col.key}
                      onClick={() => handleSort2(col.key)}
                      className="px-3 py-2.5 text-left text-[11px] font-semibold text-white bg-[#003DA5] whitespace-nowrap cursor-pointer hover:bg-[#002d7a] select-none"
                    >
                      <span className="flex items-center gap-0.5">
                        {col.label}
                        {sortKey2 === col.key
                          ? (sortDir2 === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />)
                          : <span className="w-3 inline-block" />}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredDist.map((r, i) => (
                  <tr key={r.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                    <td className="px-3 py-2 border-b border-gray-100 text-xs font-medium">{r.nombre}</td>
                    <td className="px-3 py-2 border-b border-gray-100 text-xs">{r.empresa}</td>
                    <td className="px-3 py-2 border-b border-gray-100 text-xs text-right tabular-nums">{r.asignados}</td>
                    <td className="px-3 py-2 border-b border-gray-100 text-xs text-right tabular-nums">{r.conPdv}</td>
                    <td className="px-3 py-2 border-b border-gray-100 text-xs text-right tabular-nums">{r.sinPdv}</td>
                    <td className="px-3 py-2 border-b border-gray-100 text-xs text-right tabular-nums">{r.promedioDia.toFixed(1)}</td>
                    <td className="px-3 py-2 border-b border-gray-100 text-xs text-right tabular-nums">{r.pendientes}</td>
                    <td className="px-3 py-2 border-b border-gray-100 text-xs text-right tabular-nums">{r.porVencer}</td>
                    <td className="px-3 py-2 border-b border-gray-100 text-xs text-right tabular-nums">{r.creados}</td>
                    <td className="px-3 py-2 border-b border-gray-100 text-xs text-right tabular-nums">{r.totalPuntos}</td>
                    <td className="px-3 py-2 border-b border-gray-100 text-xs max-w-[220px]">{r.departamentosPrincipales || '—'}</td>
                    <td className="px-3 py-2 border-b border-gray-100"><StockBadge r={r} /></td>
                  </tr>
                ))}
                {filteredDist.length === 0 && (
                  <tr><td colSpan={DIST_COLS.length} className="px-4 py-10 text-center text-sm text-gray-400">Sin resultados</td></tr>
                )}
              </tbody>
            </table>
        </div>
      </div>

      <DesempenoFootnote />

      </div>
    </>
  );
}

// ── Tab 3: Activaciones por empresa (6 meses) ────────────────────────────────────

function Kpi3Card({ label, value, borderColor, valueColor }: {
  label: string; value: string | number; borderColor: string; valueColor?: string;
}) {
  const isNum = typeof value === 'number';
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4" style={{ borderTop: `3px solid ${borderColor}` }}>
      <div className={isNum ? 'text-2xl font-bold' : 'text-base font-bold'} style={{ color: valueColor ?? '#1A1A2E' }}>
        {isNum ? (value as number).toLocaleString('es-UY') : value}
      </div>
      <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mt-1">{label}</div>
    </div>
  );
}

const CHART3_PALETTE = [
  '#003DA5', '#E3000F', '#28a745', '#fd7e14', '#6f42c1',
  '#20c997', '#0052CC', '#dc3545', '#6c757d', '#ffc107',
];

function GroupedBarChart3({ categories, series, colors }: {
  categories: string[]; series: { name: string; values: number[] }[]; colors: string[];
}) {
  const W = 900, H = 320, padL = 54, padR = 16, padT = 24, padB = 50;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const maxVal = Math.max(1, ...series.flatMap(s => s.values));
  const niceMax = niceCeil3(maxVal);
  const groupW = plotW / Math.max(1, categories.length);
  const barGap = 5;
  const barW = Math.max(4, (groupW - barGap * (series.length + 1)) / series.length);
  const steps = 4;

  const gridEls: ReactNode[] = [];
  for (let i = 0; i <= steps; i++) {
    const y = padT + plotH - (plotH * i / steps);
    const v = Math.round(niceMax * i / steps);
    gridEls.push(
      <line key={`g${i}`} x1={padL} y1={y} x2={W - padR} y2={y} stroke="#E2E8F0" strokeWidth={1} />,
      <text key={`t${i}`} x={padL - 8} y={y + 4} textAnchor="end" fontSize={10} fill="#4A4A6A" fontFamily="monospace">{v.toLocaleString('es-UY')}</text>,
    );
  }

  const barEls: ReactNode[] = [];
  categories.forEach((cat, ci) => {
    const groupX = padL + ci * groupW;
    series.forEach((s, si) => {
      const val = s.values[ci] || 0;
      const barH = plotH * (val / niceMax);
      const x = groupX + barGap + si * (barW + barGap);
      const y = padT + plotH - barH;
      barEls.push(
        <rect key={`b${ci}-${si}`} x={x} y={y} width={barW} height={barH} style={{ fill: colors[si % colors.length] }} rx={2}>
          <title>{s.name} — {cat}: {val}</title>
        </rect>,
      );
      if (val > 0 && barW >= 9) {
        barEls.push(
          <text key={`v${ci}-${si}`} x={x + barW / 2} y={y - 4} textAnchor="middle" fontSize={9} fill="#1A1A2E" fontFamily="monospace">{val}</text>,
        );
      }
    });
    barEls.push(
      <text key={`c${ci}`} x={groupX + groupW / 2} y={H - padB + 18} textAnchor="middle" fontSize={10.5} fill="#1A1A2E" fontWeight={600}>{cat}</text>,
    );
  });

  return (
    <div>
      {series.length > 1 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 mb-2 text-xs text-gray-700">
          {series.map((s, si) => (
            <span key={s.name} className="inline-flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: colors[si % colors.length] }} />
              {s.name}
            </span>
          ))}
        </div>
      )}
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block', background: '#ffffff' }}>
        {gridEls}
        {barEls}
      </svg>
    </div>
  );
}

function Tab3Footnote() {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-4">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-3 text-left"
      >
        <span className="text-sm font-semibold text-gray-700">ℹ️ Cómo se calcula</span>
        {open ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
      </button>
      {open && (
        <div className="px-5 pb-4 text-xs text-gray-500 leading-relaxed space-y-2 border-t border-gray-100 pt-3">
          <p>Se toma la columna <b>Fecha asignación punto venta</b> de cada chip del archivo de Activaciones — es la fecha en la que ese chip quedó entregado a un punto de venta. La <b>fecha de referencia</b> es por defecto la más reciente que aparece en esa columna, pero se puede fijar manualmente arriba y volver a calcular.</p>
          <p><b>Períodos comparables:</b> se arman 6 meses calendario (el mes de la fecha de referencia y los 5 anteriores), pero en cada uno de esos 6 meses solo se cuentan los chips asignados entre el día 1 y el mismo día del mes que tiene la fecha de referencia — así el mes en curso, que suele estar incompleto, se compara parejo contra los meses anteriores y no queda en desventaja. Los chips sin esa fecha cargada, o los que caen fuera de ese rango de 6 meses o después del día de corte en su mes, no se cuentan.</p>
          <p><b>Por empresa:</b> agrupa la cantidad de chips por Empresa y mes (dentro de la ventana 1–día de corte), con una gráfica de barras agrupadas para comparar el ritmo de asignación de cada empresa mes a mes.</p>
          <p><b>Total general:</b> suma de todas las empresas en cada uno de los 6 períodos, para ver la tendencia global.</p>
          <p><b>Variación último mes vs. anterior:</b> compara el total del último período contra el del período previo, ambos ya recortados al mismo rango de días, por lo que la comparación es pareja.</p>
        </div>
      )}
    </div>
  );
}

function toInputDate3(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function Tab3Panel() {
  const [aoa, setAoa]           = useState<unknown[][] | null>(null);
  const [cols, setCols]         = useState<Tab3Cols | null>(null);
  const [fileName, setFileName] = useState('');
  const [loading, setLoading]   = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [refDate, setRefDate]   = useState('');
  const [result, setResult]     = useState<Tab3Result | null>(null);

  const handleFile3 = useCallback(async (file: File) => {
    setLoading(true); setErrorMsg(''); setFileName(file.name);
    try {
      const r = await parseTab3(file);
      setAoa(r.aoa); setCols(r.cols);
      const s = toInputDate3(r.refDate);
      setRefDate(s);
      setResult(runTab3Analysis(r.aoa, r.cols, r.refDate));
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Error al procesar el archivo');
    }
    setLoading(false);
  }, []);

  function handleRecalcular3() {
    if (!aoa || !cols || !refDate) return;
    setResult(runTab3Analysis(aoa, cols, new Date(refDate + 'T12:00:00')));
  }

  function handleReset3() {
    setAoa(null); setCols(null); setFileName(''); setErrorMsg('');
    setRefDate(''); setResult(null);
  }

  if (!result) {
    return (
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-xl mx-auto">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-100 rounded-2xl mb-3">
              <Upload size={28} className="text-[#003DA5]" />
            </div>
            <h2 className="text-xl font-bold text-gray-800">Cargar archivo de Activaciones</h2>
            <p className="text-sm text-gray-500 mt-1">
              Subí el archivo de Activaciones con columnas <strong>Empresa</strong> y{' '}
              <strong>Fecha asignación punto venta</strong>, con al menos 7 meses de historia.
              El reporte compara el mismo rango de días en cada uno de los últimos 6 meses.
            </p>
          </div>
          <FileUploader onFile={handleFile3} accept=".xlsx,.xls,.csv" />
          {loading && (
            <div className="mt-4 flex items-center justify-center gap-2 text-gray-500 text-sm">
              <Loader2 size={16} className="animate-spin" /> Procesando archivo...
            </div>
          )}
          {errorMsg && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 whitespace-pre-line flex items-start gap-2">
              <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}
          {fileName && !errorMsg && !loading && (
            <div className="text-xs text-gray-400 mt-2">{fileName}</div>
          )}
        </div>
      </div>
    );
  }

  const { periods, rows, totalPorPeriodo, cutoffDay, sinFecha, fueraDeRango, fueraDeCorte, detail } = result;
  const totalGeneral = totalPorPeriodo.reduce((a, b) => a + b, 0);

  let bestIdx = 0;
  totalPorPeriodo.forEach((v, i) => { if (v > totalPorPeriodo[bestIdx]) bestIdx = i; });
  const mejorLabel = totalGeneral > 0
    ? `${periods[bestIdx].label} (${totalPorPeriodo[bestIdx].toLocaleString('es-UY')})`
    : '—';

  const last = totalPorPeriodo[5], prev = totalPorPeriodo[4];
  let varLabel = '—', varColor = '#16a34a';
  if (prev > 0) {
    const pct = ((last - prev) / prev) * 100;
    varLabel = `${pct >= 0 ? '+' : ''}${pct.toFixed(0)}%`;
    varColor = pct < 0 ? '#dc2626' : '#16a34a';
  }

  const noteParts = [
    `Comparando el día 1 al ${cutoffDay} de cada mes (según fecha de referencia)`,
    `Períodos: ${periods[0].label} – ${periods[5].label}`,
  ];
  if (sinFecha)     noteParts.push(`${sinFecha.toLocaleString('es-UY')} filas sin fecha de asignación a PDV`);
  if (fueraDeRango) noteParts.push(`${fueraDeRango.toLocaleString('es-UY')} filas fuera del rango de 6 meses`);
  if (fueraDeCorte) noteParts.push(`${fueraDeCorte.toLocaleString('es-UY')} filas después del día ${cutoffDay} de su mes (excluidas para comparar parejo)`);

  const categories = periods.map(p => p.label);
  const seriesEmpresas = rows.map(r => ({ name: r.empresa, values: r.values }));

  return (
    <>
      {/* PARTE FIJA — fecha de referencia, KPIs */}
      <div style={{ flexShrink: 0 }} className="px-6 pt-4">
        <div className="flex flex-wrap items-center gap-3 bg-white rounded-xl border border-gray-200 px-5 py-3 mb-3">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Fecha de referencia (último día asignado a PDV):</span>
          <input
            type="date" value={refDate} onChange={e => setRefDate(e.target.value)}
            className="border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-[#003DA5]"
          />
          <button
            onClick={handleRecalcular3}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#003DA5] hover:bg-blue-800 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <RefreshCw size={14} /> Recalcular
          </button>
          <span className="text-xs text-gray-400">{noteParts.join(' | ')}</span>
          <div className="ml-auto flex gap-2">
            <button onClick={() => exportTab3Excel(periods, rows, totalPorPeriodo, detail)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors">
              <FileSpreadsheet size={15} /> Excel
            </button>
            <button onClick={() => exportTab3PDF(periods, rows, totalPorPeriodo)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors">
              <Download size={15} /> PDF
            </button>
            <button onClick={handleReset3}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition-colors">
              <RefreshCw size={15} /> Cambiar archivo
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8, marginBottom: 12 }}>
          <Kpi3Card label="Chips asignados a PDV (6m)" value={totalGeneral} borderColor="#20c997" valueColor="#20c997" />
          <Kpi3Card label="Promedio mensual" value={Math.round(totalGeneral / 6)} borderColor="#20c997" valueColor="#20c997" />
          <Kpi3Card label="Mes con más asignaciones" value={mejorLabel} borderColor="#fd7e14" />
          <Kpi3Card label="Var. último mes vs. anterior" value={varLabel} borderColor={varColor} valueColor={varColor} />
        </div>
      </div>

      {/* Contenido — scroll propio */}
      <div style={{
        flex: 1, minHeight: 0, minWidth: 0, overflowY: 'auto', overflowX: 'auto',
        border: '1px solid #E2E8F0', borderRadius: 8, margin: '0 24px 16px', padding: 16,
      }}>
        <h3 className="text-sm font-bold text-gray-700 mb-2">Chips asignados a punto de venta por empresa — últimos 6 meses</h3>
        <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
          {seriesEmpresas.length
            ? <GroupedBarChart3 categories={categories} series={seriesEmpresas} colors={CHART3_PALETTE} />
            : <p className="text-sm text-gray-400">Sin datos para el período.</p>}
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-6 overflow-x-auto">
          <table style={{ width: '100%', borderCollapse: 'collapse' }} className="text-sm">
            <thead style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: '#003DA5' }}>
              <tr>
                <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-white bg-[#003DA5] whitespace-nowrap">Empresa</th>
                {periods.map(p => (
                  <th key={p.key} className="px-3 py-2.5 text-right text-[11px] font-semibold text-white bg-[#003DA5] whitespace-nowrap">{p.label}</th>
                ))}
                <th className="px-3 py-2.5 text-right text-[11px] font-semibold text-white bg-[#003DA5] whitespace-nowrap">Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.empresa} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                  <td className="px-3 py-2 border-b border-gray-100 text-xs font-medium">{r.empresa}</td>
                  {r.values.map((v, vi) => (
                    <td key={vi} className="px-3 py-2 border-b border-gray-100 text-xs text-right tabular-nums">{v.toLocaleString('es-UY')}</td>
                  ))}
                  <td className="px-3 py-2 border-b border-gray-100 text-xs text-right tabular-nums font-bold">{r.total.toLocaleString('es-UY')}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={periods.length + 2} className="px-4 py-8 text-center text-sm text-gray-400">Sin datos en el rango de 6 meses.</td></tr>
              )}
              <tr className="bg-gray-100 font-bold">
                <td className="px-3 py-2 text-xs">TOTAL</td>
                {totalPorPeriodo.map((v, i) => (
                  <td key={i} className="px-3 py-2 text-xs text-right tabular-nums">{v.toLocaleString('es-UY')}</td>
                ))}
                <td className="px-3 py-2 text-xs text-right tabular-nums">{totalGeneral.toLocaleString('es-UY')}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h3 className="text-sm font-bold text-gray-700 mb-2">Total general — todas las empresas</h3>
        <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
          <GroupedBarChart3 categories={categories} series={[{ name: 'Total', values: totalPorPeriodo }]} colors={['#003DA5']} />
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-4 overflow-x-auto">
          <table style={{ width: '100%', borderCollapse: 'collapse' }} className="text-sm">
            <thead style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: '#003DA5' }}>
              <tr>
                <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-white bg-[#003DA5] whitespace-nowrap">Período</th>
                <th className="px-3 py-2.5 text-right text-[11px] font-semibold text-white bg-[#003DA5] whitespace-nowrap">Chips asignados a PDV</th>
              </tr>
            </thead>
            <tbody>
              {periods.map((p, i) => (
                <tr key={p.key} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                  <td className="px-3 py-2 border-b border-gray-100 text-xs font-medium">{p.label}</td>
                  <td className="px-3 py-2 border-b border-gray-100 text-xs text-right tabular-nums">{totalPorPeriodo[i].toLocaleString('es-UY')}</td>
                </tr>
              ))}
              <tr className="bg-gray-100 font-bold">
                <td className="px-3 py-2 text-xs">Total 6 meses</td>
                <td className="px-3 py-2 text-xs text-right tabular-nums">{totalGeneral.toLocaleString('es-UY')}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <Tab3Footnote />
      </div>
    </>
  );
}
