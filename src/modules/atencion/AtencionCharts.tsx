import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, LineChart, RadialBarChart, RadialBar,
} from 'recharts';
import type { GrupoAtencion, HoraDesglose } from './atencionParser';
import { fmtSecs, getGrupoColor } from './atencionParser';

// ─── LlamadasBarChart ─────────────────────────────────────────────────────────

interface LlamadasBarChartProps {
  horas: HoraDesglose[];
  grupoColor?: string;
}

export function LlamadasBarChart({ horas, grupoColor = '#003DA5' }: LlamadasBarChartProps) {
  const data = horas.map(h => ({
    hora:       `${h.hora}h`,
    Llamadas:   h.llamadas,
    Abandono:   h.abandono,
    tasaAban:   parseFloat(h.tasaAbandono.toFixed(1)),
  }));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <ComposedChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="hora" tick={{ fontSize: 11 }} />
        <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} unit="%" />
        <Tooltip
          formatter={(v, name) => {
            if (name === '% Abandono') return [`${v}%`, name];
            return [v, name];
          }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar yAxisId="left" dataKey="Llamadas" fill={grupoColor} radius={[3, 3, 0, 0]} maxBarSize={32} />
        <Bar yAxisId="left" dataKey="Abandono" fill="#E3000F" radius={[3, 3, 0, 0]} maxBarSize={20} opacity={0.8} />
        <Line yAxisId="right" type="monotone" dataKey="tasaAban" name="% Abandono" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

// ─── HeatmapGrid ──────────────────────────────────────────────────────────────

interface HeatmapGridProps {
  grupos: GrupoAtencion[];
}

function heatColor(pct: number): string {
  if (pct >= 90) return '#dcfce7';
  if (pct >= 75) return '#fef9c3';
  if (pct >= 60) return '#fde68a';
  return '#fecaca';
}

export function HeatmapGrid({ grupos }: HeatmapGridProps) {
  const allHoras = [...new Set(grupos.flatMap(g => g.horasDesglose.map(h => h.hora)))].sort((a, b) => a - b);

  return (
    <div className="overflow-x-auto">
      <table className="text-xs border-collapse w-full">
        <thead>
          <tr>
            <th className="px-2 py-1.5 text-left font-semibold text-gray-600 border border-gray-200 bg-gray-50">Hora</th>
            {grupos.map(g => (
              <th key={g.nombre} className="px-2 py-1.5 text-center font-semibold text-gray-600 border border-gray-200 bg-gray-50 whitespace-nowrap">
                {g.nombreLegible}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {allHoras.map(hora => (
            <tr key={hora}>
              <td className="px-2 py-1.5 text-center font-medium text-gray-700 border border-gray-200 bg-gray-50">{hora}h</td>
              {grupos.map(g => {
                const h = g.horasDesglose.find(hh => hh.hora === hora);
                if (!h) return (
                  <td key={g.nombre} className="px-2 py-1.5 text-center text-gray-300 border border-gray-200">—</td>
                );
                return (
                  <td
                    key={g.nombre}
                    className="px-3 py-1.5 text-center border border-gray-200 font-medium transition-opacity"
                    style={{ backgroundColor: heatColor(h.tasaRespuesta) }}
                    title={`${h.llamadas} llamadas · ${h.tasaRespuesta.toFixed(1)}% respuesta`}
                  >
                    <div>{h.llamadas}</div>
                    <div className="text-[10px] text-gray-600">{h.tasaRespuesta.toFixed(0)}%</div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
        <span className="font-medium">Leyenda (% respuesta):</span>
        {[['≥90%', '#dcfce7'], ['75-89%', '#fef9c3'], ['60-74%', '#fde68a'], ['<60%', '#fecaca']].map(([lbl, bg]) => (
          <span key={lbl} className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded" style={{ background: bg }} />
            {lbl}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── MultiLineChart ───────────────────────────────────────────────────────────

interface MultiLineChartProps {
  grupos: GrupoAtencion[];
  metric: 'llamadas' | 'tasaRespuesta' | 'tasaAbandono' | 'tiempoMedioCola' | 'charlaPromedio';
  unit?: string;
  formatValue?: (v: number) => string;
}

export function MultiLineChart({ grupos, metric, unit = '', formatValue }: MultiLineChartProps) {
  const allHoras = [...new Set(grupos.flatMap(g => g.horasDesglose.map(h => h.hora)))].sort((a, b) => a - b);

  const data = allHoras.map(hora => {
    const row: Record<string, number | string> = { hora: `${hora}h` };
    grupos.forEach(g => {
      const h = g.horasDesglose.find(hh => hh.hora === hora);
      if (h) row[g.nombreLegible] = parseFloat((h[metric] as number).toFixed(2));
    });
    return row;
  });

  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="hora" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} unit={unit} />
        <Tooltip
          formatter={(v, name) => [
            formatValue ? formatValue(v as number) : `${v}${unit}`,
            name,
          ]}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {grupos.map(g => (
          <Line
            key={g.nombre}
            type="monotone"
            dataKey={g.nombreLegible}
            stroke={getGrupoColor(g.nombre)}
            strokeWidth={2}
            dot={{ r: 3 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

// ─── ColaBarChart ─────────────────────────────────────────────────────────────

interface ColaBarChartProps {
  grupos: GrupoAtencion[];
}

export function ColaBarChart({ grupos }: ColaBarChartProps) {
  const allHoras = [...new Set(grupos.flatMap(g => g.horasDesglose.map(h => h.hora)))].sort((a, b) => a - b);

  const data = allHoras.map(hora => {
    const row: Record<string, number | string> = { hora: `${hora}h` };
    grupos.forEach(g => {
      const h = g.horasDesglose.find(hh => hh.hora === hora);
      if (h) row[g.nombreLegible] = Math.round(h.tiempoMedioCola);
    });
    return row;
  });

  return (
    <ResponsiveContainer width="100%" height={240}>
      <ComposedChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="hora" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => fmtSecs(v as number)} />
        <Tooltip formatter={(v) => [fmtSecs(v as number), 'T. medio cola']} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {grupos.map(g => (
          <Bar
            key={g.nombre}
            dataKey={g.nombreLegible}
            fill={getGrupoColor(g.nombre)}
            radius={[3, 3, 0, 0]}
            maxBarSize={28}
          />
        ))}
      </ComposedChart>
    </ResponsiveContainer>
  );
}

// ─── GaugeChart ───────────────────────────────────────────────────────────────

interface GaugeChartProps {
  value: number;   // 0-100
  label: string;
  colorOk?: string;
  colorWarn?: string;
  colorBad?: string;
  warnAt?: number;
  badAt?: number;
  unit?: string;
  inverse?: boolean; // if true: low = green, high = bad (e.g. abandono)
}

export function GaugeChart({
  value,
  label,
  colorOk   = '#22c55e',
  colorWarn = '#f59e0b',
  colorBad  = '#E3000F',
  warnAt    = 80,
  badAt     = 60,
  unit      = '%',
  inverse   = false,
}: GaugeChartProps) {
  const clamped = Math.max(0, Math.min(100, value));

  let color: string;
  if (!inverse) {
    color = clamped >= warnAt ? colorOk : clamped >= badAt ? colorWarn : colorBad;
  } else {
    // inverted: low is good (e.g. abandono: bad when > warnAt)
    color = clamped <= badAt ? colorOk : clamped <= warnAt ? colorWarn : colorBad;
  }

  const data = [
    { name: label, value: clamped, fill: color },
    { name: 'empty', value: 100 - clamped, fill: '#f1f5f9' },
  ];

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: 120, height: 70 }}>
        <ResponsiveContainer width="100%" height={140}>
          <RadialBarChart
            cx="50%" cy="100%"
            innerRadius="60%" outerRadius="100%"
            startAngle={180} endAngle={0}
            data={data}
          >
            <RadialBar dataKey="value" cornerRadius={4} />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex items-end justify-center pb-1">
          <span className="text-xl font-bold" style={{ color }}>
            {clamped.toFixed(1)}{unit}
          </span>
        </div>
      </div>
      <p className="text-xs text-gray-600 font-medium mt-1 text-center leading-tight">{label}</p>
    </div>
  );
}
