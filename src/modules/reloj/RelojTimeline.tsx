import type { DiaData } from './relojParser';
import { minsToHHMM } from './relojParser';

interface Props {
  dia: DiaData;
}

const AXIS_START = 7 * 60;   // 07:00
const AXIS_END   = 20 * 60;  // 20:00
const AXIS_SPAN  = AXIS_END - AXIS_START;

const ROL_COLOR: Record<string, string> = {
  INGRESO:          '#003DA5',
  SALIDA_DESCANSO:  '#f59e0b',
  REGRESO_DESCANSO: '#10b981',
  SALIDA_FINAL:     '#E3000F',
  DATO_INCOMPLETO:  '#94a3b8',
  MARCACION_EXTRA:  '#a78bfa',
};

const ROL_LABEL: Record<string, string> = {
  INGRESO:          'Ingreso',
  SALIDA_DESCANSO:  'Sal. desc.',
  REGRESO_DESCANSO: 'Reg. desc.',
  SALIDA_FINAL:     'Salida',
  DATO_INCOMPLETO:  'Incompleto',
  MARCACION_EXTRA:  'Extra',
};

function pct(mins: number): string {
  const p = Math.max(0, Math.min(100, ((mins - AXIS_START) / AXIS_SPAN) * 100));
  return `${p.toFixed(2)}%`;
}

function pctNum(mins: number): number {
  return Math.max(0, Math.min(100, ((mins - AXIS_START) / AXIS_SPAN) * 100));
}

const AXIS_TICKS = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];

export default function RelojTimeline({ dia }: Props) {
  const { marcaciones, minutosIngreso, minutosSalidaDescanso,
          minutosRegresoDescanso, minutosSalidaFinal, minutosDescanso, minutosJornada } = dia;

  if (marcaciones.length === 0) {
    return (
      <div className="bg-gray-50 rounded-lg p-4 text-center text-gray-400 text-sm">
        Sin marcaciones para este día
      </div>
    );
  }

  const jornadaLeft  = minutosIngreso !== null ? pctNum(minutosIngreso) : null;
  const jornadaWidth = (minutosIngreso !== null && minutosSalidaFinal !== null)
    ? pctNum(minutosSalidaFinal) - pctNum(minutosIngreso) : null;

  const descLeft  = minutosSalidaDescanso !== null ? pctNum(minutosSalidaDescanso) : null;
  const descWidth = (minutosSalidaDescanso !== null && minutosRegresoDescanso !== null)
    ? pctNum(minutosRegresoDescanso) - pctNum(minutosSalidaDescanso) : null;

  return (
    <div className="bg-gray-50 rounded-xl p-4 select-none">

      {/* Timeline area */}
      <div className="relative h-12 mb-6">
        {/* Axis line */}
        <div className="absolute top-6 left-0 right-0 h-0.5 bg-gray-200 rounded" />

        {/* Jornada block */}
        {jornadaLeft !== null && jornadaWidth !== null && jornadaWidth > 0 && (
          <div
            className="absolute top-4 h-4 rounded bg-blue-100 border border-blue-200"
            style={{ left: `${jornadaLeft}%`, width: `${jornadaWidth}%` }}
            title={minutosJornada !== null ? `Jornada: ${minsToHHMM(minutosJornada)}` : ''}
          />
        )}

        {/* Descanso block */}
        {descLeft !== null && descWidth !== null && descWidth > 0 && (
          <div
            className="absolute top-4 h-4 rounded bg-amber-100 border border-amber-300"
            style={{ left: `${descLeft}%`, width: `${descWidth}%` }}
            title={minutosDescanso !== null ? `Descanso: ${minsToHHMM(minutosDescanso)}` : ''}
          />
        )}

        {/* Marcacion dots + labels */}
        {marcaciones.map((mc, i) => {
          if (mc.minutos < AXIS_START || mc.minutos > AXIS_END) return null;
          const isTop = i % 2 === 0;
          return (
            <div
              key={i}
              className="absolute flex flex-col items-center"
              style={{ left: pct(mc.minutos), transform: 'translateX(-50%)' }}
            >
              {isTop && (
                <div className="text-[9px] font-semibold mb-0.5 whitespace-nowrap"
                  style={{ color: ROL_COLOR[mc.rol] }}>
                  {mc.hora}
                </div>
              )}
              <div
                className="w-2.5 h-2.5 rounded-full border-2 border-white shadow-sm z-10"
                style={{ background: ROL_COLOR[mc.rol], marginTop: isTop ? 0 : 16 }}
                title={`${ROL_LABEL[mc.rol]}: ${mc.hora}`}
              />
              {!isTop && (
                <div className="text-[9px] font-semibold mt-0.5 whitespace-nowrap"
                  style={{ color: ROL_COLOR[mc.rol] }}>
                  {mc.hora}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Axis ticks */}
      <div className="relative flex justify-between text-[9px] text-gray-400 font-medium px-0">
        {AXIS_TICKS.map(h => (
          <span key={h}>{h < 10 ? `0${h}` : h}:00</span>
        ))}
      </div>

      {/* Marcacion legend */}
      <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t border-gray-200">
        {marcaciones.map((mc, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ background: ROL_COLOR[mc.rol] }} />
            <span className="text-[10px] text-gray-600">
              {ROL_LABEL[mc.rol]}: <strong>{mc.hora}</strong>
            </span>
          </div>
        ))}
        {minutosJornada !== null && minutosJornada > 0 && (
          <div className="ml-auto text-[10px] text-gray-500">
            Jornada total: <strong className="text-gray-700">{minsToHHMM(minutosJornada)}</strong>
            {minutosDescanso !== null && minutosDescanso > 0 && (
              <span className="ml-2">· Desc.: <strong>{minsToHHMM(minutosDescanso)}</strong></span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
