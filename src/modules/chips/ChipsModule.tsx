import { useState, useMemo, useCallback } from 'react';
import {
  MapPin, TrendingUp, AlertTriangle, Clock, Eye,
  FileSpreadsheet, Download, RefreshCw, Upload, Loader2,
  ChevronUp, ChevronDown,
} from 'lucide-react';
import Header from '../../components/Header';
import KPICard from '../../components/KPICard';
import FileUploader from '../../components/FileUploader';
import { parseChips, type ChipResult, type ParseResult } from './chipsParser';
import { exportChipsExcel, exportChipsPDF } from './ChipsExport';

type Stage = 'upload' | 'loading' | 'analysis' | 'error';

// ── Situation colors ──────────────────────────────────────────────────────────

const SITU: Record<string, { bg: string; color: string }> = {
  ok:            { bg: '#16a34a', color: '#fff' },
  'amber-plain': { bg: '#d97706', color: '#fff' },
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
  const pct = Math.round(Math.abs(r.alertaPct ?? 0) * 100);
  return r.alerta === 'baja'
    ? <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-red-100 text-red-700">▼ Baja {pct}%</span>
    : <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-green-100 text-green-700">▲ Suba {pct}%</span>;
}

function fmt(d: Date | null): string {
  if (!d) return '—';
  return d.toLocaleDateString('es-UY');
}

function pctStr(v: number): string {
  return `${Math.round(v * 100)}%`;
}

// ── Table column definitions ──────────────────────────────────────────────────

type ColDef = { key: keyof ChipResult; label: string; numeric?: boolean };

const COLS: ColDef[] = [
  { key: 'empresa',         label: 'Empresa' },
  { key: 'distribuidor',    label: 'Distribuidor' },
  { key: 'idDistribuidor',  label: 'ID Dist.' },
  { key: 'pdvNombre',       label: 'Punto de Venta' },
  { key: 'pdvId',           label: 'ID PDV' },
  { key: 'departamento',    label: 'Depto' },
  { key: 'visitas8m',       label: 'Visitas 8M',    numeric: true },
  { key: 'asignados8m',     label: 'Chips 8M',      numeric: true },
  { key: 'activaciones8m',  label: 'Activos 8M',    numeric: true },
  { key: 'pct8m',           label: '% Activ',       numeric: true },
  { key: 'ritmoReciente',   label: 'Ritmo/Mes',     numeric: true },
  { key: 'alerta',          label: 'Tendencia' },
  { key: 'ultimaAsignacion',label: 'Última Asig.' },
  { key: 'ultimaQty',       label: 'Últ. Cant.',    numeric: true },
  { key: 'ultimaActivos',   label: 'Últ. Activos',  numeric: true },
  { key: 'ultimaPct',       label: 'Últ. %',        numeric: true },
  { key: 'vencimiento',     label: 'Vence' },
  { key: 'situacion',       label: 'Situación' },
  { key: 'sugerido',        label: 'Sugerido',      numeric: true },
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
  const [filtSolo, setFiltSolo]         = useState(false);

  const [sortKey, setSortKey]           = useState<keyof ChipResult>('sugerido');
  const [sortDir, setSortDir]           = useState<'asc' | 'desc'>('desc');
  const [page, setPage]                 = useState(1);

  const results = parseResult?.results ?? [];

  const empresas = useMemo(() => [...new Set(results.map(r => r.empresa).filter(Boolean))].sort(), [results]);
  const dists    = useMemo(() => [...new Set(results.map(r => r.distribuidor).filter(Boolean))].sort(), [results]);
  const deptos   = useMemo(() => [...new Set(results.map(r => r.departamento).filter(Boolean))].sort(), [results]);
  const estados  = useMemo(() => [...new Set(results.map(r => r.estadoVisita).filter(Boolean))].sort(), [results]);

  const kpiRepo     = useMemo(() => results.filter(r => r.sugerido > 0).length, [results]);
  const kpiExpiring = useMemo(() => results.filter(r => r.situacion.includes('expir')).length, [results]);
  const kpiNoAct    = useMemo(() => results.filter(r => r.situacion === 'expired_noact').length, [results]);
  const kpiCheckup  = useMemo(() => results.filter(r => r.situacion === 'checkup').length, [results]);

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
    setFiltEstado(''); setFiltSearch(''); setFiltSolo(false);
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

  const headerActions = stage === 'analysis' ? (
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

      <div className="flex-1 overflow-y-auto p-6">

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
              <KPICard label="Total Puntos"        value={results.length} icon={MapPin}        color="blue"  />
              <KPICard label="Con Reposición"      value={kpiRepo}        icon={TrendingUp}    color="amber" sub="Sugerido > 0" />
              <KPICard label="Vencidos/Por Vencer" value={kpiExpiring}    icon={AlertTriangle} color="red"   />
              <KPICard label="Sin Actividad"       value={kpiNoAct}       icon={Clock}         color="gray"  />
              <KPICard label="Visitar (Chequeo)"   value={kpiCheckup}     icon={Eye}           color="green" />
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
                  Solo los que requieren visita
                </label>
                <span className="text-sm text-gray-400 whitespace-nowrap font-medium">{filtered.length} puntos</span>
                {(filtEmpresa || filtDist || filtDepto || filtEstado || filtSearch || filtSolo) && (
                  <button onClick={resetFilters} className="text-xs text-[#003DA5] hover:underline whitespace-nowrap">
                    Limpiar filtros
                  </button>
                )}
              </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[1500px]">
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
                          {r.ritmoReciente.toFixed(1)}
                          {!r.tieneDatosRecientes && <span className="text-gray-300 ml-0.5 text-[10px]">*</span>}
                        </td>
                        <td className="px-3 py-2 border-b border-gray-100"><TendBadge r={r} /></td>
                        <td className="px-3 py-2 border-b border-gray-100 text-xs text-gray-500">{fmt(r.ultimaAsignacion)}</td>
                        <td className="px-3 py-2 border-b border-gray-100 text-xs text-right tabular-nums">{r.ultimaQty || '—'}</td>
                        <td className="px-3 py-2 border-b border-gray-100 text-xs text-right tabular-nums">{r.ultimaActivos}</td>
                        <td className="px-3 py-2 border-b border-gray-100 text-xs text-right tabular-nums">{r.ultimaQty > 0 ? pctStr(r.ultimaPct) : '—'}</td>
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

          </div>
        )}
      </div>
    </div>
  );
}
