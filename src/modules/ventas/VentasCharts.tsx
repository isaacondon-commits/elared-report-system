import { useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, LabelList, ReferenceLine, Cell,
  PieChart, Pie, Legend,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import type { VentasStats } from './VentasModule';
import { getEstadoColor } from './VentasModule';
import { getEquivalente, getEquivalenteColor } from '../../utils/smartParser';

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

const PLAN_ABREVIATURAS: Record<string, string> = {
  'FIBRA ENTRETENIMIENTO ESTANDAR':  'FIBRA ENT. ESTANDAR',
  'FIBRA ENTRETENIMIENTO PREMIUM':   'FIBRA ENT. PREMIUM',
  'FIBRA ENTRETENIMIENTO NETFLIX':   'FIBRA ENT. NETFLIX',
  'FIBRA SUPER ENTRETENIMIENTO':     'FIBRA SUPER ENT.',
  'FIBRA CON LIMITE 1':              'FIBRA C/LIMITE 1',
  'FIBRA CON LIMITE 2':              'FIBRA C/LIMITE 2',
  'CANCELADO POR CLIENTE':           'CANC. X CLIENTE',
  'VENDIDO POR OTRA EMPRESA':        'VEND. OTRA EMP.',
  'GESTION DISTRIBUCION':            'GEST. DISTRIB.',
};
export function abreviarPlan(nombre: string): string {
  return PLAN_ABREVIATURAS[nombre.toUpperCase()] ?? (nombre.length > 22 ? nombre.substring(0, 20) + '…' : nombre);
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
// Promedio de Ventas por Vendedor — colapsable, con buscador
// ─────────────────────────────────────────────────────────────────────────────
function MetricasDiariasEquipo({ stats }: Pick<Props, 'stats'>) {
  if (stats.byDia.length === 0) return null;

  const [expanded, setExpanded] = useState(() => {
    try { return sessionStorage.getItem('elared_ventas_actividad_expandida') === 'true'; }
    catch { return false; }
  });
  const [busqueda, setBusqueda] = useState('');

  function toggleExpanded() {
    const next = !expanded;
    setExpanded(next);
    try { sessionStorage.setItem('elared_ventas_actividad_expandida', String(next)); }
    catch {}
  }

  const maxProm = Math.max(...stats.byDia.map(d => d.promVendedor));
  const validDias = stats.byDia.filter(d => d.vendedoresActivos > 1);
  const minProm = validDias.length > 0 ? Math.min(...validDias.map(d => d.promVendedor)) : -1;

  const chartData = [...stats.byDia].reverse().slice(-30).map(d => ({
    ...d,
    label: formatFechaLabel(d.fecha),
  }));
  const avgProm = stats.promedioEquipoDia;

  const filasVisibles = busqueda.trim()
    ? stats.byDia.filter(d => formatFecha(d.fecha).includes(busqueda.trim()))
    : stats.byDia;

  return (
    <div className="bg-white rounded-xl border border-gray-200">
      <button
        onClick={toggleExpanded}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 rounded-xl"
        style={{ background: 'none', border: 'none', cursor: 'pointer' }}
      >
        <h3 className="font-semibold text-gray-900">
          <span className="mr-2 text-gray-400">{expanded ? '▼' : '▶'}</span>
          Promedio de Ventas por Vendedor
        </h3>
        <span className="text-xs text-gray-400">{stats.byDia.length} días · click para {expanded ? 'colapsar' : 'expandir'}</span>
      </button>

      {expanded && (
        <div className="px-5 pb-5 border-t border-gray-100">
          {chartData.length > 1 && (
            <div className="mt-4 mb-5">
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

          <div className="mb-3">
            <input
              type="text"
              placeholder="🔍 Buscar fecha (ej: 12/06)..."
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              className="w-full sm:w-64 px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#003DA5]"
            />
          </div>

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
                {filasVisibles.map((d, i) => {
                  const isMax = Math.abs(d.promVendedor - maxProm) < 0.01;
                  const isMin = d.vendedoresActivos > 1 && Math.abs(d.promVendedor - minProm) < 0.01;
                  return (
                    <tr key={d.fecha} className="border-t border-gray-100"
                      style={{ background: isMax ? '#f0fff4' : isMin ? '#fff5f5' : i % 2 === 0 ? '#fff' : '#f8fafc' }}>
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
                {filasVisibles.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-4 text-center text-gray-400 text-sm">
                      Sin resultados para "{busqueda}"
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Distribución por Estado — solo tabla con columna EQUIVALENTE
// ─────────────────────────────────────────────────────────────────────────────
function EstadoChart({ stats }: Pick<Props, 'stats'>) {
  if (!stats.hasEstado || stats.byEstadoRaw.length === 0) return null;

  const data = stats.byEstadoRaw;
  const total = data.reduce((s, d) => s + d.count, 0);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="font-semibold text-gray-900 mb-4">Distribución por Estado</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#003DA5] text-white">
              <th className="px-3 py-2 text-left text-xs font-semibold">Estado</th>
              <th className="px-3 py-2 text-left text-xs font-semibold">Equivalente</th>
              <th className="px-3 py-2 text-right text-xs font-semibold">Cantidad</th>
              <th className="px-3 py-2 text-right text-xs font-semibold">% del Total</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d, i) => {
              const eq = getEquivalente(d.estado);
              return (
                <tr key={d.estado} className="border-t border-gray-100"
                  style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
                  <td className="px-3 py-2 font-medium text-gray-800">{d.estado}</td>
                  <td className="px-3 py-2">
                    {eq ? (
                      <span className="inline-block text-xs font-semibold px-2 py-0.5 rounded-full text-white"
                        style={{ background: getEquivalenteColor(eq) }}>
                        {eq}
                      </span>
                    ) : <span className="text-gray-300 text-xs">—</span>}
                  </td>
                  <td className="px-3 py-2 text-right font-bold text-[#003DA5]">{d.count.toLocaleString()}</td>
                  <td className="px-3 py-2 text-right text-gray-500 text-xs">
                    {total > 0 ? ((d.count / total) * 100).toFixed(1) : 0}%
                  </td>
                </tr>
              );
            })}
            <tr className="border-t-2 border-gray-300" style={{ background: '#f1f5f9' }}>
              <td className="px-3 py-2 font-bold text-gray-700">TOTAL</td>
              <td className="px-3 py-2" />
              <td className="px-3 py-2 text-right font-bold text-gray-800">{total.toLocaleString()}</td>
              <td className="px-3 py-2 text-right font-bold text-gray-600 text-xs">100%</td>
            </tr>
          </tbody>
        </table>
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
// Ranking de Rechazos — ordenado por % desc, mínimo 5 ventas
// ─────────────────────────────────────────────────────────────────────────────
function RechazosChart({ stats }: Pick<Props, 'stats'>) {
  if (!stats.hasEstado) return null;

  const conRechazos = stats.byFuncionario
    .filter(f => f.total >= 5 && f.rechazos > 0)
    .map(f => ({ ...f, pctRechazo: f.total > 0 ? (f.rechazos / f.total) * 100 : 0 }))
    .sort((a, b) => b.pctRechazo - a.pctRechazo)
    .slice(0, 12);

  if (conRechazos.length === 0) return null;

  const tasaEquipo = stats.tasaRechazoEquipo ?? 0;

  function riesgoBadge(pct: number) {
    if (pct > 30) return { label: 'Crítico', bg: '#7f1d1d', color: '#fff' };
    if (pct > 15) return { label: 'Alto',    bg: '#E3000F', color: '#fff' };
    if (pct >= 5) return { label: 'Medio',   bg: '#fd7e14', color: '#fff' };
    return              { label: 'Bajo',    bg: '#d4edda', color: '#155724' };
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
          <span className="text-gray-400 text-xs ml-2">(solo vendedores con ≥5 ventas)</span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#003DA5] text-white">
              <th className="px-2 py-2 text-center text-xs font-semibold w-8">#</th>
              <th className="px-3 py-2 text-left text-xs font-semibold">Vendedor</th>
              <th className="px-3 py-2 text-right text-xs font-semibold">Total Ventas</th>
              <th className="px-3 py-2 text-right text-xs font-semibold">Rechazos</th>
              <th className="px-3 py-2 text-right text-xs font-semibold">% Rechazo</th>
              <th className="px-3 py-2 text-center text-xs font-semibold">Riesgo</th>
            </tr>
          </thead>
          <tbody>
            {conRechazos.map((f, i) => {
              const b = riesgoBadge(f.pctRechazo);
              return (
                <tr key={f.nombre} className={`border-t border-gray-100 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                  <td className="px-2 py-1.5 text-center text-xs text-gray-400">{i + 1}</td>
                  <td className="px-3 py-1.5 font-medium text-gray-800 text-sm truncate max-w-[200px]">{f.nombre}</td>
                  <td className="px-3 py-1.5 text-right text-gray-600">{f.total}</td>
                  <td className="px-3 py-1.5 text-right font-bold text-red-600">{f.rechazos}</td>
                  <td className="px-3 py-1.5 text-right font-bold"
                    style={{ color: f.pctRechazo > 15 ? '#E3000F' : f.pctRechazo >= 5 ? '#fd7e14' : '#28a745' }}>
                    {f.pctRechazo.toFixed(1)}%
                  </td>
                  <td className="px-3 py-1.5 text-center">
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                      style={{ background: b.bg, color: b.color }}>
                      {b.label}
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
// 12. EVOLUCIÓN TEMPORAL — separado (se renderiza en VentasModule)
// ─────────────────────────────────────────────────────────────────────────────
export function TemporalChart({ stats }: { stats: VentasStats }) {
  const data = stats.byFecha.map(f => ({
    ...f,
    label: formatFechaLabel(f.fecha),
  }));

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="font-semibold text-gray-900 mb-4">Ventas Diarias</h3>
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
    nombre: abreviarPlan(p.nombre),
    ventas: p.ventas,
    fullNombre: p.nombre,
  }));

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="font-semibold text-gray-900 mb-4">Planes Vendidos</h3>
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
// Default export — secciones secundarias (sin ranking, sin stacked, sin temporal)
// ─────────────────────────────────────────────────────────────────────────────
export default function VentasCharts(props: Props) {
  const { stats } = props;
  return (
    <div className="space-y-6">
      {/* Promedio de Ventas por Vendedor */}
      <MetricasDiariasEquipo key={`actividad-equipo-${stats.byDia.length}-${stats.fechaMin}`} stats={stats} />

      {/* Distribución por Estado (solo tabla) */}
      <EstadoChart stats={stats} />

      {/* Planes Vendidos */}
      {stats.byPlan.length > 0 && <PlanChart stats={stats} />}

      {/* Modalidad de Venta */}
      <ModalidadChart stats={stats} />

      {/* Distribución Geográfica */}
      <DepartamentosChart stats={stats} />

      {/* Back Office */}
      <BackOfficeChart stats={stats} />

      {/* Ranking de Rechazos (por %) */}
      <RechazosChart stats={stats} />
    </div>
  );
}
