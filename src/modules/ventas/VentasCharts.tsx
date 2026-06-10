import { useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend, LabelList, ReferenceLine,
} from 'recharts';
import { EyeOff } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import type { VentasStats } from './VentasModule';
import { getEstadoColor } from './VentasModule';

// ── Paleta Antel ──────────────────────────────────────────────────────────────
const P = {
  azul1:   '#003DA5',
  azul2:   '#0052CC',
  azul3:   '#0066FF',
  azul4:   '#4D94FF',
  rojo:    '#E3000F',
  verde:   '#28a745',
  naranja: '#fd7e14',
  violeta: '#6f42c1',
  teal:    '#20c997',
  gris:    '#6c757d',
  grisClaro: '#adb5bd',
};

const PIE_PALETA = [P.azul1, P.rojo, P.verde, P.naranja, P.teal, P.violeta, P.azul3, P.gris, P.azul4, '#ffc107'];

function fmt(v: unknown): [string, string] { return [Number(v).toLocaleString(), '']; }

function truncate(s: string, max = 22): string {
  return s.length > max ? s.slice(0, max) + '…' : s;
}

function formatFechaLabel(iso: string): string {
  try { return format(parseISO(iso), 'dd/MM', { locale: es }); }
  catch { return iso; }
}

function formatFecha(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props {
  stats: VentasStats;
  vendedoresOcultos: Set<string>;
  onHideVendedor: (nombre: string) => void;
  vendedorActivo: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. RANKING DE VENDEDORES — tabla con hover + EyeOff (Mejoras 1, 6)
// ─────────────────────────────────────────────────────────────────────────────
function RankingChart({ stats, onHideVendedor }: Props) {
  const [hovered, setHovered] = useState<string | null>(null);
  const data = stats.byFuncionario;
  const maxTotal = data[0]?.total ?? 1;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="font-semibold text-gray-900 mb-4">Ranking General de Vendedores</h3>
      <div className="space-y-1">
        {data.map((f, i) => {
          const pct = (f.total / maxTotal) * 100;
          const isTop = i < 3;
          const medals = ['🥇', '🥈', '🥉'];
          return (
            <div
              key={f.nombre}
              className="flex items-center gap-3 px-2 py-1.5 rounded-lg transition-colors cursor-default"
              style={{ background: hovered === f.nombre ? '#f1f5f9' : 'transparent' }}
              onMouseEnter={() => setHovered(f.nombre)}
              onMouseLeave={() => setHovered(null)}
            >
              {/* Rank */}
              <div className="w-8 text-center flex-shrink-0">
                {isTop
                  ? <span className="text-base">{medals[i]}</span>
                  : <span className="text-xs text-gray-400 font-mono">{i + 1}</span>}
              </div>
              {/* Nombre */}
              <div className="w-52 flex-shrink-0 text-sm font-medium text-gray-800 truncate" title={f.nombre}>
                {f.nombre}
              </div>
              {/* Bar */}
              <div className="flex-1 bg-gray-100 rounded-full h-4 relative overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${pct}%`,
                    background: i === 0 ? P.rojo : i < 3 ? P.azul2 : P.azul1,
                    opacity: 1 - i * 0.02,
                  }}
                />
              </div>
              {/* Total */}
              <div className="w-16 text-right flex-shrink-0">
                <span className={`text-sm font-bold ${i === 0 ? 'text-[#E3000F]' : 'text-[#003DA5]'}`}>
                  {f.total.toLocaleString()}
                </span>
              </div>
              {/* EyeOff */}
              <button
                onClick={() => onHideVendedor(f.nombre)}
                className="w-7 flex-shrink-0 flex items-center justify-center transition-opacity"
                style={{ opacity: hovered === f.nombre ? 1 : 0 }}
                title={`Ocultar ${f.nombre}`}
              >
                <EyeOff size={14} className="text-gray-400 hover:text-red-500" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. COMPOSICIÓN POR VENDEDOR — stacked top 10 (Mejora 1)
// ─────────────────────────────────────────────────────────────────────────────
function StackedChart({ stats }: Pick<Props, 'stats'>) {
  const top10 = stats.byFuncionario.slice(0, 10).map(f => ({
    nombre: f.nombre.split(' ').slice(0, 2).join(' '),
    fullNombre: f.nombre,
    Renovacion: f.renovaciones,
    'Nuevo Servicio': f.altas,
    'Cambio de plan': f.cambios,
    Otros: f.otros,
  }));

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="font-semibold text-gray-900 mb-4">Composición de Ventas por Vendedor (Top 10)</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={top10} margin={{ top: 5, right: 20, left: 0, bottom: 65 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="nombre" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" interval={0} />
          <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
          <Tooltip
            labelFormatter={(_: unknown, payload: readonly { payload?: { fullNombre?: string } }[]) =>
              payload?.[0]?.payload?.fullNombre ?? ''}
          />
          <Legend />
          <Bar dataKey="Renovacion"     stackId="a" fill={P.azul1} />
          <Bar dataKey="Cambio de plan" stackId="a" fill={P.azul3} />
          <Bar dataKey="Nuevo Servicio" stackId="a" fill={P.rojo}  />
          <Bar dataKey="Otros"          stackId="a" fill={P.grisClaro} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. MÉTRICAS DIARIAS DEL EQUIPO (Mejora 4)
// ─────────────────────────────────────────────────────────────────────────────
function MetricasDiariasEquipo({ stats }: Pick<Props, 'stats'>) {
  if (stats.byDia.length === 0) return null;

  const maxProm = Math.max(...stats.byDia.map(d => d.promVendedor));
  const validDias = stats.byDia.filter(d => d.vendedoresActivos > 1);
  const minProm = validDias.length > 0 ? Math.min(...validDias.map(d => d.promVendedor)) : -1;

  // Gráfico line — últimos 30 días, asc
  const chartData = [...stats.byDia].reverse().slice(-30).map(d => ({
    ...d,
    label: formatFechaLabel(d.fecha),
    promFmt: d.promVendedor.toFixed(1),
  }));
  const avgProm = stats.promedioEquipoDia;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="font-semibold text-gray-900 mb-4">Actividad del Equipo por Día</h3>

      {/* Mini line chart */}
      {chartData.length > 1 && (
        <div className="mb-5">
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fontSize: 9 }} interval={Math.max(0, Math.floor(chartData.length / 10) - 1)} />
              <YAxis tick={{ fontSize: 10 }} allowDecimals />
              <Tooltip
                formatter={(v: unknown) => [`${Number(v).toFixed(1)} v/vend`, 'Prom/vend']}
                labelFormatter={(_: unknown, payload: readonly { payload?: { fecha?: string } }[]) =>
                  formatFecha(payload?.[0]?.payload?.fecha ?? '')}
              />
              <ReferenceLine y={avgProm} stroke={P.naranja} strokeDasharray="4 2"
                label={{ value: `Avg ${avgProm.toFixed(1)}`, position: 'right', fontSize: 9, fill: P.naranja }} />
              <Line type="monotone" dataKey="promVendedor" stroke={P.azul1} strokeWidth={2}
                dot={{ r: 2, fill: P.azul1 }} activeDot={{ r: 4 }} name="Prom/vend" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Tabla */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#003DA5] text-white">
              <th className="px-3 py-2 text-left text-xs font-semibold">Fecha</th>
              <th className="px-3 py-2 text-right text-xs font-semibold">Vendedores activos</th>
              <th className="px-3 py-2 text-right text-xs font-semibold">Ventas del día</th>
              <th className="px-3 py-2 text-right text-xs font-semibold">Prom / vendedor</th>
            </tr>
          </thead>
          <tbody>
            {stats.byDia.map((d, i) => {
              const isMax = Math.abs(d.promVendedor - maxProm) < 0.01;
              const isMin = d.vendedoresActivos > 1 && Math.abs(d.promVendedor - minProm) < 0.01;
              return (
                <tr
                  key={d.fecha}
                  className="border-t border-gray-100"
                  style={{
                    background: isMax ? '#f0fff4' : isMin ? '#fff5f5' : i % 2 === 0 ? '#fff' : '#f8fafc',
                  }}
                >
                  <td className="px-3 py-1.5 font-mono text-xs text-gray-600">{formatFecha(d.fecha)}</td>
                  <td className="px-3 py-1.5 text-right text-gray-700">{d.vendedoresActivos}</td>
                  <td className="px-3 py-1.5 text-right font-semibold text-[#003DA5]">{d.ventas}</td>
                  <td className="px-3 py-1.5 text-right">
                    <span className={`font-bold text-sm ${isMax ? 'text-green-700' : isMin ? 'text-red-600' : 'text-gray-700'}`}>
                      {d.promVendedor.toFixed(1)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. DISTRIBUCIÓN POR ESTADO (Mejora 5) — todos los estados reales
// ─────────────────────────────────────────────────────────────────────────────
function EstadoChart({ stats }: Pick<Props, 'stats'>) {
  if (!stats.hasEstado || stats.byEstadoRaw.length === 0) return null;

  const data = stats.byEstadoRaw;
  const total = data.reduce((s, d) => s + d.count, 0);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="font-semibold text-gray-900 mb-4">Distribución por Estado</h3>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pie */}
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <Pie
              data={data}
              dataKey="count"
              nameKey="estado"
              cx="50%"
              cy="50%"
              outerRadius={95}
              innerRadius={40}
              label={({ percent }: { percent?: number }) => `${((percent ?? 0) * 100).toFixed(0)}%`}
              labelLine
            >
              {data.map((entry, i) => (
                <Cell key={i} fill={getEstadoColor(entry.estado)} />
              ))}
            </Pie>
            <Tooltip formatter={fmt} />
            <Legend
              formatter={(value: string, entry: { payload?: { count?: number } }) =>
                `${value} (${entry?.payload?.count ?? 0})`}
            />
          </PieChart>
        </ResponsiveContainer>

        {/* Tabla */}
        <div className="overflow-x-auto self-center">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Estado</th>
                <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500">Cant.</th>
                <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500">%</th>
              </tr>
            </thead>
            <tbody>
              {data.map(d => (
                <tr key={d.estado} className="border-t border-gray-100">
                  <td className="px-3 py-1.5">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-1 rounded-full text-white"
                      style={{ background: getEstadoColor(d.estado) }}>
                      {d.estado}
                    </span>
                  </td>
                  <td className="px-3 py-1.5 text-right font-semibold text-gray-800">{d.count.toLocaleString()}</td>
                  <td className="px-3 py-1.5 text-right text-gray-500 text-xs">
                    {total > 0 ? ((d.count / total) * 100).toFixed(1) : 0}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. MODALIDAD DE VENTA (Mejora 10)
// ─────────────────────────────────────────────────────────────────────────────
const MODALIDAD_COLORS: Record<string, string> = {
  'Telemárketing':  P.azul1,
  'Telemarking':    P.azul1,
  'Telemarketing':  P.azul1,
  'Internet':       P.teal,
  'Presencial':     P.naranja,
};
function getModalidadColor(mod: string): string {
  return MODALIDAD_COLORS[mod] ?? PIE_PALETA[Object.keys(MODALIDAD_COLORS).length % PIE_PALETA.length];
}

function ModalidadChart({ stats }: Pick<Props, 'stats'>) {
  if (!stats.hasModalidad || stats.byModalidad.length === 0) return null;

  const data = stats.byModalidad;
  const total = data.reduce((s, d) => s + d.count, 0);

  // Mejor tasa de conversión
  let mejorMod = '';
  let mejorTasa = -1;
  for (const m of data) {
    if (m.count === 0) continue;
    const tasa = (m.vendidos / m.count) * 100;
    if (tasa > mejorTasa) { mejorTasa = tasa; mejorMod = m.modalidad; }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-start justify-between mb-4">
        <h3 className="font-semibold text-gray-900">Modalidad de Venta</h3>
        {mejorMod && (
          <span className="text-xs bg-green-50 text-green-700 border border-green-200 rounded-lg px-2 py-1 font-medium">
            Mejor conversión: {mejorMod} ({mejorTasa.toFixed(0)}%)
          </span>
        )}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie data={data} dataKey="count" nameKey="modalidad" cx="50%" cy="50%"
              outerRadius={85} innerRadius={35}
              label={({ percent }: { percent?: number }) => `${((percent ?? 0) * 100).toFixed(1)}%`} labelLine>
              {data.map((entry, i) => (
                <Cell key={i} fill={getModalidadColor(entry.modalidad)} />
              ))}
            </Pie>
            <Tooltip formatter={fmt} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>

        <div className="overflow-x-auto self-center">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Modalidad</th>
                <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500">Cant.</th>
                <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500">%</th>
                <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500">Vendidos</th>
                <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500">Conversión</th>
              </tr>
            </thead>
            <tbody>
              {data.map(d => {
                const conv = d.count > 0 ? (d.vendidos / d.count) * 100 : 0;
                return (
                  <tr key={d.modalidad} className="border-t border-gray-100">
                    <td className="px-3 py-1.5">
                      <span className="inline-block w-2.5 h-2.5 rounded-full mr-1.5 align-middle"
                        style={{ background: getModalidadColor(d.modalidad) }} />
                      {d.modalidad}
                    </td>
                    <td className="px-3 py-1.5 text-right font-semibold">{d.count.toLocaleString()}</td>
                    <td className="px-3 py-1.5 text-right text-gray-500 text-xs">
                      {total > 0 ? ((d.count / total) * 100).toFixed(1) : 0}%
                    </td>
                    <td className="px-3 py-1.5 text-right text-green-700 font-medium">{d.vendidos}</td>
                    <td className="px-3 py-1.5 text-right">
                      <span className={`text-xs font-bold ${conv >= 80 ? 'text-green-700' : conv >= 50 ? 'text-blue-700' : 'text-gray-500'}`}>
                        {conv.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. DISTRIBUCIÓN GEOGRÁFICA (Mejora 9)
// ─────────────────────────────────────────────────────────────────────────────
function DepartamentosChart({ stats }: Pick<Props, 'stats'>) {
  if (!stats.hasDepartamento || stats.byDepartamento.length === 0) return null;

  const data = stats.byDepartamento;
  const total = data.reduce((s, d) => s + d.count, 0);
  const max = data[0]?.count ?? 1;
  const MEDALS = ['🥇', '🥈', '🥉'];

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="font-semibold text-gray-900 mb-4">Distribución Geográfica</h3>

      {/* Top 3 badges */}
      <div className="flex gap-3 mb-4 flex-wrap">
        {data.slice(0, 3).map((d, i) => (
          <div key={d.departamento} className="flex items-center gap-1.5 bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5">
            <span className="text-base">{MEDALS[i]}</span>
            <span className="text-sm font-bold text-[#003DA5]">{d.departamento}</span>
            <span className="text-xs text-gray-500">· {d.count.toLocaleString()} ({total > 0 ? ((d.count / total) * 100).toFixed(1) : 0}%)</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart */}
        <div>
          <ResponsiveContainer width="100%" height={Math.max(data.length * 30 + 40, 200)}>
            <BarChart data={data} layout="vertical" margin={{ top: 0, right: 60, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
              <YAxis dataKey="departamento" type="category" tick={{ fontSize: 10 }} width={110} />
              <Tooltip formatter={fmt} contentStyle={{ fontSize: 12 }} />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                <LabelList dataKey="count" position="right" style={{ fontSize: 10, fill: '#334155', fontWeight: 600 }} />
                {data.map((d, i) => (
                  <Cell key={i} fill={
                    i === 0 ? P.azul1
                    : `rgba(0,61,165,${Math.max(0.3, 1 - (d.count / max) * 0.6 + 0.3)})`
                  } />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Tabla */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#003DA5] text-white">
                <th className="px-2 py-2 text-center text-xs font-semibold w-8">#</th>
                <th className="px-3 py-2 text-left text-xs font-semibold">Departamento</th>
                <th className="px-3 py-2 text-right text-xs font-semibold">Ventas</th>
                <th className="px-3 py-2 text-right text-xs font-semibold">%</th>
                {stats.hasEstado && <th className="px-3 py-2 text-right text-xs font-semibold">Vendidos</th>}
                {stats.hasEstado && <th className="px-3 py-2 text-right text-xs font-semibold">Pendientes</th>}
              </tr>
            </thead>
            <tbody>
              {data.map((d, i) => (
                <tr key={d.departamento} className={`border-t border-gray-100 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                  <td className="px-2 py-1.5 text-center text-xs text-gray-400">{i + 1}</td>
                  <td className="px-3 py-1.5 font-medium text-gray-800 text-sm">{d.departamento}</td>
                  <td className="px-3 py-1.5 text-right font-bold text-[#003DA5]">{d.count.toLocaleString()}</td>
                  <td className="px-3 py-1.5 text-right text-gray-500 text-xs">
                    {total > 0 ? ((d.count / total) * 100).toFixed(1) : 0}%
                  </td>
                  {stats.hasEstado && <td className="px-3 py-1.5 text-right text-green-700 font-medium">{d.vendidos}</td>}
                  {stats.hasEstado && <td className="px-3 py-1.5 text-right text-gray-500">{d.count - d.vendidos}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. RANKING DE BACK OFFICE (Mejora 8)
// ─────────────────────────────────────────────────────────────────────────────
function BackOfficeChart({ stats }: Pick<Props, 'stats'>) {
  if (!stats.hasBackOffice || stats.byBackOffice.length === 0) return null;

  const data = stats.byBackOffice;
  const total = data.reduce((s, d) => s + d.count, 0);
  const maxStates = 3; // max estado badges to show

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">Back Office</h3>
        {stats.sinBackOffice > 0 && (
          <span className="text-xs bg-orange-50 border border-orange-300 text-orange-700 rounded-lg px-2 py-1 font-medium">
            ⚠ {stats.sinBackOffice.toLocaleString()} sin asignar
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart */}
        <div>
          <ResponsiveContainer width="100%" height={Math.max(data.length * 36 + 40, 200)}>
            <BarChart data={data} layout="vertical" margin={{ top: 0, right: 55, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
              <YAxis dataKey="nombre" type="category" tick={{ fontSize: 10 }} width={120} />
              <Tooltip formatter={fmt} contentStyle={{ fontSize: 12 }} />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                <LabelList dataKey="count" position="right" style={{ fontSize: 10, fill: '#334155', fontWeight: 600 }} />
                {data.map((d, i) => (
                  <Cell key={i} fill={d.nombre === 'Sin asignar' ? P.naranja : P.azul1}
                    opacity={d.nombre === 'Sin asignar' ? 1 : 1 - i * 0.03} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Tabla */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#003DA5] text-white">
                <th className="px-3 py-2 text-left text-xs font-semibold">Back Office</th>
                <th className="px-3 py-2 text-right text-xs font-semibold">Contratos</th>
                <th className="px-3 py-2 text-right text-xs font-semibold">%</th>
                <th className="px-3 py-2 text-left text-xs font-semibold">Estados</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d, i) => {
                const topEstados = Object.entries(d.estados)
                  .sort(([, a], [, b]) => b - a)
                  .slice(0, maxStates);
                const isSA = d.nombre === 'Sin asignar';
                return (
                  <tr key={d.nombre} className={`border-t border-gray-100 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                    <td className="px-3 py-2">
                      {isSA
                        ? <span className="text-xs font-semibold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">⚠ Sin asignar</span>
                        : <span className="text-sm font-medium text-gray-800">{d.nombre}</span>}
                    </td>
                    <td className="px-3 py-2 text-right font-bold text-[#003DA5]">{d.count.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right text-gray-500 text-xs">
                      {total > 0 ? ((d.count / total) * 100).toFixed(1) : 0}%
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        {topEstados.map(([est, cnt]) => (
                          <span key={est} className="text-[10px] font-semibold text-white px-1.5 py-0.5 rounded"
                            style={{ background: getEstadoColor(est) }}>
                            {est.length > 8 ? est.slice(0, 8) + '…' : est}: {cnt}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 10. RANKING DE RECHAZOS (Mejora 7)
// ─────────────────────────────────────────────────────────────────────────────
function RechazosChart({ stats }: Pick<Props, 'stats'>) {
  if (!stats.hasEstado) return null;

  const conRechazos = stats.byFuncionario
    .filter(f => f.rechazos > 0)
    .map(f => ({ ...f, pctRechazo: f.total > 0 ? (f.rechazos / f.total) * 100 : 0 }))
    .sort((a, b) => b.rechazos - a.rechazos)
    .slice(0, 10);

  if (conRechazos.length === 0) return null;

  const tasaEquipo = stats.tasaRechazoEquipo ?? 0;

  function badgePct(pct: number) {
    if (pct < 5)  return { label: 'Bajo',  bg: '#d4edda', color: '#155724' };
    if (pct <= 15) return { label: 'Medio', bg: '#fff3cd', color: '#856404' };
    return              { label: 'Alto',  bg: '#f8d7da', color: '#721c24' };
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">Ranking de Rechazos</h3>
        <div className="text-sm">
          <span className="text-gray-500">Tasa equipo: </span>
          <span className={`font-bold ${tasaEquipo < 5 ? 'text-green-700' : tasaEquipo <= 10 ? 'text-orange-600' : 'text-red-600'}`}>
            {tasaEquipo.toFixed(1)}%
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart */}
        <div>
          <ResponsiveContainer width="100%" height={Math.max(conRechazos.length * 38 + 40, 200)}>
            <BarChart data={conRechazos} layout="vertical" margin={{ top: 0, right: 55, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
              <YAxis dataKey="nombre" type="category" tick={{ fontSize: 10 }} width={170} />
              <Tooltip formatter={(v: unknown) => [Number(v).toLocaleString(), 'Rechazos']} contentStyle={{ fontSize: 12 }} />
              <Bar dataKey="rechazos" fill={P.rojo} radius={[0, 4, 4, 0]}>
                <LabelList dataKey="rechazos" position="right" style={{ fontSize: 11, fill: '#334155', fontWeight: 600 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Tabla */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#003DA5] text-white">
                <th className="px-2 py-2 text-center text-xs font-semibold w-8">#</th>
                <th className="px-3 py-2 text-left text-xs font-semibold">Vendedor</th>
                <th className="px-3 py-2 text-right text-xs font-semibold">Rechazos</th>
                <th className="px-3 py-2 text-right text-xs font-semibold">Total</th>
                <th className="px-3 py-2 text-right text-xs font-semibold">% Rechazo</th>
              </tr>
            </thead>
            <tbody>
              {conRechazos.map((f, i) => {
                const b = badgePct(f.pctRechazo);
                return (
                  <tr key={f.nombre} className={`border-t border-gray-100 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                    <td className="px-2 py-1.5 text-center text-xs text-gray-400">{i + 1}</td>
                    <td className="px-3 py-1.5 font-medium text-gray-800 text-sm truncate max-w-[160px]">{f.nombre}</td>
                    <td className="px-3 py-1.5 text-right font-bold text-red-600">{f.rechazos}</td>
                    <td className="px-3 py-1.5 text-right text-gray-600">{f.total}</td>
                    <td className="px-3 py-1.5 text-right">
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                        style={{ background: b.bg, color: b.color }}>
                        {f.pctRechazo.toFixed(1)}% {b.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 12. EVOLUCIÓN TEMPORAL — separado (se renderiza en VentasModule)
// ─────────────────────────────────────────────────────────────────────────────
export function TemporalChart({ stats }: { stats: VentasStats }) {
  const data = stats.byFecha.map(f => ({
    ...f,
    label: formatFechaLabel(f.fecha),
  }));

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="font-semibold text-gray-900 mb-4">Evolución Temporal (ventas por día)</h3>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10 }}
            interval={data.length > 20 ? Math.floor(data.length / 15) : 0}
          />
          <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
          <Tooltip
            formatter={fmt}
            labelFormatter={(_: unknown, payload: readonly { payload?: { fecha?: string } }[]) => {
              const f = payload?.[0]?.payload?.fecha;
              if (!f) return '';
              try { return format(parseISO(f), 'dd/MM/yyyy'); } catch { return f; }
            }}
          />
          <Line
            type="monotone"
            dataKey="ventas"
            stroke={P.azul1}
            strokeWidth={2}
            dot={{ r: 3, fill: P.azul1, strokeWidth: 0 }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Gráfico auxiliar: Tipo de gestión (plan / motivo)
// ─────────────────────────────────────────────────────────────────────────────
function PlanChart({ stats }: Pick<Props, 'stats'>) {
  if (!stats.byPlan.length) return null;
  const data = stats.byPlan.slice(0, 12).map(p => ({
    nombre: truncate(p.nombre),
    ventas: p.ventas,
    fullNombre: p.nombre,
  }));

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="font-semibold text-gray-900 mb-4">Distribución por Plan</h3>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 60 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="nombre" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" interval={0} />
          <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
          <Tooltip
            formatter={fmt}
            labelFormatter={(_: unknown, payload: readonly { payload?: { fullNombre?: string } }[]) =>
              payload?.[0]?.payload?.fullNombre ?? ''}
          />
          <Bar dataKey="ventas" radius={[4, 4, 0, 0]}>
            <LabelList dataKey="ventas" position="top" style={{ fontSize: 10, fill: '#334155' }} />
            {data.map((_, i) => <Cell key={i} fill={PIE_PALETA[i % PIE_PALETA.length]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Default export — secciones 3-10 (sin temporal)
// ─────────────────────────────────────────────────────────────────────────────
export default function VentasCharts(props: Props) {
  const { stats } = props;
  return (
    <div className="space-y-6">
      {/* 3. Ranking */}
      <RankingChart {...props} />

      {/* 4. Composición stacked */}
      <StackedChart stats={stats} />

      {/* 5. Métricas diarias equipo */}
      <MetricasDiariasEquipo key={`actividad-equipo-${stats.byDia.length}-${stats.fechaMin}`} stats={stats} />

      {/* Distribución por plan (si hay datos) */}
      {stats.byPlan.length > 0 && <PlanChart stats={stats} />}

      {/* 6. Distribución por estado */}
      <EstadoChart stats={stats} />

      {/* 7. Modalidad */}
      <ModalidadChart stats={stats} />

      {/* 8. Departamentos */}
      <DepartamentosChart stats={stats} />

      {/* 9. Back Office */}
      <BackOfficeChart stats={stats} />

      {/* 10. Rechazos */}
      <RechazosChart stats={stats} />
    </div>
  );
}
