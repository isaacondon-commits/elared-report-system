import { startOfWeek, addDays, format, isToday } from 'date-fns';
import { CALENDARIO_LABELS, type CalendarioId, type EventoCalendario } from '../../hooks/useCalendario';

const DIAS_SEMANA = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'];

interface Props {
  weekDate: Date;
  eventosSala: EventoCalendario[];
  eventosPersonal: EventoCalendario[];
  onDayClick: (fechaISO: string, calendario: CalendarioId) => void;
}

export default function CalendarioSemanal({ weekDate, eventosSala, eventosPersonal, onDayClick }: Props) {
  const start = startOfWeek(weekDate, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));

  const filas: { id: CalendarioId; label: string; eventos: EventoCalendario[] }[] = [
    { id: 'sala', label: CALENDARIO_LABELS.sala, eventos: eventosSala },
    { id: 'personal', label: CALENDARIO_LABELS.personal, eventos: eventosPersonal },
  ];

  return (
    <div className="overflow-x-auto">
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 800 }}>
        <thead>
          <tr>
            <th style={{ width: 170 }} />
            {days.map((day, i) => (
              <th
                key={i}
                className="px-2 py-2 text-center text-[10px] font-bold uppercase tracking-wide"
                style={{ background: isToday(day) ? '#E8F0FE' : '#F7F8FA', color: isToday(day) ? '#003DA5' : '#6B7180' }}
              >
                {DIAS_SEMANA[i]}<br />
                <span className="font-normal text-[10px]">{format(day, 'dd/MM')}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map(fila => (
            <tr key={fila.label}>
              <td className="px-3 py-2 text-xs font-bold text-gray-600 align-top border-t border-gray-100">
                {fila.label}
              </td>
              {days.map((day, i) => {
                const iso = format(day, 'yyyy-MM-dd');
                const evs = fila.eventos.filter(e => e.fecha === iso);
                return (
                  <td
                    key={i}
                    onClick={() => onDayClick(iso, fila.id)}
                    className="align-top p-1 border-t border-l border-gray-100 cursor-pointer hover:bg-gray-50"
                  >
                    <div style={{ minHeight: 80 }} className="space-y-1">
                      {evs.map(ev => (
                        <div key={ev.id} className="rounded px-1.5 py-1 text-white" style={{ background: ev.color }}>
                          <div className="text-[10px] font-semibold truncate">{ev.titulo}</div>
                          {ev.descripcion && (
                            <div className="text-[9px] opacity-90 leading-snug">{ev.descripcion}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
