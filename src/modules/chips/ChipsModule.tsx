import { useState, useMemo, useCallback, useRef } from 'react';
import {
  AlertTriangle, FileSpreadsheet, Download, RefreshCw, Upload, Loader2,
  ChevronUp, ChevronDown,
} from 'lucide-react';
import Header from '../../components/Header';
import FileUploader from '../../components/FileUploader';
import {
  parseChips, type ChipResult, type ParseResult,
  readAoaFromFile, classifyDesempenoFile, defaultDesempenoPeriod, parseDesempeno,
  type DesempenoResult, type DistribuidorRow,
} from './chipsParser';
import { exportChipsExcel, exportChipsPDF } from './ChipsExport';

type Stage = 'upload' | 'loading' | 'analysis' | 'error';
type ModuleTab = 'asignar' | 'desempeno';

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
    <div className="bg-white rounded-lg border border-gray-200 p-4" style={{ borderTop: `4px solid ${color}` }}>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">{label}</div>
      <div className="text-[26px] font-bold leading-none mt-1.5" style={{ color }}>
        {value.toLocaleString('es-UY')}
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

type ColDef = { key: keyof ChipResult; label: string };

const COLS: ColDef[] = [
  { key: 'empresa',           label: 'Empresa' },
  { key: 'distribuidor',      label: 'Distribuidor' },
  { key: 'idDistribuidor',    label: 'ID Distribuidor' },
  { key: 'pdvNombre',         label: 'Punto de venta' },
  { key: 'pdvId',             label: 'ID punto' },
  { key: 'departamento',      label: 'Depto.' },
  { key: 'visitas8m',         label: 'Visitas 8m' },
  { key: 'asignados8m',       label: 'Asignados 8m' },
  { key: 'activaciones8m',    label: 'Activados 8m' },
  { key: 'pct8m',             label: '% activ. 8m' },
  { key: 'ritmoReciente',     label: 'Ritmo reciente (chips/mes)' },
  { key: 'alerta',            label: 'Alerta' },
  { key: 'ultimaAsignacion',  label: 'Última entrega' },
  { key: 'ultimaQty',         label: 'Chips últ. entrega' },
  { key: 'ultimaActivos',     label: 'Activ. últ. entrega' },
  { key: 'ultimaPct',         label: '% últ. entrega' },
  { key: 'estadoVisita',      label: 'Estado visita' },
  { key: 'fechaCambioEstado', label: 'Último cambio de estado' },
  { key: 'vencimiento',       label: 'Vencimiento' },
  { key: 'situacion',         label: 'Situación' },
  { key: 'sugerido',          label: 'Sugerido' },
];

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
      <button onClick={handleReset}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition-colors">
        <RefreshCw size={15} /> Cambiar archivo
      </button>
    </>
  ) : undefined;

  return (
    <div className="flex flex-col h-full">
      <Header title="Chips" subtitle={subtitle} actions={headerActions} />

      <div className="bg-white border-b border-gray-200 px-6 pt-3 flex gap-2">
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
      </div>

      <div className="flex-1 overflow-y-auto p-6">

        <div className={moduleTab === 'asignar' ? '' : 'hidden'}>

        {/* ── Upload / Error ── */}
        {(stage === 'upload' || stage === 'error') && (
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
        )}

        {/* ── Loading ── */}
        {stage === 'loading' && (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <Loader2 size={36} className="animate-spin text-[#003DA5] mx-auto mb-3" />
              <p className="text-gray-500">Procesando archivo...</p>
            </div>
          </div>
        )}

        {/* ── Analysis ── */}
        {stage === 'analysis' && parseResult && (
          <div className="space-y-6">

            {/* Fecha de referencia */}
            <div className="flex flex-wrap items-center gap-3 bg-white rounded-xl border border-gray-200 px-5 py-3">
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
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
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

            {/* Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[1700px]">
                  <thead>
                    <tr>
                      {COLS.map(col => (
                        <th
                          key={col.key}
                          onClick={() => handleSort(col.key)}
                          className="px-3 py-2.5 text-left text-[11px] font-semibold text-white bg-[#003DA5] whitespace-nowrap cursor-pointer hover:bg-[#002d7a] select-none"
                        >
                          <span className="flex items-center gap-0.5">
                            {col.label}
                            {sortKey === col.key
                              ? (sortDir === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />)
                              : <span className="w-3 inline-block" />}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {paged.map((r, i) => (
                      <tr key={r.pdvId + '-' + i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                        <td className="px-3 py-2 border-b border-gray-100 text-xs">{r.empresa      || '—'}</td>
                        <td className="px-3 py-2 border-b border-gray-100 text-xs">{r.distribuidor || '—'}</td>
                        <td className="px-3 py-2 border-b border-gray-100 text-xs text-gray-400">{r.idDistribuidor || '—'}</td>
                        <td className="px-3 py-2 border-b border-gray-100 text-xs font-medium max-w-[220px] truncate">{r.pdvNombre || r.pdvId}</td>
                        <td className="px-3 py-2 border-b border-gray-100 text-xs text-gray-400">{r.pdvId}</td>
                        <td className="px-3 py-2 border-b border-gray-100 text-xs">{r.departamento || '—'}</td>
                        <td className="px-3 py-2 border-b border-gray-100 text-xs text-right tabular-nums">{r.visitas8m}</td>
                        <td className="px-3 py-2 border-b border-gray-100 text-xs text-right tabular-nums">{r.asignados8m}</td>
                        <td className="px-3 py-2 border-b border-gray-100 text-xs text-right tabular-nums">{r.activaciones8m}</td>
                        <td className="px-3 py-2 border-b border-gray-100 text-xs text-right tabular-nums">{pctStr(r.pct8m)}</td>
                        <td className="px-3 py-2 border-b border-gray-100 text-xs text-right tabular-nums">
                          {r.ritmoReciente.toFixed(2)}
                          {!r.tieneDatosRecientes && <span className="text-gray-300 ml-0.5 text-[10px]">*</span>}
                        </td>
                        <td className="px-3 py-2 border-b border-gray-100"><TendBadge r={r} /></td>
                        <td className="px-3 py-2 border-b border-gray-100 text-xs text-gray-500">{fmt(r.ultimaAsignacion)}</td>
                        <td className="px-3 py-2 border-b border-gray-100 text-xs text-right tabular-nums">{r.ultimaQty}</td>
                        <td className="px-3 py-2 border-b border-gray-100 text-xs text-right tabular-nums">{r.ultimaActivos}</td>
                        <td className="px-3 py-2 border-b border-gray-100 text-xs text-right tabular-nums">{pctStr(r.ultimaPct)}</td>
                        <td className="px-3 py-2 border-b border-gray-100 text-xs">{r.estadoVisita || '—'}</td>
                        <td className="px-3 py-2 border-b border-gray-100 text-xs text-gray-500">{fmt(r.fechaCambioEstado)}</td>
                        <td className="px-3 py-2 border-b border-gray-100 text-xs text-gray-500">{fmt(r.vencimiento)}</td>
                        <td className="px-3 py-2 border-b border-gray-100"><SituBadge r={r} /></td>
                        <td className="px-3 py-2 border-b border-gray-100 text-right tabular-nums font-bold text-sm">
                          {r.sugerido > 0
                            ? <span style={{ color: '#d97706' }}>{r.sugerido}</span>
                            : <span className="text-gray-300 font-normal">—</span>}
                        </td>
                      </tr>
                    ))}
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

              {/* Table footer */}
              <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between flex-wrap gap-3">
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
            </div>

            <InfoFootnote />

          </div>
        )}
        </div>

        <div className={moduleTab === 'desempeno' ? '' : 'hidden'}>
          <DesempenoTab />
        </div>

      </div>
    </div>
  );
}

// ── Tab 2: Desempeño de distribuidores ─────────────────────────────────────────

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
        (localVisitas ? `, ${localVisitas.length - 1} visitas.` : '. Falta el archivo de visitas — sin él no se puede calcular "Visitas por distribuidor".')
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
    );
  }

  return (
    <div className="space-y-6">

      <div className="flex flex-wrap items-center gap-3 bg-white rounded-xl border border-gray-200 px-5 py-3">
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

      {/* Resumen por empresa */}
      <div>
        <h3 className="text-sm font-bold text-gray-700 mb-2">Resumen por empresa (período)</h3>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
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
      </div>

      {/* Visitas por distribuidor */}
      <div>
        <h3 className="text-sm font-bold text-gray-700 mb-2">Visitas por distribuidor (últimos 6 días)</h3>
        {!desemp.hasVisitas && (
          <p className="text-xs text-amber-600 mb-2">Falta el archivo de visitas — no se puede calcular esta tabla.</p>
        )}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
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
                    {dayCols.map(c => (
                      <td key={c.daysAgo} className="px-3 py-2 border-b border-gray-100 text-xs text-right tabular-nums">{r.diasCount[c.daysAgo]}</td>
                    ))}
                  </tr>
                ))}
                {desemp.distRows.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-6 text-center text-sm text-gray-400">Sin distribuidores</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Por distribuidor (detalle) */}
      <div>
        <h3 className="text-sm font-bold text-gray-700 mb-2">Por distribuidor</h3>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[1200px]">
              <thead>
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
      </div>

    </div>
  );
}
