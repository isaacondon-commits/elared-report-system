import type { ChipRow } from './chipsParser';

export type DiaVisita = {
  fecha: string;
  pdvVisitados: number;
  chipsEntregados: number;
  chipsPorComercio: number;
};

export type EfectividadRow = {
  nombre: string;
  diasTrabajados: number;
  totalChips: number;
  promChipsPorDia: number;
  promPdVPorDia: number;
  promChipsPorComercio: number;
  detalleDias: DiaVisita[];
};

export type ChiperoRow = {
  nombre: string;
  total: number;
  enTransito: number;
  enPdV: number;
  pctColocado: number;
};

export type KpiResult = {
  total: number;
  porEmpresa: Record<string, number>;
};

export type AlertaChip = {
  nivel: 'critico' | 'advertencia' | 'info';
  descripcion: string;
};

export type ChipsAnalysis = {
  chipsActivos: KpiResult;
  stockSistema: KpiResult;
  stockTransito: KpiResult;
  efectividad: EfectividadRow[];
  promEquipoChipsPorComercio: number;
  chiperos: ChiperoRow[];
  alertas: AlertaChip[];
};

export function analyzeChips(allRows: ChipRow[], empresaFiltro = 'Todas'): ChipsAnalysis {
  const rows = empresaFiltro === 'Todas' ? allRows : allRows.filter(r => r.empresa === empresaFiltro);

  // porEmpresa always computed from allRows so desglose is always available
  function kpiResult(filterFn: (r: ChipRow) => boolean): KpiResult {
    const porEmpresa: Record<string, number> = {};
    for (const r of allRows) {
      if (filterFn(r)) porEmpresa[r.empresa] = (porEmpresa[r.empresa] ?? 0) + 1;
    }
    return { total: rows.filter(filterFn).length, porEmpresa };
  }

  const chipsActivos = kpiResult(r => r.fechaAsignacionDistribuidor !== null);
  const stockSistema = kpiResult(r => !r.idDistribuidor);
  const stockTransito = kpiResult(r => !!r.idDistribuidor && !r.idPuntoVenta);

  const efectividad = calcEfectividad(rows);
  const promEquipoChipsPorComercio = efectividad.length > 0
    ? efectividad.reduce((s, e) => s + e.promChipsPorComercio, 0) / efectividad.length
    : 0;

  const chiperos = calcChiperos(rows);
  const alertas = buildAlertas(rows, stockSistema, stockTransito, chiperos, efectividad);

  return { chipsActivos, stockSistema, stockTransito, efectividad, promEquipoChipsPorComercio, chiperos, alertas };
}

function calcEfectividad(rows: ChipRow[]): EfectividadRow[] {
  // Group by (nombreDistribuidor, fechaAsignacionDistribuidor)
  const dayMap = new Map<string, { pdvs: Set<string>; chips: number }>();

  for (const r of rows) {
    if (!r.nombreDistribuidor || !r.fechaAsignacionDistribuidor) continue;
    const key = `${r.nombreDistribuidor}|||${r.fechaAsignacionDistribuidor}`;
    if (!dayMap.has(key)) dayMap.set(key, { pdvs: new Set(), chips: 0 });
    const entry = dayMap.get(key)!;
    entry.chips++;
    if (r.idPuntoVenta) entry.pdvs.add(r.idPuntoVenta);
  }

  // Collect days per distribuidor
  const distribMap = new Map<string, DiaVisita[]>();
  for (const [key, data] of dayMap.entries()) {
    const sep = key.indexOf('|||');
    const nombre = key.slice(0, sep);
    const fecha = key.slice(sep + 3);
    const pdvVisitados = data.pdvs.size;
    const chipsEntregados = data.chips;
    const chipsPorComercio = pdvVisitados > 0 ? chipsEntregados / pdvVisitados : 0;

    if (!distribMap.has(nombre)) distribMap.set(nombre, []);
    distribMap.get(nombre)!.push({ fecha, pdvVisitados, chipsEntregados, chipsPorComercio });
  }

  return Array.from(distribMap.entries())
    .map(([nombre, dias]) => {
      dias.sort((a, b) => b.fecha.localeCompare(a.fecha));
      const diasTrabajados = dias.length;
      const totalChips = dias.reduce((s, d) => s + d.chipsEntregados, 0);
      const promChipsPorDia = diasTrabajados > 0 ? totalChips / diasTrabajados : 0;
      const promPdVPorDia = diasTrabajados > 0
        ? dias.reduce((s, d) => s + d.pdvVisitados, 0) / diasTrabajados
        : 0;
      // Mean of daily ratios (not ratio of means)
      const promChipsPorComercio = diasTrabajados > 0
        ? dias.reduce((s, d) => s + d.chipsPorComercio, 0) / diasTrabajados
        : 0;
      return { nombre, diasTrabajados, totalChips, promChipsPorDia, promPdVPorDia, promChipsPorComercio, detalleDias: dias };
    })
    .sort((a, b) => b.totalChips - a.totalChips);
}

function calcChiperos(rows: ChipRow[]): ChiperoRow[] {
  const map = new Map<string, { total: number; enTransito: number; enPdV: number }>();

  for (const r of rows) {
    if (!r.idDistribuidor || !r.nombreDistribuidor) continue;
    if (!map.has(r.nombreDistribuidor)) map.set(r.nombreDistribuidor, { total: 0, enTransito: 0, enPdV: 0 });
    const entry = map.get(r.nombreDistribuidor)!;
    entry.total++;
    if (!r.idPuntoVenta) entry.enTransito++;
    else entry.enPdV++;
  }

  return Array.from(map.entries())
    .map(([nombre, d]) => ({
      nombre,
      total: d.total,
      enTransito: d.enTransito,
      enPdV: d.enPdV,
      pctColocado: d.total > 0 ? (d.enPdV / d.total) * 100 : 0,
    }))
    .sort((a, b) => b.total - a.total);
}

function buildAlertas(
  rows: ChipRow[],
  stockSistema: KpiResult,
  stockTransito: KpiResult,
  chiperos: ChiperoRow[],
  efectividad: EfectividadRow[],
): AlertaChip[] {
  const totalOK = rows.length;
  const alertas: AlertaChip[] = [];

  // CRÍTICO: chipero pctColocado < 60%
  const critChiperos = chiperos.filter(c => c.pctColocado < 60);
  if (critChiperos.length > 0) {
    alertas.push({
      nivel: 'critico',
      descripcion: `${critChiperos.length} distribuidor(es) con menos del 60% colocado: ${critChiperos.map(c => c.nombre).join(', ')}`,
    });
  }

  // CRÍTICO: stock en sistema > 20% del total
  if (totalOK > 0 && (stockSistema.total / totalOK) * 100 > 20) {
    alertas.push({
      nivel: 'critico',
      descripcion: `Stock sin distribuidor: ${((stockSistema.total / totalOK) * 100).toFixed(1)}% del total (${stockSistema.total.toLocaleString()} chips)`,
    });
  }

  // ADVERTENCIA: chipero pctColocado entre 60% y 79%
  const warnChiperos = chiperos.filter(c => c.pctColocado >= 60 && c.pctColocado < 80);
  if (warnChiperos.length > 0) {
    alertas.push({
      nivel: 'advertencia',
      descripcion: `${warnChiperos.length} distribuidor(es) con colocación entre 60% y 79%`,
    });
  }

  // ADVERTENCIA: stock en tránsito > 10% del total
  if (totalOK > 0 && (stockTransito.total / totalOK) * 100 > 10) {
    alertas.push({
      nivel: 'advertencia',
      descripcion: `Stock en tránsito: ${((stockTransito.total / totalOK) * 100).toFixed(1)}% del total (${stockTransito.total.toLocaleString()} chips)`,
    });
  }

  // INFO: mejor chipero
  if (chiperos.length > 0) {
    const mejor = chiperos.reduce((b, c) => c.pctColocado > b.pctColocado ? c : b);
    alertas.push({
      nivel: 'info',
      descripcion: `Mejor chipero: ${mejor.nombre} — ${mejor.pctColocado.toFixed(1)}% colocado`,
    });
  }

  // INFO: mayor chips/comercio
  if (efectividad.length > 0) {
    const mejorEf = efectividad.reduce((b, e) => e.promChipsPorComercio > b.promChipsPorComercio ? e : b);
    alertas.push({
      nivel: 'info',
      descripcion: `Mayor chips/comercio: ${mejorEf.nombre} — ${mejorEf.promChipsPorComercio.toFixed(1)} chips/comercio`,
    });
  }

  const order: Record<string, number> = { critico: 0, advertencia: 1, info: 2 };
  return alertas.sort((a, b) => order[a.nivel] - order[b.nivel]);
}
