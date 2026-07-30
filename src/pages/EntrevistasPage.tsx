import { useState, useMemo, useCallback } from 'react';
import {
  UserPlus, Trash2, X, ChevronDown, Search, Download, ClipboardList, RefreshCw,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import Header from '../components/Header';

// ─── Types ─────────────────────────────────────────────────────────────────────

type EstadoPostulante = 'pendiente' | 'en_cuenta' | 'a_espera_confirmacion' | 'contratado' | 'rechazado';

interface Postulante {
  id: string;
  nombre: string;
  celular: string;
  empresa: string;
  sector: string;
  fecha: string;
  estado: EstadoPostulante;
}

const EMPRESAS_ENTREVISTA = ['Elared', 'Phonehouse', 'Relpont'];
const SECTORES_ENTREVISTA = [
  'Móvil PP', 'Móvil', 'Fibra', 'Distribución', 'Atención al cliente',
  'Back office', 'RRHH', 'Limpieza', 'Recepción',
];

const ESTADO_LABEL: Record<EstadoPostulante, string> = {
  pendiente: 'Pendiente', en_cuenta: 'En cuenta', a_espera_confirmacion: 'A espera de confirmación',
  contratado: 'Contratado', rechazado: 'Rechazado',
};
const ESTADO_BADGE: Record<EstadoPostulante, string> = {
  pendiente: 'bg-amber-100 text-amber-700',
  en_cuenta: 'bg-indigo-100 text-indigo-700',
  a_espera_confirmacion: 'bg-cyan-100 text-cyan-700',
  contratado: 'bg-green-100 text-green-700',
  rechazado: 'bg-red-100 text-red-700',
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

function buildPostulante(nombre: string, celular: string, empresa: string, sector: string, fecha: string, estado: EstadoPostulante = 'pendiente'): Postulante {
  const id = `${nombre}__${celular}__${fecha}__${Math.random().toString(36).slice(2, 7)}`;
  return { id, nombre, celular, empresa, sector, fecha, estado };
}

const STORAGE_KEY = 'elared_entrevistas';

function loadData(): Postulante[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as Postulante[];
  } catch { /* ignore */ }
  return [];
}

function saveData(postulantes: Postulante[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(postulantes)); } catch { /* ignore */ }
}

// ─── Parser de texto (pegado desde Excel: nombre <tab> celular <tab> sector) ────

function parsearTexto(texto: string): { postulantes: Postulante[]; ignoradas: number } {
  const lines = texto.split('\n');
  const resultados: Postulante[] = [];
  let ignoradas = 0;
  const hoy = todayISO();

  for (const linea of lines) {
    const trim = linea.trim();
    if (!trim) continue;

    let partes = trim.split('\t').map(p => p.trim()).filter(Boolean);
    if (partes.length < 2) partes = trim.split(/\s{2,}/).map(p => p.trim()).filter(Boolean);
    if (partes.length < 2) { ignoradas++; continue; }

    const [nombre, celular, sector] = partes;
    if (!nombre) { ignoradas++; continue; }

    resultados.push(buildPostulante(nombre.toUpperCase(), celular ?? '', '', sector ?? '', hoy));
  }

  return { postulantes: resultados, ignoradas };
}

// ─── Export helper ─────────────────────────────────────────────────────────────

function exportExcel(postulantes: Postulante[]) {
  const wb = XLSX.utils.book_new();
  const headers = ['Nombre', 'Celular', 'Empresa', 'Sector', 'Fecha', 'Estado'];
  const rows = postulantes.map(p => [p.nombre, p.celular, p.empresa, p.sector, fmtDate(p.fecha), ESTADO_LABEL[p.estado]]);
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws['!cols'] = [{ wch: 32 }, { wch: 16 }, { wch: 14 }, { wch: 18 }, { wch: 12 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, ws, 'Entrevistas');
  XLSX.writeFile(wb, `Entrevistas_${new Date().toLocaleDateString('es-UY').replace(/\//g, '-')}.xlsx`);
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

// ─── Add panel ─────────────────────────────────────────────────────────────────

function AddPanel({ onSave }: { onSave: (p: Postulante) => void }) {
  const [nombre, setNombre] = useState('');
  const [celular, setCelular] = useState('');
  const [empresa, setEmpresa] = useState(EMPRESAS_ENTREVISTA[0]);
  const [sector, setSector] = useState(SECTORES_ENTREVISTA[0]);
  const [fecha, setFecha] = useState(todayISO());
  const [estado, setEstado] = useState<EstadoPostulante>('pendiente');
  const [error, setError] = useState('');

  function handleGuardar() {
    if (!nombre.trim()) { setError('El nombre es requerido.'); return; }
    onSave(buildPostulante(nombre.trim().toUpperCase(), celular.trim(), empresa, sector, fecha, estado));
    setNombre(''); setCelular(''); setError('');
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 lg:sticky lg:top-4 h-fit">
      <h3 className="font-bold text-gray-900 text-sm mb-1">+ Nuevo postulante</h3>
      <p className="text-xs text-gray-400 mb-4">Cargá y seguí con el próximo, sin ventanas emergentes.</p>

      <div className="space-y-3">
        <div>
          <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Nombre completo</label>
          <input type="text" value={nombre} onChange={e => setNombre(e.target.value.toUpperCase())}
            placeholder="APELLIDO, Nombre"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#003DA5] focus:ring-1 focus:ring-[#003DA5]" />
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Celular</label>
          <input type="text" value={celular} onChange={e => setCelular(e.target.value)}
            placeholder="09X XXX XXX"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#003DA5] focus:ring-1 focus:ring-[#003DA5]" />
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Empresa</label>
          <select value={empresa} onChange={e => setEmpresa(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#003DA5] focus:ring-1 focus:ring-[#003DA5]">
            {EMPRESAS_ENTREVISTA.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Sector</label>
          <select value={sector} onChange={e => setSector(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#003DA5] focus:ring-1 focus:ring-[#003DA5]">
            {SECTORES_ENTREVISTA.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Fecha</label>
          <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#003DA5] focus:ring-1 focus:ring-[#003DA5]" />
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Estado</label>
          <select value={estado} onChange={e => setEstado(e.target.value as EstadoPostulante)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#003DA5] focus:ring-1 focus:ring-[#003DA5]">
            {(Object.keys(ESTADO_LABEL) as EstadoPostulante[]).map(k => <option key={k} value={k}>{ESTADO_LABEL[k]}</option>)}
          </select>
        </div>

        {error && <div className="text-red-600 text-xs bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}

        <button onClick={handleGuardar}
          className="w-full bg-[#003DA5] text-white rounded-lg py-2 text-sm font-semibold hover:bg-blue-800">
          Guardar
        </button>
      </div>
    </div>
  );
}

// ─── Delete confirm modal ──────────────────────────────────────────────────────

function DeleteModal({ postulante, onConfirm, onClose }: { postulante: Postulante; onConfirm: () => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
        <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center mb-4">
          <Trash2 size={18} className="text-red-600" />
        </div>
        <h2 className="font-bold text-gray-900 text-base mb-1">¿Eliminar postulante?</h2>
        <p className="text-sm text-gray-500 mb-5"><strong>{postulante.nombre}</strong></p>
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
      <UserPlus size={15} />
      {msg}
      <button onClick={onClose} className="ml-1 opacity-70 hover:opacity-100"><X size={13} /></button>
    </div>
  );
}

// ─── Texto loader ──────────────────────────────────────────────────────────────

const EJEMPLO_TEXTO = `PEREZ GOMEZ, Ana    099123456    Call Fibra
RODRIGUEZ SILVA, Bruno    098765432    Call Móvil`;

function TextoLoaderModal({ onCargar, onClose }: { onCargar: (texto: string) => void; onClose: () => void }) {
  const [texto, setTexto] = useState('');

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-bold text-gray-900 text-lg">Agregar postulantes</h2>
            <p className="text-sm text-gray-500">Pegá desde Excel: nombre, celular y sector (una fila por persona)</p>
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
        <p className="text-sm text-gray-500 mb-5">Se eliminarán todos los postulantes guardados. Esta acción no se puede deshacer.</p>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 border border-gray-300 rounded-lg py-2 text-sm text-gray-700 hover:bg-gray-50">Cancelar</button>
          <button onClick={onConfirm} className="flex-1 bg-red-600 text-white rounded-lg py-2 text-sm font-semibold hover:bg-red-700">Limpiar todo</button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

type FiltroEstado = 'todos' | EstadoPostulante;
type SortKey = 'fecha' | 'nombre' | 'sector';

export default function EntrevistasPage() {
  const [postulantes, setPostulantes] = useState<Postulante[]>(loadData);
  const [search, setSearch] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>('todos');
  const [filtroSector, setFiltroSector] = useState<string | null>(null);
  const [filtroEmpresa, setFiltroEmpresa] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortKey>('fecha');
  const [deleteTarget, setDeleteTarget] = useState<Postulante | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [showLoader, setShowLoader] = useState(false);
  const [showLimpiarConfirm, setShowLimpiarConfirm] = useState(false);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  }, []);

  function persist(next: Postulante[]) {
    setPostulantes(next);
    saveData(next);
  }

  function handleAdd(p: Postulante) {
    persist([...postulantes, p]);
    showToast(`Postulante agregado · ${p.nombre}`);
  }

  function handleDelete() {
    if (!deleteTarget) return;
    persist(postulantes.filter(p => p.id !== deleteTarget.id));
    setDeleteTarget(null);
    showToast(`Postulante eliminado · ${deleteTarget.nombre}`);
  }

  function handleEstadoChange(id: string, estado: EstadoPostulante) {
    persist(postulantes.map(p => p.id === id ? { ...p, estado } : p));
  }

  function handleProcesarTexto(texto: string) {
    const { postulantes: nuevos, ignoradas } = parsearTexto(texto);
    if (nuevos.length === 0) { showToast('No se encontraron postulantes válidos en el texto'); return; }
    persist([...postulantes, ...nuevos]);
    setShowLoader(false);
    const partes = [`${nuevos.length} postulantes cargados`];
    if (ignoradas > 0) partes.push(`${ignoradas} líneas ignoradas`);
    showToast(partes.join(' · '));
  }

  function handleLimpiarTodo() {
    persist([]);
    setShowLimpiarConfirm(false);
    showToast('Todos los datos eliminados');
  }

  const sectoresDisponibles = useMemo(
    () => Array.from(new Set(postulantes.map(p => p.sector).filter(Boolean))).sort(),
    [postulantes]
  );

  const stats = useMemo(() => ({
    total: postulantes.length,
    pendientes: postulantes.filter(p => p.estado === 'pendiente').length,
    enCuenta: postulantes.filter(p => p.estado === 'en_cuenta').length,
    aEsperaConfirmacion: postulantes.filter(p => p.estado === 'a_espera_confirmacion').length,
    contratados: postulantes.filter(p => p.estado === 'contratado').length,
    rechazados: postulantes.filter(p => p.estado === 'rechazado').length,
  }), [postulantes]);

  const filtered = useMemo(() => {
    let result = [...postulantes];
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter(p => p.nombre.toLowerCase().includes(q) || p.celular.includes(q));
    }
    if (filtroEstado !== 'todos') result = result.filter(p => p.estado === filtroEstado);
    if (filtroSector) result = result.filter(p => p.sector === filtroSector);
    if (filtroEmpresa) result = result.filter(p => p.empresa === filtroEmpresa);

    switch (sortBy) {
      case 'fecha':  result.sort((a, b) => b.fecha.localeCompare(a.fecha)); break;
      case 'nombre': result.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')); break;
      case 'sector': result.sort((a, b) => a.sector.localeCompare(b.sector, 'es')); break;
    }
    return result;
  }, [postulantes, search, filtroEstado, filtroSector, filtroEmpresa, sortBy]);

  const subtitle = postulantes.length > 0 ? `${stats.total} postulantes` : 'Sin datos cargados';

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Entrevistas"
        subtitle={subtitle}
        actions={
          <div className="flex gap-2">
            <button onClick={() => exportExcel(postulantes)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
              <Download size={13} /> Exportar Excel
            </button>
            <button onClick={() => setShowLoader(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
              <ClipboardList size={13} /> Pegar lista
            </button>
            <button onClick={() => setShowLimpiarConfirm(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors">
              <Trash2 size={13} /> Limpiar todo
            </button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-6">
        <div id="entrevistas-content" className="max-w-[1500px] mx-auto grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5 items-start">
        <div className="space-y-5">

          {/* ── KPIs ── */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            <KpiCard label="Total postulantes" value={stats.total} sublabel="histórico" borderColor="#94a3b8" />
            <KpiCard label="Pendientes" value={stats.pendientes} sublabel="sin resolución" borderColor="#d97706" valueColor={stats.pendientes > 0 ? '#d97706' : undefined} />
            <KpiCard label="En cuenta" value={stats.enCuenta} sublabel="en seguimiento" borderColor="#4f46e5" valueColor={stats.enCuenta > 0 ? '#4f46e5' : undefined} />
            <KpiCard label="A espera de confirmación" value={stats.aEsperaConfirmacion} sublabel="pendiente de confirmar" borderColor="#0891b2" valueColor={stats.aEsperaConfirmacion > 0 ? '#0891b2' : undefined} />
            <KpiCard label="Contratados" value={stats.contratados} sublabel="postulantes contratados" borderColor="#16a34a" valueColor={stats.contratados > 0 ? '#16a34a' : undefined} />
            <KpiCard label="Rechazados" value={stats.rechazados} sublabel="postulantes rechazados" borderColor="#dc2626" />
          </div>

          {/* ── Filters ── */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 border border-gray-200 rounded-lg px-3 py-1.5 bg-white min-w-[220px]">
              <Search size={13} className="text-gray-400 flex-shrink-0" />
              <input type="text" placeholder="Buscar nombre o celular..." value={search}
                onChange={e => setSearch(e.target.value)} className="text-sm outline-none flex-1 bg-transparent" />
              {search && <button onClick={() => setSearch('')} className="text-gray-400 hover:text-gray-600"><X size={12} /></button>}
            </div>

            <div className="flex gap-1 bg-gray-100 rounded-lg p-1 flex-wrap">
              {([['todos', 'Todos'], ['pendiente', 'Pendientes'], ['en_cuenta', 'En cuenta'], ['a_espera_confirmacion', 'A espera de confirmación'], ['contratado', 'Contratados'], ['rechazado', 'Rechazados']] as [FiltroEstado, string][]).map(([v, label]) => (
                <button key={v} onClick={() => setFiltroEstado(v)}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${filtroEstado === v ? 'bg-white text-[#003DA5] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                  {label}
                </button>
              ))}
            </div>

            <select value={filtroEmpresa ?? ''} onChange={e => setFiltroEmpresa(e.target.value || null)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white outline-none">
              <option value="">Todas las empresas</option>
              {EMPRESAS_ENTREVISTA.map(e => <option key={e} value={e}>{e}</option>)}
            </select>

            {sectoresDisponibles.length > 0 && (
              <select value={filtroSector ?? ''} onChange={e => setFiltroSector(e.target.value || null)}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white outline-none">
                <option value="">Todos los sectores</option>
                {sectoresDisponibles.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            )}

            <div className="flex items-center gap-1.5 border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-sm">
              <span className="text-gray-400 text-xs">Ordenar:</span>
              <select value={sortBy} onChange={e => setSortBy(e.target.value as SortKey)} className="outline-none bg-transparent text-sm">
                <option value="fecha">Fecha reciente</option>
                <option value="nombre">Nombre A–Z</option>
                <option value="sector">Sector</option>
              </select>
              <ChevronDown size={12} className="text-gray-400" />
            </div>

            <span className="text-sm text-gray-400">{filtered.length} postulantes</span>
          </div>

          {/* ── Table ── */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#003DA5] text-white">
                    {['Nombre', 'Celular', 'Empresa', 'Sector', 'Fecha', 'Estado', ''].map(h => (
                      <th key={h} className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 && (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400 text-sm">Ningún postulante coincide con los filtros.</td></tr>
                  )}
                  {filtered.map((p, i) => (
                    <tr key={p.id} className={`border-b border-gray-100 group transition-colors hover:bg-gray-50 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                      <td className="px-3 py-2.5 font-semibold text-gray-800 whitespace-nowrap">{p.nombre}</td>
                      <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap font-mono text-xs">{p.celular || '—'}</td>
                      <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{p.empresa || '—'}</td>
                      <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{p.sector || '—'}</td>
                      <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{fmtDate(p.fecha)}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <select value={p.estado} onChange={e => handleEstadoChange(p.id, e.target.value as EstadoPostulante)}
                          className={`text-[11px] font-semibold px-2 py-1 rounded-full border-none outline-none cursor-pointer ${ESTADO_BADGE[p.estado]}`}>
                          {(Object.keys(ESTADO_LABEL) as EstadoPostulante[]).map(k => <option key={k} value={k}>{ESTADO_LABEL[k]}</option>)}
                        </select>
                      </td>
                      <td className="px-3 py-2.5 w-8">
                        <button onClick={() => setDeleteTarget(p)} className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-all">
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
        <AddPanel onSave={handleAdd} />
        </div>
      </div>

      {deleteTarget && <DeleteModal postulante={deleteTarget} onConfirm={handleDelete} onClose={() => setDeleteTarget(null)} />}
      {showLoader && <TextoLoaderModal onCargar={handleProcesarTexto} onClose={() => setShowLoader(false)} />}
      {showLimpiarConfirm && <LimpiarModal onConfirm={handleLimpiarTodo} onClose={() => setShowLimpiarConfirm(false)} />}
      {toast && <Toast msg={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
