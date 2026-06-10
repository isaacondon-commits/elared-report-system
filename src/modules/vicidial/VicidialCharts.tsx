import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
  ReferenceLine, BarChart, Bar, LabelList, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import type { VicidialAgente, VicidialData } from './vicidialParser';
import {
  getNombreLegible,
  findAlmuerzoKey, findBaoKey, findVtamovKey, findManualKey,
} from './vicidialParser';

// ─── Internal helpers ─────────────────────────────────────────────────────────

function normKey(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

function findKey(tiposPausa: string[], ...patterns: string[]): string | undefined {
  return tiposPausa.find(t => patterns.includes(normKey(t)));
}

function buildData(agentes: VicidialAgente[], key: string) {
  return agentes
    .map(a => ({ name: a.usuario, mins: Math.round(a.pausas[key] ?? 0) }))
    .filter(d => d.mins > 0)
    .sort((a, b) => b.mins - a.mins);
}

function calcAvg(data: { mins: number }[]): number | undefined {
  if (data.length < 2) return undefined;
  return data.reduce((s, d) => s + d.mins, 0) / data.length;
}

// ─── PausaBarBase — internal reusable core ────────────────────────────────────

function PausaBarBase({
  data,
  referencia,
  refColor = '#ef4444',
  refLabel,
  overColor,
  underColor,
}: {
  data: { name: string; mins: number }[];
  referencia?: number;
  refColor?: string;
  refLabel?: string;
  overColor: string;
  underColor: string;
}) {
  const colorOf = (mins: number) =>
    referencia !== undefined && mins > referencia ? overColor : underColor;

  return (
    <ResponsiveContainer width="100%" height={Math.max(200, data.length * 28)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 50, left: 4, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
        <XAxis type="number" unit=" min" tick={{ fontSize: 10 }} />
        <YAxis dataKey="name" type="category" width={90} tick={{ fontSize: 10 }} />
        {referencia !== undefined && (
          <ReferenceLine
            x={referencia}
            stroke={refColor}
            strokeWidth={2}
            strokeDasharray="4 4"
            label={{ value: refLabel ?? `${Math.round(referencia)} min`, position: 'insideTopRight', fontSize: 10, fill: refColor }}
          />
        )}
        <Tooltip formatter={(v) => `${v} min`} />
        <Bar dataKey="mins" name="Minutos" radius={[0, 3, 3, 0]}>
          {data.map((entry, i) => <Cell key={i} fill={colorOf(entry.mins)} />)}
          <LabelList dataKey="mins" position="right" style={{ fontSize: 10 }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── DonutTiempoChart ─────────────────────────────────────────────────────────

export function DonutTiempoChart({ totales }: { totales: VicidialAgente }) {
  const data = [
    { name: 'Hablando',       value: Math.round(totales.pctHablando),      color: '#22c55e' },
    { name: 'En pausa',       value: Math.round(totales.pctPausa),         color: '#f59e0b' },
    { name: 'Categorizando',  value: Math.round(totales.pctCategorizando), color: '#3b82f6' },
    { name: 'En espera',      value: Math.round(totales.pctEspera),        color: '#94a3b8' },
  ].filter(d => d.value > 0);

  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie data={data} cx="50%" cy="50%" innerRadius={65} outerRadius={100}
             dataKey="value" nameKey="name" paddingAngle={2}>
          {data.map((entry, i) => <Cell key={i} fill={entry.color} />)}
        </Pie>
        <Tooltip formatter={(v) => `${v}%`} />
        <Legend iconType="circle" iconSize={10} />
      </PieChart>
    </ResponsiveContainer>
  );
}

// ─── AlmuerzoBarChart — límite fijo 30 min ────────────────────────────────────

export function AlmuerzoBarChart({ agentes, tiposPausa }: { agentes: VicidialAgente[]; tiposPausa: string[] }) {
  const almKey = findAlmuerzoKey(tiposPausa);
  if (!almKey) return null;

  const data = buildData(agentes, almKey);
  if (data.length === 0) return null;

  return (
    <PausaBarBase
      data={data}
      referencia={30}
      refColor="#ef4444"
      refLabel="30 min"
      overColor="#ef4444"
      underColor="#003DA5"
    />
  );
}

// ─── BanoBarChart — límite fijo 10 min ────────────────────────────────────────

export function BanoBarChart({ agentes, tiposPausa }: { agentes: VicidialAgente[]; tiposPausa: string[] }) {
  const baoKey = findBaoKey(tiposPausa);
  if (!baoKey) return null;

  const data = buildData(agentes, baoKey);
  if (data.length === 0) return null;

  return (
    <PausaBarBase
      data={data}
      referencia={10}
      refColor="#ef4444"
      refLabel="10 min"
      overColor="#ef4444"
      underColor="#003DA5"
    />
  );
}

// ─── VentaBarChart — todas las barras en verde, promedio informativo ───────────

export function VentaBarChart({ agentes, tiposPausa }: { agentes: VicidialAgente[]; tiposPausa: string[] }) {
  const vtKey = findVtamovKey(tiposPausa);
  if (!vtKey) return null;

  const data = buildData(agentes, vtKey);
  if (data.length === 0) return null;

  const avg = calcAvg(data);

  return (
    <PausaBarBase
      data={data}
      referencia={avg}
      refColor="#28a745"
      refLabel={avg !== undefined ? `Promedio: ${Math.round(avg)} min` : undefined}
      overColor="#28a745"
      underColor="#28a745"
    />
  );
}

// ─── ManualBarChart — promedio dinámico, rojo si supera ──────────────────────

export function ManualBarChart({ agentes, tiposPausa }: { agentes: VicidialAgente[]; tiposPausa: string[] }) {
  const manKey = findManualKey(tiposPausa);
  if (!manKey) return null;

  const data = buildData(agentes, manKey);
  if (data.length === 0) return null;

  const avg = calcAvg(data);

  return (
    <PausaBarBase
      data={data}
      referencia={avg}
      refColor="#fd7e14"
      refLabel={avg !== undefined ? `Promedio: ${Math.round(avg)} min` : undefined}
      overColor="#ef4444"
      underColor="#003DA5"
    />
  );
}

// ─── AguaBarChart — promedio dinámico, naranja si supera ─────────────────────

export function AguaBarChart({ agentes, tiposPausa }: { agentes: VicidialAgente[]; tiposPausa: string[] }) {
  const aguaKey = findKey(tiposPausa, 'agua');
  if (!aguaKey) return null;

  const data = buildData(agentes, aguaKey);
  if (data.length === 0) return null;

  const avg = calcAvg(data);

  return (
    <PausaBarBase
      data={data}
      referencia={avg}
      refColor="#fd7e14"
      refLabel={avg !== undefined ? `Promedio: ${Math.round(avg)} min` : undefined}
      overColor="#fd7e14"
      underColor="#003DA5"
    />
  );
}

// ─── CheqBarChart — CHEQ o CONSUL ────────────────────────────────────────────

export function CheqBarChart({ agentes, tiposPausa }: { agentes: VicidialAgente[]; tiposPausa: string[] }) {
  const cheqKey = findKey(tiposPausa, 'cheq', 'consul');
  if (!cheqKey) return null;

  const data = buildData(agentes, cheqKey);
  if (data.length === 0) return null;

  const avg = calcAvg(data);

  return (
    <PausaBarBase
      data={data}
      referencia={avg}
      refColor="#fd7e14"
      refLabel={avg !== undefined ? `Promedio: ${Math.round(avg)} min` : undefined}
      overColor="#fd7e14"
      underColor="#003DA5"
    />
  );
}

// ─── LoginBarChart ────────────────────────────────────────────────────────────

export function LoginBarChart({ agentes, tiposPausa }: { agentes: VicidialAgente[]; tiposPausa: string[] }) {
  const loginKey = findKey(tiposPausa, 'login');
  if (!loginKey) return null;

  const data = buildData(agentes, loginKey);
  if (data.length === 0) return null;

  const avg = calcAvg(data);

  return (
    <PausaBarBase
      data={data}
      referencia={avg}
      refColor="#fd7e14"
      refLabel={avg !== undefined ? `Promedio: ${Math.round(avg)} min` : undefined}
      overColor="#fd7e14"
      underColor="#003DA5"
    />
  );
}

// ─── GenericPausaBarChart — para tipos no contemplados ───────────────────────

export function GenericPausaBarChart({ agentes, pausaKey }: { agentes: VicidialAgente[]; pausaKey: string }) {
  const data = buildData(agentes, pausaKey);
  if (data.length === 0) return null;

  const avg = calcAvg(data);

  return (
    <PausaBarBase
      data={data}
      referencia={avg}
      refColor="#fd7e14"
      refLabel={avg !== undefined ? `Promedio: ${Math.round(avg)} min` : undefined}
      overColor="#fd7e14"
      underColor="#003DA5"
    />
  );
}

// ─── Re-export helpers for use in VicidialModule ─────────────────────────────

export { findKey as findKeyInPausas, getNombreLegible };

// ─── Helpers to identify "handled" pause types ───────────────────────────────

export function getHandledKeys(tiposPausa: string[]): Set<string> {
  const handled = new Set<string>();
  const add = (k: string | undefined) => { if (k) handled.add(k); };
  add(findAlmuerzoKey(tiposPausa));
  add(findBaoKey(tiposPausa));
  add(findVtamovKey(tiposPausa));
  add(findManualKey(tiposPausa));
  add(findKey(tiposPausa, 'agua'));
  add(findKey(tiposPausa, 'cheq', 'consul'));
  add(findKey(tiposPausa, 'login'));
  return handled;
}

// ─── VicidialData export for DesglosePausas ──────────────────────────────────
export type { VicidialData };
