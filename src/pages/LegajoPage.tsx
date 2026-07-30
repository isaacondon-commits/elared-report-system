import { useState, useMemo, useCallback, Fragment } from 'react';
import {
  FolderOpen, Plus, Trash2, X, ChevronDown, ChevronUp, Search, Download,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import Header from '../components/Header';
import { HORARIOS_PERSONAL } from '../data/horarios_personal';

// ─── Types ─────────────────────────────────────────────────────────────────────

type TipoEntrada = 'observacion' | 'suspension' | 'llamado_atencion' | 'reconocimiento' | 'otro';

interface EntradaLegajo {
  id: string;
  nombre: string;
  tipo: TipoEntrada;
  fecha: string;
  detalle: string;
  diasSuspension: number | null;
}

const TIPO_LABEL: Record<TipoEntrada, string> = {
  observacion: 'Observación',
  suspension: 'Suspensión',
  llamado_atencion: 'Llamado de atención',
  reconocimiento: 'Reconocimiento',
  otro: 'Otro',
};

const TIPO_COLOR: Record<TipoEntrada, { bg: string; text: string }> = {
  observacion:      { bg: '#dbeafe', text: '#1d4ed8' },
  suspension:       { bg: '#fee2e2', text: '#991b1b' },
  llamado_atencion: { bg: '#fef3c7', text: '#92400e' },
  reconocimiento:   { bg: '#dcfce7', text: '#15803d' },
  otro:             { bg: '#f3f4f6', text: '#4b5563' },
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

function todayISO(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
}

function fmtDate(iso: string): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function buildEntrada(nombre: string, tipo: TipoEntrada, fecha: string, detalle: string, diasSuspension: number | null): EntradaLegajo {
  const id = `${nombre}__${fecha}__${Math.random().toString(36).slice(2, 7)}`;
  return { id, nombre, tipo, fecha, detalle, diasSuspension };
}

const STORAGE_KEY = 'elared_legajo';

function loadData(): EntradaLegajo[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as EntradaLegajo[];
  } catch { /* ignore */ }
  return [];
}

function saveData(entradas: EntradaLegajo[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(entradas)); } catch { /* ignore */ }
}

// ─── Export helper ─────────────────────────────────────────────────────────────

function exportExcel(entradas: EntradaLegajo[]) {
  const wb = XLSX.utils.book_new();
  const headers = ['Nombre', 'Tipo', 'Fecha', 'Detalle', 'Días suspensión'];
  const sorted = [...entradas].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es') || b.fecha.localeCompare(a.fecha));
  const rows = sorted.map(e => [e.nombre, TIPO_LABEL[e.tipo], fmtDate(e.fecha), e.detalle, e.diasSuspension ?? '']);
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws['!cols'] = [{ wch: 32 }, { wch: 18 }, { wch: 12 }, { wch: 44 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, ws, 'Legajo');
  XLSX.writeFile(wb, `Legajo_${new Date().toLocaleDateString('es-UY').replace(/\//g, '-')}.xlsx`);
}

// ─── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sublabel, borderColor, valueColor }: {
  label: string; value: number; sublabel: string; borderColor: string; valueColor?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col" style={{ borderTop: `3px solid ${borderColor}` }}>
      <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1">{label}</div>
      <div className="text-3xl font-bold mb-1" style={{ color: valueColor ?? '#1e293b' }}>{value}</div>
      <div className="text-[11px] text-gray-400 leading-tight">{sublabel}</div>
    </div>
  );
}

// ─── Add modal ─────────────────────────────────────────────────────────────────

const NOMBRES_ROSTER = HORARIOS_PERSONAL.map(p => p.nombre).sort((a, b) => a.localeCompare(b, 'es'));

function AddModal({ nombreInicial, onSave, onClose }: {
  nombreInicial?: string; onSave: (e: EntradaLegajo) => void; onClose: () => void;
}) {
  const [nombre, setNombre] = useState(nombreInicial ?? '');
  const [tipo, setTipo] = useState<TipoEntrada>('observacion');
  const [fecha, setFecha] = useState(todayISO());
  const [detalle, setDetalle] = useState('');
  const [dias, setDias] = useState('');
  const [error, setError] = useState('');

  function handleSave() {
    if (!nombre.trim()) { setError('El nombre es requerido.'); return; }
    if (!detalle.trim()) { setError('El detalle es requerido.'); return; }
    const diasSuspension = tipo === 'suspension' && dias.trim() ? Number(dias) : null;
    onSave(buildEntrada(nombre.trim().toUpperCase(), tipo, fecha, detalle.trim(), diasSuspension));
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-bold text-gray-900 text-lg">Nueva entrada de legajo</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Persona</label>
            <input type="text" value={nombre} onChange={e => setNombre(e.target.value.toUpperCase())}
              list="legajo-nombre-options" placeholder="APELLIDO, Nombre"
              disabled={!!nombreInicial}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#003DA5] focus:ring-1 focus:ring-[#003DA5] disabled:bg-gray-50 disabled:text-gray-500" />
            <datalist id="legajo-nombre-options">
              {NOMBRES_ROSTER.map(n => <option key={n} value={n} />)}
            </datalist>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Tipo</label>
            <select value={tipo} onChange={e => setTipo(e.target.value as TipoEntrada)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#003DA5] focus:ring-1 focus:ring-[#003DA5]">
              {(Object.keys(TIPO_LABEL) as TipoEntrada[]).map(t => <option key={t} value={t}>{TIPO_LABEL[t]}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Fecha</label>
              <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#003DA5] focus:ring-1 focus:ring-[#003DA5]" />
            </div>
            {tipo === 'suspension' && (
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Días</label>
                <input type="number" min={0} value={dias} onChange={e => setDias(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#003DA5] focus:ring-1 focus:ring-[#003DA5]" />
              </div>
            )}
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Detalle</label>
            <textarea value={detalle} onChange={e => setDetalle(e.target.value)} rows={3}
              placeholder="Descripción de la entrada..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#003DA5] focus:ring-1 focus:ring-[#003DA5] resize-none" />
          </div>
          {error && <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 border border-gray-300 rounded-lg py-2 text-sm text-gray-700 hover:bg-gray-50">Cancelar</button>
          <button onClick={handleSave} className="flex-1 bg-[#003DA5] text-white rounded-lg py-2 text-sm font-semibold hover:bg-blue-800">Guardar</button>
        </div>
      </div>
    </div>
  );
}

// ─── Delete confirm modal ──────────────────────────────────────────────────────

function DeleteModal({ entrada, onConfirm, onClose }: { entrada: EntradaLegajo; onConfirm: () => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
        <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center mb-4">
          <Trash2 size={18} className="text-red-600" />
        </div>
        <h2 className="font-bold text-gray-900 text-base mb-1">¿Eliminar entrada?</h2>
        <p className="text-sm text-gray-500 mb-5"><strong>{entrada.nombre}</strong> — {TIPO_LABEL[entrada.tipo]} del {fmtDate(entrada.fecha)}</p>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 border border-gray-300 rounded-lg py-2 text-sm text-gray-700 hover:bg-gray-50">Cancelar</button>
          <button onClick={onConfirm} className="flex-1 bg-red-600 text-white rounded-lg py-2 text-sm font-semibold hover:bg-red-700">Eliminar</button>
        </div>
      </div>
    </div>
  );
}

// ─── Toast ─────────────────────────────────────────────────────────────────────

function Toast({ msg, onClose }: { msg: string; onClose: () => void }) {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-green-600 text-white text-sm font-medium px-5 py-3 rounded-xl shadow-xl">
      <FolderOpen size={15} />
      {msg}
      <button onClick={onClose} className="ml-1 opacity-70 hover:opacity-100"><X size={13} /></button>
    </div>
  );
}

// ─── Departamento badge (reuso de colores de Reloj/Ventas) ─────────────────────

const DEPTO_COLORS: Record<string, string> = {
  'Call Fibra': '#003DA5', 'Call Móvil': '#6f42c1', 'RRHH': '#28a745', 'Atención': '#20c997',
};
function DepartamentoBadge({ depto }: { depto?: string }) {
  if (!depto) return <span className="text-gray-300 text-xs">—</span>;
  const color = DEPTO_COLORS[depto] ?? '#6c757d';
  return (
    <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold text-white whitespace-nowrap" style={{ background: color }}>
      {depto}
    </span>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

interface PersonaRoster {
  nombre: string;
  departamento?: string;
}

type FiltroLegajo = 'todos' | 'con_legajo' | 'con_observaciones' | 'con_reconocimientos' | 'con_suspensiones';
type SortKey = 'nombre' | 'entradas' | 'ultima';

export default function LegajoPage() {
  const [entradas, setEntradas] = useState<EntradaLegajo[]>(loadData);
  const [search, setSearch] = useState('');
  const [filtro, setFiltro] = useState<FiltroLegajo>('todos');
  const [sortBy, setSortBy] = useState<SortKey>('nombre');
  const [expandedNombre, setExpandedNombre] = useState<string | null>(null);
  const [addModalNombre, setAddModalNombre] = useState<string | null>(null);
  const [showAddGeneric, setShowAddGeneric] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<EntradaLegajo | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  }, []);

  function persist(next: EntradaLegajo[]) {
    setEntradas(next);
    saveData(next);
  }

  function handleAdd(e: EntradaLegajo) {
    persist([...entradas, e]);
    setAddModalNombre(null);
    setShowAddGeneric(false);
    showToast(`Entrada agregada · ${e.nombre}`);
  }

  function handleDelete() {
    if (!deleteTarget) return;
    persist(entradas.filter(e => e.id !== deleteTarget.id));
    setDeleteTarget(null);
    showToast('Entrada eliminada');
  }

  // ── Roster: todo el personal (HORARIOS_PERSONAL) + nombres extra que solo existen en el legajo ──
  const roster = useMemo<PersonaRoster[]>(() => {
    const base: PersonaRoster[] = HORARIOS_PERSONAL.map(p => ({ nombre: p.nombre, departamento: p.departamento }));
    const baseNorm = new Set(base.map(p => p.nombre.trim().toLowerCase()));
    const extras = new Set<string>();
    for (const e of entradas) {
      if (!baseNorm.has(e.nombre.trim().toLowerCase())) extras.add(e.nombre);
    }
    return [...base, ...Array.from(extras).map(nombre => ({ nombre }))];
  }, [entradas]);

  const entradasPorNombre = useMemo(() => {
    const map = new Map<string, EntradaLegajo[]>();
    for (const e of entradas) {
      const key = e.nombre.trim().toLowerCase();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    return map;
  }, [entradas]);

  const filas = useMemo(() => {
    let rows = roster.map(p => {
      const ent = (entradasPorNombre.get(p.nombre.trim().toLowerCase()) ?? []).slice().sort((a, b) => b.fecha.localeCompare(a.fecha));
      return {
        nombre: p.nombre,
        departamento: p.departamento,
        entradas: ent,
        observaciones: ent.filter(e => e.tipo === 'observacion').length,
        reconocimientos: ent.filter(e => e.tipo === 'reconocimiento').length,
        suspensiones: ent.filter(e => e.tipo === 'suspension').length,
        ultima: ent[0]?.fecha ?? null,
      };
    });

    if (search.trim()) {
      const q = search.toLowerCase().trim();
      rows = rows.filter(r => r.nombre.toLowerCase().includes(q));
    }
    if (filtro === 'con_legajo') rows = rows.filter(r => r.entradas.length > 0);
    if (filtro === 'con_observaciones') rows = rows.filter(r => r.observaciones > 0);
    if (filtro === 'con_reconocimientos') rows = rows.filter(r => r.reconocimientos > 0);
    if (filtro === 'con_suspensiones') rows = rows.filter(r => r.suspensiones > 0);

    switch (sortBy) {
      case 'nombre':   rows.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')); break;
      case 'entradas': rows.sort((a, b) => b.entradas.length - a.entradas.length); break;
      case 'ultima':   rows.sort((a, b) => (b.ultima ?? '').localeCompare(a.ultima ?? '')); break;
    }
    return rows;
  }, [roster, entradasPorNombre, search, filtro, sortBy]);

  const stats = useMemo(() => {
    const mesActual = todayISO().slice(0, 7);
    const personasConLegajo = new Set(entradas.map(e => e.nombre.trim().toLowerCase())).size;
    return {
      personasConLegajo,
      totalEntradas: entradas.length,
      observaciones: entradas.filter(e => e.tipo === 'observacion').length,
      reconocimientos: entradas.filter(e => e.tipo === 'reconocimiento').length,
      suspensiones: entradas.filter(e => e.tipo === 'suspension').length,
      esteMes: entradas.filter(e => e.fecha.slice(0, 7) === mesActual).length,
    };
  }, [entradas]);

  function toggleExpand(nombre: string) {
    setExpandedNombre(expandedNombre === nombre ? null : nombre);
  }

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Legajo"
        subtitle={`${roster.length} personas · ${stats.totalEntradas} entradas cargadas`}
        actions={
          <div className="flex gap-2">
            {entradas.length > 0 && (
              <button onClick={() => exportExcel(entradas)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
                <Download size={13} /> Exportar Excel
              </button>
            )}
            <button onClick={() => setShowAddGeneric(true)}
              className="flex items-center gap-1.5 px-4 py-1.5 text-sm bg-[#003DA5] text-white rounded-lg hover:bg-blue-800 transition-colors font-semibold">
              <Plus size={14} /> Nueva entrada
            </button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-6">
        <div id="legajo-content" className="max-w-[1300px] mx-auto space-y-5">

          {/* ── KPIs ── */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <KpiCard label="Personas con legajo" value={stats.personasConLegajo} sublabel={`de ${roster.length} en total`} borderColor="#003DA5" />
            <KpiCard label="Observaciones" value={stats.observaciones} sublabel="histórico" borderColor="#1d4ed8" />
            <KpiCard label="Reconocimientos" value={stats.reconocimientos} sublabel="histórico" borderColor="#15803d" valueColor={stats.reconocimientos > 0 ? '#15803d' : undefined} />
            <KpiCard label="Suspensiones" value={stats.suspensiones} sublabel="histórico" borderColor="#dc2626" valueColor={stats.suspensiones > 0 ? '#dc2626' : undefined} />
            <KpiCard label="Este mes" value={stats.esteMes} sublabel="entradas cargadas en el mes" borderColor="#d97706" valueColor={stats.esteMes > 0 ? '#d97706' : undefined} />
          </div>

          {/* ── Filters ── */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 border border-gray-200 rounded-lg px-3 py-1.5 bg-white min-w-[220px]">
              <Search size={13} className="text-gray-400 flex-shrink-0" />
              <input type="text" placeholder="Buscar persona..." value={search}
                onChange={e => setSearch(e.target.value)} className="text-sm outline-none flex-1 bg-transparent" />
              {search && <button onClick={() => setSearch('')} className="text-gray-400 hover:text-gray-600"><X size={12} /></button>}
            </div>

            <div className="flex gap-1 bg-gray-100 rounded-lg p-1 flex-wrap">
              {([
                ['todos', 'Todas las personas'], ['con_legajo', 'Solo con legajo'],
                ['con_observaciones', 'Con observaciones'], ['con_reconocimientos', 'Con reconocimientos'],
                ['con_suspensiones', 'Con suspensiones'],
              ] as [FiltroLegajo, string][]).map(([v, label]) => (
                <button key={v} onClick={() => setFiltro(v)}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${filtro === v ? 'bg-white text-[#003DA5] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                  {label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5 border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-sm">
              <span className="text-gray-400 text-xs">Ordenar:</span>
              <select value={sortBy} onChange={e => setSortBy(e.target.value as SortKey)} className="outline-none bg-transparent text-sm">
                <option value="nombre">Nombre A–Z</option>
                <option value="entradas">Más entradas</option>
                <option value="ultima">Entrada más reciente</option>
              </select>
              <ChevronDown size={12} className="text-gray-400" />
            </div>

            <span className="text-sm text-gray-400">{filas.length} personas</span>
          </div>

          {/* ── Table ── */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#003DA5] text-white">
                    {['Persona', 'Departamento', 'Observaciones', 'Reconocimientos', 'Suspensiones', 'Última entrada', ''].map(h => (
                      <th key={h} className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filas.length === 0 && (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400 text-sm">Ninguna persona coincide con los filtros.</td></tr>
                  )}
                  {filas.map((f, i) => {
                    const isExpanded = expandedNombre === f.nombre;
                    return (
                      <Fragment key={f.nombre}>
                        <tr
                          className={`border-b border-gray-100 cursor-pointer transition-colors ${isExpanded ? 'bg-blue-50' : i % 2 === 0 ? 'bg-white hover:bg-gray-50' : 'bg-gray-50/50 hover:bg-gray-100'}`}
                          onClick={() => toggleExpand(f.nombre)}
                        >
                          <td className="px-3 py-2.5 font-semibold text-gray-800 whitespace-nowrap">{f.nombre}</td>
                          <td className="px-3 py-2.5"><DepartamentoBadge depto={f.departamento} /></td>
                          <td className="px-3 py-2.5 text-center">
                            <span className={f.observaciones > 0 ? 'font-semibold text-blue-700' : 'text-gray-300'}>{f.observaciones}</span>
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <span className={f.reconocimientos > 0 ? 'font-semibold text-green-700' : 'text-gray-300'}>{f.reconocimientos}</span>
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <span className={f.suspensiones > 0 ? 'font-semibold text-red-600' : 'text-gray-300'}>{f.suspensiones}</span>
                          </td>
                          <td className="px-3 py-2.5 text-gray-500 text-xs whitespace-nowrap">{f.ultima ? fmtDate(f.ultima) : '—'}</td>
                          <td className="px-3 py-2.5 text-gray-400 text-center">
                            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="bg-blue-50">
                            <td colSpan={7} className="px-4 pb-4 pt-1">
                              <div className="bg-white rounded-lg border border-blue-200 overflow-hidden">
                                <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
                                  <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Historial de legajo</span>
                                  <button
                                    onClick={ev => { ev.stopPropagation(); setAddModalNombre(f.nombre); }}
                                    className="flex items-center gap-1 text-xs font-semibold text-[#003DA5] hover:bg-blue-50 px-2 py-1 rounded-lg"
                                  >
                                    <Plus size={12} /> Agregar entrada
                                  </button>
                                </div>
                                {f.entradas.length === 0 ? (
                                  <p className="text-sm text-gray-400 px-4 py-4">Sin entradas registradas para esta persona.</p>
                                ) : (
                                  <table className="w-full text-xs">
                                    <thead>
                                      <tr className="bg-gray-50">
                                        <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase tracking-wide">Fecha</th>
                                        <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase tracking-wide">Tipo</th>
                                        <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase tracking-wide">Detalle</th>
                                        <th className="px-3 py-2 w-8" />
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {f.entradas.map(e => (
                                        <tr key={e.id} className="border-t border-gray-100 group hover:bg-gray-50">
                                          <td className="px-3 py-2 font-mono text-gray-600 whitespace-nowrap">{fmtDate(e.fecha)}</td>
                                          <td className="px-3 py-2 whitespace-nowrap">
                                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                                              style={{ background: TIPO_COLOR[e.tipo].bg, color: TIPO_COLOR[e.tipo].text }}>
                                              {TIPO_LABEL[e.tipo]}{e.tipo === 'suspension' && e.diasSuspension ? ` (${e.diasSuspension}d)` : ''}
                                            </span>
                                          </td>
                                          <td className="px-3 py-2 text-gray-700">{e.detalle}</td>
                                          <td className="px-3 py-2">
                                            <button
                                              onClick={ev => { ev.stopPropagation(); setDeleteTarget(e); }}
                                              className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-all"
                                            >
                                              <Trash2 size={12} />
                                            </button>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>

      {(addModalNombre || showAddGeneric) && (
        <AddModal
          nombreInicial={addModalNombre ?? undefined}
          onSave={handleAdd}
          onClose={() => { setAddModalNombre(null); setShowAddGeneric(false); }}
        />
      )}
      {deleteTarget && <DeleteModal entrada={deleteTarget} onConfirm={handleDelete} onClose={() => setDeleteTarget(null)} />}
      {toast && <Toast msg={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
