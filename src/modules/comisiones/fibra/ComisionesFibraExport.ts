import * as XLSX from 'xlsx';
import PptxGenJS from 'pptxgenjs';
import type { ResultadosFibra, ResultadoVendedorFibra } from './ComisionesFibraConfig';
import { fmtPesos } from './ComisionesFibraConfig';

// ─── Helpers ──────────────────────────────────────────────────────────────────

type HAlign = 'left' | 'center' | 'right';
type VAlign = 'middle';
const VM: VAlign = 'middle';

function hCell(text: string, color = '003DA5') {
  return { text, options: { bold: true, fontSize: 9, color: 'FFFFFF', fill: { color }, align: 'center' as HAlign, valign: VM } };
}
function dCell(text: string, align: HAlign = 'center', bold = false, bg?: string) {
  return { text, options: { fontSize: 9, color: '1e293b', align, bold, valign: VM, fill: { color: bg ?? 'FFFFFF' } } };
}

function rowBgFibra(v: ResultadoVendedorFibra): string | undefined {
  if (v.noLlegoAlMinimo) return 'fecaca';
  if (v.bajoPorFalta)    return 'fed7aa';
  if (v.condicion === '80_sin_falta') return 'fef9c3';
  return undefined;
}

function franjaLabel(v: ResultadoVendedorFibra): string {
  if (v.franja === '50_200')   return 'F1 (50-200)';
  if (v.franja === '201_250')  return 'F2 (201-250)';
  return 'F3 (250+)';
}

function condicionLabel(v: ResultadoVendedorFibra): string {
  if (v.noLlegoAlMinimo) return 'Bajo mínimo';
  if (v.condicion === '80_sin_falta') return '80 Sin Falta';
  return '50 o Falta';
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
  slide.addText(value, { x: x + 0.12, y: y + 0.26, w: w - 0.14, h: 0.3, fontSize: 14, bold: true, color, fontFace: 'Calibri' });
}

// ─── Excel export ──────────────────────────────────────────────────────────────

export function exportarExcelFibra(resultados: ResultadosFibra, fileName: string) {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Resumen
  const resumenRows: (string | number)[][] = [
    ['Comisiones Fibra', '', '', '', '', '', '', '', '', '', ''],
    [],
    ['Vendedor', 'Total ventas', 'Faltas', 'Franja', 'Condición',
     'TM ventas', 'Internet ventas', 'Altas', 'Renovaciones', 'No Renovables', 'Comisión Total'],
    ...resultados.vendedores.map(v => [
      v.nombre,
      v.totalVentas,
      v.faltas,
      franjaLabel(v),
      condicionLabel(v),
      v.ventasTelemarketing,
      v.ventasInternet,
      v.altas.cantidad,
      v.renovaciones.cantidad,
      v.noRenovables,
      v.comisionTotal,
    ]),
    [],
    ['TOTALES',
      resultados.vendedores.reduce((s, v) => s + v.totalVentas, 0),
      resultados.vendedores.reduce((s, v) => s + v.faltas, 0),
      '', '',
      resultados.vendedores.reduce((s, v) => s + v.ventasTelemarketing, 0),
      resultados.vendedores.reduce((s, v) => s + v.ventasInternet, 0),
      resultados.vendedores.reduce((s, v) => s + v.altas.cantidad, 0),
      resultados.vendedores.reduce((s, v) => s + v.renovaciones.cantidad, 0),
      resultados.totalNoRenovables,
      resultados.totalAPagar,
    ],
  ];
  const ws1 = XLSX.utils.aoa_to_sheet(resumenRows);
  ws1['!cols'] = [{ wch: 24 }, { wch: 13 }, { wch: 8 }, { wch: 14 }, { wch: 16 },
    { wch: 12 }, { wch: 14 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, ws1, 'Resumen');

  // Sheet 2: Desglose por plan
  const desgloseRows: (string | number)[][] = [
    ['Vendedor', 'Plan', 'Modalidad', 'Altas', 'Renovaciones', 'No Renovables', 'Comisión'],
    ...resultados.vendedores.flatMap(v =>
      v.desglosePlanes.map(d => [
        v.nombre,
        d.plan,
        d.modalidad,
        d.altas,
        d.renovaciones,
        d.noRenovables,
        d.comision,
      ])
    ),
  ];
  const ws2 = XLSX.utils.aoa_to_sheet(desgloseRows);
  ws2['!cols'] = [{ wch: 24 }, { wch: 30 }, { wch: 15 }, { wch: 8 }, { wch: 13 }, { wch: 14 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, ws2, 'Desglose por Plan');

  // Sheet 3: KPIs
  const kpiRows: (string | number)[][] = [
    ['Indicador', 'Valor'],
    ['Total a Comisionar', resultados.totalAPagar],
    ['Comisión Telemarketing', resultados.totalTelemarketing],
    ['Comisión Internet', resultados.totalInternet],
    ['Vendedores 80 Sin Falta', resultados.vendedores80SinFalta],
    ['Vendedores 50 o Falta', resultados.vendedores50OFalta],
    ['Bajo Mínimo', resultados.vendedoresBajoMinimo],
    ['Total No Renovables', resultados.totalNoRenovables],
  ];
  const ws3 = XLSX.utils.aoa_to_sheet(kpiRows);
  ws3['!cols'] = [{ wch: 28 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, ws3, 'KPIs');

  XLSX.writeFile(wb, `comisiones-fibra-${fileName.replace(/\.\w+$/, '')}.xlsx`);
}

// ─── PowerPoint export ────────────────────────────────────────────────────────

export async function exportarPPTXFibra(resultados: ResultadosFibra, fileName: string) {
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';
  pptx.defineLayout({ name: 'WIDE', width: 10, height: 5.625 });

  // ── Slide 1: Portada ────────────────────────────────────────────────────────
  const s1 = pptx.addSlide();
  s1.addShape('rect' as Parameters<typeof s1.addShape>[0], { x: 0, y: 0, w: 10, h: 5.625, fill: { color: '003DA5' } });
  s1.addText('Comisiones Fibra', { x: 0.5, y: 1.5, w: 9, h: 0.8, fontSize: 32, bold: true, color: 'FFFFFF', fontFace: 'Calibri' });
  s1.addText(`${resultados.vendedores.length} vendedores · ${fileName}`, { x: 0.5, y: 2.4, w: 9, h: 0.35, fontSize: 14, color: 'BDD7EE', fontFace: 'Calibri' });

  const kpiData = [
    ['Total a comisionar', fmtPesos(resultados.totalAPagar), 'FFFFFF'],
    ['TM + Presencial',    fmtPesos(resultados.totalTelemarketing), 'BDD7EE'],
    ['Internet',           fmtPesos(resultados.totalInternet), 'BDD7EE'],
    ['80 Sin Falta',       String(resultados.vendedores80SinFalta) + ' vend.', 'FEF9C3'],
    ['50 o Falta',         String(resultados.vendedores50OFalta) + ' vend.', 'BDD7EE'],
  ];
  kpiData.forEach(([label, val, bg], i) => {
    const bx = 0.5 + i * 1.85;
    s1.addShape('rect' as Parameters<typeof s1.addShape>[0], { x: bx, y: 3.2, w: 1.7, h: 0.9, fill: { color: bg }, line: { color: 'FFFFFF', width: 0.5 } });
    s1.addText(label, { x: bx + 0.06, y: 3.25, w: 1.6, h: 0.2, fontSize: 8, color: '003DA5', fontFace: 'Calibri' });
    s1.addText(val,   { x: bx + 0.06, y: 3.48, w: 1.6, h: 0.35, fontSize: 14, bold: true, color: '003DA5', fontFace: 'Calibri' });
  });

  // ── Slide 2: KPI cards ──────────────────────────────────────────────────────
  const s2 = pptx.addSlide();
  addTitle(s2, 'Resumen de Comisiones Fibra', `${resultados.vendedores.length} vendedores`);

  const boxes: [number, number, number, string, string, string][] = [
    [0.3,  0.9, 2.8, 'Total a Comisionar', fmtPesos(resultados.totalAPagar), '28a745'],
    [3.25, 0.9, 2.2, '80 Sin Falta', `${resultados.vendedores80SinFalta} vendedores`, 'ca8a04'],
    [5.6,  0.9, 2.2, '50 o Falta',   `${resultados.vendedores50OFalta} vendedores`, '003DA5'],
    [0.3,  1.8, 2.0, 'Bajo Mínimo',  `${resultados.vendedoresBajoMinimo} vendedores`, 'E3000F'],
    [2.45, 1.8, 2.3, 'No Renovables', `${resultados.totalNoRenovables} gestiones`, 'fd7e14'],
    [4.9,  1.8, 2.3, 'TM + Presencial', fmtPesos(resultados.totalTelemarketing), '003DA5'],
    [7.35, 1.8, 2.25,'Internet',     fmtPesos(resultados.totalInternet), '20c997'],
  ];
  boxes.forEach(([x, y, w, label, val, color]) => kpiBox(s2, x, y, w, label, val, color));

  // ── Slide 3: Table ──────────────────────────────────────────────────────────
  const s3 = pptx.addSlide();
  addTitle(s3, 'Comisiones por Vendedor', 'Liquidación Fibra');

  const headers = [
    hCell('Vendedor'),
    hCell('Total'),
    hCell('Faltas'),
    hCell('Franja'),
    hCell('Condición'),
    hCell('TM'),
    hCell('Internet'),
    hCell('No Renov.'),
    hCell('Comisión Total'),
  ];

  const tableRows: ReturnType<typeof hCell>[][] = [headers];
  resultados.vendedores.forEach(v => {
    const bg = rowBgFibra(v);
    tableRows.push([
      dCell(v.nombre, 'left', true, bg),
      dCell(String(v.totalVentas), 'center', false, bg),
      dCell(String(v.faltas), 'center', false, bg),
      dCell(franjaLabel(v), 'center', false, bg),
      dCell(condicionLabel(v), 'center', false, bg),
      dCell(String(v.ventasTelemarketing), 'center', false, bg),
      dCell(String(v.ventasInternet), 'center', false, bg),
      dCell(v.noRenovables > 0 ? String(v.noRenovables) : '—', 'center', false, bg),
      dCell(fmtPesos(v.comisionTotal), 'right', true, bg),
    ]);
  });

  s3.addTable(tableRows, {
    x: 0.3, y: 0.85, w: 9.4,
    colW: [2.2, 0.7, 0.6, 1.1, 1.2, 0.7, 0.8, 0.8, 1.3],
    rowH: 0.26,
    border: { type: 'solid', color: 'E2E8F0', pt: 0.3 },
  });

  // ── Slide 4: Desglose por vendedor ──────────────────────────────────────────
  for (const v of resultados.vendedores.slice(0, 8)) {
    const sv = pptx.addSlide();
    addTitle(sv, v.nombre, `${v.totalVentas} ventas · ${condicionLabel(v)} · ${franjaLabel(v)} · ${fmtPesos(v.comisionTotal)}`);

    const dHeaders = [
      hCell('Plan'),
      hCell('Modalidad'),
      hCell('Altas'),
      hCell('Renovaciones'),
      hCell('No Renov.'),
      hCell('Comisión'),
    ];
    const dRows: ReturnType<typeof hCell>[][] = [dHeaders];
    v.desglosePlanes.forEach(d => {
      dRows.push([
        dCell(d.plan, 'left'),
        dCell(d.modalidad, 'center'),
        dCell(String(d.altas), 'center'),
        dCell(String(d.renovaciones), 'center'),
        dCell(d.noRenovables > 0 ? String(d.noRenovables) : '—', 'center'),
        dCell(fmtPesos(d.comision), 'right', true),
      ]);
    });

    sv.addTable(dRows, {
      x: 0.3, y: 0.85, w: 9.4,
      colW: [3.5, 1.5, 0.9, 1.4, 1.0, 1.1],
      rowH: 0.27,
      border: { type: 'solid', color: 'E2E8F0', pt: 0.3 },
    });

    kpiBox(sv, 0.3,  4.7, 1.8, 'TM + Presencial', fmtPesos(v.comisionTelemarketing), '003DA5');
    kpiBox(sv, 2.25, 4.7, 1.5, 'Internet',        fmtPesos(v.comisionInternet),      '20c997');
    kpiBox(sv, 3.9,  4.7, 1.5, 'Altas',           `${v.altas.cantidad} (${fmtPesos(v.altas.comision)})`, '28a745');
    kpiBox(sv, 5.5,  4.7, 1.8, 'Renovaciones',    `${v.renovaciones.cantidad} (${fmtPesos(v.renovaciones.comision)})`, '003DA5');
  }

  await pptx.writeFile({ fileName: `comisiones-fibra-${fileName.replace(/\.\w+$/, '')}.pptx` });
}
