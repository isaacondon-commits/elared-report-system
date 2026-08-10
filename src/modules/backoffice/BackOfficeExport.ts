import * as XLSX from 'xlsx';
import { autoWidth, styledExcelSheet } from '../../utils/exportHelpers';
import { rendimientoBadge, type BackOfficeStats } from './BackOfficeModule';

function formatFecha(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export function exportBackOfficeExcel(stats: BackOfficeStats, empresaActiva = 'Todas'): void {
  const wb = XLSX.utils.book_new();

  // ── Hoja 1: Resumen — tabla comparativa de back offices ──
  const resumenHeaders = ['Back Office', 'Total', 'Por Día Prom', 'Activos', 'Pendientes', 'Procesados', 'Rechazos', '% Rechazo', 'Rendimiento'];
  const resumenRows: (string | number)[][] = stats.byBackOffice.map(b => [
    b.nombre, b.total, Number(b.promDia.toFixed(1)), b.activos, b.pendientes, b.procesados, b.rechazos,
    `${b.pctRechazo.toFixed(1)}%`, rendimientoBadge(b.pctRechazo, b.promDia).label,
  ]);
  styledExcelSheet(wb, 'Resumen', resumenHeaders, resumenRows);

  // ── Hoja 2: Por día — contratos subidos por día ──
  const bos = stats.backOfficesList;
  const diaHeaders = ['Fecha', ...bos, 'Total Día'];
  const diaRows: (string | number)[][] = stats.byDia.map(d => [
    formatFecha(d.fecha), ...bos.map(bo => d.porBackOffice[bo] ?? 0), d.total,
  ]);
  const totalesRow: (string | number)[] = [
    'TOTAL', ...bos.map(bo => stats.byDia.reduce((s, d) => s + (d.porBackOffice[bo] ?? 0), 0)),
    stats.byDia.reduce((s, d) => s + d.total, 0),
  ];
  styledExcelSheet(wb, 'Por dia', diaHeaders, diaRows, totalesRow);

  // ── Hoja 3: Estados — distribución de estados por back office ──
  const estadosHeaders = ['Back Office', 'Estado', 'Equivalente', 'Cantidad', '%'];
  const estadosRows: (string | number)[][] = [];
  for (const b of stats.byBackOffice) {
    for (const e of b.estadosDetalle) {
      estadosRows.push([b.nombre, e.estado, e.equivalente ?? '—', e.count, `${e.pct.toFixed(1)}%`]);
    }
  }
  styledExcelSheet(wb, 'Estados', estadosHeaders, estadosRows);

  // ── Hoja 4: Rechazos — análisis completo ──
  const rechazosHeaders = ['Back Office', 'Vendedor', 'Rechazos', 'Total Contratos', '% Rechazo'];
  const rechazosRows: (string | number)[][] = stats.porVendedor.map(v => [
    v.backOffice, v.vendedor, v.rechazos, v.total, `${v.pctRechazo.toFixed(1)}%`,
  ]);
  styledExcelSheet(wb, 'Rechazos', rechazosHeaders, rechazosRows);

  // ── Hoja 5: Sin asignar — contratos VENDIDO sin back office ──
  const sinAsignarHeaders = ['Fecha Venta', 'Vendedor', 'Plan', 'Empresa', 'Estado'];
  const sinAsignarRows: (string | number)[][] = stats.sinAsignarRows.map(r => [
    formatFecha(r.fecha), r.vendedor || '—', r.plan || '—', r.empresa || '—', r.estado,
  ]);
  const ws5 = XLSX.utils.aoa_to_sheet([sinAsignarHeaders, ...sinAsignarRows]);
  ws5['!cols'] = autoWidth([sinAsignarHeaders, ...sinAsignarRows]);
  XLSX.utils.book_append_sheet(wb, ws5, 'Sin asignar');

  const fn = empresaActiva !== 'Todas' ? `BackOffice_${empresaActiva}_` : 'BackOffice_';
  XLSX.writeFile(wb, `${fn}${new Date().toLocaleDateString('es-UY').replace(/\//g, '-')}.xlsx`);
}
