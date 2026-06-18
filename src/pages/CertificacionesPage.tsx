import { useState, useMemo, useCallback } from 'react';
import {
  FileCheck, Plus, Trash2, X, AlertTriangle, ChevronDown, ChevronUp,
  Search, Download, ClipboardList, RefreshCw,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import Header from '../components/Header';

// ─── Types ─────────────────────────────────────────────────────────────────────

type EstadoCert = 'activa' | 'proxima_vencer' | 'vencida';

interface Certificacion {
  id: string;
  documento: string;
  nombreCompleto: string;
  fechaInicio: string;
  fechaFin: string;
  diasTotales: number;
  fechaReintegro: string;
  estado: EstadoCert;
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

function buildCert(
  documento: string,
  nombreCompleto: string,
  fechaInicio: string,
  fechaFin: string,
): Certificacion {
  const today = todayISO();
  const diasTotales = diffDays(fechaInicio, fechaFin) + 1;
  const fechaReintegro = addDays(fechaFin, 1);
  const diasRestantes = diffDays(today, fechaFin);

  let estado: EstadoCert;
  if (fechaFin < today) {
    estado = 'vencida';
  } else if (fechaInicio <= today && diasRestantes <= 7) {
    estado = 'proxima_vencer';
  } else {
    estado = 'activa';
  }

  const id = `${documento}__${nombreCompleto}__${fechaInicio}`;
  return { id, documento, nombreCompleto, fechaInicio, fechaFin, diasTotales, fechaReintegro, estado, diasRestantes };
}

const STORAGE_KEY = 'elared_certificaciones';

function loadData(): Certificacion[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const stored = JSON.parse(raw) as Array<{
        id: string; documento: string; nombreCompleto: string;
        fechaInicio: string; fechaFin: string;
      }>;
      return stored.map(s => buildCert(s.documento, s.nombreCompleto, s.fechaInicio, s.fechaFin));
    }
  } catch { /* ignore */ }
  return [];
}

function saveData(certs: Certificacion[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(
      certs.map(c => ({
        id: c.id, documento: c.documento, nombreCompleto: c.nombreCompleto,
        fechaInicio: c.fechaInicio, fechaFin: c.fechaFin,
      }))
    ));
  } catch { /* ignore */ }
}

function certKey(c: Certificacion): string {
  return `${c.documento}__${c.fechaInicio}__${c.fechaFin}`;
}

// ─── Parser de texto ───────────────────────────────────────────────────────────

function parsearTextoCertificaciones(texto: string): { certs: Certificacion[]; ignoradas: number } {
  const lines = texto.split('\n');
  const resultados: Certificacion[] = [];
  let ignoradas = 0;

  function dmyToIso(dmy: string): string {
    const [d, m, y] = dmy.split('/');
    return `${y}-${m}-${d}`;
  }

  for (const linea of lines) {
    const trim = linea.trim();
    if (!trim) continue;

    const docMatch = trim.match(/Uruguay\s+DO\s+\d+/i);
    if (!docMatch) { ignoradas++; continue; }

    const fechas = trim.match(/\d{2}\/\d{2}\/\d{4}/g);
    if (!fechas || fechas.length < 2) { ignoradas++; continue; }

    const docStr = docMatch[0];
    const docEnd = trim.indexOf(docStr) + docStr.length;
    const primerFechaIdx = trim.search(/\d{2}\/\d{2}\/\d{4}/);
    let nombre = trim.slice(docEnd, primerFechaIdx).trim();
    nombre = nombre.replace(/[\s\-]+$/, '').replace(/\s+/g, ' ').trim();

    if (!nombre) { ignoradas++; continue; }

    resultados.push(buildCert(docStr, nombre.toUpperCase(), dmyToIso(fechas[0]), dmyToIso(fechas[1])));
  }

  return { certs: resultados, ignoradas };
}

// ─── Export helper ─────────────────────────────────────────────────────────────

function exportExcel(certs: Certificacion[]) {
  const wb = XLSX.utils.book_new();
  const headers = ['Documento', 'Nombre', 'Inicio', 'Fin', 'Días cert.', 'Reintegro', 'Estado', 'Días rest.'];

  const ESTADO_LABEL: Record<EstadoCert, string> = {
    activa: 'Activa', proxima_vencer: 'Próxima a vencer', vencida: 'Finalizada',
  };

  function toRows(list: Certificacion[]) {
    return list.map(c => [
      c.documento, c.nombreCompleto, fmtDate(c.fechaInicio), fmtDate(c.fechaFin),
      c.diasTotales, fmtDate(c.fechaReintegro), ESTADO_LABEL[c.estado],
      c.estado !== 'vencida' ? c.diasRestantes : '—',
    ]);
  }

  function makeSheet(list: Certificacion[]) {
    const ws = XLSX.utils.aoa_to_sheet([headers, ...toRows(list)]);
    headers.forEach((_, ci) => {
      const ref = XLSX.utils.encode_cell({ r: 0, c: ci });
      if (ws[ref]) ws[ref].s = {
        font: { bold: true, color: { rgb: 'FFFFFF' } },
        fill: { fgColor: { rgb: '003DA5' } },
        alignment: { horizontal: 'center' },
      };
    });
    list.forEach((c, ri) => {
      const bg = c.estado === 'activa' ? 'FFF0F0'
        : c.estado === 'proxima_vencer' ? 'FFF8F0' : 'FFFFFF';
      headers.forEach((_, ci) => {
        const ref = XLSX.utils.encode_cell({ r: ri + 1, c: ci });
        if (ws[ref]) ws[ref].s = { fill: { fgColor: { rgb: bg } } };
      });
    });
    ws['!cols'] = [{ wch: 22 }, { wch: 38 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 18 }, { wch: 10 }];
    return ws;
  }

  const sorted = [...certs].sort((a, b) => {
    const order: Record<EstadoCert, number> = { proxima_vencer: 0, activa: 1, vencida: 2 };
    if (order[a.estado] !== order[b.estado]) return order[a.estado] - order[b.estado];
    return b.fechaFin.localeCompare(a.fechaFin);
  });
  XLSX.utils.book_append_sheet(wb, makeSheet(sorted), 'Todas');
  XLSX.utils.book_append_sheet(wb, makeSheet(certs.filter(c => c.estado !== 'vencida')), 'Activas');

  const byNombre = new Map<string, Certificacion[]>();
  for (const c of certs) {
    if (!byNombre.has(c.nombreCompleto)) byNombre.set(c.nombreCompleto, []);
    byNombre.get(c.nombreCompleto)!.push(c);
  }
  const personaRows: (string | number)[][] = [];
  for (const [nombre, cs] of [...byNombre.entries()].sort(([a], [b]) => a.localeCompare(b, 'es'))) {
    const sortedCs = [...cs].sort((a, b) => a.fechaInicio.localeCompare(b.fechaInicio));
    for (const c of sortedCs) {
      personaRows.push([
        nombre, c.documento, fmtDate(c.fechaInicio), fmtDate(c.fechaFin),
        c.diasTotales, fmtDate(c.fechaReintegro), ESTADO_LABEL[c.estado],
      ]);
    }
  }
  const histWs = XLSX.utils.aoa_to_sheet([
    ['Nombre', 'Documento', 'Inicio', 'Fin', 'Días cert.', 'Reintegro', 'Estado'],
    ...personaRows,
  ]);
  histWs['!cols'] = [{ wch: 38 }, { wch: 22 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, histWs, 'Historial por persona');

  XLSX.writeFile(wb, `Certificaciones_${new Date().toLocaleDateString('es-UY').replace(/\//g, '-')}.xlsx`);
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

// ─── Add modal ─────────────────────────────────────────────────────────────────

function AddModal({ onSave, onClose }: { onSave: (c: Certificacion) => void; onClose: () => void }) {
  const [documento, setDocumento] = useState('');
  const [nombre, setNombre] = useState('');
  const [inicio, setInicio] = useState('');
  const [fin, setFin] = useState('');
  const [error, setError] = useState('');

  const preview = useMemo(() => {
    if (!inicio || !fin || fin < inicio) return null;
    const dias = diffDays(inicio, fin) + 1;
    const reintegro = addDays(fin, 1);
    return { dias, reintegro };
  }, [inicio, fin]);

  function handleSave() {
    if (!documento.trim()) { setError('El documento es requerido.'); return; }
    if (!nombre.trim()) { setError('El nombre es requerido.'); return; }
    if (!inicio) { setError('La fecha de inicio es requerida.'); return; }
    if (!fin) { setError('La fecha de fin es requerida.'); return; }
    if (fin < inicio) { setError('La fecha de fin debe ser igual o posterior al inicio.'); return; }
    onSave(buildCert(documento.trim(), nombre.trim().toUpperCase(), inicio, fin));
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-bold text-gray-900 text-lg">Nueva certificación</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Documento</label>
            <input
              type="text" value={documento} onChange={e => setDocumento(e.target.value)}
              placeholder="Uruguay DO XXXXXXXX"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#003DA5] focus:ring-1 focus:ring-[#003DA5]"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Nombre completo</label>
            <input
              type="text" value={nombre}
              onChange={e => setNombre(e.target.value.toUpperCase())}
              placeholder="APELLIDO, Nombre"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#003DA5] focus:ring-1 focus:ring-[#003DA5]"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
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
          </div>

          {preview && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-sm text-blue-800">
              Duración: <strong>{preview.dias} días</strong> · Reintegro: <strong>{fmtDate(preview.reintegro)}</strong>
            </div>
          )}

          {error && (
            <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
          )}
        </div>

        <div className="flex gap-2 mt-5">
          <button onClick={onClose}
            className="flex-1 border border-gray-300 rounded-lg py-2 text-sm text-gray-700 hover:bg-gray-50">
            Cancelar
          </button>
          <button onClick={handleSave}
            className="flex-1 bg-[#003DA5] text-white rounded-lg py-2 text-sm font-semibold hover:bg-blue-800">
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Delete confirm modal ──────────────────────────────────────────────────────

function DeleteModal({ cert, onConfirm, onClose }: {
  cert: Certificacion; onConfirm: () => void; onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
        <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center mb-4">
          <Trash2 size={18} className="text-red-600" />
        </div>
        <h2 className="font-bold text-gray-900 text-base mb-1">¿Eliminar certificación?</h2>
        <p className="text-sm text-gray-500 mb-5">
          <strong>{cert.nombreCompleto}</strong>
          <br />del {fmtDate(cert.fechaInicio)} al {fmtDate(cert.fechaFin)}
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
      <FileCheck size={15} />
      {msg}
      <button onClick={onClose} className="ml-1 opacity-70 hover:opacity-100"><X size={13} /></button>
    </div>
  );
}

// ─── Estado badge ──────────────────────────────────────────────────────────────

function EstadoBadge({ estado }: { estado: EstadoCert }) {
  if (estado === 'activa')
    return <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700">● Activa</span>;
  if (estado === 'proxima_vencer')
    return <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">⚠ Vence pronto</span>;
  return <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">✓ Finalizada</span>;
}

// ─── Historial timeline ────────────────────────────────────────────────────────

function PersonaHistorial({ nombre, certs }: { nombre: string; certs: Certificacion[] }) {
  const sorted = [...certs].sort((a, b) => a.fechaInicio.localeCompare(b.fechaInicio));
  const totalDias = certs.reduce((s, c) => s + c.diasTotales, 0);
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
          <span className="ml-2 text-xs text-gray-400">{certs.length} certificaciones · {totalDias} días totales</span>
        </div>
        <span className="text-[11px] text-gray-400">{fmtDate(primeraFecha)} → {fmtDate(ultimaFecha)}</span>
      </div>
      <div className="relative h-5 bg-gray-100 rounded-full overflow-hidden">
        {sorted.map(c => {
          const left = ((isoToDate(c.fechaInicio).getTime() - minMs) / span) * 100;
          const width = Math.max(1, ((c.diasTotales - 1) / span) * 86400000 / span * 100);
          const color = c.estado === 'activa' ? '#E3000F' : c.estado === 'proxima_vencer' ? '#fd7e14' : '#94a3b8';
          return (
            <div
              key={c.id}
              className="absolute top-0 h-full rounded-full opacity-80"
              style={{ left: `${Math.min(left, 99)}%`, width: `${Math.max(width, 1)}%`, background: color }}
              title={`${fmtDate(c.fechaInicio)} – ${fmtDate(c.fechaFin)} (${c.diasTotales}d)`}
            />
          );
        })}
      </div>
    </div>
  );
}

// ─── Texto loader ──────────────────────────────────────────────────────────────

const EJEMPLO_TEXTO = `Uruguay DO 51257092    SILVEIRA ALMEIDA, Fiamma Natalie    13/05/2025  -  30/05/2026
Uruguay DO 55098139    TABEIRA RODRIGUEZ, Katherine Yuliana    16/03/2026  -  28/05/2026
Uruguay DO 53488308    ALVEZ ALVEZ, Camila Magali    02/03/2026  -  09/05/2026`;

function TextoLoaderContent({
  texto, setTexto, onCargarEjemplo, onProcesar,
}: {
  texto: string;
  setTexto: (t: string) => void;
  onCargarEjemplo: () => void;
  onProcesar: () => void;
}) {
  return (
    <div className="space-y-4">
      <textarea
        value={texto}
        onChange={e => setTexto(e.target.value)}
        rows={10}
        placeholder={`Uruguay DO 51257092    SILVEIRA ALMEIDA, Fiamma Natalie    13/05/2025  -  30/05/2026\nUruguay DO 55098139    TABEIRA RODRIGUEZ, Katherine Yuliana    16/03/2026  -  28/05/2026\n...`}
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
  onCargar, onClose, isOverlay,
}: {
  onCargar: (texto: string) => void;
  onClose?: () => void;
  isOverlay: boolean;
}) {
  const [texto, setTexto] = useState('');

  function handleProcesar() {
    if (texto.trim()) onCargar(texto);
  }

  if (isOverlay) {
    return (
      <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-6" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-bold text-gray-900 text-lg">Agregar certificaciones</h2>
              <p className="text-sm text-gray-500">Pegá el texto del listado de certificaciones</p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
          </div>
          <TextoLoaderContent
            texto={texto}
            setTexto={setTexto}
            onCargarEjemplo={() => setTexto(EJEMPLO_TEXTO)}
            onProcesar={handleProcesar}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-3">
            <ClipboardList size={26} className="text-[#003DA5]" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-1">Cargar Certificaciones</h2>
          <p className="text-sm text-gray-500">Pegá el texto exportado del sistema de certificaciones</p>
        </div>
        <TextoLoaderContent
          texto={texto}
          setTexto={setTexto}
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
          Se eliminarán todas las certificaciones guardadas. Esta acción no se puede deshacer.
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
type SortKey = 'fechaFin' | 'reintegro' | 'nombre' | 'dias' | 'documento';

export default function CertificacionesPage() {
  const [certs, setCerts] = useState<Certificacion[]>(loadData);
  const [search, setSearch] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>('todas');
  const [sortBy, setSortBy] = useState<SortKey>('fechaFin');
  const [showAdd, setShowAdd] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Certificacion | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [showHistorial, setShowHistorial] = useState(false);
  const [showLoader, setShowLoader] = useState(false);
  const [showLimpiarConfirm, setShowLimpiarConfirm] = useState(false);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  }, []);

  function handleAdd(cert: Certificacion) {
    const next = [...certs, cert];
    setCerts(next);
    saveData(next);
    setShowAdd(false);
    showToast(`Certificación agregada · ${cert.nombreCompleto}`);
  }

  function handleDelete() {
    if (!deleteTarget) return;
    const next = certs.filter(c => c.id !== deleteTarget.id);
    setCerts(next);
    saveData(next);
    setDeleteTarget(null);
    showToast(`Certificación eliminada · ${deleteTarget.nombreCompleto}`);
  }

  function handleProcesarTexto(texto: string) {
    const { certs: nuevas, ignoradas } = parsearTextoCertificaciones(texto);
    if (nuevas.length === 0) {
      showToast('No se encontraron certificaciones válidas en el texto');
      return;
    }
    const existingKeys = new Set(certs.map(certKey));
    const sinDups = nuevas.filter(c => !existingKeys.has(certKey(c)));
    const dupCount = nuevas.length - sinDups.length;
    const next = [...certs, ...sinDups];
    setCerts(next);
    saveData(next);
    setShowLoader(false);
    const partes = [`${sinDups.length} certificaciones cargadas`];
    if (dupCount > 0) partes.push(`${dupCount} duplicadas ignoradas`);
    if (ignoradas > 0) partes.push(`${ignoradas} líneas ignoradas`);
    showToast(partes.join(' · '));
  }

  function handleLimpiarTodo() {
    setCerts([]);
    saveData([]);
    setShowLimpiarConfirm(false);
    showToast('Todos los datos eliminados');
  }

  // ── Stats ──────────────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const activas = certs.filter(c => c.estado !== 'vencida');
    const proximas = certs.filter(c => c.estado === 'proxima_vencer' || (c.estado === 'activa' && c.diasRestantes <= 7));
    const reintegrosEstaSemana = certs.filter(c => c.estado !== 'vencida' && c.diasRestantes >= 0 && c.diasRestantes <= 7);
    const personas = new Set(certs.map(c => c.nombreCompleto)).size;
    return { activas: activas.length, proximas: proximas.length, reintegros: reintegrosEstaSemana.length, total: certs.length, personas };
  }, [certs]);

  const alertas = useMemo(() =>
    certs
      .filter(c => c.estado !== 'vencida' && c.diasRestantes <= 7)
      .sort((a, b) => a.diasRestantes - b.diasRestantes),
    [certs]
  );

  // ── Filters & sort ─────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    let result = [...certs];

    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter(c =>
        c.nombreCompleto.toLowerCase().includes(q) || c.documento.toLowerCase().includes(q)
      );
    }

    switch (filtroEstado) {
      case 'activas':  result = result.filter(c => c.estado !== 'vencida'); break;
      case 'proximas': result = result.filter(c => c.diasRestantes >= 0 && c.diasRestantes <= 7 && c.estado !== 'vencida'); break;
      case 'vencidas': result = result.filter(c => c.estado === 'vencida'); break;
    }

    const stateOrder: Record<EstadoCert, number> = { proxima_vencer: 0, activa: 1, vencida: 2 };

    switch (sortBy) {
      case 'fechaFin':   result.sort((a, b) => stateOrder[a.estado] - stateOrder[b.estado] || b.fechaFin.localeCompare(a.fechaFin)); break;
      case 'reintegro':  result.sort((a, b) => a.fechaReintegro.localeCompare(b.fechaReintegro)); break;
      case 'nombre':     result.sort((a, b) => a.nombreCompleto.localeCompare(b.nombreCompleto, 'es')); break;
      case 'dias':       result.sort((a, b) => b.diasTotales - a.diasTotales); break;
      case 'documento':  result.sort((a, b) => a.documento.localeCompare(b.documento)); break;
    }

    return result;
  }, [certs, search, filtroEstado, sortBy]);

  // ── Historial por persona ──────────────────────────────────────────────────

  const historialPersonas = useMemo(() => {
    const map = new Map<string, Certificacion[]>();
    for (const c of certs) {
      if (!map.has(c.nombreCompleto)) map.set(c.nombreCompleto, []);
      map.get(c.nombreCompleto)!.push(c);
    }
    return [...map.entries()]
      .filter(([, cs]) => cs.length > 1)
      .sort(([, a], [, b]) => b.length - a.length);
  }, [certs]);

  // ── Row styling ────────────────────────────────────────────────────────────

  function rowStyle(c: Certificacion): string {
    if (c.estado === 'proxima_vencer') return 'bg-orange-50 border-l-2 border-orange-400';
    if (c.estado === 'activa') return 'bg-red-50 border-l-2 border-red-400';
    return 'bg-white';
  }

  function diasRestCell(c: Certificacion) {
    if (c.estado === 'vencida') return <span className="text-gray-300">—</span>;
    const d = c.diasRestantes;
    if (d <= 0) return <span className="inline-block bg-red-100 text-red-700 font-bold text-xs px-2 py-0.5 rounded">HOY</span>;
    if (d <= 2) return <span className="inline-block bg-red-100 text-red-700 font-bold text-sm px-2 py-0.5 rounded">{d}d</span>;
    if (d <= 7) return <span className="inline-block bg-orange-100 text-orange-700 font-semibold text-sm px-2 py-0.5 rounded">{d}d</span>;
    return <span className="text-blue-600 font-semibold text-sm">{d}d</span>;
  }

  // ── Empty state ────────────────────────────────────────────────────────────

  if (certs.length === 0) {
    return (
      <div className="flex flex-col h-full">
        <Header
          title="Certificaciones"
          subtitle="Sin datos cargados"
          actions={null}
        />
        <div className="flex-1 overflow-y-auto p-6 flex items-center justify-center">
          <TextoLoaderModal isOverlay={false} onCargar={handleProcesarTexto} />
        </div>
        {toast && <Toast msg={toast} onClose={() => setToast(null)} />}
      </div>
    );
  }

  const subtitle = `${stats.total} certificaciones · ${stats.personas} personas únicas`;

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Certificaciones"
        subtitle={subtitle}
        actions={
          <div className="flex gap-2">
            <button
              onClick={() => exportExcel(certs)}
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
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-1.5 px-4 py-1.5 text-sm bg-[#003DA5] text-white rounded-lg hover:bg-blue-800 transition-colors font-semibold"
            >
              <Plus size={14} /> Nueva certificación
            </button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-6">
        <div id="certificaciones-content" className="max-w-[1300px] mx-auto space-y-5">

          {/* ── Alerta reintegros próximos ── */}
          {alertas.length > 0 && (
            <div className="bg-orange-50 border border-orange-300 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle size={16} className="text-orange-600 flex-shrink-0" />
                <span className="font-bold text-orange-800 text-sm">Reintegros próximos</span>
              </div>
              <div className="space-y-1.5">
                {alertas.map(c => (
                  <div key={c.id} className="flex items-center gap-3 text-sm">
                    <span className={`flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      c.diasRestantes <= 2 ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'
                    }`}>
                      {c.diasRestantes <= 0 ? 'HOY' : `${c.diasRestantes}d`}
                    </span>
                    <span className="font-semibold text-gray-800">{c.nombreCompleto}</span>
                    <span className="text-gray-500">
                      — vence {fmtDate(c.fechaFin)} · reintegra {fmtDate(c.fechaReintegro)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── KPIs ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard
              label="Activas hoy"
              value={stats.activas}
              sublabel="personas certificadas ahora"
              borderColor="#E3000F"
              valueColor={stats.activas > 0 ? '#E3000F' : '#16a34a'}
            />
            <KpiCard
              label="Próximas a vencer"
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
                placeholder="Buscar persona o documento..."
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
                <option value="documento">Documento</option>
              </select>
              <ChevronDown size={12} className="text-gray-400" />
            </div>

            <span className="text-sm text-gray-400">{filtered.length} certificaciones</span>
          </div>

          {/* ── Table ── */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#003DA5] text-white">
                    {['Documento', 'Nombre', 'Inicio', 'Fin', 'Días cert.', 'Reintegro', 'Estado', 'Días rest.', ''].map(h => (
                      <th key={h} className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-gray-400 text-sm">
                        Ninguna certificación coincide con los filtros.
                      </td>
                    </tr>
                  )}
                  {filtered.map(c => (
                    <tr key={c.id} className={`border-b border-gray-100 group transition-colors hover:brightness-95 ${rowStyle(c)}`}>
                      <td className="px-3 py-2.5 text-gray-500 text-xs font-mono whitespace-nowrap">{c.documento}</td>
                      <td className="px-3 py-2.5 font-semibold text-gray-800 whitespace-nowrap">{c.nombreCompleto}</td>
                      <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{fmtDate(c.fechaInicio)}</td>
                      <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{fmtDate(c.fechaFin)}</td>
                      <td className="px-3 py-2.5 text-center">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          c.diasTotales > 100 ? 'bg-orange-100 text-orange-700 font-semibold' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {c.diasTotales === 1 ? '1 día' : `${c.diasTotales}d`}
                          {c.diasTotales > 100 && ' ·larga'}
                        </span>
                      </td>
                      <td className={`px-3 py-2.5 whitespace-nowrap font-mono text-xs ${
                        c.fechaReintegro > todayISO() ? 'text-blue-600 font-bold' : 'text-gray-400'
                      }`}>
                        {fmtDate(c.fechaReintegro)}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <EstadoBadge estado={c.estado} />
                      </td>
                      <td className="px-3 py-2.5 text-center whitespace-nowrap">
                        {diasRestCell(c)}
                      </td>
                      <td className="px-3 py-2.5 w-8">
                        <button
                          onClick={() => setDeleteTarget(c)}
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
                  <span className="ml-2 text-xs text-gray-400">{historialPersonas.length} personas con múltiples certificaciones</span>
                </div>
                {showHistorial ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
              </button>

              {showHistorial && (
                <div className="px-5 pb-4 border-t border-gray-100">
                  {historialPersonas.map(([nombre, cs]) => (
                    <PersonaHistorial key={nombre} nombre={nombre} certs={cs} />
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      {showAdd && <AddModal onSave={handleAdd} onClose={() => setShowAdd(false)} />}
      {deleteTarget && (
        <DeleteModal cert={deleteTarget} onConfirm={handleDelete} onClose={() => setDeleteTarget(null)} />
      )}
      {showLoader && (
        <TextoLoaderModal
          isOverlay={true}
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
