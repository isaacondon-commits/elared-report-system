import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell,
} from 'recharts';
import type { SancionesStats } from './SancionesModule';

const COLORS = ['#E3000F', '#003DA5', '#CC2200', '#0066CC', '#FF4422', '#3385CC'];

const fmtNum = (v: unknown): [string, string] => [Number(v).toLocaleString(), ''];

interface Props {
  stats: SancionesStats;
}

export default function SancionesCharts({ stats }: Props) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Ranking por funcionario</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart
              data={stats.byFuncionario.slice(0, 12)}
              layout="vertical"
              margin={{ top: 0, right: 30, left: 80, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
              <YAxis dataKey="nombre" type="category" tick={{ fontSize: 11 }} width={75} />
              <Tooltip formatter={fmtNum} contentStyle={{ fontSize: 12 }} />
              <Bar dataKey="total" radius={[0, 3, 3, 0]}>
                {stats.byFuncionario.slice(0, 12).map((_, i) => (
                  <Cell key={i} fill={i === 0 ? '#E3000F' : '#003DA5'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Distribución por tipo</h3>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={stats.byTipo}
                dataKey="count"
                nameKey="tipo"
                cx="45%"
                cy="50%"
                outerRadius={90}
                label={({ percent }: { percent?: number }) =>
                  `${((percent ?? 0) * 100).toFixed(0)}%`
                }
                labelLine={false}
              >
                {stats.byTipo.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={fmtNum} />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-2 space-y-1">
            {stats.byTipo.slice(0, 6).map((t, i) => (
              <div key={t.tipo} className="flex items-center gap-2 text-xs">
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                <span className="text-gray-700 flex-1">{t.tipo}</span>
                <span className="font-semibold text-gray-900">{t.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {stats.byMes.length > 1 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Evolución mensual de sanciones</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={stats.byMes} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip formatter={fmtNum} />
              <Line
                type="monotone"
                dataKey="count"
                stroke="#E3000F"
                strokeWidth={2}
                dot={{ r: 4, fill: '#E3000F' }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
