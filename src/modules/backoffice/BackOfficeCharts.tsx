import {
  BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, LabelList, Cell,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import type { BackOfficeStats } from './BackOfficeModule';

const PALETA = ['#003DA5', '#E3000F', '#28a745', '#fd7e14', '#6f42c1', '#20c997', '#0052CC', '#ffc107'];

function formatFechaLabel(iso: string): string {
  try { return format(parseISO(iso), 'dd/MM', { locale: es }); }
  catch { return iso; }
}

function formatFecha(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function riesgoColor(pct: number): string {
  if (pct < 5) return '#28a745';
  if (pct <= 15) return '#fd7e14';
  return '#E3000F';
}

const TOP_N_EVOLUCION = 6;
const TOP_N_COMPOSICION = 8;
const OTROS_COLOR = '#adb5bd';

function abreviarNombre(nombre: string): string {
  return nombre.length > 14 ? nombre.slice(0, 13) + '…' : nombre;
}

// ── Evolución temporal por back office (AreaChart apilado, top 6 + Otros) ─────
function Evolucion({ stats }: { stats: BackOfficeStats }) {
  if (stats.byDia.length < 2) return null;

  const topBOs = stats.byBackOffice.slice(0, TOP_N_EVOLUCION).map(b => b.nombre);
  const hayOtros = stats.byBackOffice.length > TOP_N_EVOLUCION;

  const data = [...stats.byDia].reverse().map(d => {
    const row: Record<string, string | number> = { fecha: d.fecha, label: formatFechaLabel(d.fecha) };
    let otros = 0;
    for (const [bo, count] of Object.entries(d.porBackOffice)) {
      if (topBOs.includes(bo)) row[bo] = count;
      else otros += count;
    }
    if (hayOtros) row.Otros = otros;
    return row;
  });

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="font-semibold text-gray-900">Evolución de contratos por back office</h3>
      <p className="text-xs text-gray-400 mb-4">
        {hayOtros ? `Top ${TOP_N_EVOLUCION} back offices · el resto agrupado en "Otros"` : 'Área apilada por día'}
      </p>
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="label" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
          <Tooltip
            formatter={(v: unknown) => [Number(v).toLocaleString(), '']}
            labelFormatter={(_: unknown, payload: readonly { payload?: { fecha?: string } }[]) => formatFecha(payload?.[0]?.payload?.fecha ?? '')}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {topBOs.map((bo, i) => (
            <Area key={bo} type="monotone" dataKey={bo} stackId="1" stroke={PALETA[i % PALETA.length]} fill={PALETA[i % PALETA.length]} fillOpacity={0.75} />
          ))}
          {hayOtros && <Area type="monotone" dataKey="Otros" stackId="1" stroke={OTROS_COLOR} fill={OTROS_COLOR} fillOpacity={0.5} />}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Composición de estados por back office (barras horizontales agrupadas, top 8) ──
function Stacked({ stats }: { stats: BackOfficeStats }) {
  if (stats.byBackOffice.length === 0) return null;
  const top = stats.byBackOffice.slice(0, TOP_N_COMPOSICION);
  const restantes = stats.byBackOffice.length - top.length;
  const data = top.map(b => ({
    nombre: abreviarNombre(b.nombre),
    fullNombre: b.nombre,
    Activos: b.activos,
    Pendientes: b.pendientes,
    Procesados: b.procesados,
    Rechazos: b.rechazos,
  }));

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="font-semibold text-gray-900">Composición de estados por back office</h3>
      <p className="text-xs text-gray-400 mb-4">
        {restantes > 0 ? `Top ${TOP_N_COMPOSICION} back offices por volumen · +${restantes} más en la tabla de arriba` : 'Cantidad por estado equivalente y back office'}
      </p>
      <ResponsiveContainer width="100%" height={Math.max(data.length * 70 + 40, 260)}>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 20, left: 10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
          <YAxis dataKey="nombre" type="category" tick={{ fontSize: 10 }} width={130} />
          <Tooltip
            formatter={(v: unknown) => [Number(v).toLocaleString(), '']}
            labelFormatter={(_: unknown, payload: readonly { payload?: { fullNombre?: string } }[]) => payload?.[0]?.payload?.fullNombre ?? ''}
            contentStyle={{ fontSize: 12 }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="Activos" fill="#003DA5" radius={[0, 3, 3, 0]} />
          <Bar dataKey="Pendientes" fill="#fd7e14" radius={[0, 3, 3, 0]} />
          <Bar dataKey="Procesados" fill="#28a745" radius={[0, 3, 3, 0]} />
          <Bar dataKey="Rechazos" fill="#E3000F" radius={[0, 3, 3, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Ranking de back offices por % de rechazo ──────────────────────────────────
function RankingRechazos({ stats }: { stats: BackOfficeStats }) {
  const data = [...stats.byBackOffice]
    .filter(b => b.total > 0)
    .sort((a, b) => b.pctRechazo - a.pctRechazo)
    .map(b => ({ nombre: b.nombre, pct: Number(b.pctRechazo.toFixed(1)) }));

  if (data.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="font-semibold text-gray-900 mb-4">Ranking de back offices — % de rechazo</h3>
      <ResponsiveContainer width="100%" height={Math.max(data.length * 34 + 30, 180)}>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 50, left: 10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 10 }} unit="%" />
          <YAxis dataKey="nombre" type="category" tick={{ fontSize: 10 }} width={130} />
          <Tooltip formatter={(v: unknown) => [`${v}%`, '% Rechazo']} contentStyle={{ fontSize: 12 }} />
          <Bar dataKey="pct" radius={[0, 4, 4, 0]}>
            <LabelList dataKey="pct" position="right" formatter={(v: unknown) => `${v}%`} style={{ fontSize: 10, fontWeight: 600, fill: '#334155' }} />
            {data.map((d, i) => <Cell key={i} fill={riesgoColor(d.pct)} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

const BackOfficeCharts = { Evolucion, Stacked, RankingRechazos };
export default BackOfficeCharts;
