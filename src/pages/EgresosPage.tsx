import { useState, useMemo, useCallback } from 'react';
import {
  UserMinus, Plus, Trash2, X, ChevronDown, Search, Download, ClipboardList, RefreshCw,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import Header from '../components/Header';

// ─── Types ─────────────────────────────────────────────────────────────────────

type TipoEgreso = 'despido' | 'renuncia';

interface Egreso {
  id: string;
  nombre: string;
  tipo: TipoEgreso;
  fecha: string;
  motivo: string;
}

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

function buildEgreso(nombre: string, tipo: TipoEgreso, fecha: string, motivo: string): Egreso {
  const id = `${nombre}__${fecha}__${Math.random().toString(36).slice(2, 7)}`;
  return { id, nombre, tipo, fecha, motivo };
}

const STORAGE_KEY = 'elared_egresos';

function loadData(): Egreso[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as Egreso[];
  } catch { /* ignore */ }
  return [];
}

function saveData(egresos: Egreso[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(egresos)); } catch { /* ignore */ }
}

// ─── Parser de texto (nombre <tab> tipo <tab> dd/mm/yyyy <tab> motivo) ──────────

function parsearTexto(texto: string): { egresos: Egreso[]; ignoradas: number } {
  const lines = texto.split('\n');
  const resultados: Egreso[] = [];
  let ignoradas = 0;

  function dmyToIso(dmy: string): string {
    const [d, m, y] = dmy.split('/');
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  for (const linea of lines) {
    const trim = linea.trim();
    if (!trim) continue;

    let partes = trim.split('\t').map(p => p.trim()).filter(Boolean);
    if (partes.length < 2) partes = trim.split(/\s{2,}/).map(p => p.trim()).filter(Boolean);
    if (partes.length < 1) { ignoradas++; continue; }

    const nombre = partes[0];
    if (!nombre) { ignoradas++; continue; }

    const tipoRaw = (partes[1] ?? '').toLowerCase();
    const tipo: TipoEgreso = tipoRaw.includes('despid') ? 'despido' : 'renuncia';

    const fechaMatch = trim.match(/\d{1,2}\/\d{1,2}\/\d{4}/);
    const fecha = fechaMatch ? dmyToIso(fechaMatch[0]) : todayISO();

    const motivo = partes.slice(2).join(' ').trim();

    resultados.push(buildEgreso(nombre.toUpperCase(), tipo, fecha, motivo));
  }

  return { egresos: resultados, ignoradas };
}

// ─── Export helper ─────────────────────────────────────────────────────────────

function exportExcel(egresos: Egreso[]) {
  const wb = XLSX.utils.book_new();
  const TIPO_LABEL: Record<TipoEgreso, string> = { despido: 'Despido', renuncia: 'Renuncia' };
  const headers = ['Nombre', 'Tipo', 'Fecha', 'Motivo'];
  const rows = egresos.map(e => [e.nombre, TIPO_LABEL[e.tipo], fmtDate(e.fecha), e.motivo]);
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws['!cols'] = [{ wch: 32 }, { wch: 12 }, { wch: 12 }, { wch: 44 }];
  XLSX.utils.book_append_sheet(wb, ws, 'Egresos');
  XLSX.writeFile(wb, `Egresos_${new Date().toLocaleDateString('es-UY').replace(/\//g, '-')}.xlsx`);
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

function AddModal({ onSave, onClose }: { onSave: (e: Egreso) => void; onClose: () => void }) {
  const [nombre, setNombre] = useState('');
  const [tipo, setTipo] = useState<TipoEgreso>('renuncia');
  const [fecha, setFecha] = useState(todayISO());
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState('');

  function handleSave() {
    if (!nombre.trim()) { setError('El nombre es requerido.'); return; }
    onSave(buildEgreso(nombre.trim().toUpperCase(), tipo, fecha, motivo.trim()));
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-bold text-gray-900 text-lg">Nuevo egreso</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Nombre completo</label>
            <input type="text" value={nombre} onChange={e => setNombre(e.target.value.toUpperCase())}
              placeholder="APELLIDO, Nombre"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#003DA5] focus:ring-1 focus:ring-[#003DA5]" />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Tipo</label>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setTipo('renuncia')}
                className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${tipo === 'renuncia' ? 'bg-blue-50 border-[#003DA5] text-[#003DA5]' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                Renuncia
              </button>
              <button type="button" onClick={() => setTipo('despido')}
                className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${tipo === 'despido' ? 'bg-red-50 border-red-500 text-red-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                Despido
              </button>
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Fecha</label>
            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#003DA5] focus:ring-1 focus:ring-[#003DA5]" />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Motivo</label>
            <textarea value={motivo} onChange={e => setMotivo(e.target.value)} rows={3}
              placeholder="Detalle del motivo..."
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

function DeleteModal({ egreso, onConfirm, onClose }: { egreso: Egreso; onConfirm: () => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
        <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center mb-4">
          <Trash2 size={18} className="text-red-600" />
        </div>
        <h2 className="font-bold text-gray-900 text-base mb-1">¿Eliminar egreso?</h2>
        <p className="text-sm text-gray-500 mb-5"><strong>{egreso.nombre}</strong></p>
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
      <UserMinus size={15} />
      {msg}
      <button onClick={onClose} className="ml-1 opacity-70 hover:opacity-100"><X size={13} /></button>
    </div>
  );
}

// ─── Texto loader ──────────────────────────────────────────────────────────────

const EJEMPLO_TEXTO = `PEREZ GOMEZ, Ana    renuncia    15/07/2026    Cambio de trabajo
RODRIGUEZ SILVA, Bruno    despido    20/07/2026    Bajo rendimiento reiterado`;

function TextoLoaderModal({ onCargar, onClose }: { onCargar: (texto: string) => void; onClose: () => void }) {
  const [texto, setTexto] = useState('');

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-bold text-gray-900 text-lg">Agregar egresos</h2>
            <p className="text-sm text-gray-500">Pegá desde Excel: nombre, tipo (renuncia/despido), fecha y motivo</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <textarea
          value={texto} onChange={e => setTexto(e.target.value)} rows={10}
          placeholder={EJEMPLO_TEXTO}
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm font-mono text-gray-700 focus:outline-none focus:border-[#003DA5] focus:ring-1 focus:ring-[#003DA5] resize-none"
        />
        <div className="flex gap-2 mt-4">
          <button onClick={() => setTexto(EJEMPLO_TEXTO)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors">
            <RefreshCw size={13} /> Cargar ejemplo
          </button>
          <button
            onClick={() => texto.trim() && onCargar(texto)}
            disabled={!texto.trim()}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-[#003DA5] text-white text-sm font-semibold rounded-lg hover:bg-blue-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ClipboardList size={15} /> Procesar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Limpiar confirm modal ─────────────────────────────────────────────────────

function LimpiarModal({ onConfirm, onClose }: { onConfirm: () => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
        <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center mb-4">
          <Trash2 size={18} className="text-red-600" />
        </div>
        <h2 className="font-bold text-gray-900 text-base mb-1">¿Limpiar todo?</h2>
        <p className="text-sm text-gray-500 mb-5">Se eliminarán todos los egresos guardados. Esta acción no se puede deshacer.</p>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 border border-gray-300 rounded-lg py-2 text-sm text-gray-700 hover:bg-gray-50">Cancelar</button>
          <button onClick={onConfirm} className="flex-1 bg-red-600 text-white rounded-lg py-2 text-sm font-semibold hover:bg-red-700">Limpiar todo</button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

type FiltroTipo = 'todos' | TipoEgreso;
type SortKey = 'fecha' | 'nombre';

export default function EgresosPage() {
  const [egresos, setEgresos] = useState<Egreso[]>(loadData);
  const [search, setSearch] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<FiltroTipo>('todos');
  const [sortBy, setSortBy] = useState<SortKey>('fecha');
  const [showAdd, setShowAdd] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Egreso | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [showLoader, setShowLoader] = useState(false);
  const [showLimpiarConfirm, setShowLimpiarConfirm] = useState(false);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  }, []);

  function persist(next: Egreso[]) {
    setEgresos(next);
    saveData(next);
  }

  function handleAdd(e: Egreso) {
    persist([...egresos, e]);
    setShowAdd(false);
    showToast(`Egreso agregado · ${e.nombre}`);
  }

  function handleDelete() {
    if (!deleteTarget) return;
    persist(egresos.filter(e => e.id !== deleteTarget.id));
    setDeleteTarget(null);
    showToast(`Egreso eliminado · ${deleteTarget.nombre}`);
  }

  function handleProcesarTexto(texto: string) {
    const { egresos: nuevos, ignoradas } = parsearTexto(texto);
    if (nuevos.length === 0) { showToast('No se encontraron egresos válidos en el texto'); return; }
    persist([...egresos, ...nuevos]);
    setShowLoader(false);
    const partes = [`${nuevos.length} egresos cargados`];
    if (ignoradas > 0) partes.push(`${ignoradas} líneas ignoradas`);
    showToast(partes.join(' · '));
  }

  function handleLimpiarTodo() {
    persist([]);
    setShowLimpiarConfirm(false);
    showToast('Todos los datos eliminados');
  }

  const stats = useMemo(() => {
    const mesActual = todayISO().slice(0, 7);
    return {
      total: egresos.length,
      despidos: egresos.filter(e => e.tipo === 'despido').length,
      renuncias: egresos.filter(e => e.tipo === 'renuncia').length,
      esteMes: egresos.filter(e => e.fecha.slice(0, 7) === mesActual).length,
    };
  }, [egresos]);

  const filtered = useMemo(() => {
    let result = [...egresos];
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter(e => e.nombre.toLowerCase().includes(q) || e.motivo.toLowerCase().includes(q));
    }
    if (filtroTipo !== 'todos') result = result.filter(e => e.tipo === filtroTipo);

    switch (sortBy) {
      case 'fecha':  result.sort((a, b) => b.fecha.localeCompare(a.fecha)); break;
      case 'nombre': result.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')); break;
    }
    return result;
  }, [egresos, search, filtroTipo, sortBy]);

  if (egresos.length === 0) {
    return (
      <div className="flex flex-col h-full">
        <Header title="Egresos" subtitle="Sin datos cargados" actions={null} />
        <div className="flex-1 overflow-y-auto p-6 flex items-center justify-center">
          <div className="max-w-2xl mx-auto w-full">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center">
              <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-3">
                <UserMinus size={26} className="text-red-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-1">Cargar Egresos</h2>
              <p className="text-sm text-gray-500 mb-6">Agregá despidos y renuncias manualmente o pegá una lista desde Excel</p>
              <div className="flex gap-2 justify-center">
                <button onClick={() => setShowAdd(true)}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">
                  <Plus size={14} /> Agregar manual
                </button>
                <button onClick={() => setShowLoader(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-[#003DA5] text-white text-sm font-semibold rounded-lg hover:bg-blue-800">
                  <ClipboardList size={15} /> Pegar lista
                </button>
              </div>
            </div>
          </div>
        </div>
        {showAdd && <AddModal onSave={handleAdd} onClose={() => setShowAdd(false)} />}
        {showLoader && <TextoLoaderModal onCargar={handleProcesarTexto} onClose={() => setShowLoader(false)} />}
        {toast && <Toast msg={toast} onClose={() => setToast(null)} />}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Egresos"
        subtitle={`${stats.total} egresos registrados`}
        actions={
          <div className="flex gap-2">
            <button onClick={() => exportExcel(egresos)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
              <Download size={13} /> Exportar Excel
            </button>
            <button onClick={() => setShowLoader(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
              <Plus size={13} /> Agregar más
            </button>
            <button onClick={() => setShowLimpiarConfirm(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors">
              <Trash2 size={13} /> Limpiar todo
            </button>
            <button onClick={() => setShowAdd(true)}
              className="flex items-center gap-1.5 px-4 py-1.5 text-sm bg-[#003DA5] text-white rounded-lg hover:bg-blue-800 transition-colors font-semibold">
              <Plus size={14} /> Nuevo egreso
            </button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-6">
        <div id="egresos-content" className="max-w-[1300px] mx-auto space-y-5">

          {/* ── KPIs ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard label="Total egresos" value={stats.total} sublabel="histórico" borderColor="#94a3b8" />
            <KpiCard label="Despidos" value={stats.despidos} sublabel="del total histórico" borderColor="#dc2626" valueColor={stats.despidos > 0 ? '#dc2626' : undefined} />
            <KpiCard label="Renuncias" value={stats.renuncias} sublabel="del total histórico" borderColor="#003DA5" valueColor={stats.renuncias > 0 ? '#003DA5' : undefined} />
            <KpiCard label="Este mes" value={stats.esteMes} sublabel="egresos en el mes actual" borderColor="#d97706" valueColor={stats.esteMes > 0 ? '#d97706' : undefined} />
          </div>

          {/* ── Filters ── */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 border border-gray-200 rounded-lg px-3 py-1.5 bg-white min-w-[220px]">
              <Search size={13} className="text-gray-400 flex-shrink-0" />
              <input type="text" placeholder="Buscar nombre o motivo..." value={search}
                onChange={e => setSearch(e.target.value)} className="text-sm outline-none flex-1 bg-transparent" />
              {search && <button onClick={() => setSearch('')} className="text-gray-400 hover:text-gray-600"><X size={12} /></button>}
            </div>

            <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
              {([['todos', 'Todos'], ['renuncia', 'Renuncias'], ['despido', 'Despidos']] as [FiltroTipo, string][]).map(([v, label]) => (
                <button key={v} onClick={() => setFiltroTipo(v)}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${filtroTipo === v ? 'bg-white text-[#003DA5] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                  {label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5 border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-sm">
              <span className="text-gray-400 text-xs">Ordenar:</span>
              <select value={sortBy} onChange={e => setSortBy(e.target.value as SortKey)} className="outline-none bg-transparent text-sm">
                <option value="fecha">Fecha reciente</option>
                <option value="nombre">Nombre A–Z</option>
              </select>
              <ChevronDown size={12} className="text-gray-400" />
            </div>

            <span className="text-sm text-gray-400">{filtered.length} egresos</span>
          </div>

          {/* ── Table ── */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#003DA5] text-white">
                    {['Nombre', 'Tipo', 'Fecha', 'Motivo', ''].map(h => (
                      <th key={h} className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 && (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400 text-sm">Ningún egreso coincide con los filtros.</td></tr>
                  )}
                  {filtered.map((e, i) => (
                    <tr key={e.id} className={`border-b border-gray-100 group transition-colors hover:bg-gray-50 ${
                      e.tipo === 'despido' ? 'bg-red-50/40' : i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                    }`}>
                      <td className="px-3 py-2.5 font-semibold text-gray-800 whitespace-nowrap">{e.nombre}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                          e.tipo === 'despido' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                        }`}>
                          {e.tipo === 'despido' ? 'Despido' : 'Renuncia'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{fmtDate(e.fecha)}</td>
                      <td className="px-3 py-2.5 text-gray-600 max-w-md">{e.motivo || <span className="text-gray-300">—</span>}</td>
                      <td className="px-3 py-2.5 w-8">
                        <button onClick={() => setDeleteTarget(e)} className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-all">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>

      {showAdd && <AddModal onSave={handleAdd} onClose={() => setShowAdd(false)} />}
      {deleteTarget && <DeleteModal egreso={deleteTarget} onConfirm={handleDelete} onClose={() => setDeleteTarget(null)} />}
      {showLoader && <TextoLoaderModal onCargar={handleProcesarTexto} onClose={() => setShowLoader(false)} />}
      {showLimpiarConfirm && <LimpiarModal onConfirm={handleLimpiarTodo} onClose={() => setShowLimpiarConfirm(false)} />}
      {toast && <Toast msg={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
