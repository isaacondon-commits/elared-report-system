import { useState, useMemo, useCallback } from 'react';
import {
  Umbrella, Plus, Trash2, X, AlertTriangle, ChevronDown, ChevronUp,
  Search, Download, ClipboardList, RefreshCw,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import Header from '../components/Header';

// ─── Types ─────────────────────────────────────────────────────────────────────

type EstadoLicencia = 'activa' | 'proxima_vencer' | 'vencida';

interface Licencia {
  id: string;
  nombre: string;
  empresa: string;
  sector: string;
  fechaInicio: string;
  fechaFin: string;
  diasTotales: number;
  fechaReintegro: string;
  estado: EstadoLicencia;
  diasRestantes: number;
}

// ─── Domain helpers ────────────────────────────────────────────────────────────

function isoToDate(iso: string): Date {
  return new Date(iso + 'T12:00:00');
}

function addDays(iso: string, n: number): string {
  const d = isoToDate(iso);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function diffDays(a: string, b: string): number {
  return Math.round((isoToDate(b).getTime() - isoToDate(a).getTime()) / 86400000);
}

function todayISO(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
}

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function buildLicencia(
  nombre: string, empresa: string, sector: string, fechaInicio: string, fechaFin: string,
): Licencia {
  const today = todayISO();
  const diasTotales = diffDays(fechaInicio, fechaFin) + 1;
  const fechaReintegro = addDays(fechaFin, 1);
  const diasRestantes = diffDays(today, fechaFin);

  let estado: EstadoLicencia;
  if (fechaFin < today) {
    estado = 'vencida';
  } else if (fechaInicio <= today && diasRestantes <= 7) {
    estado = 'proxima_vencer';
  } else {
    estado = 'activa';
  }

  const id = `${nombre}__${fechaInicio}__${fechaFin}`;
  return { id, nombre, empresa, sector, fechaInicio, fechaFin, diasTotales, fechaReintegro, estado, diasRestantes };
}

const STORAGE_KEY = 'elared_licencias';

function loadData(): Licencia[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const stored = JSON.parse(raw) as Array<{
        nombre: string; empresa?: string; sector?: string; fechaInicio: string; fechaFin: string;
      }>;
      return stored.map(s => buildLicencia(s.nombre, s.empresa ?? '', s.sector ?? '', s.fechaInicio, s.fechaFin));
    }
  } catch { /* ignore */ }
  return [];
}

function saveData(licencias: Licencia[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(
      licencias.map(l => ({
        nombre: l.nombre, empresa: l.empresa, sector: l.sector,
        fechaInicio: l.fechaInicio, fechaFin: l.fechaFin,
      }))
    ));
  } catch { /* ignore */ }
}

function licenciaKey(l: Licencia): string {
  return `${l.nombre}__${l.fechaInicio}__${l.fechaFin}`;
}

// ─── Parser de texto ───────────────────────────────────────────────────────────

function parsearTextoLicencias(
  texto: string, empresa: string, sector: string,
): { licencias: Licencia[]; ignoradas: number } {
  const lines = texto.split('\n');
  const resultados: Licencia[] = [];
  let ignoradas = 0;

  function dmyToIso(dmy: string): string {
    const [d, m, y] = dmy.split('/');
    return `${y}-${m}-${d}`;
  }

  for (const linea of lines) {
    const trim = linea.trim();
    if (!trim) continue;

    const fechas = trim.match(/\d{1,2}\/\d{1,2}\/\d{4}/g);
    if (!fechas || fechas.length < 2) { ignoradas++; continue; }

    const primerFechaIdx = trim.search(/\d{1,2}\/\d{1,2}\/\d{4}/);
    let nombre = trim.slice(0, primerFechaIdx).trim();
    nombre = nombre.replace(/[\s\-,]+$/, '').replace(/\s+/g, ' ').trim();

    if (!nombre) { ignoradas++; continue; }

    const inicio = dmyToIso(fechas[0]);
    const fin = dmyToIso(fechas[1]);
    if (fin < inicio) { ignoradas++; continue; }

    resultados.push(buildLicencia(nombre.toUpperCase(), empresa, sector, inicio, fin));
  }

  return { licencias: resultados, ignoradas };
}

// ─── Export helper ─────────────────────────────────────────────────────────────

function exportExcel(licencias: Licencia[]) {
  const wb = XLSX.utils.book_new();
  const headers = ['Nombre', 'Empresa', 'Sector', 'Inicio', 'Fin', 'Días lic.', 'Reintegro', 'Estado', 'Días rest.'];

  const ESTADO_LABEL: Record<EstadoLicencia, string> = {
    activa: 'En curso', proxima_vencer: 'Próxima a terminar', vencida: 'Finalizada',
  };

  function toRows(list: Licencia[]) {
    return list.map(l => [
      l.nombre, l.empresa, l.sector, fmtDate(l.fechaInicio), fmtDate(l.fechaFin),
      l.diasTotales, fmtDate(l.fechaReintegro), ESTADO_LABEL[l.estado],
      l.estado !== 'vencida' ? l.diasRestantes : '—',
    ]);
  }

  function makeSheet(list: Licencia[]) {
    const ws = XLSX.utils.aoa_to_sheet([headers, ...toRows(list)]);
    headers.forEach((_, ci) => {
      const ref = XLSX.utils.encode_cell({ r: 0, c: ci });
      if (ws[ref]) ws[ref].s = {
        font: { bold: true, color: { rgb: 'FFFFFF' } },
        fill: { fgColor: { rgb: '003DA5' } },
        alignment: { horizontal: 'center' },
      };
    });
    list.forEach((l, ri) => {
      const bg = l.estado === 'activa' ? 'EEF2FF'
        : l.estado === 'proxima_vencer' ? 'FFF8F0' : 'FFFFFF';
      headers.forEach((_, ci) => {
        const ref = XLSX.utils.encode_cell({ r: ri + 1, c: ci });
        if (ws[ref]) ws[ref].s = { fill: { fgColor: { rgb: bg } } };
      });
    });
    ws['!cols'] = [
      { wch: 38 }, { wch: 18 }, { wch: 18 }, { wch: 12 }, { wch: 12 },
      { wch: 10 }, { wch: 12 }, { wch: 20 }, { wch: 10 },
    ];
    return ws;
  }

  const sorted = [...licencias].sort((a, b) => {
    const order: Record<EstadoLicencia, number> = { proxima_vencer: 0, activa: 1, vencida: 2 };
    if (order[a.estado] !== order[b.estado]) return order[a.estado] - order[b.estado];
    return b.fechaFin.localeCompare(a.fechaFin);
  });
  XLSX.utils.book_append_sheet(wb, makeSheet(sorted), 'Todas');
  XLSX.utils.book_append_sheet(wb, makeSheet(licencias.filter(l => l.estado !== 'vencida')), 'Activas');

  const byNombre = new Map<string, Licencia[]>();
  for (const l of licencias) {
    if (!byNombre.has(l.nombre)) byNombre.set(l.nombre, []);
    byNombre.get(l.nombre)!.push(l);
  }
  const personaRows: (string | number)[][] = [];
  for (const [nombre, ls] of [...byNombre.entries()].sort(([a], [b]) => a.localeCompare(b, 'es'))) {
    const sortedLs = [...ls].sort((a, b) => a.fechaInicio.localeCompare(b.fechaInicio));
    for (const l of sortedLs) {
      personaRows.push([nombre, l.empresa, l.sector, fmtDate(l.fechaInicio), fmtDate(l.fechaFin), l.diasTotales, fmtDate(l.fechaReintegro), ESTADO_LABEL[l.estado]]);
    }
  }
  const histWs = XLSX.utils.aoa_to_sheet([
    ['Nombre', 'Empresa', 'Sector', 'Inicio', 'Fin', 'Días lic.', 'Reintegro', 'Estado'],
    ...personaRows,
  ]);
  histWs['!cols'] = [{ wch: 38 }, { wch: 18 }, { wch: 18 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, histWs, 'Historial por persona');

  XLSX.writeFile(wb, `Licencias_${new Date().toLocaleDateString('es-UY').replace(/\//g, '-')}.xlsx`);
}

// ─── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({
  label, value, sublabel, borderColor, valueColor,
}: {
  label: string; value: number; sublabel: string;
  borderColor: string; valueColor?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col"
      style={{ borderTop: `3px solid ${borderColor}` }}>
      <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1">{label}</div>
      <div className="text-3xl font-bold mb-1" style={{ color: valueColor ?? '#1e293b' }}>{value}</div>
      <div className="text-[11px] text-gray-400 leading-tight">{sublabel}</div>
    </div>
  );
}

// ─── Add panel (fijo al costado, sin modal) ────────────────────────────────────

function AddPanel({ onSave }: { onSave: (l: Licencia) => void }) {
  const [nombre, setNombre] = useState('');
  const [empresa, setEmpresa] = useState('');
  const [sector, setSector] = useState('');
  const [inicio, setInicio] = useState('');
  const [fin, setFin] = useState('');
  const [error, setError] = useState('');

  const preview = useMemo(() => {
    if (!inicio || !fin || fin < inicio) return null;
    const dias = diffDays(inicio, fin) + 1;
    const reintegro = addDays(fin, 1);
    return { dias, reintegro };
  }, [inicio, fin]);

  function handleGuardar() {
    if (!nombre.trim()) { setError('El nombre es requerido.'); return; }
    if (!inicio) { setError('La fecha de inicio es requerida.'); return; }
    if (!fin) { setError('La fecha de fin es requerida.'); return; }
    if (fin < inicio) { setError('La fecha de fin debe ser igual o posterior al inicio.'); return; }
    onSave(buildLicencia(nombre.trim().toUpperCase(), empresa.trim(), sector.trim(), inicio, fin));
    setNombre(''); setEmpresa(''); setSector(''); setInicio(''); setFin(''); setError('');
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 lg:sticky lg:top-4 h-fit">
      <h3 className="font-bold text-gray-900 text-sm mb-1">+ Nueva licencia</h3>
      <p className="text-xs text-gray-400 mb-4">Cargá y seguí con la próxima persona, sin ventanas emergentes.</p>

      <div className="space-y-3">
        <div>
          <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Nombre completo</label>
          <input
            type="text" value={nombre}
            onChange={e => setNombre(e.target.value.toUpperCase())}
            placeholder="APELLIDO, Nombre"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#003DA5] focus:ring-1 focus:ring-[#003DA5]"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Empresa</label>
            <input
              type="text" value={empresa} list="lic-empresas"
              onChange={e => setEmpresa(e.target.value)}
              placeholder="Empresa"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#003DA5] focus:ring-1 focus:ring-[#003DA5]"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Sector</label>
            <input
              type="text" value={sector} list="lic-sectores"
              onChange={e => setSector(e.target.value)}
              placeholder="Sector"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#003DA5] focus:ring-1 focus:ring-[#003DA5]"
            />
          </div>
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Fecha inicio</label>
          <input
            type="date" value={inicio} onChange={e => setInicio(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#003DA5] focus:ring-1 focus:ring-[#003DA5]"
          />
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Fecha fin</label>
          <input
            type="date" value={fin} onChange={e => setFin(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#003DA5] focus:ring-1 focus:ring-[#003DA5]"
          />
        </div>

        {preview && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2 text-xs text-indigo-800">
            Duración: <strong>{preview.dias} días</strong> · Reintegro: <strong>{fmtDate(preview.reintegro)}</strong>
          </div>
        )}
        {error && (
          <div className="text-red-600 text-xs bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
        )}

        <button onClick={handleGuardar}
          className="w-full bg-[#003DA5] text-white rounded-lg py-2 text-sm font-semibold hover:bg-blue-800">
          Guardar
        </button>
      </div>
    </div>
  );
}

// ─── Delete confirm modal ──────────────────────────────────────────────────────

function DeleteModal({ licencia, onConfirm, onClose }: {
  licencia: Licencia; onConfirm: () => void; onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
        <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center mb-4">
          <Trash2 size={18} className="text-red-600" />
        </div>
        <h2 className="font-bold text-gray-900 text-base mb-1">¿Eliminar licencia?</h2>
        <p className="text-sm text-gray-500 mb-5">
          <strong>{licencia.nombre}</strong>
          <br />del {fmtDate(licencia.fechaInicio)} al {fmtDate(licencia.fechaFin)}
        </p>
        <div className="flex gap-2">
          <button onClick={onClose}
            className="flex-1 border border-gray-300 rounded-lg py-2 text-sm text-gray-700 hover:bg-gray-50">
            Cancelar
          </button>
          <button onClick={onConfirm}
            className="flex-1 bg-red-600 text-white rounded-lg py-2 text-sm font-semibold hover:bg-red-700">
            Eliminar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Toast ─────────────────────────────────────────────────────────────────────

function Toast({ msg, onClose }: { msg: string; onClose: () => void }) {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-green-600 text-white text-sm font-medium px-5 py-3 rounded-xl shadow-xl">
      <Umbrella size={15} />
      {msg}
      <button onClick={onClose} className="ml-1 opacity-70 hover:opacity-100"><X size={13} /></button>
    </div>
  );
}

// ─── Estado badge ──────────────────────────────────────────────────────────────

function EstadoBadge({ estado }: { estado: EstadoLicencia }) {
  if (estado === 'activa')
    return <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">● En curso</span>;
  if (estado === 'proxima_vencer')
    return <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">⚠ Termina pronto</span>;
  return <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">✓ Finalizada</span>;
}

// ─── Celda editable (Empresa / Sector) ────────────────────────────────────────

function EditableCell({ value, placeholder, listId, onCommit }: {
  value: string;
  placeholder: string;
  listId: string;
  onCommit: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  function start() { setDraft(value); setEditing(true); }
  function commit() {
    setEditing(false);
    const v = draft.trim();
    if (v !== value) onCommit(v);
  }

  if (editing) {
    return (
      <input
        autoFocus
        type="text"
        value={draft}
        list={listId}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') setEditing(false);
        }}
        className="w-full min-w-[110px] border border-[#003DA5] rounded px-2 py-1 text-xs outline-none"
      />
    );
  }

  return (
    <button
      onClick={start}
      title="Clic para editar"
      className="w-full text-left text-xs text-gray-700 hover:bg-white/60 rounded px-1 py-0.5 -mx-1 transition-colors"
    >
      {value || <span className="text-gray-300">{placeholder}</span>}
    </button>
  );
}

// ─── Historial timeline ────────────────────────────────────────────────────────

function PersonaHistorial({ nombre, licencias }: { nombre: string; licencias: Licencia[] }) {
  const sorted = [...licencias].sort((a, b) => a.fechaInicio.localeCompare(b.fechaInicio));
  const totalDias = licencias.reduce((s, l) => s + l.diasTotales, 0);
  const primeraFecha = sorted[0]?.fechaInicio ?? '';
  const ultimaFecha = sorted[sorted.length - 1]?.fechaFin ?? '';

  const minMs = isoToDate(primeraFecha).getTime();
  const maxMs = isoToDate(ultimaFecha).getTime() || minMs + 1;
  const span = maxMs - minMs || 1;

  return (
    <div className="py-3 border-b border-gray-100 last:border-0">
      <div className="flex items-center justify-between mb-2">
        <div>
          <span className="font-semibold text-gray-800 text-sm">{nombre}</span>
          <span className="ml-2 text-xs text-gray-400">{licencias.length} licencias · {totalDias} días totales</span>
        </div>
        <span className="text-[11px] text-gray-400">{fmtDate(primeraFecha)} → {fmtDate(ultimaFecha)}</span>
      </div>
      <div className="relative h-5 bg-gray-100 rounded-full overflow-hidden">
        {sorted.map(l => {
          const left = ((isoToDate(l.fechaInicio).getTime() - minMs) / span) * 100;
          const width = Math.max(1, ((l.diasTotales - 1) / span) * 86400000 / span * 100);
          const color = l.estado === 'activa' ? '#4f46e5' : l.estado === 'proxima_vencer' ? '#fd7e14' : '#94a3b8';
          return (
            <div
              key={l.id}
              className="absolute top-0 h-full rounded-full opacity-80"
              style={{ left: `${Math.min(left, 99)}%`, width: `${Math.max(width, 1)}%`, background: color }}
              title={`${fmtDate(l.fechaInicio)} – ${fmtDate(l.fechaFin)} (${l.diasTotales}d)`}
            />
          );
        })}
      </div>
    </div>
  );
}

// ─── Texto loader ──────────────────────────────────────────────────────────────

const EJEMPLO_TEXTO = `SILVEIRA ALMEIDA, Fiamma Natalie    13/05/2026  -  30/05/2026
TABEIRA RODRIGUEZ, Katherine Yuliana    16/03/2026  -  28/03/2026
ALVEZ ALVEZ, Camila Magali    02/03/2026  -  09/03/2026`;

function TextoLoaderContent({
  texto, setTexto, empresa, setEmpresa, sector, setSector, onCargarEjemplo, onProcesar,
}: {
  texto: string;
  setTexto: (t: string) => void;
  empresa: string;
  setEmpresa: (v: string) => void;
  sector: string;
  setSector: (v: string) => void;
  onCargarEjemplo: () => void;
  onProcesar: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Empresa (para todo el lote)</label>
          <input
            type="text" value={empresa} list="lic-empresas"
            onChange={e => setEmpresa(e.target.value)}
            placeholder="Opcional"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#003DA5] focus:ring-1 focus:ring-[#003DA5]"
          />
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Sector (para todo el lote)</label>
          <input
            type="text" value={sector} list="lic-sectores"
            onChange={e => setSector(e.target.value)}
            placeholder="Opcional"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#003DA5] focus:ring-1 focus:ring-[#003DA5]"
          />
        </div>
      </div>
      <textarea
        value={texto}
        onChange={e => setTexto(e.target.value)}
        rows={10}
        placeholder={`SILVEIRA ALMEIDA, Fiamma Natalie    13/05/2026  -  30/05/2026\nTABEIRA RODRIGUEZ, Katherine Yuliana    16/03/2026  -  28/03/2026\n...`}
        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm font-mono text-gray-700 focus:outline-none focus:border-[#003DA5] focus:ring-1 focus:ring-[#003DA5] resize-none"
      />
      <div className="flex gap-2">
        <button
          onClick={onCargarEjemplo}
          className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <RefreshCw size={13} /> Cargar ejemplo
        </button>
        <button
          onClick={onProcesar}
          disabled={!texto.trim()}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-[#003DA5] text-white text-sm font-semibold rounded-lg hover:bg-blue-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ClipboardList size={15} /> Procesar
        </button>
      </div>
    </div>
  );
}

function TextoLoaderModal({
  onCargar, onClose,
}: {
  onCargar: (texto: string, empresa: string, sector: string) => void;
  onClose: () => void;
}) {
  const [texto, setTexto] = useState('');
  const [empresa, setEmpresa] = useState('');
  const [sector, setSector] = useState('');

  function handleProcesar() {
    if (texto.trim()) onCargar(texto, empresa.trim(), sector.trim());
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-bold text-gray-900 text-lg">Agregar licencias</h2>
            <p className="text-sm text-gray-500">Pegá el texto del listado de licencias (nombre + rango de fechas)</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <TextoLoaderContent
          texto={texto}
          setTexto={setTexto}
          empresa={empresa}
          setEmpresa={setEmpresa}
          sector={sector}
          setSector={setSector}
          onCargarEjemplo={() => setTexto(EJEMPLO_TEXTO)}
          onProcesar={handleProcesar}
        />
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
        <p className="text-sm text-gray-500 mb-5">
          Se eliminarán todas las licencias guardadas. Esta acción no se puede deshacer.
        </p>
        <div className="flex gap-2">
          <button onClick={onClose}
            className="flex-1 border border-gray-300 rounded-lg py-2 text-sm text-gray-700 hover:bg-gray-50">
            Cancelar
          </button>
          <button onClick={onConfirm}
            className="flex-1 bg-red-600 text-white rounded-lg py-2 text-sm font-semibold hover:bg-red-700">
            Limpiar todo
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

type FiltroEstado = 'todas' | 'activas' | 'proximas' | 'vencidas';
type SortKey = 'fechaFin' | 'reintegro' | 'nombre' | 'dias';

export default function LicenciasPage() {
  const [licencias, setLicencias] = useState<Licencia[]>(loadData);
  const [search, setSearch] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>('todas');
  const [sortBy, setSortBy] = useState<SortKey>('fechaFin');
  const [deleteTarget, setDeleteTarget] = useState<Licencia | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [showHistorial, setShowHistorial] = useState(false);
  const [showLoader, setShowLoader] = useState(false);
  const [showLimpiarConfirm, setShowLimpiarConfirm] = useState(false);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  }, []);

  function handleAdd(licencia: Licencia) {
    const next = [...licencias, licencia];
    setLicencias(next);
    saveData(next);
    showToast(`Licencia agregada · ${licencia.nombre}`);
  }

  function handleDelete() {
    if (!deleteTarget) return;
    const next = licencias.filter(l => l.id !== deleteTarget.id);
    setLicencias(next);
    saveData(next);
    setDeleteTarget(null);
    showToast(`Licencia eliminada · ${deleteTarget.nombre}`);
  }

  function handleProcesarTexto(texto: string, empresa: string, sector: string) {
    const { licencias: nuevas, ignoradas } = parsearTextoLicencias(texto, empresa, sector);
    if (nuevas.length === 0) {
      showToast('No se encontraron licencias válidas en el texto');
      return;
    }
    const existingKeys = new Set(licencias.map(licenciaKey));
    const sinDups = nuevas.filter(l => !existingKeys.has(licenciaKey(l)));
    const dupCount = nuevas.length - sinDups.length;
    const next = [...licencias, ...sinDups];
    setLicencias(next);
    saveData(next);
    setShowLoader(false);
    const partes = [`${sinDups.length} licencias cargadas`];
    if (dupCount > 0) partes.push(`${dupCount} duplicadas ignoradas`);
    if (ignoradas > 0) partes.push(`${ignoradas} líneas ignoradas`);
    showToast(partes.join(' · '));
  }

  function handleLimpiarTodo() {
    setLicencias([]);
    saveData([]);
    setShowLimpiarConfirm(false);
    showToast('Todos los datos eliminados');
  }

  function handleUpdateField(id: string, field: 'empresa' | 'sector', value: string) {
    const next = licencias.map(l => (l.id === id ? { ...l, [field]: value } : l));
    setLicencias(next);
    saveData(next);
  }

  // ── Stats ──────────────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const activas = licencias.filter(l => l.estado !== 'vencida');
    const proximas = licencias.filter(l => l.estado === 'proxima_vencer' || (l.estado === 'activa' && l.diasRestantes <= 7));
    const reintegrosEstaSemana = licencias.filter(l => l.estado !== 'vencida' && l.diasRestantes >= 0 && l.diasRestantes <= 7);
    const personas = new Set(licencias.map(l => l.nombre)).size;
    return { activas: activas.length, proximas: proximas.length, reintegros: reintegrosEstaSemana.length, total: licencias.length, personas };
  }, [licencias]);

  const alertas = useMemo(() =>
    licencias
      .filter(l => l.estado !== 'vencida' && l.diasRestantes <= 7)
      .sort((a, b) => a.diasRestantes - b.diasRestantes),
    [licencias]
  );

  const empresasUsadas = useMemo(
    () => [...new Set(licencias.map(l => l.empresa).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es')),
    [licencias],
  );
  const sectoresUsados = useMemo(
    () => [...new Set(licencias.map(l => l.sector).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es')),
    [licencias],
  );

  // ── Filters & sort ─────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    let result = [...licencias];

    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter(l =>
        l.nombre.toLowerCase().includes(q) ||
        l.empresa.toLowerCase().includes(q) ||
        l.sector.toLowerCase().includes(q)
      );
    }

    switch (filtroEstado) {
      case 'activas':  result = result.filter(l => l.estado !== 'vencida'); break;
      case 'proximas': result = result.filter(l => l.diasRestantes >= 0 && l.diasRestantes <= 7 && l.estado !== 'vencida'); break;
      case 'vencidas': result = result.filter(l => l.estado === 'vencida'); break;
    }

    const stateOrder: Record<EstadoLicencia, number> = { proxima_vencer: 0, activa: 1, vencida: 2 };

    switch (sortBy) {
      case 'fechaFin':   result.sort((a, b) => stateOrder[a.estado] - stateOrder[b.estado] || b.fechaFin.localeCompare(a.fechaFin)); break;
      case 'reintegro':  result.sort((a, b) => a.fechaReintegro.localeCompare(b.fechaReintegro)); break;
      case 'nombre':     result.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')); break;
      case 'dias':       result.sort((a, b) => b.diasTotales - a.diasTotales); break;
    }

    return result;
  }, [licencias, search, filtroEstado, sortBy]);

  // ── Historial por persona ──────────────────────────────────────────────────

  const historialPersonas = useMemo(() => {
    const map = new Map<string, Licencia[]>();
    for (const l of licencias) {
      if (!map.has(l.nombre)) map.set(l.nombre, []);
      map.get(l.nombre)!.push(l);
    }
    return [...map.entries()]
      .filter(([, ls]) => ls.length > 1)
      .sort(([, a], [, b]) => b.length - a.length);
  }, [licencias]);

  // ── Row styling ────────────────────────────────────────────────────────────

  function rowStyle(l: Licencia): string {
    if (l.estado === 'proxima_vencer') return 'bg-orange-50 border-l-2 border-orange-400';
    if (l.estado === 'activa') return 'bg-indigo-50 border-l-2 border-indigo-400';
    return 'bg-white';
  }

  function diasRestCell(l: Licencia) {
    if (l.estado === 'vencida') return <span className="text-gray-300">—</span>;
    const d = l.diasRestantes;
    if (d <= 0) return <span className="inline-block bg-red-100 text-red-700 font-bold text-xs px-2 py-0.5 rounded">HOY</span>;
    if (d <= 2) return <span className="inline-block bg-red-100 text-red-700 font-bold text-sm px-2 py-0.5 rounded">{d}d</span>;
    if (d <= 7) return <span className="inline-block bg-orange-100 text-orange-700 font-semibold text-sm px-2 py-0.5 rounded">{d}d</span>;
    return <span className="text-indigo-600 font-semibold text-sm">{d}d</span>;
  }

  const subtitle = licencias.length > 0 ? `${stats.total} licencias · ${stats.personas} personas únicas` : 'Sin datos cargados';

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Licencias"
        subtitle={subtitle}
        actions={
          <div className="flex gap-2">
            <button
              onClick={() => exportExcel(licencias)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Download size={13} /> Exportar Excel
            </button>
            <button
              onClick={() => setShowLoader(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Plus size={13} /> Agregar más
            </button>
            <button
              onClick={() => setShowLimpiarConfirm(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
            >
              <Trash2 size={13} /> Limpiar todo
            </button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-6">
        <div id="licencias-content" className="max-w-[1500px] mx-auto grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5 items-start">
        <div className="space-y-5">

          {/* ── Alerta reintegros próximos ── */}
          {alertas.length > 0 && (
            <div className="bg-orange-50 border border-orange-300 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle size={16} className="text-orange-600 flex-shrink-0" />
                <span className="font-bold text-orange-800 text-sm">Reintegros próximos</span>
              </div>
              <div className="space-y-1.5">
                {alertas.map(l => (
                  <div key={l.id} className="flex items-center gap-3 text-sm">
                    <span className={`flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      l.diasRestantes <= 2 ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'
                    }`}>
                      {l.diasRestantes <= 0 ? 'HOY' : `${l.diasRestantes}d`}
                    </span>
                    <span className="font-semibold text-gray-800">{l.nombre}</span>
                    <span className="text-gray-500">
                      — termina {fmtDate(l.fechaFin)} · reintegra {fmtDate(l.fechaReintegro)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── KPIs ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard
              label="En curso hoy"
              value={stats.activas}
              sublabel="personas de licencia ahora"
              borderColor="#4f46e5"
              valueColor={stats.activas > 0 ? '#4f46e5' : '#16a34a'}
            />
            <KpiCard
              label="Próximas a terminar"
              value={stats.proximas}
              sublabel="reintegran en menos de 7 días"
              borderColor="#fd7e14"
              valueColor={stats.proximas > 0 ? '#fd7e14' : undefined}
            />
            <KpiCard
              label="Reintegros esta semana"
              value={stats.reintegros}
              sublabel="fechas de reintegro próximas"
              borderColor="#003DA5"
              valueColor={stats.reintegros > 0 ? '#003DA5' : undefined}
            />
            <KpiCard
              label="Total histórico"
              value={stats.total}
              sublabel={`${stats.personas} personas únicas`}
              borderColor="#94a3b8"
            />
          </div>

          {/* ── Filters ── */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 border border-gray-200 rounded-lg px-3 py-1.5 bg-white min-w-[220px]">
              <Search size={13} className="text-gray-400 flex-shrink-0" />
              <input
                type="text"
                placeholder="Buscar persona, empresa o sector..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="text-sm outline-none flex-1 bg-transparent"
              />
              {search && (
                <button onClick={() => setSearch('')} className="text-gray-400 hover:text-gray-600">
                  <X size={12} />
                </button>
              )}
            </div>

            <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
              {([['todas', 'Todas'], ['activas', 'Activas'], ['proximas', 'Próximas'], ['vencidas', 'Finalizadas']] as [FiltroEstado, string][]).map(([v, label]) => (
                <button
                  key={v}
                  onClick={() => setFiltroEstado(v)}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
                    filtroEstado === v ? 'bg-white text-[#003DA5] shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5 border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-sm">
              <span className="text-gray-400 text-xs">Ordenar:</span>
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as SortKey)}
                className="outline-none bg-transparent text-sm"
              >
                <option value="fechaFin">Fecha fin</option>
                <option value="reintegro">Reintegro próximo</option>
                <option value="nombre">Nombre A–Z</option>
                <option value="dias">Días totales</option>
              </select>
              <ChevronDown size={12} className="text-gray-400" />
            </div>

            <span className="text-sm text-gray-400">{filtered.length} licencias</span>
          </div>

          {/* ── Table ── */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#003DA5] text-white">
                    {['Nombre', 'Empresa', 'Sector', 'Inicio', 'Fin', 'Días lic.', 'Reintegro', 'Estado', 'Días rest.', ''].map(h => (
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
                        Ninguna licencia coincide con los filtros.
                      </td>
                    </tr>
                  )}
                  {filtered.map(l => (
                    <tr key={l.id} className={`border-b border-gray-100 group transition-colors hover:brightness-95 ${rowStyle(l)}`}>
                      <td className="px-3 py-2.5 font-semibold text-gray-800 whitespace-nowrap">{l.nombre}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap max-w-[160px]">
                        <EditableCell
                          value={l.empresa} placeholder="—" listId="lic-empresas"
                          onCommit={v => handleUpdateField(l.id, 'empresa', v)}
                        />
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap max-w-[160px]">
                        <EditableCell
                          value={l.sector} placeholder="—" listId="lic-sectores"
                          onCommit={v => handleUpdateField(l.id, 'sector', v)}
                        />
                      </td>
                      <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{fmtDate(l.fechaInicio)}</td>
                      <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{fmtDate(l.fechaFin)}</td>
                      <td className="px-3 py-2.5 text-center">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          l.diasTotales > 30 ? 'bg-orange-100 text-orange-700 font-semibold' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {l.diasTotales === 1 ? '1 día' : `${l.diasTotales}d`}
                        </span>
                      </td>
                      <td className={`px-3 py-2.5 whitespace-nowrap font-mono text-xs ${
                        l.fechaReintegro > todayISO() ? 'text-indigo-600 font-bold' : 'text-gray-400'
                      }`}>
                        {fmtDate(l.fechaReintegro)}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <EstadoBadge estado={l.estado} />
                      </td>
                      <td className="px-3 py-2.5 text-center whitespace-nowrap">
                        {diasRestCell(l)}
                      </td>
                      <td className="px-3 py-2.5 w-8">
                        <button
                          onClick={() => setDeleteTarget(l)}
                          className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-all"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Historial por persona ── */}
          {historialPersonas.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <button
                className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors"
                onClick={() => setShowHistorial(v => !v)}
              >
                <div>
                  <span className="font-semibold text-gray-800 text-sm">Historial por persona</span>
                  <span className="ml-2 text-xs text-gray-400">{historialPersonas.length} personas con múltiples licencias</span>
                </div>
                {showHistorial ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
              </button>

              {showHistorial && (
                <div className="px-5 pb-4 border-t border-gray-100">
                  {historialPersonas.map(([nombre, ls]) => (
                    <PersonaHistorial key={nombre} nombre={nombre} licencias={ls} />
                  ))}
                </div>
              )}
            </div>
          )}

        </div>

        <AddPanel onSave={handleAdd} />
        </div>
      </div>

      <datalist id="lic-empresas">
        {empresasUsadas.map(v => <option key={v} value={v} />)}
      </datalist>
      <datalist id="lic-sectores">
        {sectoresUsados.map(v => <option key={v} value={v} />)}
      </datalist>

      {deleteTarget && (
        <DeleteModal licencia={deleteTarget} onConfirm={handleDelete} onClose={() => setDeleteTarget(null)} />
      )}
      {showLoader && (
        <TextoLoaderModal
          onCargar={handleProcesarTexto}
          onClose={() => setShowLoader(false)}
        />
      )}
      {showLimpiarConfirm && (
        <LimpiarModal onConfirm={handleLimpiarTodo} onClose={() => setShowLimpiarConfirm(false)} />
      )}
      {toast && <Toast msg={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
