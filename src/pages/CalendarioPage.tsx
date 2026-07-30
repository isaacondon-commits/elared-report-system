import { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import {
  ChevronLeft, ChevronRight, School, Download,
  CalendarDays, ListTodo,
} from 'lucide-react';
import {
  addMonths, addWeeks, startOfMonth, endOfMonth, startOfWeek, endOfWeek, format,
} from 'date-fns';
import { es } from 'date-fns/locale';
import Header from '../components/Header';
import { useAuthContext } from '../contexts/AuthContext';
import {
  useCalendario, eliminarEvento, TIPO_LABELS, CALENDARIO_LABELS,
  type EventoCalendario,
} from '../hooks/useCalendario';
import CalendarioMensual from '../components/calendario/CalendarioMensual';
import CalendarioSemanal from '../components/calendario/CalendarioSemanal';
import EventoModal from '../components/calendario/EventoModal';
import DetalleDia from '../components/calendario/DetalleDia';

// ── Modal state ────────────────────────────────────────────────────────────────

type ModalState =
  | { mode: 'crear'; fecha: string }
  | { mode: 'editar'; evento: EventoCalendario }
  | null;

// ── Exportar Excel ────────────────────────────────────────────────────────────

function exportarMes(eventosSala: EventoCalendario[], monthDate: Date) {
  const rows = eventosSala.map(e => ({
    Fecha: e.fecha,
    Tipo: TIPO_LABELS[e.tipo],
    Título: e.titulo,
    Descripción: e.descripcion ?? '',
    'Creado por': e.creadoPorNombre,
  }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Sala de Capacitacion');
  XLSX.writeFile(wb, `Calendario_Sala_${format(monthDate, 'yyyy-MM')}.xlsx`);
}

// ── Componente principal ───────────────────────────────────────────────────────

export default function CalendarioPage() {
  const { userDoc, userRoles } = useAuthContext();
  const puedeEditar = userRoles.includes('admin') || userRoles.includes('rrhh');

  const [vista, setVista]           = useState<'mensual' | 'semanal'>('mensual');
  const [monthDate, setMonthDate]   = useState(() => new Date());
  const [weekDate, setWeekDate]     = useState(() => new Date());
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [modal, setModal]           = useState<ModalState>(null);

  const rango = useMemo(() => {
    if (vista === 'mensual') {
      return {
        start: startOfWeek(startOfMonth(monthDate), { weekStartsOn: 1 }),
        end:   endOfWeek(endOfMonth(monthDate), { weekStartsOn: 1 }),
      };
    }
    return {
      start: startOfWeek(weekDate, { weekStartsOn: 1 }),
      end:   endOfWeek(weekDate, { weekStartsOn: 1 }),
    };
  }, [vista, monthDate, weekDate]);

  const rangeStartStr = format(rango.start, 'yyyy-MM-dd');
  const rangeEndStr   = format(rango.end, 'yyyy-MM-dd');
  const { eventos, loading } = useCalendario(rangeStartStr, rangeEndStr);

  const eventosSala = useMemo(() => eventos.filter(e => e.calendario === 'sala'), [eventos]);

  const eventosDelDia = useMemo(
    () => (selectedDay ? eventosSala.filter(e => e.fecha === selectedDay) : []),
    [eventosSala, selectedDay],
  );

  function handleDayClick(fecha: string) {
    if (puedeEditar) {
      setModal({ mode: 'crear', fecha });
    } else {
      setSelectedDay(fecha);
    }
  }

  function handleVerMas(fecha: string) {
    setSelectedDay(fecha);
  }

  function handleEditarDesdeDetalle(evento: EventoCalendario) {
    setSelectedDay(null);
    setModal({ mode: 'editar', evento });
  }

  async function handleEliminarDesdeDetalle(evento: EventoCalendario) {
    if (!confirm(`¿Eliminar el evento "${evento.titulo}"?`)) return;
    await eliminarEvento(evento.id);
  }

  function handleModalSaved() {
    setModal(null);
  }

  const monthLabel = format(monthDate, "MMMM yyyy", { locale: es });
  const weekLabel = `${format(rango.start, 'dd/MM')} – ${format(rango.end, 'dd/MM/yyyy')}`;

  const meses = Array.from({ length: 12 }, (_, i) => format(new Date(2000, i, 1), 'MMMM', { locale: es }));
  const anioActual = new Date().getFullYear();
  const anios = Array.from({ length: 6 }, (_, i) => anioActual - 2 + i);

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Calendario RRHH"
        subtitle="Sala de capacitación"
        actions={
          <button
            onClick={() => exportarMes(eventosSala, monthDate)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-[#003DA5] text-white rounded-lg hover:bg-blue-800 transition-colors"
          >
            <Download size={14} /> Exportar mes
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-[1400px] mx-auto space-y-4">

          {/* Tabs vista */}
          <div className="flex gap-2">
            <button
              onClick={() => setVista('mensual')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                vista === 'mensual' ? 'bg-[#1A1A2E] text-white' : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-50'
              }`}
            >
              <CalendarDays size={15} /> Vista Mensual
            </button>
            <button
              onClick={() => setVista('semanal')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                vista === 'semanal' ? 'bg-[#1A1A2E] text-white' : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-50'
              }`}
            >
              <ListTodo size={15} /> Vista Semanal
            </button>
          </div>

          {/* Navegación */}
          <div className="flex items-center justify-center gap-3 relative">
            <button
              onClick={() => vista === 'mensual' ? setMonthDate(d => addMonths(d, -1)) : setWeekDate(d => addWeeks(d, -1))}
              className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-500"
            >
              <ChevronLeft size={16} />
            </button>

            <button
              onClick={() => vista === 'mensual' && setShowMonthPicker(v => !v)}
              className="text-base font-bold text-gray-800 capitalize min-w-[160px] text-center hover:text-[#003DA5] transition-colors"
            >
              {vista === 'mensual' ? monthLabel : weekLabel}
            </button>

            <button
              onClick={() => vista === 'mensual' ? setMonthDate(d => addMonths(d, 1)) : setWeekDate(d => addWeeks(d, 1))}
              className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-500"
            >
              <ChevronRight size={16} />
            </button>

            <button
              onClick={() => { setMonthDate(new Date()); setWeekDate(new Date()); }}
              className="ml-2 text-xs font-semibold px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50"
            >
              Hoy
            </button>

            {showMonthPicker && vista === 'mensual' && (
              <div className="absolute top-full mt-2 bg-white rounded-xl shadow-xl border border-gray-100 p-3 flex gap-2 z-20">
                <select
                  value={monthDate.getMonth()}
                  onChange={e => { setMonthDate(d => new Date(d.getFullYear(), Number(e.target.value), 1)); setShowMonthPicker(false); }}
                  className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm capitalize"
                >
                  {meses.map((m, i) => <option key={m} value={i} className="capitalize">{m}</option>)}
                </select>
                <select
                  value={monthDate.getFullYear()}
                  onChange={e => { setMonthDate(d => new Date(Number(e.target.value), d.getMonth(), 1)); setShowMonthPicker(false); }}
                  className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm"
                >
                  {anios.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
            )}
          </div>

          {loading && (
            <p className="text-center text-sm text-gray-400">Cargando eventos...</p>
          )}

          {/* Vista mensual */}
          {vista === 'mensual' && (
            <div className="bg-white rounded-xl border border-gray-200 p-4 max-w-2xl mx-auto w-full">
              <div className="flex items-center gap-2 mb-3">
                <School size={16} className="text-[#003DA5]" />
                <h3 className="text-sm font-bold text-[#003DA5]">{CALENDARIO_LABELS.sala}</h3>
              </div>
              <CalendarioMensual
                monthDate={monthDate}
                eventos={eventosSala}
                onDayClick={handleDayClick}
                onVerMas={handleVerMas}
              />
            </div>
          )}

          {/* Vista semanal */}
          {vista === 'semanal' && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <CalendarioSemanal
                weekDate={weekDate}
                eventosSala={eventosSala}
                onDayClick={handleDayClick}
              />
            </div>
          )}

        </div>
      </div>

      {selectedDay && (
        <DetalleDia
          fecha={selectedDay}
          eventos={eventosDelDia}
          puedeEditar={puedeEditar}
          onClose={() => setSelectedDay(null)}
          onEditar={handleEditarDesdeDetalle}
          onEliminar={handleEliminarDesdeDetalle}
          onAgregar={() => { setModal({ mode: 'crear', fecha: selectedDay }); setSelectedDay(null); }}
        />
      )}

      {modal && userDoc && (
        <EventoModal
          fechaInicial={modal.mode === 'crear' ? modal.fecha : modal.evento.fecha}
          evento={modal.mode === 'editar' ? modal.evento : undefined}
          eventosDelRango={eventosSala}
          creadoPorUid={userDoc.uid}
          creadoPorNombre={userDoc.nombre}
          onClose={() => setModal(null)}
          onSaved={handleModalSaved}
        />
      )}
    </div>
  );
}
