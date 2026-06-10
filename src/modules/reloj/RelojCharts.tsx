import { useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, ReferenceArea,
  BarChart, Bar, Cell, Legend,
} from 'recharts';
import type { EmpleadoData, EstadoDia, DiaData } from './relojParser';
import { parseHHMM, minsToHHMM } from './relojParser';

// ─── Shared constants ──────────────────────────────────────────────────────────

const DIAS_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MESES_SHORT = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function fmtFechaShort(iso: string): string {
  const d = new Date(iso + 'T12:00:00');
  return `${DIAS_SHORT[d.getDay()]} ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function getLaborableDays(fechaMin: string, fechaMax: string): string[] {
  const days: string[] = [];
  if (!fechaMin || !fechaMax) return days;
  const cur = new Date(fechaMin + 'T12:00:00');
  const max = new Date(fechaMax + 'T12:00:00');
  while (cur <= max) {
    const dow = cur.getDay();
    if (dow !== 0 && dow !== 6) {
      days.push(cur.toISOString().slice(0, 10));
    }
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

const COLORES_ESTADO: Record<EstadoDia, string> = {
  OK:                 '#16a34a',
  TARDANZA:           '#f59e0b',
  TARDANZA_GRAVE:     '#dc2626',
  SALIDA_ANTICIPADA:  '#f97316',
  DESCANSO_EXTENDIDO: '#eab308',
  DATO_INCOMPLETO:    '#60a5fa',
  AUSENTE:            '#ef4444',
  FIN_SEMANA:         '#e5e7eb',
};

const ESTADO_BG: Record<EstadoDia, string> = {
  OK:                 '#dcfce7',
  TARDANZA:           '#fef9c3',
  TARDANZA_GRAVE:     '#fee2e2',
  SALIDA_ANTICIPADA:  '#ffedd5',
  DESCANSO_EXTENDIDO: '#fef9c3',
  DATO_INCOMPLETO:    '#dbeafe',
  AUSENTE:            '#fee2e2',
  FIN_SEMANA:         '#f9fafb',
};

const ESTADO_LABELS_MAP: Partial<Record<EstadoDia, string>> = {
  OK: 'OK', TARDANZA: 'Tardanza', TARDANZA_GRAVE: 'T. Grave',
  SALIDA_ANTICIPADA: 'Sal. Anticip.', DESCANSO_EXTENDIDO: 'Desc. Ext.',
  DATO_INCOMPLETO: 'Incompleto', AUSENTE: 'Ausente',
};

const ESTADO_LABEL_FULL: Record<EstadoDia, string> = {
  OK: 'A tiempo', TARDANZA: 'Tardanza', TARDANZA_GRAVE: 'Tardanza grave',
  SALIDA_ANTICIPADA: 'Salida anticipada', DESCANSO_EXTENDIDO: 'Desc. extendido',
  DATO_INCOMPLETO: 'Incompleto', AUSENTE: 'Ausente', FIN_SEMANA: 'Fin de semana',
};

const ALL_KEYS: EstadoDia[] = [
  'OK', 'TARDANZA', 'TARDANZA_GRAVE', 'SALIDA_ANTICIPADA', 'DESCANSO_EXTENDIDO', 'DATO_INCOMPLETO', 'AUSENTE',
];

// ─── Ingreso evolution chart (individual) ─────────────────────────────────────

interface IngresoPoint {
  fecha: string;
  delta: number;
  estado: EstadoDia;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomDot(props: any) {
  const { cx, cy, payload } = props;
  return (
    <circle cx={cx} cy={cy} r={5}
      fill={payload.delta > 0 ? '#E3000F' : '#16a34a'}
      stroke="white" strokeWidth={2} />
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function IngresoTooltip({ active, payload }: any) {
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload as IngresoPoint;
  return (
    <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-lg text-xs">
      <div className={d.delta > 0 ? 'text-red-600' : 'text-green-600'}>
        {d.delta > 0 ? `${d.delta} min tarde` : d.delta < 0 ? `${Math.abs(d.delta)} min antes` : 'A tiempo exacto'}
      </div>
    </div>
  );
}

export function IngresosLineChart({ empleado }: { empleado: EmpleadoData }) {
  const ingresoEspMins = parseHHMM(empleado.horario.ingresoEsperado);
  const tolerancia = empleado.horario.toleranciaIngreso;

  const data: IngresoPoint[] = Array.from(empleado.dias.values())
    .filter(d => d.minutosIngreso !== null && d.estado !== 'FIN_SEMANA' && d.estado !== 'AUSENTE')
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .map(d => ({
      fecha: fmtFechaShort(d.fecha),
      delta: d.minutosIngreso! - ingresoEspMins,
      estado: d.estado,
    }));

  if (data.length === 0) return null;

  const absMax = Math.max(...data.map(d => Math.abs(d.delta)), tolerancia + 10);
  const yDomain = [-(absMax + 5), absMax + 5];

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 mb-1">Evolución de hora de ingreso</h3>
      <p className="text-xs text-gray-400 mb-3">
        Minutos relativos a {empleado.horario.ingresoEsperado}. Positivo = tarde.
      </p>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="fecha" tick={{ fontSize: 10, fill: '#94a3b8' }} />
          <YAxis
            domain={yDomain}
            tickFormatter={v => v > 0 ? `+${v}` : String(v)}
            tick={{ fontSize: 10, fill: '#94a3b8' }}
            width={36}
          />
          <Tooltip content={<IngresoTooltip />} />
          <ReferenceArea y1={-tolerancia} y2={tolerancia} fill="#dcfce7" fillOpacity={0.4} />
          <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="4 4" />
          <ReferenceLine y={tolerancia} stroke="#fbbf24" strokeDasharray="3 3" strokeWidth={1} />
          <ReferenceLine y={-tolerancia} stroke="#fbbf24" strokeDasharray="3 3" strokeWidth={1} />
          <Line
            type="monotone" dataKey="delta"
            stroke="#003DA5" strokeWidth={2}
            dot={<CustomDot />}
            activeDot={{ r: 6, stroke: 'white', strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Jornada evolution chart (individual) ─────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function JornadaTooltip({ active, payload }: any) {
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload as { minutos: number; esperadoMins: number };
  const diff = d.minutos - d.esperadoMins;
  return (
    <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-lg text-xs">
      <div className="font-medium text-gray-800">{minsToHHMM(d.minutos)}</div>
      <div className={diff >= -30 ? 'text-green-600' : 'text-red-600'}>
        {diff >= 0 ? `+${minsToHHMM(diff)} sobre lo esperado` : `-${minsToHHMM(Math.abs(diff))} bajo lo esperado`}
      </div>
    </div>
  );
}

export function JornadaLineChart({ empleado }: { empleado: EmpleadoData }) {
  const esperadoMins = parseHHMM(empleado.horario.salidaEsperada) - parseHHMM(empleado.horario.ingresoEsperado);
  const esperadoH = Math.round(esperadoMins / 6) / 10;

  const data = Array.from(empleado.dias.values())
    .filter(d => d.minutosJornada !== null && d.minutosJornada > 0 && d.estado !== 'FIN_SEMANA' && d.estado !== 'AUSENTE')
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .map(d => ({
      fecha: fmtFechaShort(d.fecha),
      horas: Math.round(d.minutosJornada! / 6) / 10,
      minutos: d.minutosJornada!,
      esperadoMins,
    }));

  if (data.length === 0) return null;

  const yMin = Math.max(0, Math.min(...data.map(d => d.horas), esperadoH) - 0.5);
  const yMax = Math.max(...data.map(d => d.horas), esperadoH) + 0.5;

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 mb-1">Evolución de jornada diaria</h3>
      <p className="text-xs text-gray-400 mb-3">
        Horas trabajadas por día. Línea punteada = jornada esperada ({minsToHHMM(esperadoMins)}).
      </p>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="fecha" tick={{ fontSize: 10, fill: '#94a3b8' }} />
          <YAxis
            domain={[yMin, yMax]}
            tickFormatter={v => `${v}h`}
            tick={{ fontSize: 10, fill: '#94a3b8' }}
            width={36}
          />
          <Tooltip content={<JornadaTooltip />} />
          <ReferenceLine y={esperadoH} stroke="#003DA5" strokeDasharray="4 4" strokeWidth={1.5}
            label={{ value: `${esperadoH}h`, fill: '#003DA5', fontSize: 9, position: 'insideTopRight' }}
          />
          <Line
            type="monotone" dataKey="horas"
            stroke="#10b981" strokeWidth={2}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            dot={(props: any) => {
              const { cx, cy, payload } = props;
              const isShort = payload.minutos < esperadoMins - 30;
              return <circle key={`dot-${cx}-${cy}`} cx={cx} cy={cy} r={5} fill={isShort ? '#E3000F' : '#10b981'} stroke="white" strokeWidth={2} />;
            }}
            activeDot={{ r: 6, stroke: 'white', strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Composition chart (horizontal stacked, only people with incidents) ────────

export function CompositionChart({ empleados }: { empleados: EmpleadoData[] }) {
  const withIncidents = empleados.filter(e =>
    e.tardanzas > 0 || e.ausencias > 0 || e.descansosExtendidos > 0 || e.salidasAnticipadas > 0 ||
    Array.from(e.dias.values()).some(d => d.estado === 'DATO_INCOMPLETO')
  );

  if (withIncidents.length === 0) {
    return (
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Composición de días por persona</h3>
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <div className="text-3xl mb-2">🎉</div>
          <div className="font-semibold text-green-700 text-sm">¡Sin incidencias!</div>
          <div className="text-xs text-gray-400 mt-1">Todo el equipo tiene días perfectos.</div>
        </div>
      </div>
    );
  }

  const data = [...withIncidents]
    .sort((a, b) =>
      (b.tardanzas + b.ausencias + b.descansosExtendidos) -
      (a.tardanzas + a.ausencias + a.descansosExtendidos)
    )
    .map(emp => {
      const counts: Record<string, number> = {
        OK: 0, TARDANZA: 0, TARDANZA_GRAVE: 0,
        SALIDA_ANTICIPADA: 0, DESCANSO_EXTENDIDO: 0, DATO_INCOMPLETO: 0, AUSENTE: 0,
      };
      for (const dia of emp.dias.values()) {
        if (dia.estado !== 'FIN_SEMANA' && counts[dia.estado] !== undefined) {
          counts[dia.estado]++;
        }
      }
      return { nombre: emp.nombre, ...counts };
    });

  const height = Math.max(160, data.length * 40 + 70);

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 mb-1">Composición de días por persona</h3>
      <p className="text-xs text-gray-400 mb-3">
        {withIncidents.length} de {empleados.length} personas con incidencias
      </p>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} layout="vertical" margin={{ top: 5, right: 20, left: 180, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} />
          <YAxis type="category" dataKey="nombre" width={175} tick={{ fontSize: 11, fill: '#64748b' }} />
          <Tooltip
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={(value: any, name: any) => [value, ESTADO_LABELS_MAP[name as EstadoDia] ?? name]}
          />
          <Legend
            formatter={(name: string) => ESTADO_LABELS_MAP[name as EstadoDia] ?? name}
            iconType="circle" iconSize={8}
            wrapperStyle={{ fontSize: 10, paddingTop: 8 }}
          />
          {ALL_KEYS.map(k => (
            <Bar key={k} dataKey={k} stackId="a" fill={COLORES_ESTADO[k]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Ranking chart (only <100%, celebration if all perfect) ───────────────────

export function RankingBarChart({ empleados }: { empleados: EmpleadoData[] }) {
  const withIssues = empleados.filter(e => e.puntualidadPct < 100);

  if (withIssues.length === 0) {
    return (
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Ranking de puntualidad</h3>
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <div className="text-3xl mb-2">🏆</div>
          <div className="font-semibold text-green-700 text-sm">¡Puntualidad perfecta!</div>
          <div className="text-xs text-gray-400 mt-1">Todo el equipo tiene 100% de puntualidad.</div>
        </div>
      </div>
    );
  }

  const data = [...withIssues]
    .sort((a, b) => a.puntualidadPct - b.puntualidadPct)
    .map(e => ({ nombre: e.nombre, puntualidad: e.puntualidadPct }));

  const height = Math.max(120, data.length * 40 + 70);

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 mb-1">Ranking de puntualidad</h3>
      <p className="text-xs text-gray-400 mb-3">
        {withIssues.length} de {empleados.length} personas con puntualidad &lt; 100%
      </p>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} layout="vertical" margin={{ top: 5, right: 50, left: 180, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical horizontal={false} />
          <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${v}%`}
            tick={{ fontSize: 10, fill: '#94a3b8' }} />
          <YAxis type="category" dataKey="nombre" width={175} tick={{ fontSize: 11, fill: '#64748b' }} />
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <Tooltip formatter={(v: any) => [`${v}%`, 'Puntualidad']} />
          <ReferenceLine x={90} stroke="#f59e0b" strokeDasharray="3 3" strokeWidth={1} />
          <Bar dataKey="puntualidad" radius={[0, 4, 4, 0]}>
            {data.map((entry, i) => (
              <Cell
                key={i}
                fill={entry.puntualidad >= 90 ? '#16a34a' : entry.puntualidad >= 75 ? '#f59e0b' : '#E3000F'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Jornada chart (horizontal, colored by vs expected) ───────────────────────

export function JornadaBarChart({ empleados }: { empleados: EmpleadoData[] }) {
  const data = empleados
    .filter(e => e.jornadaPromedioMinutos > 0)
    .map(e => {
      const expectedMins = parseHHMM(e.horario.salidaEsperada) - parseHHMM(e.horario.ingresoEsperado);
      const diff = e.jornadaPromedioMinutos - expectedMins;
      return {
        nombre: e.nombre,
        jornada: Math.round(e.jornadaPromedioMinutos / 60 * 10) / 10,
        label: minsToHHMM(e.jornadaPromedioMinutos),
        expectedH: Math.round(expectedMins / 60 * 10) / 10,
        diff,
      };
    })
    .sort((a, b) => a.jornada - b.jornada);

  if (data.length === 0) return null;

  const sorted = [...data].sort((a, b) => a.expectedH - b.expectedH);
  const medianExp = sorted[Math.floor(sorted.length / 2)]?.expectedH ?? 8;
  const xMin = Math.max(0, Math.min(...data.map(d => d.jornada)) - 0.5);
  const xMax = Math.max(...data.map(d => d.jornada)) + 0.5;
  const height = Math.max(160, data.length * 36 + 70);

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 mb-1">Jornada promedio por persona</h3>
      <p className="text-xs text-gray-400 mb-3">Horas trabajadas promedio. Línea azul = jornada esperada.</p>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 180, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical horizontal={false} />
          <XAxis type="number" domain={[xMin, xMax]} tickFormatter={v => `${v}h`}
            tick={{ fontSize: 10, fill: '#94a3b8' }} />
          <YAxis type="category" dataKey="nombre" width={175} tick={{ fontSize: 11, fill: '#64748b' }} />
          <Tooltip
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={(_v: any, _n: any, p: any) => [p.payload.label, 'Jornada promedio']}
          />
          <ReferenceLine x={medianExp} stroke="#003DA5" strokeDasharray="4 4" strokeWidth={1.5}
            label={{ value: `${medianExp}h`, fill: '#003DA5', fontSize: 9, position: 'insideTopRight' }}
          />
          <Bar dataKey="jornada" radius={[0, 4, 4, 0]}>
            {data.map((entry, i) => (
              <Cell
                key={i}
                fill={entry.diff >= -10 ? '#16a34a' : entry.diff >= -30 ? '#f59e0b' : '#E3000F'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Heatmap chart (CSS grid, people × dates) ─────────────────────────────────

interface HeatmapTooltipState {
  clientX: number;
  clientY: number;
  empNombre: string;
  fecha: string;
  dia: DiaData | null;
  estado: EstadoDia;
}

interface HeatmapChartProps {
  empleados: EmpleadoData[];
  fechaMin: string;
  fechaMax: string;
}

export function HeatmapChart({ empleados, fechaMin, fechaMax }: HeatmapChartProps) {
  const [tooltip, setTooltip] = useState<HeatmapTooltipState | null>(null);

  const allDates = getLaborableDays(fechaMin, fechaMax);

  const topEmps = [...empleados]
    .sort((a, b) =>
      (b.tardanzas + b.ausencias + b.descansosExtendidos) -
      (a.tardanzas + a.ausencias + a.descansosExtendidos)
    )
    .slice(0, 20);

  if (allDates.length === 0 || topEmps.length === 0) return null;

  const monthChanges = new Set<number>();
  allDates.forEach((d, i) => {
    if (i > 0 && d.slice(5, 7) !== allDates[i - 1].slice(5, 7)) {
      monthChanges.add(i);
    }
  });

  const CELL = 20;
  const GAP = 2;
  const NAME_W = 170;

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 mb-1">Mapa de calor de asistencia</h3>
      <p className="text-xs text-gray-400 mb-3">
        Top {topEmps.length} personas · {allDates.length} días laborables
        {empleados.length > 20 && ` (de ${empleados.length} totales)`}
      </p>

      <div className="flex flex-wrap gap-3 mb-4">
        {(Object.entries(ESTADO_LABEL_FULL) as [EstadoDia, string][])
          .filter(([k]) => k !== 'FIN_SEMANA')
          .map(([estado, label]) => (
            <div key={estado} className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm flex-shrink-0 border"
                style={{ background: ESTADO_BG[estado], borderColor: COLORES_ESTADO[estado] + '80' }} />
              <span className="text-[10px] text-gray-500">{label}</span>
            </div>
          ))}
      </div>

      <div className="overflow-x-auto">
        <div style={{ minWidth: NAME_W + allDates.length * (CELL + GAP) + 'px' }}>

          {/* Date header row */}
          <div className="flex mb-1" style={{ paddingLeft: NAME_W + 'px', gap: GAP + 'px' }}>
            {allDates.map((d, i) => {
              const date = new Date(d + 'T12:00:00');
              const isChange = monthChanges.has(i);
              return (
                <div key={d} className="flex-shrink-0 text-center relative pt-3" style={{ width: CELL + 'px' }}>
                  {isChange && (
                    <div className="absolute top-0 left-0 text-[8px] text-[#003DA5] font-bold whitespace-nowrap">
                      {MESES_SHORT[date.getMonth()]}
                    </div>
                  )}
                  <div className="text-[9px] text-gray-400">{date.getDate()}</div>
                </div>
              );
            })}
          </div>

          {/* Employee rows */}
          <div className="space-y-[2px]">
            {topEmps.map(emp => (
              <div key={emp.nombre} className="flex items-center" style={{ gap: GAP + 'px' }}>
                <div
                  className="text-right text-[11px] text-gray-600 truncate pr-2 flex-shrink-0"
                  style={{ width: NAME_W + 'px' }}
                  title={emp.nombre}
                >
                  {emp.nombre}
                </div>
                {allDates.map((fecha) => {
                  const dia = emp.dias.get(fecha);
                  const estado: EstadoDia = dia?.estado ?? 'AUSENTE';
                  return (
                    <div
                      key={fecha}
                      className="flex-shrink-0 rounded-sm border cursor-default"
                      style={{
                        width: CELL + 'px',
                        height: CELL + 'px',
                        background: ESTADO_BG[estado],
                        borderColor: COLORES_ESTADO[estado] + '60',
                      }}
                      onMouseEnter={(e) => {
                        setTooltip({
                          clientX: e.clientX,
                          clientY: e.clientY,
                          empNombre: emp.nombre,
                          fecha,
                          dia: dia ?? null,
                          estado,
                        });
                      }}
                      onMouseLeave={() => setTooltip(null)}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {tooltip && (
        <div
          className="fixed z-[9999] bg-white border border-gray-200 rounded-xl shadow-xl p-3 w-52 pointer-events-none text-xs"
          style={{
            top: Math.min(tooltip.clientY + 14, window.innerHeight - 150),
            left: Math.min(tooltip.clientX + 12, window.innerWidth - 220),
          }}
        >
          <div className="font-semibold text-gray-800 mb-1 truncate">{tooltip.empNombre}</div>
          <div className="text-gray-500 mb-1.5">{fmtFechaShort(tooltip.fecha)}</div>
          <div className="font-medium" style={{ color: COLORES_ESTADO[tooltip.estado] }}>
            {ESTADO_LABEL_FULL[tooltip.estado]}
          </div>
          {tooltip.dia?.ingreso && (
            <div className="text-gray-500 mt-1.5">
              Ingreso: <strong className="text-gray-700">{tooltip.dia.ingreso}</strong>
              {tooltip.dia.minutosTardanza > 0 && (
                <span className="text-red-600 ml-1">+{tooltip.dia.minutosTardanza}m</span>
              )}
            </div>
          )}
          {tooltip.dia?.salidaFinal && (
            <div className="text-gray-500">
              Salida: <strong className="text-gray-700">{tooltip.dia.salidaFinal}</strong>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Horas extras chart ────────────────────────────────────────────────────────

export function HorasExtrasBarChart({ empleados }: { empleados: EmpleadoData[] }) {
  const withExtras = empleados
    .filter(e => e.totalHorasExtrasMinutos > 0)
    .sort((a, b) => b.totalHorasExtrasMinutos - a.totalHorasExtrasMinutos);

  if (withExtras.length === 0) return null;

  const avgMins = Math.round(
    withExtras.reduce((s, e) => s + e.totalHorasExtrasMinutos, 0) / withExtras.length,
  );
  const avgH = avgMins / 60;

  const data = withExtras.map(e => ({
    nombre: e.nombre,
    extrasH: Math.round((e.totalHorasExtrasMinutos / 60) * 10) / 10,
    label: minsToHHMM(e.totalHorasExtrasMinutos),
  }));

  const height = Math.max(120, data.length * 40 + 70);

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 mb-1">Horas extras acumuladas</h3>
      <p className="text-xs text-gray-400 mb-3">
        {withExtras.length} persona{withExtras.length !== 1 ? 's' : ''} con extras · promedio equipo: {minsToHHMM(avgMins)}
      </p>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} layout="vertical" margin={{ top: 5, right: 60, left: 180, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical horizontal={false} />
          <XAxis type="number" tickFormatter={v => `${v}h`} tick={{ fontSize: 10, fill: '#94a3b8' }} />
          <YAxis type="category" dataKey="nombre" width={175} tick={{ fontSize: 11, fill: '#64748b' }} />
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <Tooltip formatter={(v: any) => [`${v}h`, 'Extras']} />
          <ReferenceLine x={avgH} stroke="#94a3b8" strokeDasharray="3 3" strokeWidth={1} label={{ value: 'prom.', position: 'top', fontSize: 9, fill: '#94a3b8' }} />
          <Bar dataKey="extrasH" fill="#28a745" radius={[0, 4, 4, 0]}>
            {data.map((_, i) => (
              <Cell key={i} fill="#28a745" />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
