import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, PieChart, Pie, Legend,
} from 'recharts';
import type { ResultadoVendedorFibra } from './ComisionesFibraConfig';
import { fmtPesos } from './ComisionesFibraConfig';

// ─── Ranking horizontal bar chart ─────────────────────────────────────────────

export function RankingFibraChart({ vendedores }: { vendedores: ResultadoVendedorFibra[] }) {
  const data = [...vendedores]
    .sort((a, b) => b.comisionTotal - a.comisionTotal)
    .slice(0, 15)
    .map(v => ({
      nombre:   v.nombre.split(' ')[0] ?? v.nombre,
      fullName: v.nombre,
      monto:    v.comisionTotal,
      color:    v.noLlegoAlMinimo ? '#E3000F' : v.condicion === '80_sin_falta' ? '#ca8a04' : '#003DA5',
    }));

  if (data.length === 0) return <p className="text-gray-400 text-sm text-center py-8">Sin datos</p>;

  return (
    <ResponsiveContainer width="100%" height={Math.max(200, data.length * 36)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 80, bottom: 4, left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
        <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => `$${Math.round(v as number / 1000)}k`} />
        <YAxis type="category" dataKey="nombre" width={90} tick={{ fontSize: 11 }} />
        <Tooltip
          formatter={(v) => [fmtPesos(v as number), 'Comisión']}
          labelFormatter={(_, payload) => (payload?.[0]?.payload as { fullName: string })?.fullName ?? ''}
        />
        <Bar dataKey="monto" radius={[0, 4, 4, 0]} maxBarSize={22}
          label={{ position: 'right', fontSize: 10, formatter: (v: unknown) => fmtPesos(v as number) }}>
          {data.map((d, i) => <Cell key={i} fill={d.color} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── Condiciones donut ────────────────────────────────────────────────────────

export function CondicionesFibraDonut({ vendedores }: { vendedores: ResultadoVendedorFibra[] }) {
  const n80  = vendedores.filter(v => v.condicion === '80_sin_falta').length;
  const n50  = vendedores.filter(v => v.condicion === '50_o_falta' && !v.noLlegoAlMinimo).length;
  const bajo = vendedores.filter(v => v.noLlegoAlMinimo).length;

  const data = [
    { name: '80 Sin Falta', value: n80,  fill: '#ca8a04' },
    { name: '50 o Falta',   value: n50,  fill: '#003DA5' },
    { name: 'Bajo Mínimo',  value: bajo, fill: '#E3000F' },
  ].filter(d => d.value > 0);

  const total = vendedores.length;

  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie data={data} cx="50%" cy="50%" innerRadius={55} outerRadius={85}
          paddingAngle={3} dataKey="value"
          label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
          {data.map((d, i) => <Cell key={i} fill={d.fill} />)}
        </Pie>
        <Tooltip formatter={(v) => [`${v} vendedores`, '']} />
        <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" fontSize={18} fontWeight="bold" fill="#1e293b">
          {total}
        </text>
        <text x="50%" y="50%" dy={18} textAnchor="middle" dominantBaseline="middle" fontSize={10} fill="#64748b">
          vendedores
        </text>
      </PieChart>
    </ResponsiveContainer>
  );
}

// ─── Franja distribution ──────────────────────────────────────────────────────

export function FranjaFibraChart({ vendedores }: { vendedores: ResultadoVendedorFibra[] }) {
  const f1 = vendedores.filter(v => v.franja === '50_200').length;
  const f2 = vendedores.filter(v => v.franja === '201_250').length;
  const f3 = vendedores.filter(v => v.franja === '250_plus').length;

  const data = [
    { name: 'Franja 1 (50-200)', value: f1, fill: '#6c757d' },
    { name: 'Franja 2 (201-250)', value: f2, fill: '#003DA5' },
    { name: 'Franja 3 (250+)',    value: f3, fill: '#ca8a04' },
  ].filter(d => d.value > 0);

  if (data.length === 0) return <p className="text-gray-400 text-sm text-center py-8">Sin datos</p>;

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 4, right: 20, bottom: 4, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
        <XAxis dataKey="name" tick={{ fontSize: 10 }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
        <Tooltip formatter={(v) => [`${v} vendedores`, '']} />
        <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={60}
          label={{ position: 'top', fontSize: 11, fontWeight: 600 }}>
          {data.map((d, i) => <Cell key={i} fill={d.fill} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── Ventas por modalidad ─────────────────────────────────────────────────────

export function ModalidadFibraChart({ vendedores }: { vendedores: ResultadoVendedorFibra[] }) {
  const tmTotal  = vendedores.reduce((s, v) => s + v.ventasTelemarketing, 0);
  const intTotal = vendedores.reduce((s, v) => s + v.ventasInternet, 0);
  const total    = tmTotal + intTotal;

  const data = [
    { name: 'Telemarketing / Presencial', value: tmTotal,  fill: '#003DA5' },
    { name: 'Internet',                   value: intTotal, fill: '#20c997' },
  ].filter(d => d.value > 0);

  if (data.length === 0) return <p className="text-gray-400 text-sm text-center py-8">Sin datos</p>;

  return (
    <div className="space-y-3">
      <ResponsiveContainer width="100%" height={160}>
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={40} outerRadius={70}
            paddingAngle={3} dataKey="value"
            label={({ percent }) => `${((percent ?? 0) * 100).toFixed(0)}%`} labelLine>
            {data.map((d, i) => <Cell key={i} fill={d.fill} />)}
          </Pie>
          <Tooltip formatter={(v) => [`${v} ventas`, '']} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
        </PieChart>
      </ResponsiveContainer>
      <div className="text-xs text-center text-gray-400">
        {tmTotal.toLocaleString()} TM · {intTotal.toLocaleString()} Internet · {total.toLocaleString()} total
      </div>
    </div>
  );
}
