import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, PieChart, Pie, Legend,
} from 'recharts';
import type { ResultadoVendedor, ResumenPlan } from './ComisionesConfig';
import { fmtPesos } from './ComisionesConfig';

// ─── Color helpers ────────────────────────────────────────────────────────────

function condColor(v: ResultadoVendedor): string {
  if (v.sinCondicion)               return '#E3000F';
  if (v.condicionAplicada === 'condicion2') return '#ca8a04';
  return '#003DA5';
}

// ─── Ranking horizontal bars ─────────────────────────────────────────────────

export function RankingComisionesChart({ vendedores }: { vendedores: ResultadoVendedor[] }) {
  const data = [...vendedores]
    .sort((a, b) => b.comisionTotal - a.comisionTotal)
    .slice(0, 15)
    .map(v => ({
      nombre:   v.nombre.split(' ')[0] ?? v.nombre,
      monto:    v.comisionTotal,
      color:    condColor(v),
      fullName: v.nombre,
    }));

  return (
    <ResponsiveContainer width="100%" height={Math.max(200, data.length * 36)}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 80, bottom: 4, left: 8 }}
      >
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
        <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => `$${Math.round(v as number / 1000)}k`} />
        <YAxis type="category" dataKey="nombre" width={90} tick={{ fontSize: 11 }} />
        <Tooltip
          formatter={(v) => [fmtPesos(v as number), 'Comisión']}
          labelFormatter={(_, payload) => (payload?.[0]?.payload as { fullName: string })?.fullName ?? ''}
        />
        <Bar dataKey="monto" radius={[0, 4, 4, 0]} maxBarSize={22} label={{ position: 'right', fontSize: 10, formatter: (v) => fmtPesos(v as number) }}>
          {data.map((d, i) => <Cell key={i} fill={d.color} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── Stacked bar: ventas por plan ─────────────────────────────────────────────

export function VentasPorPlanChart({ planes }: { planes: ResumenPlan[] }) {
  const data = [...planes]
    .sort((a, b) => b.total - a.total)
    .slice(0, 12)
    .map(p => ({
      plan:      p.plan.length > 22 ? p.plan.substring(0, 20) + '…' : p.plan,
      fullPlan:  p.plan,
      Renovaciones: p.renovaciones,
      Altas:        p.altas,
      Cambios:      p.cambios,
    }));

  return (
    <ResponsiveContainer width="100%" height={Math.max(200, data.length * 36)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 20, bottom: 4, left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
        <XAxis type="number" tick={{ fontSize: 10 }} />
        <YAxis type="category" dataKey="plan" width={140} tick={{ fontSize: 10 }} />
        <Tooltip
          labelFormatter={(_, payload) => (payload?.[0]?.payload as { fullPlan: string })?.fullPlan ?? ''}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar dataKey="Renovaciones" stackId="a" fill="#16a34a" maxBarSize={18} />
        <Bar dataKey="Altas"        stackId="a" fill="#003DA5" maxBarSize={18} />
        <Bar dataKey="Cambios"      stackId="a" fill="#f59e0b" maxBarSize={18} radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── Donut: condición alcanzada ───────────────────────────────────────────────

export function CondicionDonutChart({ vendedores }: { vendedores: ResultadoVendedor[] }) {
  const cond2 = vendedores.filter(v => v.condicionAplicada === 'condicion2').length;
  const cond1 = vendedores.filter(v => v.condicionAplicada === 'condicion1').length;
  const sinC  = vendedores.filter(v => v.sinCondicion).length;

  const cond2Label = vendedores.find(v => v.condicionAplicada === 'condicion2')?.nombreCondicion ?? 'Condición 2';
  const cond1Label = vendedores.find(v => v.condicionAplicada === 'condicion1')?.nombreCondicion ?? 'Condición 1';

  const data = [
    { name: cond2Label, value: cond2, fill: '#ca8a04' },
    { name: cond1Label, value: cond1, fill: '#003DA5' },
    { name: 'Sin condición', value: sinC, fill: '#E3000F' },
  ].filter(d => d.value > 0);

  const total = vendedores.length;

  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={55}
          outerRadius={85}
          paddingAngle={3}
          dataKey="value"
          label={({ name, value }) => `${name}: ${value}`}
          labelLine={false}
        >
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
