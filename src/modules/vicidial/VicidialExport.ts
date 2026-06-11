import * as XLSX from 'xlsx';
import PptxGenJS from 'pptxgenjs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { VicidialData } from './vicidialParser';
import { fmtMins, getNombreLegible, findAlmuerzoKey, findVtamovKey } from './vicidialParser';
import { generarAlertas } from './VicidialAlertas';

// ─── Excel ────────────────────────────────────────────────────────────────────

function autoWidth(rows: (string | number)[][]): XLSX.ColInfo[] {
  if (rows.length === 0) return [];
  const cols = rows[0]?.length ?? 0;
  const widths = Array.from({ length: cols }, () => 10);
  for (const row of rows) {
    row.forEach((cell, i) => {
      const len = String(cell ?? '').length;
      if (len + 2 > (widths[i] ?? 10)) widths[i] = len + 2;
    });
  }
  return widths.map(w => ({ wch: Math.min(w, 40) }));
}

export function exportarExcel(data: VicidialData) {
  const { agentes, totales, tiposPausa, fecha } = data;
  const wb = XLSX.utils.book_new();

  // ── Hoja 1: Resumen ──
  const resHeaders = ['Agente', 'Llamadas', 'Hora reloj', 'Hablando', '% Hablando', 'Categorizando', '% Categ.', 'Pausa total', '% Pausa', 'Ociosa', 'Eficiencia %'];
  const resRows: (string | number)[][] = agentes.map(a => [
    a.usuario, a.llamadas,
    fmtMins(a.horaReloj), fmtMins(a.hablando), parseFloat(a.pctHablando.toFixed(1)),
    fmtMins(a.categorizando), parseFloat(a.pctCategorizando.toFixed(1)),
    fmtMins(a.pausaTotal), parseFloat(a.pctPausa.toFixed(1)),
    fmtMins(a.pausaOciosa), parseFloat(a.eficiencia.toFixed(1)),
  ]);
  resRows.push([
    'TOTALES', totales.llamadas,
    fmtMins(totales.horaReloj), fmtMins(totales.hablando), parseFloat(totales.pctHablando.toFixed(1)),
    fmtMins(totales.categorizando), parseFloat(totales.pctCategorizando.toFixed(1)),
    fmtMins(totales.pausaTotal), parseFloat(totales.pctPausa.toFixed(1)),
    fmtMins(totales.pausaOciosa), parseFloat(totales.eficiencia.toFixed(1)),
  ]);
  const ws1 = XLSX.utils.aoa_to_sheet([resHeaders, ...resRows]);
  ws1['!cols'] = autoWidth([resHeaders, ...resRows]);
  XLSX.utils.book_append_sheet(wb, ws1, 'Resumen');

  // ── Hoja 2: Pausas por tipo ──
  const pausaHeaders = ['Agente', ...tiposPausa.map(getNombreLegible), 'Pausa ociosa', 'Pausa productiva'];
  const pausaRows: (string | number)[][] = agentes.map(a => [
    a.usuario,
    ...tiposPausa.map(t => fmtMins(a.pausas[t] ?? 0)),
    fmtMins(a.pausaOciosa), fmtMins(a.pausaProductiva),
  ]);
  pausaRows.push([
    'TOTALES',
    ...tiposPausa.map(t => fmtMins(totales.pausas[t] ?? 0)),
    fmtMins(totales.pausaOciosa), fmtMins(totales.pausaProductiva),
  ]);
  const ws2 = XLSX.utils.aoa_to_sheet([pausaHeaders, ...pausaRows]);
  ws2['!cols'] = autoWidth([pausaHeaders, ...pausaRows]);
  XLSX.utils.book_append_sheet(wb, ws2, 'Pausas por Tipo');

  // ── Hoja 3: Eficiencia ──
  const efHeaders = ['Agente', 'Eficiencia %', '% Hablando', '% Categorizando', '% Pausa', 'Llamadas', 'Pausa ociosa'];
  const sorted = [...agentes].sort((a, b) => b.eficiencia - a.eficiencia);
  const efRows: (string | number)[][] = sorted.map(a => [
    a.usuario, parseFloat(a.eficiencia.toFixed(1)),
    parseFloat(a.pctHablando.toFixed(1)), parseFloat(a.pctCategorizando.toFixed(1)),
    parseFloat(a.pctPausa.toFixed(1)), a.llamadas, fmtMins(a.pausaOciosa),
  ]);
  const ws3 = XLSX.utils.aoa_to_sheet([efHeaders, ...efRows]);
  ws3['!cols'] = autoWidth([efHeaders, ...efRows]);
  XLSX.utils.book_append_sheet(wb, ws3, 'Eficiencia');

  // ── Hoja 4: Alertas ──
  const alertas = generarAlertas(data);
  const alertHeaders = ['Nivel', 'Agente', 'Detalle'];
  const alertRows: (string | number)[][] = alertas.length > 0
    ? alertas.map(a => [a.nivel.toUpperCase(), a.agente, a.mensaje])
    : [['—', '—', 'Sin alertas']];
  const ws4 = XLSX.utils.aoa_to_sheet([alertHeaders, ...alertRows]);
  ws4['!cols'] = autoWidth([alertHeaders, ...alertRows]);
  XLSX.utils.book_append_sheet(wb, ws4, 'Alertas');

  // ── Hoja 5: Almuerzos ──
  const almKey = findAlmuerzoKey(tiposPausa);
  if (almKey) {
    const almHeaders = ['Agente', 'Almuerzo (min)', 'Estado'];
    const almRows: (string | number)[][] = agentes
      .map(a => [a.usuario, Math.round(a.pausas[almKey] ?? 0), a.almuerzoExcedido ? 'EXCEDIDO' : 'OK'])
      .sort((a, b) => (b[1] as number) - (a[1] as number));
    const ws5 = XLSX.utils.aoa_to_sheet([almHeaders, ...almRows]);
    ws5['!cols'] = autoWidth([almHeaders, ...almRows]);
    XLSX.utils.book_append_sheet(wb, ws5, 'Almuerzos');
  }

  XLSX.writeFile(wb, `vicidial_pausas_${fecha || 'reporte'}.xlsx`);
}

// ─── PowerPoint ───────────────────────────────────────────────────────────────

const BLUE  = '1d4ed8';
const DARK  = '1e293b';
const GRAY  = '64748b';
const GREEN = '16a34a';
const RED   = 'dc2626';

function slide1Cover(prs: PptxGenJS, data: VicidialData) {
  const s = prs.addSlide();
  s.background = { color: BLUE };
  s.addText('Reporte de Pausas', { x: 0.5, y: 1.2, w: 9, h: 1, fontSize: 36, bold: true, color: 'FFFFFF', align: 'center' });
  s.addText('Vicidial — Tiempo detallado de agentes', { x: 0.5, y: 2.4, w: 9, h: 0.5, fontSize: 16, color: 'BFDBFE', align: 'center' });
  const subtitle = data.fecha ? `Fecha: ${data.fecha}  ·  ${data.agentes.length} agentes` : `${data.agentes.length} agentes`;
  s.addText(subtitle, { x: 0.5, y: 3.1, w: 9, h: 0.4, fontSize: 13, color: 'BFDBFE', align: 'center' });
  if (data.rangoInicio && data.rangoFin) {
    s.addText(`Rango horario: ${data.rangoInicio} – ${data.rangoFin}`, {
      x: 0.5, y: 3.6, w: 9, h: 0.35, fontSize: 12, color: '93C5FD', align: 'center',
    });
  }
}

function slide2KPIs(prs: PptxGenJS, data: VicidialData) {
  const s = prs.addSlide();
  s.addText('KPIs del día', { x: 0.4, y: 0.2, w: 9.2, h: 0.5, fontSize: 20, bold: true, color: DARK });
  const { totales, agentes } = data;
  const kpis = [
    { label: 'Agentes',          value: String(agentes.length) },
    { label: 'Llamadas totales', value: String(totales.llamadas) },
    { label: 'Eficiencia prom.', value: `${totales.eficiencia.toFixed(1)}%` },
    { label: 'Pausa ociosa tot.', value: fmtMins(totales.pausaOciosa) },
    { label: 'Hablando prom.',   value: `${totales.pctHablando.toFixed(1)}%` },
  ];
  kpis.forEach((k, i) => {
    const col = i % 3, row = Math.floor(i / 3);
    const x = 0.3 + col * 3.2, y = 0.9 + row * 1.6;
    s.addShape(prs.ShapeType.rect, { x, y, w: 3, h: 1.4, fill: { color: 'F1F5F9' }, line: { color: 'E2E8F0', width: 1 } });
    s.addText(k.value, { x, y: y + 0.2, w: 3, h: 0.7, fontSize: 24, bold: true, color: BLUE, align: 'center' });
    s.addText(k.label, { x, y: y + 0.85, w: 3, h: 0.4, fontSize: 11, color: GRAY, align: 'center' });
  });
}

function slide3Tabla(prs: PptxGenJS, data: VicidialData) {
  const s = prs.addSlide();
  s.addText('Tabla de agentes', { x: 0.4, y: 0.2, w: 9.2, h: 0.5, fontSize: 20, bold: true, color: DARK });
  const cols = ['Agente', 'Llamadas', 'Hablando', 'Efic.%', 'Pausa', 'Ociosa'];
  const tableData = [
    cols.map(c => ({ text: c, options: { bold: true, color: 'FFFFFF', fill: { color: BLUE }, fontSize: 9 } })),
    ...data.agentes.slice(0, 15).map(a => [
      a.usuario, String(a.llamadas),
      `${a.pctHablando.toFixed(1)}%`, `${a.eficiencia.toFixed(1)}%`,
      `${a.pctPausa.toFixed(1)}%`, fmtMins(a.pausaOciosa),
    ].map((v, ci) => ({ text: v, options: { fontSize: 9, align: (ci === 0 ? 'left' : 'center') as 'left' | 'center' } }))),
  ];
  s.addTable(tableData, { x: 0.3, y: 0.85, w: 9.4, rowH: 0.28, border: { type: 'solid', color: 'E2E8F0', pt: 0.5 } });
}

function slide4Alertas(prs: PptxGenJS, data: VicidialData) {
  const s = prs.addSlide();
  s.addText('Alertas', { x: 0.4, y: 0.2, w: 9.2, h: 0.5, fontSize: 20, bold: true, color: DARK });
  const alertas = generarAlertas(data);
  if (alertas.length === 0) {
    s.addText('Sin alertas — todos los agentes dentro de parámetros.', { x: 0.4, y: 1.2, w: 9.2, h: 0.5, fontSize: 13, color: GREEN });
    return;
  }
  alertas.slice(0, 12).forEach((a, i) => {
    const y = 0.85 + i * 0.45;
    const color = a.nivel === 'critico' ? RED : a.nivel === 'advertencia' ? 'D97706' : '3B82F6';
    const prefix = a.nivel === 'critico' ? '[CRITICO]' : a.nivel === 'advertencia' ? '[ADVERTENCIA]' : '[INFO]';
    s.addText(`${prefix} ${a.agente} — ${a.mensaje}`, { x: 0.3, y, w: 9.4, h: 0.38, fontSize: 9.5, color });
  });
  if (alertas.length > 12) {
    s.addText(`... y ${alertas.length - 12} alertas más`, { x: 0.3, y: 0.85 + 12 * 0.45, w: 9.4, h: 0.35, fontSize: 9, color: GRAY });
  }
}

function slide5Almuerzos(prs: PptxGenJS, data: VicidialData) {
  const s = prs.addSlide();
  s.addText('Almuerzos', { x: 0.4, y: 0.2, w: 9.2, h: 0.5, fontSize: 20, bold: true, color: DARK });
  const almKey = findAlmuerzoKey(data.tiposPausa);
  if (!almKey) {
    s.addText('Sin datos de almuerzo en este reporte.', { x: 0.4, y: 1.2, w: 9.2, h: 0.5, fontSize: 13, color: GRAY });
    return;
  }
  const sorted = data.agentes
    .map(a => ({ name: a.usuario, mins: Math.round(a.pausas[almKey] ?? 0), over: a.almuerzoExcedido }))
    .filter(d => d.mins > 0)
    .sort((a, b) => b.mins - a.mins);
  const tableData = [
    [{ text: 'Agente',   options: { bold: true, color: 'FFFFFF', fill: { color: BLUE }, fontSize: 9 } },
     { text: 'Minutos',  options: { bold: true, color: 'FFFFFF', fill: { color: BLUE }, fontSize: 9 } },
     { text: 'Estado',   options: { bold: true, color: 'FFFFFF', fill: { color: BLUE }, fontSize: 9 } }],
    ...sorted.slice(0, 18).map(r => [
      { text: r.name,                  options: { fontSize: 9 } },
      { text: String(r.mins),          options: { fontSize: 9, align: 'center' as const } },
      { text: r.over ? 'EXCEDIDO' : 'OK', options: { fontSize: 9, color: r.over ? RED : GREEN, bold: r.over, align: 'center' as const } },
    ]),
  ];
  s.addTable(tableData, { x: 1.5, y: 0.85, w: 7, rowH: 0.3, border: { type: 'solid', color: 'E2E8F0', pt: 0.5 } });
}

function slide6Vtamov(prs: PptxGenJS, data: VicidialData) {
  const vtKey = findVtamovKey(data.tiposPausa);
  const s = prs.addSlide();
  const title = vtKey ? getNombreLegible(vtKey) : 'Venta Móvil';
  s.addText(title, { x: 0.4, y: 0.2, w: 9.2, h: 0.5, fontSize: 20, bold: true, color: DARK });
  if (!vtKey) {
    s.addText('Sin datos de venta en este reporte.', { x: 0.4, y: 1.2, w: 9.2, h: 0.5, fontSize: 13, color: GRAY });
    return;
  }
  const sorted = data.agentes
    .map(a => ({ name: a.usuario, mins: Math.round(a.pausas[vtKey] ?? 0) }))
    .filter(d => d.mins > 0)
    .sort((a, b) => b.mins - a.mins);
  if (sorted.length === 0) {
    s.addText(`Ningún agente con tiempo de ${title}.`, { x: 0.4, y: 1.2, w: 9.2, h: 0.5, fontSize: 13, color: GRAY });
    return;
  }
  const tableData = [
    [{ text: 'Agente',  options: { bold: true, color: 'FFFFFF', fill: { color: BLUE }, fontSize: 9 } },
     { text: 'Minutos', options: { bold: true, color: 'FFFFFF', fill: { color: BLUE }, fontSize: 9 } }],
    ...sorted.slice(0, 18).map(r => [
      { text: r.name,        options: { fontSize: 9 } },
      { text: String(r.mins), options: { fontSize: 9, color: GREEN, bold: true, align: 'center' as const } },
    ]),
  ];
  s.addTable(tableData, { x: 2.5, y: 0.85, w: 5, rowH: 0.3, border: { type: 'solid', color: 'E2E8F0', pt: 0.5 } });
}

function slide7Closing(prs: PptxGenJS, data: VicidialData) {
  const s = prs.addSlide();
  s.background = { color: BLUE };
  s.addText('Elared S.A.', { x: 0.5, y: 1.8, w: 9, h: 0.8, fontSize: 28, bold: true, color: 'FFFFFF', align: 'center' });
  s.addText('Reporte generado automáticamente · Pausas Vicidial', { x: 0.5, y: 2.7, w: 9, h: 0.5, fontSize: 13, color: 'BFDBFE', align: 'center' });
  if (data.fecha) {
    s.addText(data.fecha, { x: 0.5, y: 3.3, w: 9, h: 0.4, fontSize: 12, color: '93C5FD', align: 'center' });
  }
}

// ─── PDF ──────────────────────────────────────────────────────────────────────

export function exportarPDF(data: VicidialData): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const W = 297; const fecha = data.fecha || new Date().toLocaleDateString('es-UY');

  function hdr(titulo: string) {
    doc.setFillColor(0, 61, 165); doc.rect(0, 0, W, 15, 'F');
    doc.setFillColor(227, 0, 15); doc.rect(0, 15, W, 1.5, 'F');
    doc.setTextColor(255, 255, 255); doc.setFontSize(12); doc.setFont('helvetica', 'bold');
    doc.text('ELARED · Vicidial Pausas', 7, 10);
    doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(202, 220, 252);
    doc.text(titulo, W / 2, 10, { align: 'center' });
    doc.text(fecha, W - 7, 10, { align: 'right' });
  }
  function ftr(p: number, t: number) {
    doc.setFillColor(232, 240, 254); doc.rect(0, 200, W, 10, 'F');
    doc.setFontSize(7); doc.setTextColor(74, 74, 106); doc.setFont('helvetica', 'normal');
    doc.text('Elared S.A. · Confidencial', 7, 207);
    doc.text(`Pág. ${p}/${t}`, W - 7, 207, { align: 'right' });
  }

  hdr('Resumen de Agentes');
  autoTable(doc, {
    startY: 20,
    head: [['Agente', 'Llamadas', 'Hablando', '% Hab.', 'Eficiencia %', 'Pausa total', '% Pausa', 'Ociosa']],
    body: data.agentes.map(a => [
      a.usuario, a.llamadas, fmtMins(a.hablando), `${a.pctHablando.toFixed(1)}%`,
      `${a.eficiencia.toFixed(1)}%`, fmtMins(a.pausaTotal), `${a.pctPausa.toFixed(1)}%`, fmtMins(a.pausaOciosa),
    ]),
    foot: [['TOTALES', data.totales.llamadas, fmtMins(data.totales.hablando), `${data.totales.pctHablando.toFixed(1)}%`,
      `${data.totales.eficiencia.toFixed(1)}%`, fmtMins(data.totales.pausaTotal), `${data.totales.pctPausa.toFixed(1)}%`, fmtMins(data.totales.pausaOciosa)]],
    headStyles: { fillColor: [0, 61, 165], textColor: 255, fontSize: 9, fontStyle: 'bold' },
    bodyStyles: { fontSize: 8.5 },
    footStyles: { fillColor: [74, 74, 106], textColor: 255, fontStyle: 'bold', fontSize: 9 },
    alternateRowStyles: { fillColor: [232, 240, 254] },
    margin: { left: 7, right: 7 },
  });

  const alertas = generarAlertas(data);
  if (alertas.length > 0) {
    doc.addPage();
    hdr('Alertas');
    autoTable(doc, {
      startY: 20,
      head: [['Nivel', 'Agente', 'Mensaje']],
      body: alertas.map(a => [a.nivel.toUpperCase(), a.agente, a.mensaje]),
      headStyles: { fillColor: [0, 61, 165], textColor: 255, fontSize: 9, fontStyle: 'bold' },
      bodyStyles: { fontSize: 8.5 },
      columnStyles: { 0: { cellWidth: 25 }, 1: { cellWidth: 50 } },
      didParseCell: (d) => {
        if (d.section === 'body' && d.column.index === 0) {
          const v = String(d.cell.raw);
          if (v === 'CRITICO') d.cell.styles.textColor = [200, 30, 20];
          else if (v === 'ADVERTENCIA') d.cell.styles.textColor = [180, 100, 0];
        }
      },
      margin: { left: 7, right: 7 },
    });
  }

  const pg = doc.getNumberOfPages();
  for (let i = 1; i <= pg; i++) { doc.setPage(i); ftr(i, pg); }
  doc.save(`vicidial_${fecha}.pdf`);
}

export async function exportarPPTX(data: VicidialData) {
  const prs = new PptxGenJS();
  prs.layout  = 'LAYOUT_WIDE';
  prs.author  = 'Elared S.A.';
  prs.subject = 'Pausas Vicidial';
  prs.title   = `Reporte Vicidial ${data.fecha}`;

  slide1Cover(prs, data);
  slide2KPIs(prs, data);
  slide3Tabla(prs, data);
  slide4Alertas(prs, data);
  slide5Almuerzos(prs, data);
  slide6Vtamov(prs, data);
  slide7Closing(prs, data);

  await prs.writeFile({ fileName: `vicidial_pausas_${data.fecha || 'reporte'}.pptx` });
}
