import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
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

// ── Evolución temporal por back office (LineChart) ────────────────────────────
function Evolucion({ stats }: { stats: BackOfficeStats }) {
  if (stats.byDia.length < 2) return null;
  const bos = stats.backOfficesList;
  const data = [...stats.byDia].reverse().map(d => ({
    ...d.porBackOffice,
    fecha: d.fecha,
    label: formatFechaLabel(d.fecha),
  }));

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="font-semibold text-gray-900 mb-4">Evolución de contratos por back office</h3>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="label" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
          <Tooltip
            formatter={(v: unknown) => [Number(v).toLocaleString(), '']}
            labelFormatter={(_: unknown, payload: readonly { payload?: { fecha?: string } }[]) => formatFecha(payload?.[0]?.payload?.fecha ?? '')}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {bos.map((bo, i) => (
            <Line key={bo} type="monotone" dataKey={bo} stroke={PALETA[i % PALETA.length]} strokeWidth={2}
              dot={{ r: 2 }} activeDot={{ r: 4 }} connectNulls />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Stacked bar horizontal por back office (estados) ──────────────────────────
function Stacked({ stats }: { stats: BackOfficeStats }) {
  if (stats.byBackOffice.length === 0) return null;
  const data = stats.byBackOffice.map(b => ({
    nombre: b.nombre,
    Activos: b.activos,
    Pendientes: b.pendientes,
    Procesados: b.procesados,
    Rechazos: b.rechazos,
  }));

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="font-semibold text-gray-900 mb-4">Composición de estados por back office</h3>
      <ResponsiveContainer width="100%" height={Math.max(data.length * 42 + 40, 220)}>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 30, left: 10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
          <YAxis dataKey="nombre" type="category" tick={{ fontSize: 10 }} width={130} />
          <Tooltip formatter={(v: unknown) => [Number(v).toLocaleString(), '']} contentStyle={{ fontSize: 12 }} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="Activos" stackId="a" fill="#003DA5" />
          <Bar dataKey="Pendientes" stackId="a" fill="#fd7e14" />
          <Bar dataKey="Procesados" stackId="a" fill="#28a745" />
          <Bar dataKey="Rechazos" stackId="a" fill="#E3000F" />
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
