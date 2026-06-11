import { useState, useCallback, useEffect } from 'react';
import { FileText, FileSpreadsheet, DownloadCloud, ChevronDown, ChevronRight, Copy } from 'lucide-react';
import Header from '../../../components/Header';
import { parseExcel } from '../../../utils/smartParser';
import { recordActivity } from '../../../utils/activityTracker';
import {
  extractVentasFibra, calcularComisionesFibra, calcularComisionVendedorFibra,
  fmtPesos, PLANES_FIBRA,
  PRECIOS_80_SIN_FALTA, PRECIOS_50_O_FALTA, PRECIOS_INTERNET,
  type CondicionFibra, type FranjaRenovacion, type ModalidadFibra,
  type ResultadoVendedorFibra, type ResultadosFibra, type VendedorFibraInput,
} from './ComisionesFibraConfig';
import { RankingFibraChart, CondicionesFibraDonut, FranjaFibraChart, ModalidadFibraChart } from './ComisionesFibraCharts';
import { exportarExcelFibra, exportarPPTXFibra, exportarPDFFibra } from './ComisionesFibraExport';

const ACCENT = '#003DA5';

// ─── Small reusable components ────────────────────────────────────────────────

function KpiCard({ label, value, sub, borderColor }: { label: string; value: string; sub?: string; borderColor: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4" style={{ borderTop: `3px solid ${borderColor}` }}>
      <p className="text-xs font-medium text-gray-500 mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function FranjaBadge({ franja }: { franja: FranjaRenovacion }) {
  const map: Record<FranjaRenovacion, { label: string; bg: string; text: string }> = {
    '50_200':   { label: 'F1', bg: '#e9ecef', text: '#495057' },
    '201_250':  { label: 'F2', bg: '#cfe2ff', text: '#003DA5' },
    '250_plus': { label: 'F3', bg: '#fff3cd', text: '#ca8a04' },
  };
  const s = map[franja];
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold"
      style={{ background: s.bg, color: s.text }}>
      {s.label}
    </span>
  );
}

function CondicionBadge({ v }: { v: ResultadoVendedorFibra }) {
  if (v.noLlegoAlMinimo)
    return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700">Bajo Mín.</span>;
  if (v.condicion === '80_sin_falta')
    return (
      <span className="inline-flex items-center gap-1">
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-yellow-100 text-yellow-800">80 Sin Falta</span>
        {v.bajoPorFalta && <span className="text-[10px] text-orange-500 font-medium">↓ falta</span>}
        {v.esOverride   && <span className="text-[10px] text-purple-500 font-medium">manual</span>}
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1">
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800">50 o Falta</span>
      {v.bajoPorFalta && <span className="text-[10px] text-orange-500 font-medium">↓ falta</span>}
      {v.esOverride   && <span className="text-[10px] text-purple-500 font-medium">manual</span>}
    </span>
  );
}

// ─── Franja progress bar ──────────────────────────────────────────────────────

function FranjaProgress({ v, delta }: { v: ResultadoVendedorFibra; delta: number | null }) {
  const total = v.totalVentas;
  const nextTarget = v.franja === '50_200' ? 201 : v.franja === '201_250' ? 251 : null;

  if (!nextTarget) {
    return (
      <div className="text-xs text-yellow-700 font-semibold bg-yellow-50 rounded px-2 py-1">
        Franja máxima alcanzada (250+ ventas)
      </div>
    );
  }

  const pct = Math.min(100, (total / nextTarget) * 100);
  const faltanVentas = nextTarget - total;
  const nextFranjaLabel = v.franja === '50_200' ? 'Franja 2' : 'Franja 3';

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-gray-500">
        <span>Progreso hacia {nextFranjaLabel}</span>
        <span>{total} / {nextTarget} ({Math.round(pct)}%)</span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-2">
        <div className="h-2 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: ACCENT }} />
      </div>
      <div className="text-xs text-gray-400">
        {faltanVentas} ventas para {nextFranjaLabel}
        {delta !== null && delta > 0 && (
          <span className="ml-2 text-green-700 font-semibold">→ {fmtPesos(delta)} más en renovaciones</span>
        )}
      </div>
    </div>
  );
}

// ─── Price reference panel ────────────────────────────────────────────────────

type PrecioTab = 'tm' | 'internet' | 'comparativa';
type CondTab   = '80' | '50';

function PreciosPanel() {
  const [tab, setTab] = useState<PrecioTab>('tm');
  const [cond, setCond] = useState<CondTab>('80');

  const tabla = cond === '80' ? PRECIOS_80_SIN_FALTA : PRECIOS_50_O_FALTA;

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      {/* Tab selector */}
      <div className="flex border-b border-gray-100 bg-gray-50">
        {([['tm', 'Telemárketing / Presencial'], ['internet', 'Internet / Redes Sociales'], ['comparativa', 'Vista comparativa']] as [PrecioTab, string][]).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-xs font-semibold transition-colors whitespace-nowrap ${tab === t ? 'bg-white border-b-2 border-[#003DA5] text-[#003DA5]' : 'text-gray-500 hover:text-gray-700'}`}>
            {label}
          </button>
        ))}
      </div>

      <div className="p-4">
        {(tab === 'tm' || tab === 'internet') && (
          <div className="flex gap-2 mb-3">
            <button onClick={() => setCond('80')}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${cond === '80' ? 'bg-yellow-100 text-yellow-800 border border-yellow-300' : 'bg-gray-100 text-gray-500'}`}>
              Condición 80 Sin Falta
            </button>
            <button onClick={() => setCond('50')}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${cond === '50' ? 'bg-blue-100 text-blue-800 border border-blue-300' : 'bg-gray-100 text-gray-500'}`}>
              Condición 50 o Falta
            </button>
          </div>
        )}

        {tab === 'tm' && (
          <>
            <p className="text-xs text-gray-400 mb-2">Renovaciones dependen de la franja de ventas totales del vendedor.</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ background: ACCENT, color: '#fff' }}>
                    <th className="px-3 py-2 text-left font-semibold">Plan</th>
                    <th className="px-3 py-2 text-right font-semibold">Alta</th>
                    <th className="px-3 py-2 text-right font-semibold">Reno F1 (50-200)</th>
                    <th className="px-3 py-2 text-right font-semibold">Reno F2 (201-250)</th>
                    <th className="px-3 py-2 text-right font-semibold">Reno F3 (250+)</th>
                  </tr>
                </thead>
                <tbody>
                  {PLANES_FIBRA.map((plan, i) => {
                    const p = tabla[plan];
                    return (
                      <tr key={plan} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-3 py-1.5 font-medium text-gray-800">{plan}</td>
                        <td className="px-3 py-1.5 text-right text-green-700 font-semibold">{fmtPesos(p.alta)}</td>
                        {([p.reno_50_200, p.reno_201_250, p.reno_250_plus] as (number | null)[]).map((v, ci) => (
                          <td key={ci} className="px-3 py-1.5 text-right">
                            {v === null
                              ? <span className="text-gray-400 italic text-[10px]">NO RENOVABLE</span>
                              : <span className="text-blue-700 font-semibold">{fmtPesos(v)}</span>}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {tab === 'internet' && (
          <>
            <p className="text-xs text-gray-400 mb-2 bg-blue-50 border border-blue-100 rounded px-2 py-1">
              Las ventas por Internet pagan igual altas y renovaciones — un único precio por condición.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ background: ACCENT, color: '#fff' }}>
                    <th className="px-3 py-2 text-left font-semibold">Plan</th>
                    <th className="px-3 py-2 text-right font-semibold">Precio (altas y renovaciones)</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(PRECIOS_INTERNET).map(([plan, p], i) => {
                    const precio = cond === '80' ? p.precio_80_sin_falta : p.precio_50_o_falta;
                    return (
                      <tr key={plan} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-3 py-1.5 font-medium text-gray-800">{plan}</td>
                        <td className="px-3 py-1.5 text-right font-semibold text-teal-700">{fmtPesos(precio)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {tab === 'comparativa' && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ background: ACCENT, color: '#fff' }}>
                  <th className="px-2 py-2 text-left font-semibold">Plan</th>
                  <th className="px-2 py-2 text-center font-semibold" colSpan={2}>Alta</th>
                  <th className="px-2 py-2 text-center font-semibold" colSpan={2}>Reno F1</th>
                  <th className="px-2 py-2 text-center font-semibold" colSpan={2}>Reno F2</th>
                  <th className="px-2 py-2 text-center font-semibold" colSpan={2}>Internet</th>
                </tr>
                <tr className="bg-blue-800 text-blue-100 text-[10px]">
                  <th className="px-2 py-1" />
                  <th className="px-2 py-1">80SF</th><th className="px-2 py-1">50oF</th>
                  <th className="px-2 py-1">80SF</th><th className="px-2 py-1">50oF</th>
                  <th className="px-2 py-1">80SF</th><th className="px-2 py-1">50oF</th>
                  <th className="px-2 py-1">80SF</th><th className="px-2 py-1">50oF</th>
                </tr>
              </thead>
              <tbody>
                {PLANES_FIBRA.map((plan, i) => {
                  const p80 = PRECIOS_80_SIN_FALTA[plan];
                  const p50 = PRECIOS_50_O_FALTA[plan];
                  const pi  = PRECIOS_INTERNET[plan];
                  return (
                    <tr key={plan} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-2 py-1 font-medium text-gray-800 whitespace-nowrap">{plan}</td>
                      <td className="px-2 py-1 text-right text-green-700">{fmtPesos(p80.alta)}</td>
                      <td className="px-2 py-1 text-right text-green-600 text-[10px]">{fmtPesos(p50.alta)}</td>
                      <td className="px-2 py-1 text-right">{p80.reno_50_200 !== null ? <span className="text-blue-700">{fmtPesos(p80.reno_50_200)}</span> : <span className="text-gray-300">—</span>}</td>
                      <td className="px-2 py-1 text-right text-[10px]">{p50.reno_50_200 !== null ? <span className="text-blue-600">{fmtPesos(p50.reno_50_200)}</span> : <span className="text-gray-300">—</span>}</td>
                      <td className="px-2 py-1 text-right">{p80.reno_201_250 !== null ? <span className="text-blue-700">{fmtPesos(p80.reno_201_250)}</span> : <span className="text-gray-300">—</span>}</td>
                      <td className="px-2 py-1 text-right text-[10px]">{p50.reno_201_250 !== null ? <span className="text-blue-600">{fmtPesos(p50.reno_201_250)}</span> : <span className="text-gray-300">—</span>}</td>
                      <td className="px-2 py-1 text-right">{pi ? <span className="text-teal-700">{fmtPesos(pi.precio_80_sin_falta)}</span> : <span className="text-gray-300">—</span>}</td>
                      <td className="px-2 py-1 text-right text-[10px]">{pi ? <span className="text-teal-600">{fmtPesos(pi.precio_50_o_falta)}</span> : <span className="text-gray-300">—</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Conditions info cards ────────────────────────────────────────────────────

function CondicionesPanel() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="bg-white border border-yellow-200 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs font-bold rounded-full">Condición Premium</span>
        </div>
        <h3 className="font-bold text-gray-900 mb-1">80 Ventas Sin Faltas</h3>
        <p className="text-xs text-gray-500 leading-relaxed">≥ 80 ventas <strong>Y</strong> 0 faltas → precios más altos en todas las categorías.</p>
      </div>
      <div className="bg-white border border-blue-200 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs font-bold rounded-full">Condición Base</span>
        </div>
        <h3 className="font-bold text-gray-900 mb-1">50 Ventas o Con Falta</h3>
        <p className="text-xs text-gray-500 leading-relaxed">50-79 ventas, <strong>O</strong> ≥ 80 con ≥ 1 falta → comisión base. Bajo 50: comisiona igual sin el mínimo.</p>
      </div>
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <h3 className="font-bold text-gray-900 mb-2">Franjas de Renovación</h3>
        <div className="space-y-1 text-xs text-gray-600">
          <div className="flex items-center gap-2"><span className="px-1.5 py-0.5 bg-gray-200 text-gray-700 rounded font-bold text-[10px]">F1</span>50-200 ventas</div>
          <div className="flex items-center gap-2"><span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded font-bold text-[10px]">F2</span>201-250 ventas</div>
          <div className="flex items-center gap-2"><span className="px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded font-bold text-[10px]">F3</span>+250 ventas</div>
        </div>
        <p className="text-[10px] text-gray-400 mt-2">La franja aplica a renovaciones de todos los planes del vendedor.</p>
      </div>
    </div>
  );
}

// ─── Upload view ──────────────────────────────────────────────────────────────

function UploadView({ onFile, error }: { onFile: (f: File) => void; error: string | null }) {
  const [dragging, setDragging] = useState(false);

  return (
    <div className="flex flex-col h-full">
      <Header title="Comisiones Fibra" />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-5xl mx-auto space-y-6">

          <CondicionesPanel />

          <div className="max-w-lg mx-auto">
            <label
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) onFile(f); }}
              className={`flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-2xl p-10 cursor-pointer transition-all
                ${dragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50/30'}`}
            >
              <div className="w-14 h-14 rounded-xl flex items-center justify-center" style={{ background: `${ACCENT}20` }}>
                <FileText size={26} style={{ color: ACCENT }} />
              </div>
              <div className="text-center">
                <p className="font-semibold text-gray-700">Cargá el archivo Excel de ventas</p>
                <p className="text-gray-400 text-sm mt-1">o arrastrá aquí · Excel o CSV</p>
              </div>
              <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
            </label>
            {error && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
            )}
            <p className="text-center text-xs text-gray-400 mt-3">
              Columnas detectadas automáticamente: Vendedor, Plan, Motivo, Modalidad de venta
            </p>
          </div>

          <PreciosPanel />
        </div>
      </div>
    </div>
  );
}

// ─── Results table row ────────────────────────────────────────────────────────

function ResultadoRow({
  v,
  rank,
  onFaltaChange,
  onOverrideChange,
}: {
  v: ResultadoVendedorFibra;
  rank: number;
  onFaltaChange: (nombre: string, faltas: number) => void;
  onOverrideChange: (nombre: string, override: CondicionFibra | null) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [faltasInput, setFaltasInput] = useState(String(v.faltas));

  // Franja delta: comisión con siguiente franja vs actual
  let delta: number | null = null;
  if (v.franja !== '250_plus') {
    const nextFranja: FranjaRenovacion = v.franja === '50_200' ? '201_250' : '250_plus';
    const nextTotal = nextFranja === '201_250' ? 201 : 251;
    const simVentas = [...Array(nextTotal - v.totalVentas)].map(() => ({
      plan: v.desglosePlanes[0]?.plan ?? '',
      motivo: 'Renovacion' as const,
      modalidad: 'telemarketing' as const,
    }));
    const simVentasAll = [...v.desglosePlanes.flatMap(d => {
      const entries = [];
      for (let i = 0; i < d.altas; i++) entries.push({ plan: d.plan, motivo: 'Nuevo Servicio' as const, modalidad: d.modalidad });
      for (let i = 0; i < d.renovaciones; i++) entries.push({ plan: d.plan, motivo: 'Renovacion' as const, modalidad: d.modalidad });
      return entries;
    }), ...simVentas];
    const nextResult = calcularComisionVendedorFibra(v.nombre, simVentasAll, v.faltas, v.esOverride ? v.condicion : undefined);
    delta = nextResult.comisionTotal - v.comisionTotal;
    if (delta < 0) delta = null;
  }

  const rowBg = v.noLlegoAlMinimo
    ? 'bg-red-50 border-l-2 border-l-red-400'
    : v.bajoPorFalta
      ? 'bg-orange-50 border-l-2 border-l-orange-400'
      : v.condicion === '80_sin_falta'
        ? 'bg-yellow-50 border-l-2 border-l-yellow-400'
        : '';

  const BADGE_RANKS = [
    { bg: '#FFD700', text: '#7a5800' },
    { bg: '#C0C0C0', text: '#4a4a4a' },
    { bg: '#CD7F32', text: '#5c3200' },
  ];

  return (
    <>
      <tr className={`border-t border-gray-100 hover:bg-gray-50/50 cursor-pointer ${rowBg}`} onClick={() => setExpanded(e => !e)}>
        <td className="px-3 py-2.5 text-center w-10">
          {rank < 3 ? (
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold"
              style={{ background: BADGE_RANKS[rank].bg, color: BADGE_RANKS[rank].text }}>
              {rank + 1}°
            </span>
          ) : (
            <span className="text-gray-400 text-xs">{rank + 1}</span>
          )}
        </td>
        <td className="px-2 py-2.5 text-gray-400" onClick={e => e.stopPropagation()}>
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </td>
        <td className="px-4 py-2.5 font-medium text-gray-900 max-w-[180px] truncate" title={v.nombre}>{v.nombre}</td>
        <td className="px-3 py-2.5 text-right font-bold" style={{ color: ACCENT }}>{v.totalVentas.toLocaleString()}</td>
        <td className="px-3 py-2.5 text-center" onClick={e => e.stopPropagation()}>
          <input
            type="number" min={0} max={31}
            value={faltasInput}
            onChange={e => setFaltasInput(e.target.value)}
            onBlur={() => {
              const n = parseInt(faltasInput) || 0;
              setFaltasInput(String(n));
              onFaltaChange(v.nombre, n);
            }}
            className="w-12 text-center border border-gray-200 rounded px-1 py-0.5 text-xs focus:border-blue-500 outline-none"
          />
        </td>
        <td className="px-3 py-2.5 text-center"><FranjaBadge franja={v.franja} /></td>
        <td className="px-3 py-2.5"><CondicionBadge v={v} /></td>
        <td className="px-3 py-2.5 text-right text-gray-600 text-sm">{v.ventasTelemarketing > 0 ? fmtPesos(v.comisionTelemarketing) : <span className="text-gray-300">—</span>}</td>
        <td className="px-3 py-2.5 text-right text-teal-700 text-sm">{v.ventasInternet > 0 ? fmtPesos(v.comisionInternet) : <span className="text-gray-300">—</span>}</td>
        <td className="px-3 py-2.5 text-center">
          {v.noRenovables > 0
            ? <span className="text-orange-600 font-semibold text-sm" title={`${v.noRenovables} renovaciones de planes no renovables no generaron comisión`}>{v.noRenovables}</span>
            : <span className="text-gray-300">—</span>}
        </td>
        <td className="px-4 py-2.5 text-right font-bold text-green-700">{fmtPesos(v.comisionTotal)}</td>
        <td className="px-3 py-2.5 text-center" onClick={e => e.stopPropagation()}>
          <select
            value={v.esOverride ? v.condicion : ''}
            onChange={e => onOverrideChange(v.nombre, e.target.value === '' ? null : e.target.value as CondicionFibra)}
            className="text-[10px] border border-gray-200 rounded px-1 py-0.5 bg-white outline-none"
            title="Ajustar condición manualmente"
          >
            <option value="">Auto</option>
            <option value="80_sin_falta">80 Sin Falta</option>
            <option value="50_o_falta">50 o Falta</option>
          </select>
        </td>
      </tr>

      {expanded && (
        <tr className="bg-gray-50 border-t border-gray-100">
          <td colSpan={12} className="px-8 py-4">
            <div className="space-y-4">
              {/* Franja progress */}
              <FranjaProgress v={v} delta={delta} />

              {/* Desglose por plan */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Desglose por plan</p>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-200 text-gray-600">
                      <th className="px-3 py-1.5 text-left font-semibold">Plan</th>
                      <th className="px-3 py-1.5 text-center font-semibold">Modalidad</th>
                      <th className="px-3 py-1.5 text-right font-semibold">Altas</th>
                      <th className="px-3 py-1.5 text-right font-semibold">Renov.</th>
                      <th className="px-3 py-1.5 text-right font-semibold">No Renov.</th>
                      <th className="px-3 py-1.5 text-right font-semibold">Comisión</th>
                    </tr>
                  </thead>
                  <tbody>
                    {v.desglosePlanes.map((d, i) => (
                      <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-3 py-1.5 font-medium text-gray-800">{d.plan}</td>
                        <td className="px-3 py-1.5 text-center">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${d.modalidad === 'internet' ? 'bg-teal-100 text-teal-700' : 'bg-blue-100 text-blue-700'}`}>
                            {d.modalidad}
                          </span>
                        </td>
                        <td className="px-3 py-1.5 text-right text-gray-700">{d.altas}</td>
                        <td className="px-3 py-1.5 text-right text-gray-700">{d.renovaciones}</td>
                        <td className="px-3 py-1.5 text-right">
                          {d.noRenovables > 0
                            ? <span className="text-orange-600 font-semibold">{d.noRenovables}</span>
                            : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-3 py-1.5 text-right font-bold text-green-700">{fmtPesos(d.comision)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Results view ─────────────────────────────────────────────────────────────

function ResultsView({
  resultados,
  fileName,
  onFaltaChange,
  onOverrideChange,
  onReset,
}: {
  resultados: ResultadosFibra;
  fileName: string;
  onFaltaChange: (nombre: string, faltas: number) => void;
  onOverrideChange: (nombre: string, override: CondicionFibra | null) => void;
  onReset: () => void;
}) {
  const [exportXls, setExportXls]   = useState(false);
  const [exportPptx, setExportPptx] = useState(false);
  const [exportPdf,  setExportPdf]  = useState(false);

  return (
    <div className="flex flex-col h-full">
      <Header title="Comisiones Fibra" />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-7xl mx-auto space-y-6">

          {/* Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-bold text-gray-900 text-lg">Resultados — Comisiones Fibra</h2>
              <p className="text-xs text-gray-400 mt-0.5">{fileName} · {resultados.vendedores.length} vendedores</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={async () => { setExportPptx(true); try { await exportarPPTXFibra(resultados, fileName); } finally { setExportPptx(false); } }}
                disabled={exportPptx}
                className="flex items-center gap-2 px-4 py-2 text-white rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-60 transition-colors"
                style={{ background: '#C43B1C' }}>
                <DownloadCloud size={15} />
                {exportPptx ? 'Exportando…' : 'PowerPoint'}
              </button>
              <button
                onClick={() => { setExportXls(true); setTimeout(() => { exportarExcelFibra(resultados, fileName); setExportXls(false); }, 50); }}
                disabled={exportXls}
                className="flex items-center gap-2 px-4 py-2 text-white rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-60 transition-colors"
                style={{ background: '#1D6F42' }}>
                <FileSpreadsheet size={15} />
                {exportXls ? 'Exportando…' : 'Excel'}
              </button>
              <button
                onClick={() => { setExportPdf(true); setTimeout(() => { exportarPDFFibra(resultados, fileName); setExportPdf(false); }, 50); }}
                disabled={exportPdf}
                className="flex items-center gap-2 px-4 py-2 text-white rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-60 transition-colors"
                style={{ background: '#E3000F' }}>
                <DownloadCloud size={15} />
                {exportPdf ? 'Generando…' : 'PDF'}
              </button>
              <button onClick={onReset}
                className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-500 hover:bg-gray-50 transition-colors">
                Nuevo archivo
              </button>
            </div>
          </div>

          {/* KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
            <KpiCard
              label="Total a comisionar"
              value={fmtPesos(resultados.totalAPagar)}
              sub={`TM: ${fmtPesos(resultados.totalTelemarketing)} · Int: ${fmtPesos(resultados.totalInternet)}`}
              borderColor="#28a745"
            />
            <KpiCard
              label="Condición 80 Sin Falta"
              value={String(resultados.vendedores80SinFalta)}
              sub={`de ${resultados.vendedores.length} vendedores`}
              borderColor="#ca8a04"
            />
            <KpiCard
              label="Condición 50 o Falta"
              value={String(resultados.vendedores50OFalta)}
              sub="Condición base"
              borderColor={ACCENT}
            />
            <KpiCard
              label="Bajo mínimo"
              value={String(resultados.vendedoresBajoMinimo)}
              sub="< 50 ventas"
              borderColor="#E3000F"
            />
            <KpiCard
              label="No Renovables"
              value={String(resultados.totalNoRenovables)}
              sub="gestiones sin comisión"
              borderColor="#fd7e14"
            />
          </div>

          {/* Results table */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-800 text-sm uppercase tracking-wide">Comisiones por Vendedor</h3>
              <p className="text-xs text-gray-400 mt-0.5">Click en fila para ver desglose · Editá "Faltas" para recalcular en tiempo real · Ajustá condición con el selector</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: ACCENT, color: '#fff' }}>
                    <th className="px-3 py-3 text-center font-semibold w-10">#</th>
                    <th className="px-2 py-3 w-6" />
                    <th className="px-4 py-3 font-semibold text-left">Vendedor</th>
                    <th className="px-3 py-3 font-semibold text-right">Total</th>
                    <th className="px-3 py-3 font-semibold text-center">Faltas</th>
                    <th className="px-3 py-3 font-semibold text-center">Franja</th>
                    <th className="px-3 py-3 font-semibold text-left">Condición</th>
                    <th className="px-3 py-3 font-semibold text-right">Telemarketing</th>
                    <th className="px-3 py-3 font-semibold text-right">Internet</th>
                    <th className="px-3 py-3 font-semibold text-center">No Renov.</th>
                    <th className="px-3 py-3 font-semibold text-right">Comisión Total</th>
                    <th className="px-3 py-3 font-semibold text-center">Ajuste</th>
                  </tr>
                </thead>
                <tbody>
                  {resultados.vendedores.map((v, i) => (
                    <ResultadoRow
                      key={v.nombre}
                      v={v}
                      rank={i}
                      onFaltaChange={onFaltaChange}
                      onOverrideChange={onOverrideChange}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="font-bold text-gray-800 text-sm uppercase tracking-wide mb-3">Ranking de Comisiones</h3>
              <RankingFibraChart vendedores={resultados.vendedores} />
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="font-bold text-gray-800 text-sm uppercase tracking-wide mb-3">Condiciones</h3>
              <CondicionesFibraDonut vendedores={resultados.vendedores} />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="font-bold text-gray-800 text-sm uppercase tracking-wide mb-3">Distribución por Franja</h3>
              <FranjaFibraChart vendedores={resultados.vendedores} />
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="font-bold text-gray-800 text-sm uppercase tracking-wide mb-3">Modalidad de Venta</h3>
              <ModalidadFibraChart vendedores={resultados.vendedores} />
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

// ─── Proyección view ──────────────────────────────────────────────────────────

interface PlanQtyFibra {
  altasTM: number;
  renovTM: number;
  altasInt: number;
  renovInt: number;
}

function ProyeccionView() {
  const [quantities, setQuantities] = useState<Map<string, PlanQtyFibra>>(new Map());
  const [faltas, setFaltas] = useState(0);
  const [copied, setCopied] = useState(false);

  function updateQty(plan: string, field: keyof PlanQtyFibra, val: number) {
    setQuantities(prev => {
      const next = new Map(prev);
      const cur = next.get(plan) ?? { altasTM: 0, renovTM: 0, altasInt: 0, renovInt: 0 };
      next.set(plan, { ...cur, [field]: Math.max(0, val) });
      return next;
    });
  }

  // Build synthetic VentaFibra list from quantities
  const allVentas = PLANES_FIBRA.flatMap(plan => {
    const q = quantities.get(plan) ?? { altasTM: 0, renovTM: 0, altasInt: 0, renovInt: 0 };
    const ventas = [];
    for (let i = 0; i < q.altasTM;  i++) ventas.push({ plan, motivo: 'Nuevo Servicio' as const, modalidad: 'telemarketing' as ModalidadFibra });
    for (let i = 0; i < q.renovTM;  i++) ventas.push({ plan, motivo: 'Renovacion' as const,     modalidad: 'telemarketing' as ModalidadFibra });
    for (let i = 0; i < q.altasInt; i++) ventas.push({ plan, motivo: 'Nuevo Servicio' as const, modalidad: 'internet' as ModalidadFibra });
    for (let i = 0; i < q.renovInt; i++) ventas.push({ plan, motivo: 'Renovacion' as const,     modalidad: 'internet' as ModalidadFibra });
    return ventas;
  });

  const totalVentas = allVentas.length;
  const resultado = calcularComisionVendedorFibra('Proyección', allVentas, faltas);
  const franja = resultado.franja;
  const condicion = resultado.condicion;

  // Delta to next franja
  let deltaFranja: { label: string; delta: number } | null = null;
  if (franja !== '250_plus') {
    const nextTarget = franja === '50_200' ? 201 : 251;
    const nextFranjaLabel = franja === '50_200' ? 'Franja 2' : 'Franja 3';
    const extraVentas = nextTarget - totalVentas;
    if (extraVentas > 0) {
      const simExtra = Array.from({ length: extraVentas }, () => ({
        plan: PLANES_FIBRA[0],
        motivo: 'Renovacion' as const,
        modalidad: 'telemarketing' as ModalidadFibra,
      }));
      const simResultado = calcularComisionVendedorFibra('Sim', [...allVentas, ...simExtra], faltas);
      const delta = simResultado.comisionTotal - resultado.comisionTotal;
      if (delta > 0) deltaFranja = { label: nextFranjaLabel, delta };
    }
  }

  const progressTarget = franja === '50_200' ? 201 : franja === '201_250' ? 251 : null;
  const progressPct = progressTarget ? Math.min(100, (totalVentas / progressTarget) * 100) : 100;

  function handleCopiar() {
    const lines = [
      'Proyección Comisiones Fibra',
      `Total ventas: ${totalVentas}`,
      `Condición: ${condicion === '80_sin_falta' ? '80 Sin Falta' : '50 o Falta'}`,
      `Franja: ${franja}`,
      `Comisión TM: ${fmtPesos(resultado.comisionTelemarketing)}`,
      `Comisión Internet: ${fmtPesos(resultado.comisionInternet)}`,
      `Total: ${fmtPesos(resultado.comisionTotal)}`,
    ];
    navigator.clipboard.writeText(lines.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex flex-col h-full">
      <Header title="Comisiones Fibra" />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-5xl mx-auto space-y-6">

          {/* Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-bold text-gray-900 text-lg">Calculadora de Proyección</h2>
              <p className="text-xs text-gray-400 mt-0.5">Simulá cuánto comisionarías según ventas estimadas — independiente del archivo cargado</p>
            </div>
            <div className="flex gap-2">
              <button onClick={handleCopiar}
                className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                <Copy size={14} />
                {copied ? 'Copiado ✓' : 'Copiar resumen'}
              </button>
              <button onClick={() => { setQuantities(new Map()); setFaltas(0); }}
                className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-500 hover:bg-gray-50 transition-colors">
                Limpiar
              </button>
            </div>
          </div>

          {/* KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard label="Total ventas" value={String(totalVentas)} borderColor={ACCENT} />
            <KpiCard
              label="Condición activa"
              value={condicion === '80_sin_falta' ? '80 Sin Falta' : '50 o Falta'}
              sub={totalVentas === 0 ? 'Sin ventas aún' : totalVentas < 50 ? 'Bajo mínimo' : `≥ ${totalVentas < 80 ? 50 : faltas === 0 ? 80 : 50} ventas`}
              borderColor={condicion === '80_sin_falta' ? '#ca8a04' : ACCENT}
            />
            <KpiCard label="Comisión proyectada" value={fmtPesos(resultado.comisionTotal)} sub={`TM: ${fmtPesos(resultado.comisionTelemarketing)} · Int: ${fmtPesos(resultado.comisionInternet)}`} borderColor="#28a745" />
            <KpiCard label="No Renovables" value={String(resultado.noRenovables)} sub="gestiones sin comisión" borderColor="#fd7e14" />
          </div>

          {/* Faltas input */}
          <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-4">
            <label className="text-sm font-semibold text-gray-700">Faltas estimadas:</label>
            <input
              type="number" min={0} max={31} value={faltas}
              onChange={e => setFaltas(Math.max(0, parseInt(e.target.value) || 0))}
              className="w-20 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:border-blue-500 outline-none text-center"
            />
            <span className="text-xs text-gray-400">
              {faltas > 0 && condicion === '50_o_falta' && totalVentas >= 80
                ? '⚠ Con falta → condición 50 o Falta (aunque tengas ≥80 ventas)'
                : faltas === 0 && totalVentas >= 80
                  ? '✓ Sin falta y ≥80 ventas → Condición 80 Sin Falta'
                  : ''}
            </span>
          </div>

          {/* Franja progress */}
          {progressTarget && (
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-semibold text-gray-700">
                  Franja actual: <FranjaBadge franja={franja} />
                </span>
                <span className="text-sm text-gray-500">{totalVentas} / {progressTarget} ({Math.round(progressPct)}%)</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-3">
                <div className="h-3 rounded-full transition-all duration-300" style={{ width: `${progressPct}%`, backgroundColor: progressPct >= 100 ? '#28a745' : ACCENT }} />
              </div>
              {deltaFranja && (
                <p className="text-xs text-gray-400 mt-2">
                  {progressTarget - totalVentas} ventas para {deltaFranja.label}
                  <span className="ml-2 text-green-700 font-semibold">→ {fmtPesos(deltaFranja.delta)} más en renovaciones con esas ventas extra</span>
                </p>
              )}
            </div>
          )}

          {/* Plan table */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-800 text-sm uppercase tracking-wide">Ventas por Plan</h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Condición activa: <strong>{condicion === '80_sin_falta' ? '80 Sin Falta' : '50 o Falta'}</strong>
                {' '} · Franja: <strong>{franja}</strong>
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Plan</th>
                    <th className="px-3 py-3 text-center text-xs font-semibold text-gray-600 uppercase" colSpan={2}>Telemarketing</th>
                    <th className="px-3 py-3 text-center text-xs font-semibold text-gray-600 uppercase" colSpan={2}>Internet</th>
                    <th className="px-3 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Subtotal</th>
                  </tr>
                  <tr className="border-b border-gray-100 bg-gray-50 text-[10px] text-gray-500">
                    <th />
                    <th className="px-3 py-1.5 text-center">Altas</th>
                    <th className="px-3 py-1.5 text-center">Renov.</th>
                    <th className="px-3 py-1.5 text-center">Altas</th>
                    <th className="px-3 py-1.5 text-center">Renov.</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {PLANES_FIBRA.map((plan, i) => {
                    const q = quantities.get(plan) ?? { altasTM: 0, renovTM: 0, altasInt: 0, renovInt: 0 };
                    const ventasPlan = [
                      ...Array.from({ length: q.altasTM },  () => ({ plan, motivo: 'Nuevo Servicio' as const, modalidad: 'telemarketing' as ModalidadFibra })),
                      ...Array.from({ length: q.renovTM },  () => ({ plan, motivo: 'Renovacion' as const,     modalidad: 'telemarketing' as ModalidadFibra })),
                      ...Array.from({ length: q.altasInt }, () => ({ plan, motivo: 'Nuevo Servicio' as const, modalidad: 'internet' as ModalidadFibra })),
                      ...Array.from({ length: q.renovInt }, () => ({ plan, motivo: 'Renovacion' as const,     modalidad: 'internet' as ModalidadFibra })),
                    ];
                    const simPlan = calcularComisionVendedorFibra('', ventasPlan, faltas, condicion);
                    const subtotal = simPlan.comisionTotal;
                    const hasInput = q.altasTM + q.renovTM + q.altasInt + q.renovInt > 0;

                    return (
                      <tr key={plan} className={`border-b border-gray-100 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50/20`}>
                        <td className="px-4 py-2.5 font-medium text-gray-800 text-xs">{plan}</td>
                        {(['altasTM', 'renovTM', 'altasInt', 'renovInt'] as const).map(field => (
                          <td key={field} className="px-2 py-2 text-center">
                            <input
                              type="number" min={0}
                              value={q[field] || ''}
                              placeholder="0"
                              onChange={e => updateQty(plan, field, parseInt(e.target.value) || 0)}
                              className="w-14 text-center border border-gray-200 rounded px-1 py-1 text-xs focus:border-blue-500 outline-none"
                            />
                          </td>
                        ))}
                        <td className="px-4 py-2.5 text-right font-semibold text-gray-800 text-xs">
                          {hasInput ? fmtPesos(subtotal) : <span className="text-gray-300">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-300 bg-gray-50 font-bold">
                    <td className="px-4 py-3 text-gray-800 uppercase text-xs tracking-wide" colSpan={5}>Total</td>
                    <td className="px-4 py-3 text-right text-green-700 text-base">{fmtPesos(resultado.comisionTotal)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

// ─── Main module ──────────────────────────────────────────────────────────────

export default function ComisionesFibraModule() {
  const [mainTab, setMainTab]   = useState<'liquidacion' | 'proyeccion'>('liquidacion');
  const [stage, setStage]       = useState<'upload' | 'results'>('upload');
  const [fileName, setFileName] = useState('');
  const [error, setError]       = useState<string | null>(null);
  const [vendedoresInput, setVendedoresInput] = useState<VendedorFibraInput[]>([]);
  const [faltasPorVendedor, setFaltasPorVendedor]     = useState<Map<string, number>>(new Map());
  const [overridesPorVendedor, setOverridesPorVendedor] = useState<Map<string, CondicionFibra | null>>(new Map());

  const [resultados, setResultados] = useState<ResultadosFibra | null>(null);

  useEffect(() => {
    if (vendedoresInput.length === 0) return;
    setResultados(calcularComisionesFibra(vendedoresInput, faltasPorVendedor, overridesPorVendedor));
  }, [vendedoresInput, faltasPorVendedor, overridesPorVendedor]);

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    try {
      const result = await parseExcel(file, 'ventas');
      const vendedores = extractVentasFibra(result.rows, result.columnMap);
      if (vendedores.length === 0) throw new Error('No se detectaron vendedores. Verificá que el archivo tenga columnas de Vendedor, Plan y Motivo.');
      setVendedoresInput(vendedores);
      setFaltasPorVendedor(new Map());
      setOverridesPorVendedor(new Map());
      setFileName(file.name);
      recordActivity('comisiones_fibra', file.name);
      setStage('results');
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  const handleFaltaChange = useCallback((nombre: string, faltas: number) => {
    setFaltasPorVendedor(prev => {
      const next = new Map(prev);
      if (faltas === 0) next.delete(nombre); else next.set(nombre, faltas);
      return next;
    });
  }, []);

  const handleOverrideChange = useCallback((nombre: string, override: CondicionFibra | null) => {
    setOverridesPorVendedor(prev => {
      const next = new Map(prev);
      if (override === null) next.delete(nombre); else next.set(nombre, override);
      return next;
    });
  }, []);

  const handleReset = useCallback(() => {
    setStage('upload');
    setVendedoresInput([]);
    setFaltasPorVendedor(new Map());
    setOverridesPorVendedor(new Map());
    setResultados(null);
    setError(null);
  }, []);

  function renderLiquidacion() {
    if (stage === 'results' && resultados) {
      return (
        <ResultsView
          resultados={resultados}
          fileName={fileName}
          onFaltaChange={handleFaltaChange}
          onOverrideChange={handleOverrideChange}
          onReset={handleReset}
        />
      );
    }
    return <UploadView onFile={handleFile} error={error} />;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Sub-nav tabs */}
      <div className="bg-white border-b border-gray-200 px-6 flex items-center gap-1 h-11 flex-shrink-0">
        {(['liquidacion', 'proyeccion'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setMainTab(tab)}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
              mainTab === tab ? 'bg-blue-50 text-blue-700' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}>
            {tab === 'liquidacion' ? '📊 Liquidación' : '🧮 Proyección'}
          </button>
        ))}
        {stage === 'results' && mainTab === 'liquidacion' && (
          <span className="ml-auto text-xs text-gray-400">{vendedoresInput.length} vendedores · {fileName}</span>
        )}
      </div>
      <div className="flex-1 overflow-hidden min-h-0">
        {mainTab === 'proyeccion' ? <ProyeccionView /> : renderLiquidacion()}
      </div>
    </div>
  );
}
