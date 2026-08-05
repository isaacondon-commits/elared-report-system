import type { LlamadasData } from './llamadasParser';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface LlamadasPerUser {
  total: number;
  aten: number;
  ventas: number;
  statusC: number[];
}

export interface LlamadasResult {
  thr: number;
  excV: boolean;
  total: number;
  aten: number;
  ventas: number;
  atenVenta: number;
  perUser: Record<string, LlamadasPerUser>;
  statusC: number[];
  hourTotal: Record<number, number>;
  hourAten: Record<number, number>;
  hourStatus: Record<number, Record<number, number>>;
  atenStatus: number[];
  durBuckets: number[];
}

// Edges para durBuckets: [0s, 1-10s, 11-30s, 31-60s, 61-120s, 121-300s, 300+s]
const DUR_EDGES = [1, 11, 31, 61, 121, 301];

// ─── computeLlamadas — traducción de compute() del HTML ───────────────────────

export function computeLlamadas(data: LlamadasData, umbral: number, excluirVDAD: boolean): LlamadasResult {
  const thr = Math.max(0, umbral || 0);
  const excV = excluirVDAD;
  const U = data.users, S = data.stats, C = data.calls;
  const VENTA = S.indexOf('VENTA');
  const VDAD = U.indexOf('VDAD');

  const R: LlamadasResult = {
    thr, excV, total: 0, aten: 0, ventas: 0, atenVenta: 0,
    perUser: {}, statusC: new Array(S.length).fill(0),
    hourTotal: {}, hourAten: {}, hourStatus: {},
    atenStatus: new Array(S.length).fill(0),
    durBuckets: [0, 0, 0, 0, 0, 0, 0],
  };

  for (const c of C) {
    const [h, u, s, len] = c;
    R.total++;
    R.statusC[s] = (R.statusC[s] ?? 0) + 1;
    R.hourTotal[h] = (R.hourTotal[h] ?? 0) + 1;
    const hourStatusRow = (R.hourStatus[h] ??= {});
    hourStatusRow[s] = (hourStatusRow[s] ?? 0) + 1;

    const isA = len > thr;
    if (isA) {
      R.aten++;
      R.hourAten[h] = (R.hourAten[h] ?? 0) + 1;
      R.atenStatus[s] = (R.atenStatus[s] ?? 0) + 1;
    }
    if (s === VENTA) {
      R.ventas++;
      if (isA) R.atenVenta++;
    }

    let bi = 0;
    while (bi < DUR_EDGES.length && len >= (DUR_EDGES[bi] as number)) bi++;
    R.durBuckets[bi] = (R.durBuckets[bi] ?? 0) + 1;

    if (excV && u === VDAD) continue;

    const un = U[u] ?? '';
    let pu = R.perUser[un];
    if (!pu) { pu = R.perUser[un] = { total: 0, aten: 0, ventas: 0, statusC: new Array(S.length).fill(0) }; }
    pu.total++;
    pu.statusC[s] = (pu.statusC[s] ?? 0) + 1;
    if (isA) pu.aten++;
    if (s === VENTA) pu.ventas++;
  }

  return R;
}
