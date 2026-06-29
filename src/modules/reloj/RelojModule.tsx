import { useState, useCallback, useMemo, type FormEvent, Fragment } from 'react';
import { recordActivity } from '../../utils/activityTracker';
import type { HorarioDia, HorarioPersona } from '../../data/horarios_personal';
import { guardarHorarioCustom } from '../../data/horarios_personal';
import {
  Clock, Download, Loader2, FileText, ChevronDown, ChevronUp,
  Edit2, Info, Check, Users, AlertCircle, XCircle, Calendar,
  Search, ArrowLeft,
} from 'lucide-react';
import FileUploader from '../../components/FileUploader';
import KPICard from '../../components/KPICard';
import Header from '../../components/Header';
import {
  parseReloj, calcularMetricas, minsToHHMM, parseHHMM,
  type RelojData, type EmpleadoData, type DiaData, type EstadoDia, type HorarioEsperado,
} from './relojParser';
import RelojCalendar from './RelojCalendar';
import RelojTimeline from './RelojTimeline';
import { IngresosLineChart, JornadaLineChart, HeatmapChart } from './RelojCharts';
import { exportRelojExcel, exportRelojPPTX } from './RelojExport';
import PDFModal from '../../components/PDFModal';
import { useConfig } from '../../hooks/useConfig';
import { useAnalisisStore, formatFechaCarga } from '../../store/analisisStore';

// ─── Helpers ───────────────────────────────────────────────────────────────────

const DIAS_SEMANA_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

function fmtFecha(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso + 'T12:00:00');
  return `${DIAS_SEMANA_SHORT[d.getDay()]} ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function fmtFechaLong(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso + 'T12:00:00');
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function fmtExtras(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h > 0 && m > 0) return `+${h}h ${m}min`;
  if (h > 0) return `+${h}h`;
  return `+${m}min`;
}

const ESTADO_BADGE: Record<EstadoDia, { label: string; bg: string; text: string }> = {
  OK:                 { label: 'OK',           bg: '#dcfce7', text: '#15803d' },
  TARDANZA:           { label: 'Tardanza',      bg: '#fef9c3', text: '#854d0e' },
  TARDANZA_GRAVE:     { label: 'T. Grave',      bg: '#fee2e2', text: '#991b1b' },
  DESCANSO_EXTENDIDO: { label: 'Desc. ext.',    bg: '#fef3c7', text: '#92400e' },
  SALIDA_ANTICIPADA:  { label: 'Sal. anticip.', bg: '#ffedd5', text: '#9a3412' },
  DATO_INCOMPLETO:    { label: 'Incompleto',    bg: '#dbeafe', text: '#4D94FF' },
  AUSENTE:            { label: 'Ausente',       bg: '#fee2e2', text: '#991b1b' },
  FIN_SEMANA:         { label: 'Fin semana',    bg: '#f9fafb', text: '#9ca3af' },
};

function EstadoBadge({ estado, tooltip }: { estado: EstadoDia; tooltip?: string }) {
  const b = ESTADO_BADGE[estado];
  return (
    <span className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full"
      style={{ background: b.bg, color: b.text }}
      title={tooltip}>
      {b.label}
    </span>
  );
}

function TimeCell({ value, warn = false, missing = false }: { value: string | null; warn?: boolean; missing?: boolean }) {
  if (!value || missing) return (
    <span className="font-mono text-sm" style={{ color: '#CBD5E1' }} title="Marcación no registrada">—</span>
  );
  return (
    <span className={`font-mono text-sm font-medium ${warn ? 'text-red-600' : 'text-gray-800'}`}>
      {value}
    </span>
  );
}

// ─── Horario edit modal ────────────────────────────────────────────────────────

interface HorarioModalProps {
  emp: EmpleadoData;
  onSave: (newHorario: HorarioEsperado) => void;
  onClose: () => void;
}

function HorarioModal({ emp, onSave, onClose }: HorarioModalProps) {
  const [form, setForm] = useState<HorarioEsperado>({ ...emp.horario });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSave(form);
    onClose();
  }

  const field = (key: keyof HorarioEsperado, label: string, type: 'time' | 'number' = 'time') => (
    <div>
      <label className="block text-[11px] font-semibold text-gray-500 mb-1 uppercase tracking-widest">{label}</label>
      <input
        type={type}
        value={String(form[key])}
        onChange={e => setForm(f => ({ ...f, [key]: type === 'number' ? Number(e.target.value) : e.target.value }))}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#003DA5] focus:ring-1 focus:ring-[#003DA5]"
        min={type === 'number' ? 0 : undefined}
        max={type === 'number' ? 120 : undefined}
      />
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <h2 className="font-bold text-gray-900 text-lg mb-1">Editar horario detectado</h2>
        <p className="text-gray-400 text-sm mb-4">{emp.nombre}</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {field('ingresoEsperado', 'Ingreso esperado')}
            {field('salidaEsperada', 'Salida esperada')}
            {field('descansoSalida', 'Salida descanso')}
            {field('descansoRegreso', 'Regreso descanso')}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {field('duracionDescansoMinutos', 'Duración descanso (min)', 'number')}
            {field('toleranciaIngreso', 'Tolerancia ingreso (min)', 'number')}
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 border border-gray-300 rounded-lg py-2 text-sm text-gray-700 hover:bg-gray-50">
              Cancelar
            </button>
            <button type="submit"
              className="flex-1 bg-[#003DA5] text-white rounded-lg py-2 text-sm font-semibold hover:bg-blue-800 flex items-center justify-center gap-2">
              <Check size={15} /> Guardar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Horario info card ─────────────────────────────────────────────────────────

function TurnoCard({ label, turno }: { label: string; turno: HorarioDia }) {
  return (
    <div className={`rounded-lg border p-2.5 ${turno.trabaja ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-100'}`}>
      <div className="text-[11px] font-semibold text-gray-500 mb-1 uppercase tracking-wide">{label}</div>
      {turno.trabaja ? (
        <div className="font-mono text-sm font-semibold text-gray-800">{turno.ingreso} – {turno.salida}</div>
      ) : (
        <div className="text-xs text-gray-400 italic">No trabaja</div>
      )}
    </div>
  );
}

function HorarioCard({ emp, onEdit }: { emp: EmpleadoData; onEdit: () => void }) {
  const [showTurns, setShowTurns] = useState(false);
  const h = emp.horario;
  const isOficial = h.fuenteHorario === 'horario_oficial';
  const isCustom  = h.fuenteHorario === 'horario_custom';
  const hp = h.horarioPersona;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="bg-blue-50 p-1.5 rounded-lg"><Clock size={15} className="text-[#003DA5]" /></div>
          <div>
            <div className="text-xs font-semibold text-gray-700">Horario</div>
            {isOficial ? (
              <span
                className="text-[10px] bg-green-100 text-green-700 border border-green-200 px-1.5 py-0.5 rounded-full font-semibold"
                title="Horario cargado desde el archivo de configuración"
              >
                ✓ Horario oficial
              </span>
            ) : isCustom ? (
              <span
                className="text-[10px] bg-blue-100 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded-full font-semibold"
                title="Horario guardado manualmente"
              >
                Horario guardado
              </span>
            ) : (
              <span
                className="text-[10px] bg-amber-100 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-full font-semibold"
                title="Persona no encontrada en la configuración — horario calculado por mediana de marcaciones"
              >
                ⚠ Inferido
              </span>
            )}
            {!isOficial && h.diasConDatosCompletos > 0 && (
              <span className="ml-1 text-[10px] text-gray-400">({h.diasConDatosCompletos} días)</span>
            )}
          </div>
        </div>

        <div className="flex gap-4 flex-wrap text-sm flex-1">
          {(isOficial || isCustom) && hp ? (
            <>
              <div>
                <span className="text-gray-400 text-xs">Lun–Mié</span>
                <div className="font-semibold text-gray-800 font-mono text-xs">
                  {hp.lunesAMiercoles.trabaja ? `${hp.lunesAMiercoles.ingreso} – ${hp.lunesAMiercoles.salida}` : 'No trabaja'}
                </div>
              </div>
              {(hp.jueveYViernes.ingreso !== hp.lunesAMiercoles.ingreso || hp.jueveYViernes.salida !== hp.lunesAMiercoles.salida || hp.jueveYViernes.trabaja !== hp.lunesAMiercoles.trabaja) && (
                <div>
                  <span className="text-gray-400 text-xs">Jue–Vie</span>
                  <div className="font-semibold text-gray-800 font-mono text-xs">
                    {hp.jueveYViernes.trabaja ? `${hp.jueveYViernes.ingreso} – ${hp.jueveYViernes.salida}` : 'No trabaja'}
                  </div>
                </div>
              )}
              {hp.sabado.trabaja && (
                <div>
                  <span className="text-gray-400 text-xs">Sáb</span>
                  <div className="font-semibold text-gray-800 font-mono text-xs">{hp.sabado.ingreso} – {hp.sabado.salida}</div>
                </div>
              )}
              {hp.domingo.trabaja && (
                <div>
                  <span className="text-gray-400 text-xs">Dom</span>
                  <div className="font-semibold text-gray-800 font-mono text-xs">{hp.domingo.ingreso} – {hp.domingo.salida}</div>
                </div>
              )}
            </>
          ) : (
            <>
              <div><span className="text-gray-400 text-xs">Ingreso</span><div className="font-semibold text-gray-800">{h.ingresoEsperado}</div></div>
              <div><span className="text-gray-400 text-xs">Salida</span><div className="font-semibold text-gray-800">{h.salidaEsperada}</div></div>
              <div><span className="text-gray-400 text-xs">Sal. desc.</span><div className="font-semibold text-gray-800">{h.descansoSalida}</div></div>
              <div><span className="text-gray-400 text-xs">Reg. desc.</span><div className="font-semibold text-gray-800">{h.descansoRegreso}</div></div>
              <div><span className="text-gray-400 text-xs">Descanso</span><div className="font-semibold text-gray-800">{h.duracionDescansoMinutos}m</div></div>
            </>
          )}
        </div>

        {(isOficial || isCustom) && hp ? (
          <button
            onClick={() => setShowTurns(v => !v)}
            className="flex items-center gap-1.5 text-[#003DA5] text-xs font-medium hover:bg-blue-50 px-2 py-1 rounded-lg transition-colors flex-shrink-0"
          >
            {showTurns ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            {showTurns ? 'Ocultar' : 'Ver completo'}
          </button>
        ) : (
          <button
            onClick={onEdit}
            className="flex items-center gap-1.5 text-[#003DA5] text-xs font-medium hover:bg-blue-50 px-2 py-1 rounded-lg transition-colors flex-shrink-0"
          >
            <Edit2 size={13} /> Editar
          </button>
        )}
      </div>

      {showTurns && hp && (
        <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-2 md:grid-cols-4 gap-2">
          <TurnoCard label="Lun – Mié" turno={hp.lunesAMiercoles} />
          <TurnoCard label="Jue – Vie" turno={hp.jueveYViernes} />
          <TurnoCard label="Sábado" turno={hp.sabado} />
          <TurnoCard label="Domingo" turno={hp.domingo} />
        </div>
      )}
    </div>
  );
}

// ─── Day detail table ──────────────────────────────────────────────────────────

function DiaTable({ emp }: { emp: EmpleadoData }) {
  const [expandedDate, setExpandedDate] = useState<string | null>(null);

  const rows: DiaData[] = [...emp.dias.values()]
    .filter(d => d.estado !== 'FIN_SEMANA')
    .sort((a, b) => b.fecha.localeCompare(a.fecha));

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            {['Fecha', 'Ingreso', 'Sal. Desc.', 'Reg. Desc.', 'Salida', 'Extras', 'Jornada', 'Estado', ''].map(h => (
              <th key={h} className="px-3 py-2 text-[11px] font-semibold text-gray-500 uppercase tracking-wide text-left whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(dia => {
            const isExpanded = expandedDate === dia.fecha;
            const tardanza = dia.minutosTardanza > 0;
            const salAnt   = dia.minutosSalidaAnticipada > 0;
            const isIncompleto = dia.estado === 'DATO_INCOMPLETO';

            // Positional display for incomplete days: assign marcaciones by position
            let displayIngreso: string | null = null;
            let displaySalDesc: string | null = null;
            let displayRegDesc: string | null = null;
            let displaySalida: string | null = null;
            let extrasBadge = 0;

            if (isIncompleto && dia.marcaciones.length > 0) {
              const mcs = dia.marcaciones; // sorted by time from parser
              const n = mcs.length;
              displayIngreso = mcs[0]?.hora ?? null;
              displaySalDesc = n >= 3 ? (mcs[1]?.hora ?? null) : null;
              displayRegDesc = n >= 4 ? (mcs[2]?.hora ?? null) : null;
              displaySalida  = n >= 2 ? (mcs[Math.min(n - 1, 3)]?.hora ?? null) : null;
              extrasBadge    = n > 4 ? n - 4 : 0;
            }

            const badgeTooltip = isIncompleto
              ? `Se detectaron ${dia.marcaciones.length} de 4 marcaciones esperadas. Las horas mostradas son las registradas en el reloj.`
              : undefined;

            return (
              <Fragment key={dia.fecha}>
                <tr
                  className={`border-b border-gray-100 transition-colors cursor-pointer ${
                    isExpanded ? 'bg-blue-50' : 'hover:bg-gray-50'
                  }`}
                  onClick={() => setExpandedDate(isExpanded ? null : dia.fecha)}
                >
                  <td className="px-3 py-2.5 font-medium text-gray-700 whitespace-nowrap">
                    {fmtFecha(dia.fecha)}
                  </td>
                  <td className="px-3 py-2.5">
                    {isIncompleto ? (
                      <TimeCell value={displayIngreso} missing={!displayIngreso} />
                    ) : (
                      <>
                        <TimeCell value={dia.ingreso} warn={tardanza} missing={!dia.ingreso} />
                        {dia.minutosTardanza > 0 && (
                          <span className="ml-1 text-[10px] text-red-500">+{dia.minutosTardanza}m</span>
                        )}
                      </>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    {isIncompleto ? (
                      <TimeCell value={displaySalDesc} missing={!displaySalDesc} />
                    ) : (
                      <TimeCell value={dia.salidaDescanso} missing={!dia.salidaDescanso} />
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    {isIncompleto ? (
                      <TimeCell value={displayRegDesc} missing={!displayRegDesc} />
                    ) : (
                      <>
                        <TimeCell value={dia.regresoDescanso} missing={!dia.regresoDescanso}
                          warn={dia.minutosDescansoExtra > 0} />
                        {dia.minutosDescansoExtra > 0 && (
                          <span className="ml-1 text-[10px] text-amber-500">+{dia.minutosDescansoExtra}m</span>
                        )}
                      </>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    {isIncompleto ? (
                      <>
                        <TimeCell value={displaySalida} missing={!displaySalida} />
                        {extrasBadge > 0 && (
                          <span className="ml-1 text-[10px] bg-blue-100 text-blue-600 px-1 py-0.5 rounded">
                            +{extrasBadge}
                          </span>
                        )}
                      </>
                    ) : (
                      <>
                        <TimeCell value={dia.salidaFinal} warn={salAnt} missing={!dia.salidaFinal} />
                        {dia.minutosSalidaAnticipada > 0 && (
                          <span className="ml-1 text-[10px] text-orange-500">-{dia.minutosSalidaAnticipada}m</span>
                        )}
                      </>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-xs font-mono">
                    {dia.horasExtrasMinutos > 0
                      ? <span className="text-green-600 font-semibold">+{minsToHHMM(dia.horasExtrasMinutos)}</span>
                      : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-3 py-2.5 text-gray-500 text-xs">
                    {dia.minutosJornada !== null && dia.minutosJornada > 0
                      ? minsToHHMM(dia.minutosJornada) : '—'}
                  </td>
                  <td className="px-3 py-2.5">
                    <EstadoBadge estado={dia.estado} tooltip={badgeTooltip} />
                  </td>
                  <td className="px-3 py-2.5 text-gray-400">
                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </td>
                </tr>
                {isExpanded && (
                  <tr className="bg-blue-50">
                    <td colSpan={9} className="px-4 py-3">
                      <RelojTimeline dia={dia} />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── ResumenTable ──────────────────────────────────────────────────────────────

type ResumenSortCol = 'nombre' | 'presencia' | 'tardanzas' | 'ausencias' | 'descExt' | 'salAnt' | 'extras' | 'puntualidad';
type ResumenFiltro  = 'todos' | 'con' | 'sin';

function ResumenTable({ empleados, onSelectEmployee }: {
  empleados: EmpleadoData[];
  onSelectEmployee?: (nombre: string) => void;
}) {
  const [search,  setSearch]  = useState('');
  const [filtro,  setFiltro]  = useState<ResumenFiltro>('todos');
  const [sortCol, setSortCol] = useState<ResumenSortCol>('nombre');
  const [sortAsc, setSortAsc] = useState(true);
  const [page,    setPage]    = useState(0);
  const PAGE_SIZE = 15;

  const hasIncidencia = (e: EmpleadoData) =>
    e.tardanzas > 0 || e.ausencias > 0 || e.descansosExtendidos > 0 ||
    e.salidasAnticipadas > 0 || e.diasIncompletos > 0;

  const filtered = useMemo(() => {
    let r = [...empleados];
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      r = r.filter(e => e.nombre.toLowerCase().includes(q));
    }
    if (filtro === 'con') r = r.filter(hasIncidencia);
    if (filtro === 'sin') r = r.filter(e => !hasIncidencia(e));

    r.sort((a, b) => {
      let diff = 0;
      switch (sortCol) {
        case 'nombre':      diff = a.nombre.localeCompare(b.nombre, 'es'); break;
        case 'presencia':   diff = (a.diasPresentes / Math.max(a.diasLaborables, 1)) - (b.diasPresentes / Math.max(b.diasLaborables, 1)); break;
        case 'tardanzas':   diff = a.tardanzas - b.tardanzas; break;
        case 'ausencias':   diff = a.ausencias - b.ausencias; break;
        case 'descExt':     diff = a.descansosExtendidos - b.descansosExtendidos; break;
        case 'salAnt':      diff = a.salidasAnticipadas - b.salidasAnticipadas; break;
        case 'extras':      diff = a.totalHorasExtrasMinutos - b.totalHorasExtrasMinutos; break;
        case 'puntualidad': diff = a.puntualidadPct - b.puntualidadPct; break;
      }
      return sortAsc ? diff : -diff;
    });
    return r;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empleados, search, filtro, sortCol, sortAsc]);

  const pageCount = Math.ceil(filtered.length / PAGE_SIZE);
  const pageData  = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const SortTh = ({ col, label }: { col: ResumenSortCol; label: string }) => (
    <th
      className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap cursor-pointer select-none hover:bg-blue-700 transition-colors"
      onClick={() => {
        if (sortCol === col) setSortAsc(v => !v);
        else { setSortCol(col); setSortAsc(true); }
        setPage(0);
      }}
    >
      {label}{sortCol === col ? (sortAsc ? ' ↑' : ' ↓') : ''}
    </th>
  );

  return (
    <div>
      <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-100 flex-wrap">
        <div className="relative flex-shrink-0" style={{ width: 210 }}>
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="search" value={search}
            onChange={e => { setSearch(e.target.value); setPage(0); }}
            placeholder="Buscar empleado..."
            className="w-full border border-gray-200 rounded-lg text-sm pl-8 pr-3 py-1.5 focus:outline-none focus:border-[#003DA5] focus:ring-1 focus:ring-[#003DA5]"
          />
        </div>
        <div className="flex gap-1">
          {(['todos', 'con', 'sin'] as ResumenFiltro[]).map(f => (
            <button key={f}
              onClick={() => { setFiltro(f); setPage(0); }}
              className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${
                filtro === f ? 'bg-[#003DA5] text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {f === 'todos' ? 'Todos' : f === 'con' ? 'Con incidencias' : 'Sin incidencias'}
            </button>
          ))}
        </div>
        <span className="ml-auto text-xs text-gray-400 flex-shrink-0">
          {filtered.length} persona{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#003DA5] text-white">
              <SortTh col="nombre"      label="Empleado" />
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap">Departamento</th>
              <SortTh col="presencia"   label="Presencia" />
              <SortTh col="tardanzas"   label="Tardanzas" />
              <SortTh col="ausencias"   label="Ausencias" />
              <SortTh col="descExt"     label="Desc. Ext." />
              <SortTh col="salAnt"      label="Sal. Anticip." />
              <SortTh col="extras"      label="Hrs Extras" />
              <SortTh col="puntualidad" label="Puntualidad %" />
            </tr>
          </thead>
          <tbody>
            {pageData.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-gray-400 text-sm">
                  Ningún empleado coincide con los filtros aplicados.
                </td>
              </tr>
            )}
            {pageData.map((emp, i) => {
              const inc = hasIncidencia(emp);
              return (
                <tr key={emp.nombre}
                  style={{ borderLeft: `3px solid ${inc ? '#dc2626' : '#16a34a'}` }}
                  className={`border-b border-gray-100 transition-colors ${
                    i % 2 === 0 ? 'bg-white' : 'bg-[#F0F5FF]'
                  } ${onSelectEmployee ? 'cursor-pointer hover:bg-blue-50' : ''}`}
                  onClick={() => onSelectEmployee?.(emp.nombre)}
                >
                  <td className="px-4 py-2.5 font-semibold text-gray-800">{emp.nombre}</td>
                  <td className="px-4 py-2.5">
                    <DepartamentoBadge depto={emp.horario.horarioPersona?.departamento} />
                  </td>
                  <td className="px-4 py-2.5 text-center text-gray-600">
                    {emp.diasPresentes}/{emp.diasLaborables}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <span className={`font-semibold ${emp.tardanzas > 5 ? 'text-red-700' : emp.tardanzas > 2 ? 'text-amber-700' : 'text-gray-700'}`}>
                      {emp.tardanzas}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <span className={emp.ausencias > 3 ? 'text-red-700 font-semibold' : emp.ausencias > 0 ? 'text-amber-700 font-semibold' : 'text-green-700'}>
                      {emp.ausencias}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-center text-gray-600">{emp.descansosExtendidos}</td>
                  <td className="px-4 py-2.5 text-center text-gray-600">{emp.salidasAnticipadas}</td>
                  <td className="px-4 py-2.5 text-center font-mono text-xs">
                    {emp.totalHorasExtrasMinutos > 0
                      ? <span style={{ color: '#28a745' }} className="font-semibold">{minsToHHMM(emp.totalHorasExtrasMinutos)}</span>
                      : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <span className={`font-semibold ${emp.puntualidadPct >= 90 ? 'text-green-700' : emp.puntualidadPct >= 75 ? 'text-amber-700' : 'text-red-700'}`}>
                      {emp.puntualidadPct}%
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {pageCount > 1 && (
        <div className="flex items-center justify-center gap-2 px-5 py-3 border-t border-gray-100">
          <button disabled={page === 0} onClick={() => setPage(p => p - 1)}
            className="px-3 py-1 text-xs border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">
            ← Anterior
          </button>
          <span className="text-xs text-gray-500">Pág. {page + 1} de {pageCount}</span>
          <button disabled={page >= pageCount - 1} onClick={() => setPage(p => p + 1)}
            className="px-3 py-1 text-xs border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">
            Siguiente →
          </button>
        </div>
      )}
    </div>
  );
}

// ─── ExtrasPanel ───────────────────────────────────────────────────────────────

function ExtrasModal({ emp, onClose }: { emp: EmpleadoData; onClose: () => void }) {
  const dias = Array.from(emp.dias.values())
    .filter(d => d.horasExtrasMinutos > 0)
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
  const expectedMins = parseHHMM(emp.horario.salidaEsperada) - parseHHMM(emp.horario.ingresoEsperado);

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-gray-900">{emp.nombre}</h2>
            <p className="text-xs text-gray-400">{dias.length} días con horas extras</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-gray-50">
              <tr className="border-b border-gray-200">
                {['Fecha', 'Día', 'Ingreso', 'Salida', 'Jornada real', 'Esperada', 'Extras'].map(h => (
                  <th key={h} className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dias.map(dia => (
                <tr key={dia.fecha} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-3 py-1.5 text-gray-700 whitespace-nowrap">{fmtFecha(dia.fecha)}</td>
                  <td className="px-3 py-1.5 text-gray-500">{DIAS_SEMANA_SHORT[new Date(dia.fecha + 'T12:00:00').getDay()]}</td>
                  <td className="px-3 py-1.5 font-mono text-gray-700">{dia.ingreso ?? '—'}</td>
                  <td className="px-3 py-1.5 font-mono text-gray-700">{dia.salidaFinal ?? '—'}</td>
                  <td className="px-3 py-1.5 font-mono text-gray-600">{dia.minutosJornada ? minsToHHMM(dia.minutosJornada) : '—'}</td>
                  <td className="px-3 py-1.5 font-mono text-gray-500">{minsToHHMM(expectedMins)}</td>
                  <td className="px-3 py-1.5 font-mono font-bold" style={{ color: '#28a745' }}>{fmtExtras(dia.horasExtrasMinutos)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ExtrasPanel({ empleados, onSelectEmployee }: {
  empleados: EmpleadoData[];
  onSelectEmployee?: (nombre: string) => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [modalEmp, setModalEmp] = useState<EmpleadoData | null>(null);

  const withExtras = empleados
    .filter(e => e.totalHorasExtrasMinutos > 0)
    .sort((a, b) => b.totalHorasExtrasMinutos - a.totalHorasExtrasMinutos);

  if (withExtras.length === 0) return null;

  return (
    <div>
      <div className="px-5 py-4 border-b border-gray-100">
        <h3 className="font-semibold text-gray-800 text-sm">Horas extras acumuladas</h3>
        <p className="text-[11px] text-gray-400 mt-0.5">
          {withExtras.length} persona{withExtras.length !== 1 ? 's' : ''} con horas extras · Hacé clic para ver el detalle por día
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              {['Empleado', 'Días con extras', 'Total acumulado', 'Promedio/día', ''].map(h => (
                <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {withExtras.map(emp => {
              const isExp = expanded === emp.nombre;
              const diasExtra = Array.from(emp.dias.values())
                .filter(d => d.horasExtrasMinutos > 0)
                .sort((a, b) => b.fecha.localeCompare(a.fecha));
              const expectedMins = parseHHMM(emp.horario.salidaEsperada) - parseHHMM(emp.horario.ingresoEsperado);
              const diasShown  = isExp ? diasExtra.slice(0, 10) : [];
              const hasMore    = diasExtra.length > 10;

              return (
                <Fragment key={emp.nombre}>
                  <tr
                    className={`border-b border-gray-100 cursor-pointer transition-colors ${isExp ? 'bg-green-50' : 'hover:bg-gray-50'}`}
                    onClick={() => setExpanded(isExp ? null : emp.nombre)}
                  >
                    <td className="px-4 py-2.5 font-semibold text-gray-800">{emp.nombre}</td>
                    <td className="px-4 py-2.5 text-center text-gray-600">{emp.diasConExtras}</td>
                    <td className="px-4 py-2.5 text-center">
                      <span style={{ color: '#28a745' }} className="font-bold font-mono text-sm">
                        {fmtExtras(emp.totalHorasExtrasMinutos)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-center font-mono text-xs text-gray-500">
                      {emp.diasConExtras > 0 ? fmtExtras(Math.round(emp.totalHorasExtrasMinutos / emp.diasConExtras)) : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-gray-400">
                      {isExp ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </td>
                  </tr>
                  {isExp && (
                    <tr className="bg-green-50">
                      <td colSpan={5} className="px-4 pb-3 pt-0">
                        <div className="mt-2 rounded-lg border border-green-200 overflow-hidden">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="bg-green-100">
                                {['Fecha', 'Día', 'Ingreso', 'Salida', 'Jornada real', 'Esperada', 'Extras'].map(h => (
                                  <th key={h} className="px-3 py-1.5 text-left text-[10px] font-semibold text-green-800 uppercase tracking-wide whitespace-nowrap">{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {diasShown.map(dia => (
                                <tr key={dia.fecha} className="border-t border-green-100 bg-white">
                                  <td className="px-3 py-1.5 text-gray-700 whitespace-nowrap">{fmtFecha(dia.fecha)}</td>
                                  <td className="px-3 py-1.5 text-gray-500">{DIAS_SEMANA_SHORT[new Date(dia.fecha + 'T12:00:00').getDay()]}</td>
                                  <td className="px-3 py-1.5 font-mono text-gray-700">{dia.ingreso ?? '—'}</td>
                                  <td className="px-3 py-1.5 font-mono text-gray-700">{dia.salidaFinal ?? '—'}</td>
                                  <td className="px-3 py-1.5 font-mono text-gray-600">{dia.minutosJornada ? minsToHHMM(dia.minutosJornada) : '—'}</td>
                                  <td className="px-3 py-1.5 font-mono text-gray-500">{minsToHHMM(expectedMins)}</td>
                                  <td className="px-3 py-1.5 font-mono font-bold" style={{ color: '#28a745' }}>{fmtExtras(dia.horasExtrasMinutos)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        {hasMore && (
                          <button
                            onClick={e => { e.stopPropagation(); setModalEmp(emp); }}
                            className="mt-2 text-xs text-[#003DA5] font-medium hover:underline"
                          >
                            Ver todos los días ({diasExtra.length}) →
                          </button>
                        )}
                        {onSelectEmployee && (
                          <button
                            onClick={e => { e.stopPropagation(); onSelectEmployee(emp.nombre); }}
                            className="mt-2 ml-4 text-xs text-gray-500 hover:text-[#003DA5] font-medium hover:underline"
                          >
                            Ver ficha individual →
                          </button>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      {modalEmp && <ExtrasModal emp={modalEmp} onClose={() => setModalEmp(null)} />}
    </div>
  );
}

// ─── DepartamentoBadge ────────────────────────────────────────────────────────

const DEPTO_COLORS: Record<string, string> = {
  'Call Fibra': '#003DA5',
  'Call Móvil': '#6f42c1',
  'RRHH':       '#28a745',
  'Atención':   '#20c997',
};

function DepartamentoBadge({ depto }: { depto?: string }) {
  if (!depto) return <span className="text-gray-300 text-xs">—</span>;
  const color = DEPTO_COLORS[depto] ?? '#6c757d';
  return (
    <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold text-white whitespace-nowrap"
      style={{ background: color }}>
      {depto}
    </span>
  );
}

// ─── SinHorarioCard ───────────────────────────────────────────────────────────

function SinHorarioCard({ empleados, onGuardar }: {
  empleados: EmpleadoData[];
  onGuardar: (emp: EmpleadoData) => void;
}) {
  const sinHorario = empleados.filter(e => e.horario.fuenteHorario === 'inferido');
  if (sinHorario.length === 0) return null;

  const [expandido, setExpandido] = useState(() => {
    try { return sessionStorage.getItem('elared_reloj_sinhorario_expandido') === 'true'; }
    catch { return false; }
  });

  const toggle = () => {
    const next = !expandido;
    setExpandido(next);
    try { sessionStorage.setItem('elared_reloj_sinhorario_expandido', String(next)); } catch {}
  };

  return (
    <div
      className="border border-orange-200 rounded-xl overflow-hidden"
      style={{ background: '#FFF8F0', borderLeft: '4px solid #fd7e14' }}
    >
      <div className="flex items-center gap-3 p-4 cursor-pointer select-none" onClick={toggle}>
        <AlertCircle size={18} className="text-orange-500 flex-shrink-0" />
        <div className="flex-1">
          <h3 className="font-semibold text-orange-800 text-sm">
            {sinHorario.length} persona{sinHorario.length !== 1 ? 's' : ''} sin horario oficial configurado
          </h3>
          <p className="text-xs text-orange-600 mt-0.5">
            Sus análisis usan horario inferido por mediana de marcaciones
          </p>
        </div>
        {expandido
          ? <ChevronUp size={16} className="text-orange-400 flex-shrink-0" />
          : <ChevronDown size={16} className="text-orange-400 flex-shrink-0" />
        }
      </div>
      {expandido && (
        <div className="px-4 pb-4 space-y-2">
          {sinHorario.map(emp => (
            <div key={emp.nombre} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-orange-100">
              <div>
                <span className="text-sm font-medium text-gray-800">{emp.nombre}</span>
                <span className="ml-2 text-xs text-gray-400">
                  inferido: {emp.horario.ingresoEsperado}–{emp.horario.salidaEsperada}
                </span>
              </div>
              <button
                onClick={e => { e.stopPropagation(); onGuardar(emp); }}
                className="text-xs text-[#003DA5] font-medium hover:bg-blue-50 px-2 py-1 rounded transition-colors flex-shrink-0"
              >
                Guardar horario
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── HorarioCustomModal ───────────────────────────────────────────────────────

function HorarioCustomModal({ emp, onSave, onClose }: {
  emp: EmpleadoData;
  onSave: (horario: HorarioPersona) => void;
  onClose: () => void;
}) {
  const [lunMie, setLunMie] = useState<HorarioDia>({ ingreso: emp.horario.ingresoEsperado, salida: emp.horario.salidaEsperada, trabaja: true });
  const [jueVie, setJueVie] = useState<HorarioDia>({ ingreso: emp.horario.ingresoEsperado, salida: emp.horario.salidaEsperada, trabaja: true });
  const [sab,    setSab]    = useState<HorarioDia>({ ingreso: '10:00', salida: '14:00', trabaja: false });
  const [dom,    setDom]    = useState<HorarioDia>({ ingreso: '10:00', salida: '14:00', trabaja: false });
  const [mismoLunMie, setMismoLunMie] = useState(true);
  const [departamento, setDepartamento] = useState(emp.horario.horarioPersona?.departamento ?? '');

  const jueVieEfectivo: HorarioDia = mismoLunMie ? { ...lunMie } : jueVie;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSave({
      nombre: emp.nombre,
      lunesAMiercoles: lunMie,
      jueveYViernes: jueVieEfectivo,
      sabado: sab,
      domingo: dom,
      departamento: departamento.trim() || undefined,
    });
    onClose();
  }

  function TurnoRow({ label, val, setVal, locked = false }: {
    label: string; val: HorarioDia; setVal?: (v: HorarioDia) => void; locked?: boolean;
  }) {
    const disabled = locked || !val.trabaja;
    const inputCls = `border rounded px-2 py-1 text-xs focus:outline-none focus:border-[#003DA5] ${
      disabled ? 'border-gray-100 text-gray-300 bg-gray-50 cursor-not-allowed' : 'border-gray-200'
    }`;
    return (
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-xs font-medium text-gray-600 w-20 flex-shrink-0">{label}</span>
        <label className={`flex items-center gap-1.5 text-xs cursor-pointer ${locked ? 'text-gray-300' : 'text-gray-500'}`}>
          <input type="checkbox" checked={val.trabaja} disabled={locked}
            onChange={e => setVal?.({ ...val, trabaja: e.target.checked })}
            className="accent-[#003DA5]" />
          Trabaja
        </label>
        <input type="time" value={val.ingreso} disabled={disabled}
          onChange={e => setVal?.({ ...val, ingreso: e.target.value })}
          className={inputCls} />
        <span className={`text-xs ${disabled ? 'text-gray-300' : 'text-gray-400'}`}>a</span>
        <input type="time" value={val.salida} disabled={disabled}
          onChange={e => setVal?.({ ...val, salida: e.target.value })}
          className={inputCls} />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <h2 className="font-bold text-gray-900 text-lg mb-1">Guardar horario de {emp.nombre}</h2>
        <p className="text-xs text-gray-400 mb-4">Confirmá o ajustá el horario inferido. Se guardará localmente.</p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <TurnoRow label="Lun – Mié" val={lunMie} setVal={setLunMie} />
          <div>
            <TurnoRow label="Jue – Vie" val={jueVieEfectivo} setVal={mismoLunMie ? undefined : setJueVie} locked={mismoLunMie} />
            <label className="flex items-center gap-2 mt-1 ml-[92px] text-xs text-gray-400 cursor-pointer">
              <input type="checkbox" checked={mismoLunMie}
                onChange={e => setMismoLunMie(e.target.checked)}
                className="accent-[#003DA5]" />
              Mismo que Lun – Mié
            </label>
          </div>
          <TurnoRow label="Sábado"  val={sab} setVal={setSab} />
          <TurnoRow label="Domingo" val={dom} setVal={setDom} />
          <div className="pt-2 border-t border-gray-100">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1">Departamento</label>
            <input
              type="text"
              value={departamento}
              onChange={e => setDepartamento(e.target.value)}
              list="depto-options"
              placeholder="Ej: Call Fibra, Call Móvil, RRHH…"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#003DA5] focus:ring-1 focus:ring-[#003DA5]"
            />
            <datalist id="depto-options">
              <option value="Call Fibra" />
              <option value="Call Móvil" />
              <option value="RRHH" />
              <option value="Atención" />
            </datalist>
          </div>
          <div className="flex gap-2 pt-3 border-t border-gray-100">
            <button type="button" onClick={onClose}
              className="flex-1 border border-gray-300 rounded-lg py-2 text-sm text-gray-700 hover:bg-gray-50">
              Cancelar
            </button>
            <button type="submit"
              className="flex-1 bg-[#003DA5] text-white rounded-lg py-2 text-sm font-semibold hover:bg-blue-800 flex items-center justify-center gap-2">
              <Check size={15} /> Guardar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Filter types & constants ──────────────────────────────────────────────────

type IncidenciaFiltro = 'all' | 'tardanzas' | 'ausencias' | 'any' | 'none';
type SortBy = 'nombre' | 'tardanzas' | 'ausencias' | 'puntualidad' | 'presencias';

const ALL_ESTADOS_FILTER: EstadoDia[] = [
  'OK', 'TARDANZA', 'TARDANZA_GRAVE', 'DESCANSO_EXTENDIDO',
  'SALIDA_ANTICIPADA', 'DATO_INCOMPLETO', 'AUSENTE',
];

const ESTADO_FILTER_LABEL: Record<string, string> = {
  OK: 'OK',
  TARDANZA: 'Tardanza',
  TARDANZA_GRAVE: 'Tardanza Grave',
  DESCANSO_EXTENDIDO: 'Desc. Extendido',
  SALIDA_ANTICIPADA: 'Salida Anticipada',
  DATO_INCOMPLETO: 'Incompleto',
  AUSENTE: 'Ausente',
};

const SORT_LABELS: Record<string, string> = {
  tardanzas: 'Tardanzas', ausencias: 'Ausencias',
  puntualidad: 'Puntualidad', presencias: 'Presencias',
};

const INCIDENCIA_ACTIVE_LABEL: Record<string, string> = {
  tardanzas: 'Con tardanzas',
  ausencias: 'Con ausencias',
  any: 'Con incidencias',
  none: 'Sin incidencias',
};

// ─── FilterBar ─────────────────────────────────────────────────────────────────

interface FilterBarProps {
  searchQuery: string;
  onSearchChange: (v: string) => void;
  estadoFiltros: Set<EstadoDia>;
  onEstadoChange: (s: Set<EstadoDia>) => void;
  incidenciaFiltro: IncidenciaFiltro;
  onIncidenciaChange: (v: IncidenciaFiltro) => void;
  sortBy: SortBy;
  onSortByChange: (v: SortBy) => void;
  departamentoFiltro: string | null;
  onDepartamentoChange: (v: string | null) => void;
  availableDepartamentos: string[];
  total: number;
  filtered: number;
  onClear: () => void;
}

function FilterBar({
  searchQuery, onSearchChange,
  estadoFiltros, onEstadoChange,
  incidenciaFiltro, onIncidenciaChange,
  sortBy, onSortByChange,
  departamentoFiltro, onDepartamentoChange, availableDepartamentos,
  total, filtered, onClear,
}: FilterBarProps) {
  type OpenPanel = 'estado' | 'incidencia' | 'ordenar' | 'depto' | null;
  const [open, setOpen] = useState<OpenPanel>(null);
  const [pendingEstado, setPendingEstado] = useState<Set<EstadoDia>>(new Set(estadoFiltros));

  const toggle = (name: Exclude<OpenPanel, null>) => {
    if (open === name) { setOpen(null); return; }
    if (name === 'estado') setPendingEstado(new Set(estadoFiltros));
    setOpen(name);
  };

  const estadoIsActive    = estadoFiltros.size < ALL_ESTADOS_FILTER.length;
  const incidenciaIsActive = incidenciaFiltro !== 'all';
  const sortIsActive      = sortBy !== 'nombre';
  const deptoIsActive     = departamentoFiltro !== null;
  const hasFilters = searchQuery.trim() !== '' || estadoIsActive || incidenciaIsActive || sortIsActive || deptoIsActive;

  const panelStyle: React.CSSProperties = {
    boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
    animation: 'dropdownIn 150ms ease-out',
  };

  const btnCls = (active: boolean) =>
    `flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-colors flex-shrink-0 ${
      active
        ? 'bg-[#003DA5] text-white border-[#003DA5]'
        : 'text-gray-700 border-[#E2E8F0] hover:bg-gray-50'
    }`;

  const chevron = (panel: Exclude<OpenPanel, null>) => (
    <ChevronDown size={13} className={`transition-transform duration-150 ${open === panel ? 'rotate-180' : ''}`} />
  );

  const INCIDENCIA_OPTS: [IncidenciaFiltro, string][] = [
    ['all',      'Todas las personas'],
    ['tardanzas','Solo con tardanzas'],
    ['ausencias','Solo con ausencias'],
    ['any',      'Solo con cualquier incidencia'],
    ['none',     'Sin ninguna incidencia (puntualidad perfecta)'],
  ];

  const SORT_OPTS: [SortBy, string][] = [
    ['nombre',     'Nombre A–Z'],
    ['tardanzas',  'Tardanzas (mayor primero)'],
    ['ausencias',  'Ausencias (mayor primero)'],
    ['puntualidad','Puntualidad (menor primero)'],
    ['presencias', 'Presencias (menor primero)'],
  ];

  return (
    <div className="bg-white rounded-xl border border-gray-200 px-3 py-2.5 flex items-center gap-2 flex-wrap">

      {/* Buscador */}
      <div className="relative flex-shrink-0" style={{ width: 200 }}>
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        <input
          type="search"
          value={searchQuery}
          onChange={e => onSearchChange(e.target.value)}
          placeholder="Buscar persona..."
          className="w-full border border-[#E2E8F0] rounded-lg text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:border-[#003DA5] focus:ring-1 focus:ring-[#003DA5]"
          style={{ padding: '8px 12px 8px 36px' }}
        />
      </div>

      {/* Estado */}
      <div className="relative flex-shrink-0">
        <button onClick={() => toggle('estado')} className={btnCls(estadoIsActive)}>
          {estadoIsActive ? `Estado: ${estadoFiltros.size}` : 'Estado: Todos'}
          {chevron('estado')}
        </button>
        {open === 'estado' && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(null)} />
            <div
              className="absolute top-full mt-1.5 left-0 z-50 bg-white border border-[#E2E8F0] rounded-lg p-3"
              style={{ minWidth: 200, ...panelStyle }}
            >
              <div className="space-y-1.5 mb-3">
                {ALL_ESTADOS_FILTER.map(estado => (
                  <label key={estado} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 rounded px-1.5 py-0.5">
                    <input
                      type="checkbox"
                      checked={pendingEstado.has(estado)}
                      onChange={e => {
                        const next = new Set(pendingEstado);
                        e.target.checked ? next.add(estado) : next.delete(estado);
                        setPendingEstado(next);
                      }}
                      className="accent-[#003DA5]"
                    />
                    <span className="text-sm text-gray-700">{ESTADO_FILTER_LABEL[estado]}</span>
                  </label>
                ))}
              </div>
              <div className="flex gap-2 border-t border-gray-100 pt-2">
                <button
                  onClick={() => { onEstadoChange(new Set(ALL_ESTADOS_FILTER)); setOpen(null); }}
                  className="flex-1 text-xs text-gray-500 hover:text-gray-700 py-1.5 rounded border border-gray-200 hover:bg-gray-50"
                >
                  Limpiar
                </button>
                <button
                  onClick={() => { onEstadoChange(new Set(pendingEstado)); setOpen(null); }}
                  className="flex-1 text-xs bg-[#003DA5] text-white py-1.5 rounded hover:bg-blue-800 font-medium"
                >
                  Aplicar
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Incidencias */}
      <div className="relative flex-shrink-0">
        <button onClick={() => toggle('incidencia')} className={btnCls(incidenciaIsActive)}>
          {incidenciaIsActive ? INCIDENCIA_ACTIVE_LABEL[incidenciaFiltro] : 'Incidencias: Todas'}
          {chevron('incidencia')}
        </button>
        {open === 'incidencia' && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(null)} />
            <div
              className="absolute top-full mt-1.5 left-0 z-50 bg-white border border-[#E2E8F0] rounded-lg p-3"
              style={{ minWidth: 240, ...panelStyle }}
            >
              {INCIDENCIA_OPTS.map(([value, label]) => (
                <label key={value} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 rounded px-1.5 py-1.5">
                  <input
                    type="radio" name="incidencia-filter" value={value}
                    checked={incidenciaFiltro === value}
                    onChange={() => { onIncidenciaChange(value); setOpen(null); }}
                    className="accent-[#003DA5]"
                  />
                  <span className="text-sm text-gray-700">{label}</span>
                </label>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Ordenar */}
      <div className="relative flex-shrink-0">
        <button onClick={() => toggle('ordenar')} className={btnCls(sortIsActive)}>
          {sortIsActive ? `Ordenar: ${SORT_LABELS[sortBy]}` : 'Ordenar: Nombre'}
          {chevron('ordenar')}
        </button>
        {open === 'ordenar' && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(null)} />
            <div
              className="absolute top-full mt-1.5 left-0 z-50 bg-white border border-[#E2E8F0] rounded-lg p-3"
              style={{ minWidth: 230, ...panelStyle }}
            >
              {SORT_OPTS.map(([value, label]) => (
                <label key={value} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 rounded px-1.5 py-1.5">
                  <input
                    type="radio" name="sortby-filter" value={value}
                    checked={sortBy === value}
                    onChange={() => { onSortByChange(value); setOpen(null); }}
                    className="accent-[#003DA5]"
                  />
                  <span className="text-sm text-gray-700">{label}</span>
                </label>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Departamento */}
      {availableDepartamentos.length > 0 && (
        <div className="relative flex-shrink-0">
          <button onClick={() => toggle('depto')} className={btnCls(deptoIsActive)}>
            {deptoIsActive ? departamentoFiltro : 'Departamento: Todos'}
            {chevron('depto')}
          </button>
          {open === 'depto' && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setOpen(null)} />
              <div
                className="absolute top-full mt-1.5 left-0 z-50 bg-white border border-[#E2E8F0] rounded-lg p-3"
                style={{ minWidth: 200, ...panelStyle }}
              >
                <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 rounded px-1.5 py-1.5">
                  <input type="radio" name="depto-filter" value=""
                    checked={departamentoFiltro === null}
                    onChange={() => { onDepartamentoChange(null); setOpen(null); }}
                    className="accent-[#003DA5]"
                  />
                  <span className="text-sm text-gray-700">Todos los departamentos</span>
                </label>
                {availableDepartamentos.map(d => (
                  <label key={d} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 rounded px-1.5 py-1.5">
                    <input type="radio" name="depto-filter" value={d}
                      checked={departamentoFiltro === d}
                      onChange={() => { onDepartamentoChange(d); setOpen(null); }}
                      className="accent-[#003DA5]"
                    />
                    <DepartamentoBadge depto={d} />
                  </label>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Limpiar todos */}
      {hasFilters && (
        <button
          onClick={onClear}
          className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-700 px-2.5 py-2 rounded-lg hover:bg-red-50 transition-colors flex-shrink-0"
        >
          <XCircle size={13} /> Limpiar filtros
        </button>
      )}

      {/* Contador */}
      <div className="ml-auto text-[13px] text-gray-500 flex-shrink-0">
        Mostrando{' '}
        {filtered < total
          ? <><span className="text-[#003DA5] font-bold">{filtered}</span> de {total}</>
          : total
        }{' '}
        persona{total !== 1 ? 's' : ''}
      </div>
    </div>
  );
}

// ─── Individual view ───────────────────────────────────────────────────────────

function IndividualView({ emp, onEditHorario }: {
  emp: EmpleadoData;
  onEditHorario: () => void;
}) {
  const presenciaPct = emp.diasLaborables > 0
    ? Math.round((emp.diasPresentes / emp.diasLaborables) * 100) : 0;
  return (
    <div id={`reloj-persona-${emp.nombre.replace(/\s+/g, '-')}`} className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <KPICard
          label="Presencias"
          value={`${emp.diasPresentes} / ${emp.diasLaborables}`}
          sub={`${presenciaPct}% de asistencia`}
          icon={Calendar}
          color={presenciaPct >= 90 ? 'green' : presenciaPct >= 75 ? 'amber' : 'red'}
        />
        <KPICard
          label="Tardanzas"
          value={emp.tardanzas}
          sub={emp.minutosTardanzaTotal > 0 ? `${minsToHHMM(emp.minutosTardanzaTotal)} acumulados` : 'ninguna'}
          icon={AlertCircle}
          color={emp.tardanzas === 0 ? 'green' : emp.tardanzas <= 3 ? 'amber' : 'red'}
        />
        <KPICard
          label="Desc. extendidos"
          value={emp.descansosExtendidos}
          sub={emp.salidasAnticipadas > 0 ? `${emp.salidasAnticipadas} sal. anticipadas` : 'ninguna salida anticipada'}
          icon={Clock}
          color={emp.descansosExtendidos === 0 ? 'green' : 'amber'}
        />
        <KPICard
          label="Jornada promedio"
          value={emp.jornadaPromedioMinutos > 0 ? minsToHHMM(emp.jornadaPromedioMinutos) : '—'}
          sub={`Esperada: ${minsToHHMM(parseHHMM(emp.horario.salidaEsperada) - parseHHMM(emp.horario.ingresoEsperado))}`}
          icon={Users}
          color="blue"
        />
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col" style={{ borderTop: '3px solid #28a745' }}>
          <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Hrs extras</div>
          {emp.totalHorasExtrasMinutos > 0 ? (
            <div className="text-2xl font-bold" style={{ color: '#28a745' }}>
              {minsToHHMM(emp.totalHorasExtrasMinutos).replace(':', 'h ') + 'min'}
            </div>
          ) : (
            <div className="text-2xl font-bold text-gray-300">0 extras</div>
          )}
          <div className="text-[11px] text-gray-400 mt-1">
            en {emp.diasConExtras} día{emp.diasConExtras !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* Departamento */}
      {emp.horario.horarioPersona?.departamento && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 font-medium">Departamento:</span>
          <DepartamentoBadge depto={emp.horario.horarioPersona.departamento} />
        </div>
      )}

      {/* Horario card */}
      <HorarioCard emp={emp} onEdit={onEditHorario} />

      {/* Calendar */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="font-semibold text-gray-800 mb-4 text-sm">Calendario de asistencia</h3>
        <RelojCalendar dias={emp.dias} fechaMin={emp.fechaMin} fechaMax={emp.fechaMax} horario={emp.horario} />
      </div>

      {/* Day detail table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800 text-sm">Detalle por día</h3>
          <p className="text-[11px] text-gray-400 mt-0.5">Hacé clic en una fila para ver la línea de tiempo del día</p>
        </div>
        <DiaTable emp={emp} />
      </div>

      {/* Ingreso evolution chart */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <IngresosLineChart empleado={emp} />
      </div>

      {/* Jornada evolution chart */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <JornadaLineChart empleado={emp} />
      </div>
    </div>
  );
}

// ─── Comparative view ──────────────────────────────────────────────────────────

function ComparativaView({ empleados, fechaMin, fechaMax, onSelectEmployee }: {
  empleados: EmpleadoData[];
  fechaMin: string;
  fechaMax: string;
  onSelectEmployee?: (nombre: string) => void;
}) {
  return (
    <div className="space-y-5">
      {/* Tabla resumen */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800 text-sm">Resumen comparativo</h3>
          {onSelectEmployee && (
            <p className="text-[11px] text-gray-400 mt-0.5">Hacé clic en una fila para ver el detalle individual</p>
          )}
        </div>
        <ResumenTable empleados={empleados} onSelectEmployee={onSelectEmployee} />
      </div>

      {empleados.length > 0 && (
        <>
          {/* Panel de horas extras */}
          {empleados.some(e => e.totalHorasExtrasMinutos > 0) && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <ExtrasPanel empleados={empleados} onSelectEmployee={onSelectEmployee} />
            </div>
          )}

          {/* Mapa de calor */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <HeatmapChart empleados={empleados} fechaMin={fechaMin} fechaMax={fechaMax} />
          </div>
        </>
      )}
    </div>
  );
}

// ─── Main module ───────────────────────────────────────────────────────────────

type Stage = 'upload' | 'loading' | 'analysis';

const DEFAULT_ESTADO_FILTROS = new Set<EstadoDia>(ALL_ESTADOS_FILTER);

export default function RelojModule() {
  const { config } = useConfig();
  const { reloj: storeEntry, setReloj: saveToStore, clearReloj } = useAnalisisStore();

  const [stage, setStage]               = useState<Stage>(() => storeEntry ? 'analysis' : 'upload');
  const [error, setError]               = useState('');
  const [data, setData]                 = useState<RelojData | null>(() => storeEntry?.data ?? null);
  const [empleados, setEmpleados]       = useState<EmpleadoData[]>(() => storeEntry?.empleados ?? []);
  const [selected, setSelected]         = useState<string>('ALL');
  const [editingEmp, setEditingEmp]     = useState<string | null>(null);
  const [exportingPptx, setExportingPptx]       = useState(false);
  const [showPDFModal, setShowPDFModal]         = useState(false);
  const [customHorarioModal, setCustomHorarioModal] = useState<EmpleadoData | null>(null);

  // Filter state
  const [searchQuery, setSearchQuery]           = useState('');
  const [estadoFiltros, setEstadoFiltros]       = useState<Set<EstadoDia>>(DEFAULT_ESTADO_FILTROS);
  const [incidenciaFiltro, setIncidenciaFiltro] = useState<IncidenciaFiltro>('all');
  const [sortBy, setSortBy]                     = useState<SortBy>('nombre');
  const [departamentoFiltro, setDepartamentoFiltro] = useState<string | null>(null);

  const resetFilters = () => {
    setSearchQuery('');
    setEstadoFiltros(new Set(ALL_ESTADOS_FILTER));
    setIncidenciaFiltro('all');
    setSortBy('nombre');
    setDepartamentoFiltro(null);
  };

  const availableDepartamentos = useMemo(() => {
    const depts = new Set<string>();
    empleados.forEach(e => {
      const d = e.horario.horarioPersona?.departamento;
      if (d) depts.add(d);
    });
    return Array.from(depts).sort();
  }, [empleados]);

  const empleadosFiltrados = useMemo(() => {
    let result = [...empleados];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(e => e.nombre.toLowerCase().includes(q));
    }

    if (estadoFiltros.size < ALL_ESTADOS_FILTER.length) {
      result = result.filter(emp =>
        Array.from(emp.dias.values()).some(d => estadoFiltros.has(d.estado))
      );
    }

    switch (incidenciaFiltro) {
      case 'tardanzas': result = result.filter(e => e.tardanzas > 0); break;
      case 'ausencias': result = result.filter(e => e.ausencias > 0); break;
      case 'any':       result = result.filter(e =>
        e.tardanzas > 0 || e.ausencias > 0 || e.descansosExtendidos > 0 ||
        e.salidasAnticipadas > 0 || e.diasIncompletos > 0
      ); break;
      case 'none':      result = result.filter(e =>
        e.tardanzas === 0 && e.ausencias === 0 &&
        e.descansosExtendidos === 0 && e.salidasAnticipadas === 0
      ); break;
    }

    if (departamentoFiltro) {
      result = result.filter(e => e.horario.horarioPersona?.departamento === departamentoFiltro);
    }

    switch (sortBy) {
      case 'tardanzas':   result.sort((a, b) => b.tardanzas - a.tardanzas   || a.nombre.localeCompare(b.nombre, 'es')); break;
      case 'ausencias':   result.sort((a, b) => b.ausencias - a.ausencias   || a.nombre.localeCompare(b.nombre, 'es')); break;
      case 'puntualidad': result.sort((a, b) => a.puntualidadPct - b.puntualidadPct || a.nombre.localeCompare(b.nombre, 'es')); break;
      case 'presencias':  result.sort((a, b) => a.diasPresentes - b.diasPresentes   || a.nombre.localeCompare(b.nombre, 'es')); break;
    }

    return result;
  }, [empleados, searchQuery, estadoFiltros, incidenciaFiltro, sortBy, departamentoFiltro]);

  const handleFile = useCallback(async (file: File) => {
    setError('');
    setStage('loading');
    try {
      const parsed = await parseReloj(file);
      setData(parsed);
      setEmpleados(parsed.empleados);
      setSelected('ALL');
      resetFilters();
      recordActivity('reloj', file.name);
      saveToStore({ data: parsed, empleados: parsed.empleados, nombreArchivo: file.name });
      setStage('analysis');
    } catch (e) {
      setError((e as Error).message);
      setStage('upload');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveToStore]);

  const reset = () => {
    clearReloj();
    setStage('upload'); setData(null); setEmpleados([]); setError('');
    setSelected('ALL'); resetFilters();
  };

  const handleExportExcel = useCallback(() => {
    if (!data) return;
    exportRelojExcel({ ...data, empleados });
  }, [data, empleados]);

  const handleExportPPTX = useCallback(async () => {
    if (!data) return;
    setExportingPptx(true);
    try { await exportRelojPPTX({ ...data, empleados }, config.nombreEmpresa); } finally { setExportingPptx(false); }
  }, [data, empleados, config]);

  const handleSaveHorario = useCallback((empNombre: string, newHorario: HorarioEsperado) => {
    setEmpleados(prev => {
      const updated = prev.map(e => {
        if (e.nombre !== empNombre) return e;
        const newDias = new Map(Array.from(e.dias.entries()).map(([k, v]) => [
          k, { ...v, marcaciones: v.marcaciones.map(m => ({ ...m })) },
        ]));
        const metricas = calcularMetricas(newDias, newHorario);
        return { ...e, dias: newDias, horario: newHorario, ...metricas };
      });
      if (data) saveToStore({ data, empleados: updated, nombreArchivo: storeEntry?.nombreArchivo ?? '' });
      return updated;
    });
  }, [data, saveToStore, storeEntry?.nombreArchivo]);

  const handleGuardarHorarioCustom = useCallback((emp: EmpleadoData, horario: HorarioPersona) => {
    guardarHorarioCustom(horario);
    const repr = horario.lunesAMiercoles.trabaja ? horario.lunesAMiercoles : horario.jueveYViernes;
    handleSaveHorario(emp.nombre, {
      ingresoEsperado: repr.ingreso,
      salidaEsperada: repr.salida,
      descansoSalida: '13:00',
      descansoRegreso: '14:00',
      duracionDescansoMinutos: 60,
      toleranciaIngreso: 10,
      diasConDatosCompletos: 0,
      fuenteHorario: 'horario_custom',
      nombreEnConfig: horario.nombre,
      horarioPersona: horario,
    });
  }, [handleSaveHorario]);

  const selectedEmp = empleados.find(e => e.nombre === selected) ?? null;

  const subtitle = useMemo(() => {
    if (!data) return 'Análisis de fichaje y asistencia';
    const base = `${data.empleados.length} persona${data.empleados.length !== 1 ? 's' : ''} · ${data.totalMarcaciones.toLocaleString()} marcaciones · ${fmtFechaLong(data.fechaMin)} – ${fmtFechaLong(data.fechaMax)}`;
    return storeEntry ? `${base} · ${storeEntry.nombreArchivo} · ${formatFechaCarga(storeEntry.fechaCarga)}` : base;
  }, [data, storeEntry]);

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Módulo Reloj"
        subtitle={subtitle}
        actions={
          stage === 'analysis' && data ? (
            <div className="flex gap-2">
              <button onClick={reset}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                Cargar otro
              </button>
              <button
                onClick={handleExportPPTX}
                disabled={exportingPptx}
                className="flex items-center gap-2 px-4 py-1.5 text-sm text-white rounded-lg hover:opacity-90 disabled:opacity-50 transition-colors"
                style={{ background: '#C43B1C' }}>
                <Download size={14} />
                {exportingPptx ? 'Generando…' : 'PowerPoint'}
              </button>
              <button onClick={handleExportExcel}
                className="flex items-center gap-2 px-4 py-1.5 text-sm text-white rounded-lg hover:opacity-90 transition-colors"
                style={{ background: '#1D6F42' }}>
                <Download size={14} />
                Excel
              </button>
              <button
                onClick={() => setShowPDFModal(true)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-white rounded-lg hover:opacity-90 transition-colors"
                style={{ background: '#E3000F' }}>
                <FileText size={14} />
                PDF
              </button>
            </div>
          ) : null
        }
      />

      <div className="flex-1 overflow-y-auto p-6">

        {/* ── UPLOAD ── */}
        {stage === 'upload' && (
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-8">
              <div className="inline-flex bg-blue-50 rounded-full p-4 mb-4">
                <Clock size={36} className="text-[#003DA5]" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Análisis de fichaje</h2>
              <p className="text-gray-500 mt-2 text-sm max-w-md mx-auto">
                Cargá el reporte de marcaciones exportado del sistema de control de acceso.
                El sistema detecta automáticamente el horario de cada persona.
              </p>
            </div>
            {error && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-start gap-3">
                <XCircle size={16} className="flex-shrink-0 mt-0.5" />
                {error}
              </div>
            )}
            <FileUploader
              onFile={handleFile}
              label='Arrastrá el "Reporte de Marcaciones" aquí'
              sublabel="Formato: Excel con columnas Id del Empleado, Nombres, Fecha, Hora"
            />
            <div className="mt-5 bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3">
              <Info size={16} className="text-[#003DA5] flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800">
                <strong>Formato esperado:</strong> El archivo debe tener una fila de título en la fila 1,
                los encabezados en la fila 2 (Id del Empleado, Nombres, Departamento, Fecha, Hora, Tipo de Marcación…)
                y los datos desde la fila 3 en adelante.
              </div>
            </div>
          </div>
        )}

        {/* ── LOADING ── */}
        {stage === 'loading' && (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <Loader2 size={36} className="animate-spin text-[#003DA5] mx-auto mb-3" />
              <p className="text-gray-500">Procesando marcaciones…</p>
            </div>
          </div>
        )}

        {/* ── ANALYSIS ── */}
        {stage === 'analysis' && data && (
          <div id="reloj-content" className="space-y-5">

            {/* Personas sin horario oficial */}
            {empleados.some(e => e.horario.fuenteHorario === 'inferido') && (
              <SinHorarioCard
                empleados={empleados}
                onGuardar={setCustomHorarioModal}
              />
            )}

            {/* Filter bar — solo en vista comparativa */}
            {selected === 'ALL' && (
              <FilterBar
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                estadoFiltros={estadoFiltros}
                onEstadoChange={setEstadoFiltros}
                incidenciaFiltro={incidenciaFiltro}
                onIncidenciaChange={setIncidenciaFiltro}
                sortBy={sortBy}
                onSortByChange={setSortBy}
                departamentoFiltro={departamentoFiltro}
                onDepartamentoChange={setDepartamentoFiltro}
                availableDepartamentos={availableDepartamentos}
                total={empleados.length}
                filtered={empleadosFiltrados.length}
                onClear={resetFilters}
              />
            )}

            {/* Back button — solo en vista individual */}
            {selected !== 'ALL' && (
              <button
                onClick={() => setSelected('ALL')}
                className="flex items-center gap-1.5 text-sm text-[#003DA5] hover:text-blue-800 font-medium transition-colors"
              >
                <ArrowLeft size={15} /> Volver al listado
              </button>
            )}

            {/* Vista individual */}
            {selected !== 'ALL' && selectedEmp && (
              <IndividualView
                emp={selectedEmp}
                onEditHorario={() => setEditingEmp(selectedEmp.nombre)}
              />
            )}

            {/* Vista comparativa */}
            {selected === 'ALL' && (
              <ComparativaView
                empleados={empleadosFiltrados}
                fechaMin={data.fechaMin}
                fechaMax={data.fechaMax}
                onSelectEmployee={setSelected}
              />
            )}
          </div>
        )}
      </div>

      {/* Horario edit modal */}
      {editingEmp && selectedEmp && editingEmp === selectedEmp.nombre && (
        <HorarioModal
          emp={selectedEmp}
          onSave={h => handleSaveHorario(selectedEmp.nombre, h)}
          onClose={() => setEditingEmp(null)}
        />
      )}
      {customHorarioModal && (
        <HorarioCustomModal
          emp={customHorarioModal}
          onSave={horario => { handleGuardarHorarioCustom(customHorarioModal, horario); setCustomHorarioModal(null); }}
          onClose={() => setCustomHorarioModal(null)}
        />
      )}
      {showPDFModal && (
        <PDFModal
          elementId="reloj-content"
          titulo="Reloj de Personal"
          nombreArchivo={`Reloj_${new Date().toLocaleDateString('es-UY').replace(/\//g, '-')}`}
          onClose={() => setShowPDFModal(false)}
          personaElementId={selected !== 'ALL' && selectedEmp ? `reloj-persona-${selectedEmp.nombre.replace(/\s+/g, '-')}` : undefined}
          personaNombre={selected !== 'ALL' ? selected : undefined}
        />
      )}
    </div>
  );
}
