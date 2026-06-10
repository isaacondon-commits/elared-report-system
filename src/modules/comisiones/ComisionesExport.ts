import * as XLSX from 'xlsx';
import PptxGenJS from 'pptxgenjs';
import type { ResultadosComisiones, ResultadoVendedor, ComisionesConfig } from './ComisionesConfig';
import { fmtPesos, TIPO_LABELS } from './ComisionesConfig';

// ─── Helpers ──────────────────────────────────────────────────────────────────

type HAlign = 'left' | 'center' | 'right';
type VAlign = 'middle' | 'top' | 'bottom';
const VM: VAlign = 'middle';

function hCell(text: string, color = '003DA5') {
  return { text, options: { bold: true, fontSize: 9, color: 'FFFFFF', fill: { color }, align: 'center' as HAlign, valign: VM } };
}
function dCell(text: string, align: HAlign = 'center', bold = false, bg?: string) {
  return { text, options: { fontSize: 9, color: '1e293b', align, bold, valign: VM, fill: bg ? { color: bg } : { color: 'FFFFFF' } } };
}

function condBg(v: ResultadoVendedor): string | undefined {
  if (v.noLlegoAlMinimo) return 'fecaca';
  if (v.bajoPorFalta)    return 'fed7aa';
  if (v.condicionAplicada === 'condicion2') return 'fef9c3';
  return undefined;
}

function observacion(v: ResultadoVendedor): string {
  if (v.esOverride)       return 'Condición ajustada manualmente';
  if (v.bajoPorFalta)     return 'Condición reducida por falta';
  if (v.noLlegoAlMinimo)  return 'No llegó al mínimo — condición base';
  return '';
}

function addTitle(slide: PptxGenJS.Slide, title: string, sub = '') {
  slide.addText(title, { x: 0.3, y: 0.15, w: 9.4, h: 0.35, fontSize: 16, bold: true, color: '003DA5', fontFace: 'Calibri' });
  if (sub) slide.addText(sub, { x: 0.3, y: 0.5, w: 9.4, h: 0.2, fontSize: 10, color: '64748b', fontFace: 'Calibri' });
  slide.addShape('line' as Parameters<typeof slide.addShape>[0], { x: 0.3, y: 0.73, w: 9.4, h: 0, line: { color: '003DA5', width: 1.5 } });
}

function kpiBox(slide: PptxGenJS.Slide, x: number, y: number, w: number, label: string, value: string, color: string) {
  const h = 0.7;
  slide.addShape('rect' as Parameters<typeof slide.addShape>[0], { x, y, w, h, fill: { color: 'F8FAFC' }, line: { color: 'E2E8F0', width: 0.5 } });
  slide.addShape('rect' as Parameters<typeof slide.addShape>[0], { x, y, w: 0.05, h, fill: { color }, line: { color, width: 0 } });
  slide.addText(label, { x: x + 0.12, y: y + 0.06, w: w - 0.14, h: 0.2, fontSize: 8, color: '64748b', fontFace: 'Calibri' });
  slide.addText(value, { x: x + 0.12, y: y + 0.26, w: w - 0.14, h: 0.3, fontSize: 15, bold: true, color, fontFace: 'Calibri' });
}

// ─── Excel export ─────────────────────────────────────────────────────────────

export function exportarExcelComisiones(
  resultados: ResultadosComisiones,
  config: ComisionesConfig,
  titulo: string
) {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Resumen
  const resumenRows: (string | number)[][] = [
    [titulo, '', '', '', '', '', '', '', ''],
    [],
    ['Vendedor', 'Total ventas', 'Faltas', 'Condición', 'Renovaciones', 'Altas', 'Cambios', 'Comisión Total', 'Observaciones'],
    ...resultados.vendedores.map(v => [
      v.nombre,
      v.totalVentas,
      v.faltas,
      v.nombreCondicion,
      v.desglose.renovaciones.cantidad,
      v.desglose.altas.cantidad,
      v.desglose.cambios.cantidad,
      v.comisionTotal,
      observacion(v),
    ]),
    [],
    ['TOTALES',
      resultados.vendedores.reduce((s, v) => s + v.totalVentas, 0),
      resultados.vendedores.reduce((s, v) => s + v.faltas, 0),
      '', '', '', '',
      resultados.totalAPagar, ''],
  ];
  const ws1 = XLSX.utils.aoa_to_sheet(resumenRows);
  ws1['!cols'] = [{ wch: 24 }, { wch: 14 }, { wch: 8 }, { wch: 20 }, { wch: 14 }, { wch: 10 }, { wch: 10 }, { wch: 16 }, { wch: 36 }];
  XLSX.utils.book_append_sheet(wb, ws1, 'Resumen');

  // Sheet 2: Detalle por Plan
  const detalleRows: (string | number)[][] = [
    ['Vendedor', 'Plan', 'Tipo', 'Cantidad', 'Precio unitario', 'Subtotal'],
    ...resultados.vendedores.flatMap(v =>
      v.desglosePorPlan.map(d => [v.nombre, d.plan, TIPO_LABELS[d.tipo], d.cantidad, d.precioUnitario, d.comisionTotal])
    ),
  ];
  const ws2 = XLSX.utils.aoa_to_sheet(detalleRows);
  ws2['!cols'] = [{ wch: 24 }, { wch: 30 }, { wch: 14 }, { wch: 10 }, { wch: 16 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, ws2, 'Detalle por Plan');

  // Sheet 3: Bajo mínimo
  const bajoMinimoRows: (string | number)[][] = [
    ['Bajo mínimo — comisionan por condición base', '', ''],
    [],
    ['Vendedor', 'Total ventas', 'Comisión (cond. base)'],
    ...resultados.vendedores
      .filter(v => v.noLlegoAlMinimo)
      .map(v => [v.nombre, v.totalVentas, v.comisionTotal]),
  ];
  const ws3 = XLSX.utils.aoa_to_sheet(bajoMinimoRows);
  ws3['!cols'] = [{ wch: 24 }, { wch: 14 }, { wch: 22 }];
  XLSX.utils.book_append_sheet(wb, ws3, 'Bajo Mínimo');

  // Sheet 4: Configuración
  const configRows: (string | number | boolean)[][] = [['Configuración aplicada', '']];
  for (const emp of config.empresas) {
    configRows.push([], [`Empresa: ${emp.nombre}`, '']);
    configRows.push([`${emp.condiciones[0].nombre}`, `≥ ${emp.condiciones[0].minVentas} ventas`]);
    configRows.push([`${emp.condiciones[1].nombre}`, `≥ ${emp.condiciones[1].minVentas} ventas`]);
    configRows.push([], ['Plan', 'Activo', 'Renov. C1', 'Alta C1', 'Cambio C1', 'Renov. C2', 'Alta C2', 'Cambio C2']);
    for (const p of emp.planes) {
      configRows.push([p.nombre, p.activo, p.precios.condicion1.renovacion, p.precios.condicion1.alta, p.precios.condicion1.cambio, p.precios.condicion2.renovacion, p.precios.condicion2.alta, p.precios.condicion2.cambio]);
    }
  }
  const ws4 = XLSX.utils.aoa_to_sheet(configRows);
  ws4['!cols'] = [{ wch: 30 }, { wch: 10 }, ...Array(6).fill({ wch: 12 })];
  XLSX.utils.book_append_sheet(wb, ws4, 'Configuración');

  XLSX.writeFile(wb, `comisiones_${titulo.toLowerCase().replace(/\s+/g, '_')}.xlsx`);
}

// ─── PPTX export ─────────────────────────────────────────────────────────────

export async function exportarPPTXComisiones(
  resultados: ResultadosComisiones,
  config: ComisionesConfig,
  titulo: string
) {
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';
  pptx.author = 'Elared S.A.';

  const empresa = config.empresas[0];
  const cond1Label = empresa?.condiciones[0].nombre ?? 'Condición 1';
  const cond2Label = empresa?.condiciones[1].nombre ?? 'Condición 2';

  // ── Slide 1: Portada ────────────────────────────────────────────────────────
  const s1 = pptx.addSlide();
  s1.addShape('rect' as Parameters<typeof s1.addShape>[0], { x: 0, y: 0, w: '100%', h: 1.2, fill: { color: '003DA5' } });
  s1.addText('ELARED S.A.', { x: 0.5, y: 0.2, w: 9, h: 0.4, fontSize: 22, bold: true, color: 'FFFFFF', fontFace: 'Calibri' });
  s1.addText(`Liquidación de ${titulo}`, { x: 0.5, y: 0.65, w: 9, h: 0.3, fontSize: 13, color: 'bfdbfe', fontFace: 'Calibri' });

  const kpisP = [
    { label: 'Total a pagar',        value: fmtPesos(resultados.totalAPagar),               color: '16a34a' },
    { label: `En ${cond2Label}`,      value: String(resultados.vendedoresCondicion2),          color: '003DA5' },
    { label: 'Bajo mínimo',           value: String(resultados.vendedoresSinCondicion),         color: 'E3000F' },
    { label: 'Con faltas',            value: String(resultados.vendedoresConFaltas),            color: 'fd7e14' },
  ];
  kpisP.forEach((k, i) => kpiBox(s1, 0.3 + i * 2.35, 1.5, 2.25, k.label, k.value, k.color));

  // ── Slide 2: KPIs detallados ────────────────────────────────────────────────
  const s2 = pptx.addSlide();
  addTitle(s2, `${titulo} — Resumen`);

  const totalVend = resultados.vendedores.length;
  const cond1Count = resultados.vendedores.filter(v => v.condicionAplicada === 'condicion1').length;

  const kpis2 = [
    { label: 'Vendedores totales',  value: String(totalVend),                              color: '003DA5' },
    { label: cond1Label,            value: String(cond1Count),                             color: '0284c7' },
    { label: cond2Label,            value: String(resultados.vendedoresCondicion2),         color: 'ca8a04' },
    { label: 'Con faltas',          value: String(resultados.vendedoresConFaltas),          color: 'fd7e14' },
  ];
  kpis2.forEach((k, i) => kpiBox(s2, 0.3 + i * 2.35, 0.9, 2.25, k.label, k.value, k.color));

  s2.addText(`Total a liquidar: ${fmtPesos(resultados.totalAPagar)}`, {
    x: 0.3, y: 1.85, w: 9.4, h: 0.3, fontSize: 13, bold: true, color: '16a34a', fontFace: 'Calibri',
  });

  if (resultados.vendedoresBajoPorFalta > 0) {
    s2.addText(`⚠ ${resultados.vendedoresBajoPorFalta} vendedor${resultados.vendedoresBajoPorFalta > 1 ? 'es' : ''} bajaron de condición por falta`, {
      x: 0.3, y: 2.2, w: 9.4, h: 0.25, fontSize: 10, color: 'c2410c', fontFace: 'Calibri',
    });
  }

  // ── Slide 3: Top 10 vendedores ──────────────────────────────────────────────
  const s3 = pptx.addSlide();
  addTitle(s3, 'Top 10 — Comisiones por Vendedor');

  const top10 = resultados.vendedores.slice(0, 10);
  const t3Header = [
    hCell('Vendedor', '003DA5'), hCell('Ventas'), hCell('Faltas'), hCell('Condición'),
    hCell('Renovac.'), hCell('Altas'), hCell('Cambios'), hCell('Comisión'),
  ];
  const t3Rows = top10.map((v, idx) => {
    const bg = condBg(v);
    const obs = observacion(v);
    return [
      dCell(`${idx + 1}. ${v.nombre}`, 'left', true, bg),
      dCell(String(v.totalVentas), 'center', false, bg),
      dCell(v.faltas > 0 ? `⚠ ${v.faltas}` : '—', 'center', false, bg),
      dCell(v.nombreCondicion + (obs ? ' *' : ''), 'center', false, bg),
      dCell(String(v.desglose.renovaciones.cantidad), 'center', false, bg),
      dCell(String(v.desglose.altas.cantidad), 'center', false, bg),
      dCell(String(v.desglose.cambios.cantidad), 'center', false, bg),
      dCell(fmtPesos(v.comisionTotal) + (v.noLlegoAlMinimo ? ' *' : ''), 'right', true, bg),
    ];
  });

  s3.addTable([t3Header, ...t3Rows], {
    x: 0.3, y: 0.85, w: 9.4, rowH: 0.28,
    colW: [2.2, 0.7, 0.6, 1.4, 0.8, 0.7, 0.8, 1.4],
    border: { type: 'solid', color: 'E2E8F0', pt: 0.5 },
    fontFace: 'Calibri',
  });

  // ── Slide 4: Ranking visual ─────────────────────────────────────────────────
  const s4 = pptx.addSlide();
  addTitle(s4, 'Ranking de Comisiones');

  const top8 = resultados.vendedores.slice(0, 8);
  const maxMonto = Math.max(...top8.map(v => v.comisionTotal), 1);
  const barMaxW = 7.0;
  let yPos = 0.9;

  for (const v of top8) {
    const barW = Math.max(0.05, (v.comisionTotal / maxMonto) * barMaxW);
    const barColor = v.condicionAplicada === 'condicion2' ? 'ca8a04' : '003DA5';
    s4.addText(v.nombre, { x: 0.3, y: yPos, w: 2.0, h: 0.28, fontSize: 9, color: '374151', fontFace: 'Calibri', align: 'right' });
    s4.addShape('rect' as Parameters<typeof s4.addShape>[0], { x: 2.4, y: yPos, w: barW, h: 0.26, fill: { color: barColor } });
    s4.addText(fmtPesos(v.comisionTotal), { x: 2.4 + barW + 0.08, y: yPos, w: 1.5, h: 0.26, fontSize: 9, bold: true, color: barColor, fontFace: 'Calibri' });
    yPos += 0.42;
  }

  // ── Slide 5: Distribución ───────────────────────────────────────────────────
  const s5 = pptx.addSlide();
  addTitle(s5, 'Distribución de Condiciones');

  const pieData = [
    { label: cond2Label,         count: resultados.vendedoresCondicion2, color: 'ca8a04' },
    { label: cond1Label,         count: resultados.vendedores.filter(v => v.condicionAplicada === 'condicion1' && !v.noLlegoAlMinimo).length, color: '003DA5' },
    { label: 'Bajo mínimo',      count: resultados.vendedoresSinCondicion, color: 'E3000F' },
    { label: 'Bajaron por falta', count: resultados.vendedoresBajoPorFalta, color: 'fd7e14' },
  ].filter(d => d.count > 0);

  const totalPie = resultados.vendedores.length;
  let legendY = 1.8;
  for (const d of pieData) {
    s5.addShape('rect' as Parameters<typeof s5.addShape>[0], { x: 5.5, y: legendY, w: 0.18, h: 0.18, fill: { color: d.color } });
    s5.addText(`${d.label}: ${d.count} (${Math.round(d.count / totalPie * 100)}%)`, { x: 5.8, y: legendY, w: 3.5, h: 0.22, fontSize: 11, color: '374151', fontFace: 'Calibri' });
    legendY += 0.4;
  }
  s5.addText(String(totalPie), { x: 1.0, y: 2.8, w: 3.0, h: 0.5, fontSize: 28, bold: true, color: '003DA5', align: 'center', fontFace: 'Calibri' });
  s5.addText('vendedores', { x: 1.0, y: 3.3, w: 3.0, h: 0.25, fontSize: 10, color: '64748b', align: 'center', fontFace: 'Calibri' });

  // ── Slide 6: Detalle por plan ───────────────────────────────────────────────
  const s6 = pptx.addSlide();
  addTitle(s6, 'Resumen por Plan');

  const planHeader = [hCell('Plan', '475569'), hCell('Renovac.'), hCell('Altas'), hCell('Cambios'), hCell('Total gest.'), hCell('Comisión')];
  const planRows = resultados.resumenPorPlan.slice(0, 12).map(p => [
    dCell(p.plan, 'left'),
    dCell(String(p.renovaciones)),
    dCell(String(p.altas)),
    dCell(String(p.cambios)),
    dCell(String(p.total), 'center', true),
    dCell(fmtPesos(p.comisionTotal), 'right', true, p.comisionTotal > 0 ? 'f0fdf4' : undefined),
  ]);

  s6.addTable([planHeader, ...planRows], {
    x: 0.3, y: 0.85, w: 9.4, rowH: 0.28,
    colW: [3.4, 1.0, 0.8, 0.9, 1.1, 1.5],
    border: { type: 'solid', color: 'E2E8F0', pt: 0.5 },
    fontFace: 'Calibri',
  });

  // ── Slide 7: Cierre ─────────────────────────────────────────────────────────
  const s7 = pptx.addSlide();
  s7.addShape('rect' as Parameters<typeof s7.addShape>[0], { x: 0, y: 0, w: '100%', h: '100%', fill: { color: '003DA5' } });
  s7.addText('ELARED S.A.', { x: 0.5, y: 2.5, w: 9, h: 0.5, fontSize: 24, bold: true, color: 'FFFFFF', align: 'center', fontFace: 'Calibri' });
  s7.addText(`Liquidación ${titulo}`, { x: 0.5, y: 3.1, w: 9, h: 0.3, fontSize: 12, color: 'bfdbfe', align: 'center', fontFace: 'Calibri' });
  s7.addText('Generado automáticamente', { x: 0.5, y: 3.5, w: 9, h: 0.25, fontSize: 10, color: '93c5fd', align: 'center', fontFace: 'Calibri' });

  await pptx.writeFile({ fileName: `comisiones_${titulo.toLowerCase().replace(/\s+/g, '_')}.pptx` });
}

// ─── Excel export — Proyección ────────────────────────────────────────────────

interface FilaProyeccion {
  plan: string;
  renov: number;
  altas: number;
  cambios: number;
  subtotal: number;
}

export function exportarExcelProyeccion(
  filas: FilaProyeccion[],
  condicion: string,
  comisionTotal: number,
  titulo: string
) {
  const wb = XLSX.utils.book_new();

  const rows: (string | number)[][] = [
    [`Proyección de Comisiones — ${titulo}`, '', '', '', ''],
    [],
    ['Plan', 'Renovaciones', 'Altas', 'Cambios', 'Subtotal ($)'],
    ...filas.map(f => [f.plan, f.renov, f.altas, f.cambios, f.subtotal]),
    [],
    ['TOTAL', filas.reduce((s, f) => s + f.renov, 0), filas.reduce((s, f) => s + f.altas, 0), filas.reduce((s, f) => s + f.cambios, 0), comisionTotal],
    [],
    ['Condición activa', condicion, '', '', ''],
  ];

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 32 }, { wch: 14 }, { wch: 10 }, { wch: 10 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, ws, 'Proyección');
  XLSX.writeFile(wb, `proyeccion_${titulo.toLowerCase().replace(/\s+/g, '_')}.xlsx`);
}
