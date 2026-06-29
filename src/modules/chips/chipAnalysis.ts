import type { ChipRow } from './chipsParser';

export type PdvRow = {
  nombre: string;
  chips: number;
};

export type ChiperoRow = {
  nombre: string;
  total: number;
  enTransito: number;
  enPdv: number;
  pctColocado: number;
  pdvs: PdvRow[];
};

export type EfectividadRow = {
  distribuidor: string;
  pdv: string;
  chips: number;
};

export type LoteRow = {
  lote: string;
  subLote: string;
  total: number;
  enDistribuidor: number;
  enPdv: number;
};

export type AlertaChip = {
  tipo: 'alta_transito' | 'stock_alto' | 'sin_pdv';
  descripcion: string;
  valor: number;
};

export type ChipsAnalysis = {
  chipsActivos: number;
  stockSistema: number;
  stockTransito: number;
  totalConPdv: number;
  chiperos: ChiperoRow[];
  efectividad: EfectividadRow[];
  lotes: LoteRow[];
  alertas: AlertaChip[];
};

export function analyzeChips(rows: ChipRow[], empresaFiltro = 'Todas'): ChipsAnalysis {
  const filtered = empresaFiltro === 'Todas' ? rows : rows.filter(r => r.empresa === empresaFiltro);

  const chipsActivos = filtered.filter(r => r.idDistribuidor !== null).length;
  const stockSistema = filtered.filter(r => r.idDistribuidor === null).length;
  const stockTransito = filtered.filter(r => r.idDistribuidor !== null && r.idPuntoVenta === null).length;
  const totalConPdv = filtered.filter(r => r.idPuntoVenta !== null).length;

  // Chiperos
  const chiperoMap = new Map<string, { total: number; enTransito: number; enPdv: number; pdvs: Map<string, number> }>();
  for (const r of filtered) {
    if (!r.nombreDistribuidor) continue;
    if (!chiperoMap.has(r.nombreDistribuidor)) {
      chiperoMap.set(r.nombreDistribuidor, { total: 0, enTransito: 0, enPdv: 0, pdvs: new Map() });
    }
    const entry = chiperoMap.get(r.nombreDistribuidor)!;
    entry.total++;
    if (r.idPuntoVenta === null) {
      entry.enTransito++;
    } else {
      entry.enPdv++;
      const pdvNombre = r.puntoVenta ?? r.idPuntoVenta ?? 'PdV sin nombre';
      entry.pdvs.set(pdvNombre, (entry.pdvs.get(pdvNombre) ?? 0) + 1);
    }
  }

  const chiperos: ChiperoRow[] = Array.from(chiperoMap.entries())
    .map(([nombre, d]) => ({
      nombre,
      total: d.total,
      enTransito: d.enTransito,
      enPdv: d.enPdv,
      pctColocado: d.total > 0 ? Math.round((d.enPdv / d.total) * 100) : 0,
      pdvs: Array.from(d.pdvs.entries())
        .map(([pdvNombre, chips]) => ({ nombre: pdvNombre, chips }))
        .sort((a, b) => b.chips - a.chips),
    }))
    .sort((a, b) => b.total - a.total);

  // Efectividad (chips por PdV por distribuidor)
  const efMap = new Map<string, number>();
  for (const r of filtered) {
    if (!r.nombreDistribuidor || !r.puntoVenta) continue;
    const key = `${r.nombreDistribuidor}|||${r.puntoVenta}`;
    efMap.set(key, (efMap.get(key) ?? 0) + 1);
  }
  const efectividad: EfectividadRow[] = Array.from(efMap.entries())
    .map(([key, chips]) => {
      const sep = key.indexOf('|||');
      return { distribuidor: key.slice(0, sep), pdv: key.slice(sep + 3), chips };
    })
    .sort((a, b) => b.chips - a.chips);

  // Lotes
  const loteMap = new Map<string, { total: number; enDistribuidor: number; enPdv: number }>();
  for (const r of filtered) {
    const key = `${r.lote}|||${r.subLote}`;
    if (!loteMap.has(key)) loteMap.set(key, { total: 0, enDistribuidor: 0, enPdv: 0 });
    const entry = loteMap.get(key)!;
    entry.total++;
    if (r.idDistribuidor && !r.idPuntoVenta) entry.enDistribuidor++;
    if (r.idPuntoVenta) entry.enPdv++;
  }
  const lotes: LoteRow[] = Array.from(loteMap.entries())
    .map(([key, d]) => {
      const sep = key.indexOf('|||');
      return { lote: key.slice(0, sep), subLote: key.slice(sep + 3), ...d };
    })
    .sort((a, b) => b.total - a.total);

  // Alertas
  const alertas: AlertaChip[] = [];
  const highTransito = chiperos.filter(c => c.pctColocado < 30 && c.total >= 10);
  if (highTransito.length > 0) {
    alertas.push({
      tipo: 'alta_transito',
      descripcion: `${highTransito.length} chipero(s) con menos del 30% colocado (alta permanencia en tránsito)`,
      valor: highTransito.length,
    });
  }
  if (stockSistema > 0) {
    alertas.push({
      tipo: 'stock_alto',
      descripcion: `${stockSistema.toLocaleString()} chips en sistema sin distribuidor asignado`,
      valor: stockSistema,
    });
  }
  const sinPdvPct = chipsActivos > 0 ? Math.round((stockTransito / chipsActivos) * 100) : 0;
  if (sinPdvPct > 50) {
    alertas.push({
      tipo: 'sin_pdv',
      descripcion: `${sinPdvPct}% de chips activos aún sin llegar a un PdV`,
      valor: sinPdvPct,
    });
  }

  return { chipsActivos, stockSistema, stockTransito, totalConPdv, chiperos, efectividad, lotes, alertas };
}
