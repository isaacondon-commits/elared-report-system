import { useState, useMemo, useCallback, useRef } from 'react';
import { RefreshCw, Download, Search, ChevronDown, CheckCircle2, AlertCircle, X } from 'lucide-react';
import * as XLSX from 'xlsx';
import Header from '../components/Header';
import {
  usePersonalStore, type RegistroPersonal,
  getFaltas, getTardanzas, getHorasExtras, getComisiones,
} from '../store/personalStore';
import { useAnalisisStore } from '../store/analisisStore';

// ─── Helpers ───────────────────────────────────────────────────────────────────

function fmtPesos(n: number): string {
  return '$' + n.toLocaleString('es-UY');
}

function fmtHoras(mins: number): string {
  if (mins <= 0) return '—';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}

function fmtSincDate(iso: string | null): string {
  if (!iso) return 'Nunca';
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Hoy';
  if (days === 1) return 'Ayer';
  return `hace ${days} días`;
}

// ─── Toast ─────────────────────────────────────────────────────────────────────

function Toast({ msg, type, onClose }: { msg: string; type: 'success' | 'error'; onClose: () => void }) {
  return (
    <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-xl shadow-xl text-sm font-medium text-white ${
      type === 'success' ? 'bg-green-600' : 'bg-red-600'
    }`}>
      {type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
      {msg}
      <button onClick={onClose} className="ml-1 opacity-70 hover:opacity-100"><X size={14} /></button>
    </div>
  );
}

// ─── Inline editable cell ──────────────────────────────────────────────────────

function EditableNumber({
  value, onSave, isAuto, prefix = '', suffix = '',
  formatDisplay, color,
}: {
  value: number | null;
  onSave: (v: number | null) => void;
  isAuto: boolean;
  prefix?: string;
  suffix?: string;
  formatDisplay?: (n: number) => string;
  color?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const autoVal = value ?? 0;
  const display = formatDisplay ? formatDisplay(autoVal) : `${prefix}${autoVal}${suffix}`;

  function startEdit() {
    setDraft(String(autoVal));
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  }

  function commit() {
    const n = parseInt(draft, 10);
    onSave(isNaN(n) ? null : n);
    setEditing(false);
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="number"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
        className="w-16 border border-blue-400 rounded px-1.5 py-0.5 text-xs text-center focus:outline-none focus:ring-1 focus:ring-blue-400"
      />
    );
  }

  return (
    <button
      onClick={startEdit}
      className="flex flex-col items-center gap-0.5 hover:bg-gray-50 rounded px-1 py-0.5 transition-colors cursor-pointer"
    >
      <span className={`text-sm font-semibold ${color ?? 'text-gray-700'}`}>{display}</span>
      <span className={`text-[9px] px-1.5 rounded-full font-semibold ${
        isAuto ? 'bg-gray-100 text-gray-500' : 'bg-blue-100 text-blue-600'
      }`}>
        {isAuto ? 'Auto' : 'Manual'}
      </span>
    </button>
  );
}

function EditableText({
  value, onSave, placeholder, maxLen = 100,
}: {
  value: string;
  onSave: (v: string) => void;
  placeholder: string;
  maxLen?: number;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  function startEdit() {
    setDraft(value);
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  }

  function commit() {
    onSave(draft.trim());
    setEditing(false);
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={draft}
        maxLength={maxLen}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
        className="w-full border border-blue-400 rounded px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
      />
    );
  }

  return (
    <button
      onClick={startEdit}
      className="text-left text-xs text-gray-600 hover:bg-gray-50 rounded px-1 py-0.5 transition-colors cursor-pointer max-w-[120px] truncate"
      title={value || undefined}
    >
      {value || <span className="text-gray-300 italic">{placeholder}</span>}
    </button>
  );
}

// ─── Filter bar ────────────────────────────────────────────────────────────────

type SortKey = 'nombre' | 'faltas' | 'tardanzas' | 'extras' | 'comisiones';

interface FiltersProps {
  search: string; onSearch: (v: string) => void;
  turno: string; onTurno: (v: string) => void;
  conFaltas: boolean; onConFaltas: (v: boolean) => void;
  sortBy: SortKey; onSortBy: (v: SortKey) => void;
  turnos: string[];
}

function FilterBar({ search, onSearch, turno, onTurno, conFaltas, onConFaltas, sortBy, onSortBy, turnos }: FiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1.5 border border-gray-200 rounded-lg px-3 py-1.5 bg-white min-w-[180px]">
        <Search size={13} className="text-gray-400 flex-shrink-0" />
        <input
          type="text"
          placeholder="Buscar persona..."
          value={search}
          onChange={e => onSearch(e.target.value)}
          className="text-sm outline-none flex-1 bg-transparent"
        />
        {search && (
          <button onClick={() => onSearch('')} className="text-gray-400 hover:text-gray-600">
            <X size={12} />
          </button>
        )}
      </div>

      <select
        value={turno}
        onChange={e => onTurno(e.target.value)}
        className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none"
      >
        <option value="">Todos los turnos</option>
        {turnos.map(t => <option key={t} value={t}>{t}</option>)}
      </select>

      <button
        onClick={() => onConFaltas(!conFaltas)}
        className={`flex items-center gap-1.5 border rounded-lg px-3 py-1.5 text-sm transition-colors ${
          conFaltas ? 'bg-red-50 border-red-300 text-red-700' : 'bg-white border-gray-200 text-gray-700'
        }`}
      >
        Con faltas
        {conFaltas && <X size={12} />}
      </button>

      <div className="flex items-center gap-1.5 border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-sm">
        <span className="text-gray-400 text-xs">Ordenar:</span>
        <select
          value={sortBy}
          onChange={e => onSortBy(e.target.value as SortKey)}
          className="outline-none bg-transparent text-sm"
        >
          <option value="nombre">Nombre A–Z</option>
          <option value="faltas">Más faltas</option>
          <option value="tardanzas">Más tardanzas</option>
          <option value="extras">Más horas extras</option>
          <option value="comisiones">Mayor comisión</option>
        </select>
        <ChevronDown size={12} className="text-gray-400" />
      </div>
    </div>
  );
}

// ─── Export ────────────────────────────────────────────────────────────────────

function exportarExcel(registros: RegistroPersonal[]) {
  const headers = [
    'Nombre', 'Turno', 'Trabaja Sáb', 'Faltas', 'Tardanzas',
    'Hrs Extras', 'Comisiones', 'Incentivos', 'Metas', 'Observaciones',
  ];
  const rows = registros.map(r => [
    r.nombre,
    r.turno,
    r.trabajaSabados ? 'Sí' : 'No',
    getFaltas(r),
    getTardanzas(r),
    fmtHoras(getHorasExtras(r)),
    getComisiones(r),
    r.incentivos,
    r.metas,
    r.observaciones,
  ]);

  const totals = [
    'TOTAL', '', '',
    registros.reduce((s, r) => s + getFaltas(r), 0),
    registros.reduce((s, r) => s + getTardanzas(r), 0),
    fmtHoras(registros.reduce((s, r) => s + getHorasExtras(r), 0)),
    registros.reduce((s, r) => s + getComisiones(r), 0),
    registros.reduce((s, r) => s + r.incentivos, 0),
    '', '',
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows, totals]);

  // Header style
  headers.forEach((_, ci) => {
    const ref = XLSX.utils.encode_cell({ r: 0, c: ci });
    if (ws[ref]) ws[ref].s = {
      font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 },
      fill: { fgColor: { rgb: '003DA5' } },
      alignment: { horizontal: 'center' },
    };
  });

  // Row styles
  rows.forEach((row, ri) => {
    const faltas = row[3] as number;
    const extras = row[5] as string;
    const bg = faltas > 0 ? 'FFF5F5' : extras !== '—' ? 'F0FFF4' : ri % 2 === 0 ? 'FFFFFF' : 'F8FAFF';
    row.forEach((_, ci) => {
      const ref = XLSX.utils.encode_cell({ r: ri + 1, c: ci });
      if (ws[ref]) ws[ref].s = { fill: { fgColor: { rgb: bg } } };
    });
  });

  // Totals row
  totals.forEach((_, ci) => {
    const ref = XLSX.utils.encode_cell({ r: rows.length + 1, c: ci });
    if (ws[ref]) ws[ref].s = {
      font: { bold: true },
      fill: { fgColor: { rgb: 'E2E8F0' } },
    };
  });

  ws['!cols'] = [
    { wch: 30 }, { wch: 18 }, { wch: 12 }, { wch: 8 }, { wch: 10 },
    { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 25 }, { wch: 35 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Personal');
  XLSX.writeFile(wb, `Personal_${new Date().toLocaleDateString('es-UY').replace(/\//g, '-')}.xlsx`);
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function PersonalPage() {
  const { registros, updateRegistro, sincronizarReloj, sincronizarComisiones } = usePersonalStore();
  const { reloj, comisionesMovil, comisionesFibra } = useAnalisisStore();

  const [search, setSearch]         = useState('');
  const [turnoFiltro, setTurnoFiltro] = useState('');
  const [conFaltas, setConFaltas]   = useState(false);
  const [sortBy, setSortBy]         = useState<SortKey>('nombre');
  const [toast, setToast]           = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const turnos = useMemo(() => {
    const set = new Set(registros.map(r => r.turno).filter(Boolean));
    return [...set].sort();
  }, [registros]);

  const filtered = useMemo(() => {
    let result = [...registros];
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter(r => r.nombre.toLowerCase().includes(q));
    }
    if (turnoFiltro) result = result.filter(r => r.turno === turnoFiltro);
    if (conFaltas)   result = result.filter(r => getFaltas(r) > 0);
    switch (sortBy) {
      case 'faltas':     result.sort((a, b) => getFaltas(b) - getFaltas(a)); break;
      case 'tardanzas':  result.sort((a, b) => getTardanzas(b) - getTardanzas(a)); break;
      case 'extras':     result.sort((a, b) => getHorasExtras(b) - getHorasExtras(a)); break;
      case 'comisiones': result.sort((a, b) => getComisiones(b) - getComisiones(a)); break;
      default: result.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    }
    return result;
  }, [registros, search, turnoFiltro, conFaltas, sortBy]);

  const totales = useMemo(() => ({
    faltas:     filtered.reduce((s, r) => s + getFaltas(r), 0),
    tardanzas:  filtered.reduce((s, r) => s + getTardanzas(r), 0),
    extras:     filtered.reduce((s, r) => s + getHorasExtras(r), 0),
    comisiones: filtered.reduce((s, r) => s + getComisiones(r), 0),
    incentivos: filtered.reduce((s, r) => s + r.incentivos, 0),
  }), [filtered]);

  const ultimaSincReloj = useMemo(() => {
    const dates = registros.map(r => r.ultimaSincReloj).filter(Boolean) as string[];
    if (dates.length === 0) return null;
    return dates.sort().at(-1) ?? null;
  }, [registros]);

  function handleSincReloj() {
    if (!reloj) {
      showToast('No hay análisis de Reloj cargado. Cargá un archivo en el módulo Reloj primero.', 'error');
      return;
    }
    const { actualizados, noMatcheados } = sincronizarReloj(reloj.empleados);
    const msg = `Sincronizado: ${actualizados} personas actualizadas${noMatcheados.length > 0 ? ` · ${noMatcheados.length} sin match` : ''}`;
    showToast(msg, actualizados > 0 ? 'success' : 'error');
  }

  function handleSincComisiones() {
    if (!comisionesMovil && !comisionesFibra) {
      showToast('No hay análisis de Comisiones cargado. Cargá un archivo primero.', 'error');
      return;
    }

    // Extract vendedores from comisiones store
    // ComisionesEntry stores ventasRaw which has vendedor field
    const movil: { nombre: string; comision: number }[] = [];
    const fibra: { nombre: string; comision: number }[] = [];

    if (comisionesMovil?.ventasRaw) {
      const byVendedor = new Map<string, number>();
      for (const v of comisionesMovil.ventasRaw as { vendedor: string; comision?: number }[]) {
        byVendedor.set(v.vendedor, (byVendedor.get(v.vendedor) ?? 0) + (v.comision ?? 0));
      }
      for (const [nombre, comision] of byVendedor) movil.push({ nombre, comision });
    }
    if (comisionesFibra?.ventasRaw) {
      const byVendedor = new Map<string, number>();
      for (const v of comisionesFibra.ventasRaw as { vendedor: string; comision?: number }[]) {
        byVendedor.set(v.vendedor, (byVendedor.get(v.vendedor) ?? 0) + (v.comision ?? 0));
      }
      for (const [nombre, comision] of byVendedor) fibra.push({ nombre, comision });
    }

    const { actualizados, noMatcheados } = sincronizarComisiones(movil, fibra);
    const msg = `Sincronizado: ${actualizados} personas actualizadas${noMatcheados.length > 0 ? ` · ${noMatcheados.length} sin match` : ''}`;
    showToast(msg, actualizados > 0 ? 'success' : 'error');
  }

  const subtitle = `${registros.length} funcionarios · Última sinc. Reloj: ${fmtSincDate(ultimaSincReloj)}`;

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Personal"
        subtitle={subtitle}
        actions={
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={handleSincReloj}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-green-300 text-green-700 rounded-lg hover:bg-green-50 transition-colors"
            >
              <RefreshCw size={13} /> Sincronizar Reloj
            </button>
            <button
              onClick={handleSincComisiones}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-blue-300 text-blue-700 rounded-lg hover:bg-blue-50 transition-colors"
            >
              <RefreshCw size={13} /> Sincronizar Comisiones
            </button>
            <button
              onClick={() => exportarExcel(filtered)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-[#003DA5] text-white rounded-lg hover:bg-blue-800 transition-colors"
            >
              <Download size={13} /> Exportar Excel
            </button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-[1400px] mx-auto space-y-4">

          {/* Filters */}
          <FilterBar
            search={search} onSearch={setSearch}
            turno={turnoFiltro} onTurno={setTurnoFiltro}
            conFaltas={conFaltas} onConFaltas={setConFaltas}
            sortBy={sortBy} onSortBy={setSortBy}
            turnos={turnos}
          />

          {/* Table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#003DA5] text-white">
                    {[
                      'Nombre', 'Turno', 'Faltas', 'Tardanzas', 'Hrs Extras',
                      'Comisiones', 'Incentivos', 'Metas', 'Observaciones', 'Sinc.',
                    ].map(h => (
                      <th key={h} className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={10} className="px-4 py-8 text-center text-gray-400 text-sm">
                        Ninguna persona coincide con los filtros.
                      </td>
                    </tr>
                  )}
                  {filtered.map((r, i) => {
                    const faltas = getFaltas(r);
                    const tardanzas = getTardanzas(r);
                    const extras = getHorasExtras(r);
                    const comis = getComisiones(r);
                    const sincDate = r.ultimaSincReloj ?? r.ultimaSincComisiones;

                    return (
                      <tr
                        key={r.id}
                        className={`border-b border-gray-100 transition-colors ${
                          i % 2 === 0 ? 'bg-white' : 'bg-[#F8FAFF]'
                        } ${faltas > 0 ? 'bg-red-50' : ''} ${extras > 0 ? '!bg-green-50' : ''}`}
                      >
                        {/* Nombre */}
                        <td className="px-3 py-2 font-semibold text-gray-800 whitespace-nowrap">
                          {r.nombre}
                        </td>

                        {/* Turno */}
                        <td className="px-3 py-2">
                          <span className="text-xs text-gray-500 font-mono">{r.turno}</span>
                          {r.trabajaSabados && (
                            <span className="ml-1 text-[9px] bg-blue-100 text-blue-600 px-1 rounded">Sáb</span>
                          )}
                        </td>

                        {/* Faltas */}
                        <td className="px-3 py-2 text-center">
                          <EditableNumber
                            value={r.faltasManual ?? r.faltasReloj}
                            isAuto={r.faltasManual === null}
                            onSave={v => updateRegistro(r.id, { faltasManual: v })}
                            color={faltas > 0 ? 'text-red-600' : undefined}
                          />
                        </td>

                        {/* Tardanzas */}
                        <td className="px-3 py-2 text-center">
                          <EditableNumber
                            value={r.tardanzasManual ?? r.tardanzasReloj}
                            isAuto={r.tardanzasManual === null}
                            onSave={v => updateRegistro(r.id, { tardanzasManual: v })}
                            color={tardanzas > 0 ? 'text-amber-600' : undefined}
                          />
                        </td>

                        {/* Hrs extras */}
                        <td className="px-3 py-2 text-center">
                          <EditableNumber
                            value={r.horasExtrasManual ?? r.horasExtrasReloj}
                            isAuto={r.horasExtrasManual === null}
                            onSave={v => updateRegistro(r.id, { horasExtrasManual: v })}
                            formatDisplay={fmtHoras}
                            color={extras > 0 ? 'text-green-600' : undefined}
                          />
                        </td>

                        {/* Comisiones */}
                        <td className="px-3 py-2 text-center">
                          <EditableNumber
                            value={r.comisionesManual ?? (r.comisionesMovil + r.comisionesFibra)}
                            isAuto={r.comisionesManual === null}
                            onSave={v => updateRegistro(r.id, { comisionesManual: v })}
                            formatDisplay={n => n > 0 ? fmtPesos(n) : '—'}
                            color={comis > 0 ? 'text-green-700' : undefined}
                          />
                        </td>

                        {/* Incentivos */}
                        <td className="px-3 py-2 text-center">
                          <EditableNumber
                            value={r.incentivos}
                            isAuto={false}
                            onSave={v => updateRegistro(r.id, { incentivos: v ?? 0 })}
                            formatDisplay={n => n > 0 ? fmtPesos(n) : '—'}
                            color={r.incentivos > 0 ? 'text-emerald-600' : undefined}
                          />
                        </td>

                        {/* Metas */}
                        <td className="px-3 py-2">
                          <EditableText
                            value={r.metas}
                            onSave={v => updateRegistro(r.id, { metas: v })}
                            placeholder="Agregar meta..."
                            maxLen={50}
                          />
                        </td>

                        {/* Observaciones */}
                        <td className="px-3 py-2">
                          <EditableText
                            value={r.observaciones}
                            onSave={v => updateRegistro(r.id, { observaciones: v })}
                            placeholder="Agregar nota..."
                            maxLen={100}
                          />
                        </td>

                        {/* Sinc */}
                        <td className="px-3 py-2 text-center">
                          {sincDate ? (
                            <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap">
                              {fmtSincDate(sincDate)}
                            </span>
                          ) : (
                            <span className="text-[10px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-full font-medium">
                              Sin datos
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>

                {/* Totals row */}
                {filtered.length > 0 && (
                  <tfoot>
                    <tr className="bg-[#003DA5] text-white">
                      <td className="px-3 py-2.5 font-bold text-sm">
                        TOTAL ({filtered.length})
                      </td>
                      <td className="px-3 py-2.5">—</td>
                      <td className="px-3 py-2.5 text-center font-bold">{totales.faltas}</td>
                      <td className="px-3 py-2.5 text-center font-bold">{totales.tardanzas}</td>
                      <td className="px-3 py-2.5 text-center font-bold text-xs font-mono">
                        {fmtHoras(totales.extras)}
                      </td>
                      <td className="px-3 py-2.5 text-center font-bold text-xs">
                        {totales.comisiones > 0 ? fmtPesos(totales.comisiones) : '—'}
                      </td>
                      <td className="px-3 py-2.5 text-center font-bold text-xs">
                        {totales.incentivos > 0 ? fmtPesos(totales.incentivos) : '—'}
                      </td>
                      <td className="px-3 py-2.5">—</td>
                      <td className="px-3 py-2.5">—</td>
                      <td className="px-3 py-2.5">—</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

        </div>
      </div>

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
