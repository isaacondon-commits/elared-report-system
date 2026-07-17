import { useState, useMemo, useCallback, useRef } from 'react';
import {
  RefreshCw, Download, Search, ChevronDown, CheckCircle2, AlertCircle, X,
  Plus, UserX, UserCheck, Pencil,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import Header from '../components/Header';
import {
  usePersonalStore, type RegistroPersonal, type NuevaPersona,
  getFaltas, getTardanzas, getHorasExtras, getComisiones,
  getDiasTrabajados, formatAntiguedad, getAntiguedadBadge,
} from '../store/personalStore';
import { useAnalisisStore } from '../store/analisisStore';

// ─── Helpers ───────────────────────────────────────────────────────────────────

const DEPARTAMENTOS = ['Call Fibra', 'Call Móvil', 'RRHH', 'Atención al Cliente', 'Back Office', 'Administración'];

function fmtFecha(iso: string | null): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

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

// ─── Modal base ──────────────────────────────────────────────────────────────

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4 py-6 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg my-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900 text-base">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

const MODAL_INPUT = 'w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#003DA5] focus:ring-1 focus:ring-[#003DA5] transition-colors';
const MODAL_LABEL = 'block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-widest';

// ─── Modal Alta/Editar persona ──────────────────────────────────────────────────

function ModalPersona({ existing, onClose, onSave }: {
  existing?: RegistroPersonal;
  onClose: () => void;
  onSave: (datos: NuevaPersona) => void;
}) {
  const [nombre, setNombre]           = useState(existing?.nombre ?? '');
  const [cargo, setCargo]             = useState(existing?.cargo ?? '');
  const [departamento, setDepartamento] = useState(existing?.departamento ?? '');
  const [fechaIngreso, setFechaIngreso] = useState(existing?.fechaIngreso ?? todayIso());
  const [estado, setEstado]           = useState<'activo' | 'baja'>(existing?.estado ?? 'activo');
  const [fechaBaja, setFechaBaja]     = useState(existing?.fechaBaja ?? todayIso());
  const [observaciones, setObservaciones] = useState(existing?.observaciones ?? '');
  const [error, setError]             = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) { setError('El nombre es obligatorio.'); return; }
    if (!fechaIngreso) { setError('La fecha de ingreso es obligatoria.'); return; }
    onSave({
      nombre: nombre.trim(), cargo: cargo.trim(), departamento: departamento.trim(),
      fechaIngreso, estado, fechaBaja: estado === 'baja' ? fechaBaja : null,
      observaciones: observaciones.trim(),
    });
    onClose();
  }

  return (
    <Modal title={existing ? 'Editar persona' : 'Agregar persona'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className={MODAL_LABEL}>Nombre completo *</label>
          <input required value={nombre} onChange={e => setNombre(e.target.value)} className={MODAL_INPUT} placeholder="Ej: María García" />
        </div>
        <div>
          <label className={MODAL_LABEL}>Cargo / Puesto</label>
          <input value={cargo} onChange={e => setCargo(e.target.value)} className={MODAL_INPUT} placeholder="Ej: Teleoperador/a" />
        </div>
        <div>
          <label className={MODAL_LABEL}>Departamento</label>
          <input value={departamento} onChange={e => setDepartamento(e.target.value)} className={MODAL_INPUT} list="departamentos-list" placeholder="Ej: Call Fibra" />
          <datalist id="departamentos-list">
            {DEPARTAMENTOS.map(d => <option key={d} value={d} />)}
          </datalist>
        </div>
        <div>
          <label className={MODAL_LABEL}>Fecha de ingreso *</label>
          <input required type="date" value={fechaIngreso} onChange={e => setFechaIngreso(e.target.value)} className={MODAL_INPUT} />
        </div>
        <div>
          <label className={MODAL_LABEL}>Estado</label>
          <div className="flex gap-2">
            <button type="button" onClick={() => setEstado('activo')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                estado === 'activo' ? 'bg-green-600 text-white border-green-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}>
              Activo ✓
            </button>
            <button type="button" onClick={() => setEstado('baja')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                estado === 'baja' ? 'bg-red-600 text-white border-red-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}>
              Baja ✗
            </button>
          </div>
        </div>
        {estado === 'baja' && (
          <div>
            <label className={MODAL_LABEL}>Fecha de baja</label>
            <input type="date" value={fechaBaja} onChange={e => setFechaBaja(e.target.value)} className={MODAL_INPUT} />
          </div>
        )}
        <div>
          <label className={MODAL_LABEL}>Observaciones</label>
          <textarea value={observaciones} onChange={e => setObservaciones(e.target.value)} className={`${MODAL_INPUT} resize-none`} rows={2} />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3.5 py-2.5 text-sm">{error}</div>
        )}

        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose}
            className="flex-1 border border-gray-200 text-gray-700 rounded-lg py-2.5 text-sm hover:bg-gray-50 transition-colors">
            Cancelar
          </button>
          <button type="submit"
            className="flex-1 bg-[#003DA5] hover:bg-[#0052CC] text-white font-semibold rounded-lg py-2.5 text-sm transition-colors">
            {existing ? 'Guardar cambios' : 'Agregar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Modal Dar de baja ──────────────────────────────────────────────────────────

function ModalBaja({ persona, onClose, onConfirm }: {
  persona: RegistroPersonal;
  onClose: () => void;
  onConfirm: (fechaBaja: string, motivo: string) => void;
}) {
  const [fechaBaja, setFechaBaja] = useState(todayIso());
  const [motivo, setMotivo]       = useState('');

  return (
    <Modal title={`¿Dar de baja a ${persona.nombre}?`} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className={MODAL_LABEL}>Fecha de baja</label>
          <input type="date" value={fechaBaja} onChange={e => setFechaBaja(e.target.value)} className={MODAL_INPUT} />
        </div>
        <div>
          <label className={MODAL_LABEL}>Motivo (opcional)</label>
          <textarea value={motivo} onChange={e => setMotivo(e.target.value)} className={`${MODAL_INPUT} resize-none`} rows={3} />
        </div>
        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose}
            className="flex-1 border border-gray-200 text-gray-700 rounded-lg py-2.5 text-sm hover:bg-gray-50 transition-colors">
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => { onConfirm(fechaBaja, motivo.trim()); onClose(); }}
            className="flex-1 text-white font-semibold rounded-lg py-2.5 text-sm transition-colors"
            style={{ background: '#E3000F' }}
          >
            Confirmar baja
          </button>
        </div>
      </div>
    </Modal>
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
type EstadoFiltro = 'todos' | 'activo' | 'baja';

interface FiltersProps {
  search: string; onSearch: (v: string) => void;
  turno: string; onTurno: (v: string) => void;
  conFaltas: boolean; onConFaltas: (v: boolean) => void;
  sortBy: SortKey; onSortBy: (v: SortKey) => void;
  turnos: string[];
  estadoFiltro: EstadoFiltro; onEstadoFiltro: (v: EstadoFiltro) => void;
}

function EstadoFilterTabs({ value, onChange }: { value: EstadoFiltro; onChange: (v: EstadoFiltro) => void }) {
  const opts: { key: EstadoFiltro; label: string }[] = [
    { key: 'todos', label: 'Todos' }, { key: 'activo', label: 'Activos' }, { key: 'baja', label: 'Bajas' },
  ];
  return (
    <div className="flex items-center gap-1 border border-gray-200 rounded-lg p-0.5 bg-white">
      {opts.map(o => (
        <button
          key={o.key}
          onClick={() => onChange(o.key)}
          className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
            value === o.key ? 'bg-[#003DA5] text-white' : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function FilterBar({ search, onSearch, turno, onTurno, conFaltas, onConFaltas, sortBy, onSortBy, turnos, estadoFiltro, onEstadoFiltro }: FiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <EstadoFilterTabs value={estadoFiltro} onChange={onEstadoFiltro} />

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
  const { registros, updateRegistro, agregarPersona, sincronizarReloj, sincronizarComisiones } = usePersonalStore();
  const { reloj, comisionesMovil, comisionesFibra } = useAnalisisStore();

  const [search, setSearch]         = useState('');
  const [turnoFiltro, setTurnoFiltro] = useState('');
  const [conFaltas, setConFaltas]   = useState(false);
  const [sortBy, setSortBy]         = useState<SortKey>('nombre');
  const [estadoFiltro, setEstadoFiltro] = useState<EstadoFiltro>('activo');
  const [toast, setToast]           = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const [modalAgregar, setModalAgregar] = useState(false);
  const [modalEditar, setModalEditar]   = useState<RegistroPersonal | null>(null);
  const [modalBaja, setModalBaja]       = useState<RegistroPersonal | null>(null);

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
    if (estadoFiltro !== 'todos') result = result.filter(r => r.estado === estadoFiltro);
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
  }, [registros, search, turnoFiltro, conFaltas, sortBy, estadoFiltro]);

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
              onClick={() => setModalAgregar(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
            >
              <Plus size={13} /> Agregar persona
            </button>
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
            estadoFiltro={estadoFiltro} onEstadoFiltro={setEstadoFiltro}
          />

          {/* Table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#003DA5] text-white">
                    {[
                      'Nombre', 'Cargo', 'Departamento', 'Turno', 'Estado', 'Fecha ingreso', 'Antigüedad',
                      'Faltas', 'Tardanzas', 'Hrs Extras',
                      'Comisiones', 'Incentivos', 'Metas', 'Observaciones', 'Sinc.', 'Acciones',
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
                      <td colSpan={16} className="px-4 py-8 text-center text-gray-400 text-sm">
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
                    const dias = getDiasTrabajados(r);
                    const antBadge = dias !== null ? getAntiguedadBadge(dias) : null;

                    return (
                      <tr
                        key={r.id}
                        className={`border-b border-gray-100 transition-colors ${
                          i % 2 === 0 ? 'bg-white' : 'bg-[#F8FAFF]'
                        } ${r.estado === 'baja' ? '!bg-red-50/60' : ''} ${faltas > 0 && r.estado === 'activo' ? 'bg-red-50' : ''} ${extras > 0 && r.estado === 'activo' ? '!bg-green-50' : ''}`}
                      >
                        {/* Nombre */}
                        <td className="px-3 py-2 font-semibold text-gray-800 whitespace-nowrap">
                          {r.nombre}
                        </td>

                        {/* Cargo */}
                        <td className="px-3 py-2 text-xs text-gray-600 whitespace-nowrap">{r.cargo || '—'}</td>

                        {/* Departamento */}
                        <td className="px-3 py-2 text-xs text-gray-600 whitespace-nowrap">{r.departamento || '—'}</td>

                        {/* Turno */}
                        <td className="px-3 py-2">
                          <span className="text-xs text-gray-500 font-mono">{r.turno}</span>
                          {r.trabajaSabados && (
                            <span className="ml-1 text-[9px] bg-blue-100 text-blue-600 px-1 rounded">Sáb</span>
                          )}
                        </td>

                        {/* Estado */}
                        <td className="px-3 py-2">
                          {r.estado === 'activo' ? (
                            <span className="inline-block text-white text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: '#28a745' }}>Activo</span>
                          ) : (
                            <span className="inline-block text-white text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap" style={{ background: '#E3000F' }}>
                              Baja {r.fechaBaja ? fmtFecha(r.fechaBaja) : ''}
                            </span>
                          )}
                        </td>

                        {/* Fecha ingreso */}
                        <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">{fmtFecha(r.fechaIngreso)}</td>

                        {/* Antigüedad */}
                        <td className="px-3 py-2 whitespace-nowrap">
                          {dias !== null && antBadge ? (
                            <span className="inline-flex items-center gap-1 text-xs text-gray-600">
                              {formatAntiguedad(dias)}
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: antBadge.bg, color: antBadge.color }}>
                                {antBadge.label}
                              </span>
                            </span>
                          ) : <span className="text-xs text-gray-300">—</span>}
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

                        {/* Acciones */}
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1.5 whitespace-nowrap">
                            <button
                              onClick={() => setModalEditar(r)}
                              className="flex items-center gap-1 text-xs text-[#003DA5] hover:bg-blue-50 px-2 py-1 rounded-lg border border-[#003DA5]/20 transition-colors font-medium"
                            >
                              <Pencil size={12} /> Editar
                            </button>
                            {r.estado === 'activo' ? (
                              <button
                                onClick={() => setModalBaja(r)}
                                className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
                              >
                                <UserX size={12} /> Dar de baja
                              </button>
                            ) : (
                              <button
                                onClick={() => updateRegistro(r.id, { estado: 'activo', fechaBaja: null, motivoBaja: '' })}
                                className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg border border-green-200 text-green-700 hover:bg-green-50 transition-colors"
                              >
                                <UserCheck size={12} /> Reactivar
                              </button>
                            )}
                          </div>
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
                      <td className="px-3 py-2.5">—</td>
                      <td className="px-3 py-2.5">—</td>
                      <td className="px-3 py-2.5">—</td>
                      <td className="px-3 py-2.5">—</td>
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
                      <td className="px-3 py-2.5">—</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

        </div>
      </div>

      {modalAgregar && (
        <ModalPersona
          onClose={() => setModalAgregar(false)}
          onSave={datos => { agregarPersona(datos); showToast(`"${datos.nombre}" agregado correctamente`); }}
        />
      )}
      {modalEditar && (
        <ModalPersona
          existing={modalEditar}
          onClose={() => setModalEditar(null)}
          onSave={datos => {
            updateRegistro(modalEditar.id, {
              nombre: datos.nombre, cargo: datos.cargo, departamento: datos.departamento,
              fechaIngreso: datos.fechaIngreso, estado: datos.estado, fechaBaja: datos.fechaBaja,
              observaciones: datos.observaciones,
            });
            showToast(`"${datos.nombre}" actualizado`);
          }}
        />
      )}
      {modalBaja && (
        <ModalBaja
          persona={modalBaja}
          onClose={() => setModalBaja(null)}
          onConfirm={(fechaBaja, motivo) => {
            updateRegistro(modalBaja.id, { estado: 'baja', fechaBaja, motivoBaja: motivo });
            showToast(`"${modalBaja.nombre}" dado de baja`);
          }}
        />
      )}

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
