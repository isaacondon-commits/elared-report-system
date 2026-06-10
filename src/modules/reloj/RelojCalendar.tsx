import { useState, useRef, useEffect } from 'react';
import type { DiaData, EstadoDia, HorarioEsperado } from './relojParser';
import { minsToHHMM, parseHHMM } from './relojParser';

interface Props {
  dias: Map<string, DiaData>;
  fechaMin: string;
  fechaMax: string;
  horario: HorarioEsperado;
}

const DIAS_HEADER = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const ESTADO_STYLE: Record<EstadoDia, { bg: string; text: string; border: string }> = {
  OK:                 { bg: '#dcfce7', text: '#15803d', border: '#86efac' },
  TARDANZA:           { bg: '#fef9c3', text: '#854d0e', border: '#fde047' },
  TARDANZA_GRAVE:     { bg: '#fee2e2', text: '#991b1b', border: '#fca5a5' },
  DESCANSO_EXTENDIDO: { bg: '#fef9c3', text: '#854d0e', border: '#fde047' },
  SALIDA_ANTICIPADA:  { bg: '#ffedd5', text: '#9a3412', border: '#fdba74' },
  DATO_INCOMPLETO:    { bg: '#dbeafe', text: '#1e40af', border: '#93c5fd' },
  AUSENTE:            { bg: '#fee2e2', text: '#991b1b', border: '#fca5a5' },
  FIN_SEMANA:         { bg: '#f9fafb', text: '#9ca3af', border: '#e5e7eb' },
};

const ESTADO_LABEL: Record<EstadoDia, string> = {
  OK:                 'A tiempo',
  TARDANZA:           'Tardanza',
  TARDANZA_GRAVE:     'Tardanza grave',
  DESCANSO_EXTENDIDO: 'Desc. extendido',
  SALIDA_ANTICIPADA:  'Salida anticipada',
  DATO_INCOMPLETO:    'Dato incompleto',
  AUSENTE:            'Ausente',
  FIN_SEMANA:         'Fin de semana',
};

function getMonthsInRange(min: string, max: string): { year: number; month: number }[] {
  if (!min || !max) return [];
  const months: { year: number; month: number }[] = [];
  const s = new Date(min + 'T12:00:00');
  const e = new Date(max + 'T12:00:00');
  const cur = new Date(s.getFullYear(), s.getMonth(), 1);
  while (cur <= e) {
    months.push({ year: cur.getFullYear(), month: cur.getMonth() });
    cur.setMonth(cur.getMonth() + 1);
  }
  return months;
}

function getAllDaysInMonth(year: number, month: number): string[] {
  const days: string[] = [];
  const d = new Date(year, month, 1);
  while (d.getMonth() === month) {
    days.push(`${year}-${String(month + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
    d.setDate(d.getDate() + 1);
  }
  return days;
}

function fmtMinsDelta(delta: number): string {
  if (delta === 0) return 'a tiempo';
  const abs = Math.abs(delta);
  const sign = delta > 0 ? '+' : '-';
  return `${sign}${abs}m`;
}

interface TooltipContent {
  dia: DiaData;
  horario: HorarioEsperado;
}

function TooltipCard({ dia, horario }: TooltipContent) {
  const d = new Date(dia.fecha + 'T12:00:00');
  const dayLabel = `${DIAS_HEADER[d.getDay()]} ${d.getDate().toString().padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
  const ingresoEsp = parseHHMM(horario.ingresoEsperado);

  const tardanzaLabel = dia.minutosIngreso !== null
    ? fmtMinsDelta(dia.minutosIngreso - ingresoEsp)
    : null;

  return (
    <div className="text-xs space-y-1.5">
      <div className="font-semibold text-gray-800 border-b border-gray-100 pb-1 mb-1">{dayLabel}</div>

      {dia.estado === 'AUSENTE' && (
        <div className="text-red-600 font-medium">Sin marcaciones registradas</div>
      )}
      {dia.estado === 'FIN_SEMANA' && (
        <div className="text-gray-400">Fin de semana</div>
      )}

      {dia.ingreso && (
        <div className="flex justify-between gap-4">
          <span className="text-gray-500">Ingreso</span>
          <span className="font-medium text-gray-800">
            {dia.ingreso}
            {tardanzaLabel && (
              <span className={`ml-1 ${dia.minutosTardanza > 0 ? 'text-red-600' : 'text-green-600'}`}>
                ({tardanzaLabel})
              </span>
            )}
          </span>
        </div>
      )}
      {dia.salidaDescanso && dia.regresoDescanso && (
        <div className="flex justify-between gap-4">
          <span className="text-gray-500">Descanso</span>
          <span className="font-medium text-gray-800">
            {dia.salidaDescanso} – {dia.regresoDescanso}
            {dia.minutosDescanso !== null && (
              <span className={`ml-1 ${dia.minutosDescansoExtra > 0 ? 'text-amber-600' : 'text-gray-400'}`}>
                ({minsToHHMM(dia.minutosDescanso)}
                {dia.minutosDescansoExtra > 0 ? ` +${dia.minutosDescansoExtra}m` : ''})
              </span>
            )}
          </span>
        </div>
      )}
      {dia.salidaFinal && (
        <div className="flex justify-between gap-4">
          <span className="text-gray-500">Salida</span>
          <span className="font-medium text-gray-800">
            {dia.salidaFinal}
            {dia.minutosSalidaAnticipada > 0 && (
              <span className="ml-1 text-orange-600">(-{dia.minutosSalidaAnticipada}m)</span>
            )}
          </span>
        </div>
      )}
      {dia.minutosJornada !== null && dia.minutosJornada > 0 && (
        <div className="flex justify-between gap-4 pt-1 border-t border-gray-100">
          <span className="text-gray-500">Jornada</span>
          <span className="font-medium text-gray-800">{minsToHHMM(dia.minutosJornada)}</span>
        </div>
      )}
    </div>
  );
}

export default function RelojCalendar({ dias, fechaMin, fechaMax, horario }: Props) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; dia: DiaData } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleScroll() { setTooltip(null); }
    window.addEventListener('scroll', handleScroll, true);
    return () => window.removeEventListener('scroll', handleScroll, true);
  }, []);

  const months = getMonthsInRange(fechaMin, fechaMax);

  return (
    <div ref={containerRef} className="relative">

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mb-4">
        {(Object.entries(ESTADO_LABEL) as [EstadoDia, string][])
          .filter(([k]) => k !== 'FIN_SEMANA')
          .map(([estado, label]) => (
            <div key={estado} className="flex items-center gap-1.5">
              <div
                className="w-3 h-3 rounded border flex-shrink-0"
                style={{ background: ESTADO_STYLE[estado].bg, borderColor: ESTADO_STYLE[estado].border }}
              />
              <span className="text-[11px] text-gray-500">{label}</span>
            </div>
          ))}
      </div>

      {/* Calendar grid */}
      <div className="space-y-6">
        {months.map(({ year, month }) => {
          const allDays = getAllDaysInMonth(year, month);
          const firstDayOfWeek = new Date(year, month, 1).getDay();
          const blanks = Array(firstDayOfWeek).fill(null);

          // Only show days within the data range
          const minDate = new Date(fechaMin + 'T12:00:00');
          const maxDate = new Date(fechaMax + 'T12:00:00');

          return (
            <div key={`${year}-${month}`}>
              <div className="text-sm font-semibold text-gray-700 mb-2">
                {MESES[month]} {year}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {DIAS_HEADER.map(d => (
                  <div key={d} className="text-center text-[10px] text-gray-400 font-semibold py-1">{d}</div>
                ))}
                {blanks.map((_, i) => <div key={`b${i}`} />)}
                {allDays.map(dateStr => {
                  const dateObj = new Date(dateStr + 'T12:00:00');
                  const dayNum = dateObj.getDate();
                  const inRange = dateObj >= minDate && dateObj <= maxDate;
                  const dia = dias.get(dateStr);

                  if (!inRange) {
                    return (
                      <div key={dateStr} className="rounded border border-gray-100 p-1 text-center bg-gray-50 opacity-30">
                        <div className="text-[11px] text-gray-300">{dayNum}</div>
                      </div>
                    );
                  }

                  const estado: EstadoDia = dia?.estado ?? 'AUSENTE';
                  const style = ESTADO_STYLE[estado];

                  return (
                    <div
                      key={dateStr}
                      className="rounded border p-1 text-center cursor-default transition-opacity hover:opacity-80 relative"
                      style={{ background: style.bg, borderColor: style.border }}
                      onMouseEnter={(e) => {
                        if (!dia) return;
                        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                        const containerRect = containerRef.current?.getBoundingClientRect();
                        setTooltip({
                          x: rect.left - (containerRect?.left ?? 0),
                          y: rect.bottom - (containerRect?.top ?? 0) + 4,
                          dia,
                        });
                      }}
                      onMouseLeave={() => setTooltip(null)}
                    >
                      <div className="text-[11px] font-semibold" style={{ color: style.text }}>{dayNum}</div>
                      {dia?.minutosTardanza != null && dia.minutosTardanza > 0 && (
                        <div className="text-[8px] leading-tight" style={{ color: style.text }}>
                          +{dia.minutosTardanza}m
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Floating tooltip */}
      {tooltip && (
        <div
          className="absolute z-50 bg-white rounded-xl shadow-xl border border-gray-200 p-3 w-64 pointer-events-none"
          style={{ top: tooltip.y, left: Math.min(tooltip.x, (containerRef.current?.offsetWidth ?? 400) - 264) }}
        >
          <TooltipCard dia={tooltip.dia} horario={horario} />
        </div>
      )}
    </div>
  );
}
