import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays,
  isSameMonth, isToday, isWeekend, format,
} from 'date-fns';
import type { EventoCalendario } from '../../hooks/useCalendario';

const DIAS_SEMANA = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'];

function ocupacionColor(count: number): string {
  if (count >= 5) return '#E3000F';
  if (count >= 3) return '#fd7e14';
  return '#28a745';
}

interface Props {
  monthDate: Date;
  eventos: EventoCalendario[];
  onDayClick: (fechaISO: string) => void;
  onVerMas: (fechaISO: string) => void;
}

export default function CalendarioMensual({ monthDate, eventos, onDayClick, onVerMas }: Props) {
  const gridStart = startOfWeek(startOfMonth(monthDate), { weekStartsOn: 1 });
  const gridEnd = endOfWeek(endOfMonth(monthDate), { weekStartsOn: 1 });

  const days: Date[] = [];
  for (let d = gridStart; d <= gridEnd; d = addDays(d, 1)) days.push(d);

  const weeks: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

  const eventosPorDia = new Map<string, EventoCalendario[]>();
  for (const ev of eventos) {
    const list = eventosPorDia.get(ev.fecha) ?? [];
    list.push(ev);
    eventosPorDia.set(ev.fecha, list);
  }

  return (
    <div>
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DIAS_SEMANA.map(d => (
          <div key={d} className="text-center text-[10px] font-bold text-gray-400 uppercase py-1">{d}</div>
        ))}
      </div>
      <div className="space-y-1">
        {weeks.map((week, wi) => {
          const totalSemana = week.reduce(
            (s, day) => s + (eventosPorDia.get(format(day, 'yyyy-MM-dd'))?.length ?? 0), 0,
          );
          return (
            <div key={wi}>
              <div className="grid grid-cols-7 gap-1">
                {week.map(day => {
                  const iso = format(day, 'yyyy-MM-dd');
                  const inMonth = isSameMonth(day, monthDate);
                  const evs = eventosPorDia.get(iso) ?? [];
                  const hoy = isToday(day);
                  const finde = isWeekend(day);
                  return (
                    <button
                      key={iso}
                      onClick={() => onDayClick(iso)}
                      className="text-left rounded-lg p-1.5 flex flex-col transition-colors"
                      style={{
                        minHeight: 76,
                        background: hoy ? '#E8F0FE' : finde ? '#F8FAFC' : '#fff',
                        border: hoy ? '1.5px solid #003DA5' : '1px solid #EEF0F3',
                        opacity: inMonth ? 1 : 0.45,
                      }}
                    >
                      <div className="flex justify-end">
                        <span className={`text-[11px] font-semibold ${inMonth ? 'text-gray-600' : 'text-gray-300'}`}>
                          {day.getDate()}
                        </span>
                      </div>
                      <div className="flex-1 space-y-0.5 mt-0.5 overflow-hidden">
                        {evs.slice(0, 2).map(ev => (
                          <div
                            key={ev.id}
                            onClick={e => { e.stopPropagation(); onVerMas(iso); }}
                            className="text-[9.5px] font-semibold text-white rounded px-1 py-0.5 truncate"
                            style={{ background: ev.color }}
                            title={ev.titulo}
                          >
                            {ev.titulo}
                          </div>
                        ))}
                        {evs.length > 2 && (
                          <span
                            role="button"
                            onClick={e => { e.stopPropagation(); onVerMas(iso); }}
                            className="block text-[9.5px] text-[#003DA5] font-semibold hover:underline"
                          >
                            +{evs.length - 2} más
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="h-1 rounded-full mt-1" style={{ background: ocupacionColor(totalSemana) }} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
