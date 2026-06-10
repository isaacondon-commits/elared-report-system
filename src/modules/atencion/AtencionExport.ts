import * as XLSX from 'xlsx';
import PptxGenJS from 'pptxgenjs';
import type { AtencionData } from './atencionParser';
import { fmtSecs } from './atencionParser';
import { generarAlertas } from './AtencionAlertas';

// ─── Colors ───────────────────────────────────────────────────────────────────

const AZUL    = '003DA5';
const ROJO    = 'E3000F';
const BLANCO  = 'FFFFFF';
const GRIS_BG = 'F5F7FA';
type VAlign = 'middle' | 'top' | 'bottom';

// ─── Excel ────────────────────────────────────────────────────────────────────

export function exportarExcel(data: AtencionData) {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Resumen General
  const resumenRows = [
    ['Resumen General', '', '', '', '', '', '', ''],
    [`Fecha: ${data.fecha}`, '', '', '', '', '', '', ''],
    [],
    ['Grupo', 'Llamadas', 'Respuestas', 'Abandono', '% Respuesta', '% Abandono', 'T. Charla Prom.', 'T. Medio Cola'],
    ...data.grupos.map(g => [
      g.nombreLegible,
      g.llamadas,
      g.respuestas,
      g.abandono,
      `${g.tasaRespuesta.toFixed(1)}%`,
      `${g.tasaAbandono.toFixed(1)}%`,
      fmtSecs(g.charlaPromedio),
      fmtSecs(g.tiempoMedioCola),
    ]),
    [],
    [
      'TOTALES',
      data.totales.llamadas,
      data.totales.respuestas,
      data.totales.abandono,
      `${data.totales.tasaRespuesta.toFixed(1)}%`,
      `${data.totales.tasaAbandono.toFixed(1)}%`,
      fmtSecs(data.totales.charlaPromedio),
      fmtSecs(data.totales.tiempoMedioCola),
    ],
  ];
  const ws1 = XLSX.utils.aoa_to_sheet(resumenRows);
  ws1['!cols'] = [{ wch: 18 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, ws1, 'Resumen General');

  // Sheet 2: Detalle Horario (per group)
  for (const g of data.grupos) {
    const horaRows = [
      [`${g.nombreLegible} — Detalle Horario`, '', '', '', '', '', '', ''],
      [`Fecha: ${data.fecha}`, '', '', '', '', '', '', ''],
      [],
      ['Hora', 'Llamadas', 'Respuestas', 'Abandono', '% Respuesta', '% Abandono', 'T. Charla Prom.', 'T. Medio Cola'],
      ...g.horasDesglose.map(h => [
        `${h.hora}:00`,
        h.llamadas,
        h.respuestas,
        h.abandono,
        `${h.tasaRespuesta.toFixed(1)}%`,
        `${h.tasaAbandono.toFixed(1)}%`,
        fmtSecs(h.charlaPromedio),
        fmtSecs(h.tiempoMedioCola),
      ]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(horaRows);
    ws['!cols'] = [{ wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 16 }];
    const sheetName = g.nombreLegible.substring(0, 31);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  }

  // Sheet 3: Horas Críticas
  const horasCriticas = data.grupos.flatMap(g =>
    g.horasDesglose
      .filter(h => h.alertaAbandono && h.llamadas > 0)
      .map(h => [g.nombreLegible, `${h.hora}:00`, h.llamadas, h.abandono, `${h.tasaAbandono.toFixed(1)}%`, fmtSecs(h.tiempoMedioCola)])
  );
  const ws3 = XLSX.utils.aoa_to_sheet([
    ['Horas Críticas (abandono >15%)', '', '', '', '', ''],
    [`Fecha: ${data.fecha}`, '', '', '', '', ''],
    [],
    ['Grupo', 'Hora', 'Llamadas', 'Abandono', '% Abandono', 'T. Medio Cola'],
    ...horasCriticas,
  ]);
  ws3['!cols'] = [{ wch: 16 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, ws3, 'Horas Críticas');

  // Sheet 4: Alertas
  const alertas = generarAlertas(data);
  const ws4 = XLSX.utils.aoa_to_sheet([
    ['Alertas del Sistema', '', ''],
    [`Fecha: ${data.fecha}`, '', ''],
    [],
    ['Nivel', 'Grupo', 'Mensaje'],
    ...alertas.map(a => [a.nivel.toUpperCase(), a.grupo, a.mensaje]),
  ]);
  ws4['!cols'] = [{ wch: 14 }, { wch: 16 }, { wch: 60 }];
  XLSX.utils.book_append_sheet(wb, ws4, 'Alertas');

  XLSX.writeFile(wb, `atencion_cliente_${data.fecha}.xlsx`);
}

// ─── PPTX helpers ─────────────────────────────────────────────────────────────

type HAlign = 'left' | 'center' | 'right';

const VM: VAlign = 'middle';

function headerCell(text: string, opts: object = {}) {
  return { text, options: { bold: true, fontSize: 9, color: BLANCO, fill: { color: AZUL }, align: 'center' as HAlign, valign: VM, ...opts } };
}
function dataCell(text: string, align: HAlign = 'center', bold = false, fillColor?: string) {
  return { text, options: { fontSize: 9, color: '1e293b', align, bold, valign: VM, fill: fillColor ? { color: fillColor } : { color: BLANCO } } };
}
function groupHeaderCell(text: string) {
  return { text, options: { bold: true, fontSize: 9, color: BLANCO, fill: { color: '475569' }, align: 'center' as HAlign, valign: VM } };
}

function addSlideTitle(slide: PptxGenJS.Slide, title: string, subtitle: string = '') {
  slide.addText(title, { x: 0.3, y: 0.15, w: 9.4, h: 0.35, fontSize: 16, bold: true, color: AZUL, fontFace: 'Calibri' });
  if (subtitle) {
    slide.addText(subtitle, { x: 0.3, y: 0.5, w: 9.4, h: 0.2, fontSize: 10, color: '64748b', fontFace: 'Calibri' });
  }
  slide.addShape('line' as Parameters<typeof slide.addShape>[0], { x: 0.3, y: 0.73, w: 9.4, h: 0, line: { color: AZUL, width: 1.5 } });
}

function kpiBox(slide: PptxGenJS.Slide, x: number, y: number, w: number, h: number, label: string, value: string, color: string) {
  slide.addShape('rect' as Parameters<typeof slide.addShape>[0], { x, y, w, h, fill: { color: GRIS_BG }, line: { color: 'E2E8F0', width: 0.5 } });
  slide.addText(label, { x, y: y + 0.06, w, h: 0.22, fontSize: 8, color: '64748b', align: 'center', fontFace: 'Calibri' });
  slide.addText(value, { x, y: y + 0.28, w, h: 0.32, fontSize: 15, bold: true, color, align: 'center', fontFace: 'Calibri' });
}

// ─── PPTX export ──────────────────────────────────────────────────────────────

export async function exportarPPTX(data: AtencionData) {
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';
  pptx.author = 'Elared S.A.';
  pptx.subject = 'Atención al Cliente';

  const fechaLabel = data.fecha || 'Sin fecha';

  // ── Slide 1: Portada ────────────────────────────────────────────────────────
  const s1 = pptx.addSlide();
  s1.addShape('rect' as Parameters<typeof s1.addShape>[0], { x: 0, y: 0, w: '100%', h: 1.2, fill: { color: AZUL } });
  s1.addText('ELARED S.A.', { x: 0.5, y: 0.2, w: 9, h: 0.4, fontSize: 22, bold: true, color: BLANCO, fontFace: 'Calibri' });
  s1.addText('Informe Atención al Cliente', { x: 0.5, y: 0.65, w: 9, h: 0.3, fontSize: 13, color: 'bfdbfe', fontFace: 'Calibri' });
  s1.addText(`Fecha: ${fechaLabel}`, { x: 0.5, y: 1.4, w: 9, h: 0.3, fontSize: 12, color: '374151', fontFace: 'Calibri' });
  s1.addText(`Grupos: ${data.grupos.map(g => g.nombreLegible).join(' · ')}`, { x: 0.5, y: 1.8, w: 9, h: 0.25, fontSize: 10, color: '64748b', fontFace: 'Calibri' });

  const totT = data.totales;
  const kpis = [
    { label: 'Total Llamadas', value: String(totT.llamadas), color: AZUL },
    { label: 'Respondidas',    value: String(totT.respuestas), color: '16a34a' },
    { label: 'Abandonadas',    value: String(totT.abandono), color: ROJO },
    { label: '% Respuesta',    value: `${totT.tasaRespuesta.toFixed(1)}%`, color: '0284c7' },
    { label: '% Abandono',     value: `${totT.tasaAbandono.toFixed(1)}%`, color: ROJO },
  ];
  kpis.forEach((k, i) => kpiBox(s1, 0.3 + i * 1.9, 2.3, 1.8, 0.7, k.label, k.value, k.color));

  // ── Slide 2: Comparativa por grupo ─────────────────────────────────────────
  const s2 = pptx.addSlide();
  addSlideTitle(s2, 'Comparativa por Grupo', `Fecha: ${fechaLabel}`);

  const colWidths = [1.5, 1.1, 1.1, 1.0, 1.2, 1.2, 1.4, 1.4];
  const headerRow = [
    headerCell('Grupo'), headerCell('Llamadas'), headerCell('Respondidas'),
    headerCell('Abandono'), headerCell('% Resp.'), headerCell('% Aban.'),
    headerCell('T. Charla'), headerCell('T. Cola'),
  ];
  const dataRows = data.grupos.map(g => [
    dataCell(g.nombreLegible, 'left', true),
    dataCell(String(g.llamadas)),
    dataCell(String(g.respuestas)),
    dataCell(String(g.abandono)),
    dataCell(`${g.tasaRespuesta.toFixed(1)}%`, 'center', false, g.tasaRespuesta >= 80 ? 'dcfce7' : g.tasaRespuesta >= 60 ? 'fef9c3' : 'fecaca'),
    dataCell(`${g.tasaAbandono.toFixed(1)}%`, 'center', false, g.tasaAbandono <= 10 ? 'dcfce7' : g.tasaAbandono <= 20 ? 'fef9c3' : 'fecaca'),
    dataCell(fmtSecs(g.charlaPromedio)),
    dataCell(fmtSecs(g.tiempoMedioCola)),
  ]);
  const totRow = [
    dataCell('TOTALES', 'left', true),
    dataCell(String(totT.llamadas), 'center', true),
    dataCell(String(totT.respuestas), 'center', true),
    dataCell(String(totT.abandono), 'center', true),
    dataCell(`${totT.tasaRespuesta.toFixed(1)}%`, 'center', true),
    dataCell(`${totT.tasaAbandono.toFixed(1)}%`, 'center', true),
    dataCell(fmtSecs(totT.charlaPromedio), 'center', true),
    dataCell(fmtSecs(totT.tiempoMedioCola), 'center', true),
  ];

  s2.addTable([headerRow, ...dataRows, totRow], {
    x: 0.3, y: 0.85, w: 9.4,
    rowH: 0.32,
    colW: colWidths,
    border: { type: 'solid', color: 'E2E8F0', pt: 0.5 },
    fontFace: 'Calibri',
  });

  // ── Slide 3: Desglose horario por grupo ────────────────────────────────────
  for (const grupo of data.grupos) {
    const sg = pptx.addSlide();
    addSlideTitle(sg, `Desglose Horario — ${grupo.nombreLegible}`, `Fecha: ${fechaLabel}`);

    const hColW = [0.7, 1.0, 1.1, 1.0, 1.2, 1.2, 1.4, 1.4];
    const hHeader = [
      headerCell('Hora'), headerCell('Llamadas'), headerCell('Respondidas'),
      headerCell('Abandono'), headerCell('% Resp.'), headerCell('% Aban.'),
      headerCell('T. Charla'), headerCell('T. Cola'),
    ];
    const hRows = grupo.horasDesglose.map(h => [
      dataCell(`${h.hora}:00`, 'center', h.esHoraPico, h.esHoraPico ? 'dbeafe' : undefined),
      dataCell(String(h.llamadas), 'center', h.esHoraPico),
      dataCell(String(h.respuestas)),
      dataCell(String(h.abandono)),
      dataCell(`${h.tasaRespuesta.toFixed(1)}%`, 'center', false, h.tasaRespuesta >= 80 ? 'dcfce7' : h.tasaRespuesta >= 60 ? 'fef9c3' : 'fecaca'),
      dataCell(`${h.tasaAbandono.toFixed(1)}%`, 'center', false, h.alertaAbandono ? 'fecaca' : 'dcfce7'),
      dataCell(fmtSecs(h.charlaPromedio)),
      dataCell(fmtSecs(h.tiempoMedioCola)),
    ]);

    const maxRows = 14;
    const visibleRows = hRows.slice(0, maxRows);

    sg.addTable([hHeader, ...visibleRows], {
      x: 0.3, y: 0.85, w: 9.4,
      rowH: 0.28,
      colW: hColW,
      border: { type: 'solid', color: 'E2E8F0', pt: 0.5 },
      fontFace: 'Calibri',
    });
  }

  // ── Slide 4: Horas Críticas ────────────────────────────────────────────────
  const s4 = pptx.addSlide();
  addSlideTitle(s4, 'Horas Críticas (Abandono >15%)', `Fecha: ${fechaLabel}`);

  const criticas = data.grupos.flatMap(g =>
    g.horasDesglose
      .filter(h => h.alertaAbandono && h.llamadas > 0)
      .map(h => ({ grupo: g.nombreLegible, ...h }))
  ).sort((a, b) => b.tasaAbandono - a.tasaAbandono);

  if (criticas.length === 0) {
    s4.addText('Sin horas críticas — desempeño dentro de parámetros normales.', {
      x: 0.5, y: 2, w: 9, h: 0.4, fontSize: 13, color: '16a34a', align: 'center', fontFace: 'Calibri',
    });
  } else {
    const crHeader = [
      headerCell('Grupo'), headerCell('Hora'), headerCell('Llamadas'),
      headerCell('Abandono'), headerCell('% Abandono'), headerCell('T. Medio Cola'),
    ];
    const crRows = criticas.slice(0, 12).map(h => [
      dataCell(h.grupo, 'left', true),
      dataCell(`${h.hora}:00`),
      dataCell(String(h.llamadas)),
      dataCell(String(h.abandono)),
      dataCell(`${h.tasaAbandono.toFixed(1)}%`, 'center', true, h.tasaAbandono > 25 ? 'fecaca' : 'fde68a'),
      dataCell(fmtSecs(h.tiempoMedioCola)),
    ]);
    s4.addTable([crHeader, ...crRows], {
      x: 0.3, y: 0.85, w: 9.4,
      rowH: 0.3,
      colW: [1.6, 0.8, 1.1, 1.1, 1.4, 1.5],
      border: { type: 'solid', color: 'E2E8F0', pt: 0.5 },
      fontFace: 'Calibri',
    });
  }

  // ── Slide 5: Indicadores de Calidad ────────────────────────────────────────
  const s5 = pptx.addSlide();
  addSlideTitle(s5, 'Indicadores de Calidad', `Fecha: ${fechaLabel}`);

  const calHeader = [
    headerCell('Grupo'), headerCell('% Respuesta'), headerCell('% Abandono'),
    headerCell('T. Medio Cola'), headerCell('T. Charla Prom.'), headerCell('Llamadas'),
  ];
  const calRows = data.grupos.map(g => [
    dataCell(g.nombreLegible, 'left', true),
    dataCell(`${g.tasaRespuesta.toFixed(1)}%`, 'center', false, g.tasaRespuesta >= 80 ? 'dcfce7' : g.tasaRespuesta >= 60 ? 'fef9c3' : 'fecaca'),
    dataCell(`${g.tasaAbandono.toFixed(1)}%`, 'center', false, g.tasaAbandono <= 10 ? 'dcfce7' : g.tasaAbandono <= 20 ? 'fef9c3' : 'fecaca'),
    dataCell(fmtSecs(g.tiempoMedioCola), 'center', false, g.tiempoMedioCola > 120 ? 'fecaca' : g.tiempoMedioCola > 60 ? 'fef9c3' : 'dcfce7'),
    dataCell(fmtSecs(g.charlaPromedio)),
    dataCell(String(g.llamadas)),
  ]);
  s5.addTable([calHeader, ...calRows], {
    x: 0.3, y: 0.85, w: 9.4,
    rowH: 0.35,
    colW: [1.8, 1.4, 1.4, 1.6, 1.6, 1.2],
    border: { type: 'solid', color: 'E2E8F0', pt: 0.5 },
    fontFace: 'Calibri',
  });

  // Legend
  s5.addText('Colores: Verde ≥80% resp. / ≤10% aban. · Amarillo 60-79% / 10-20% · Rojo <60% / >20%', {
    x: 0.3, y: 6.6, w: 9.4, h: 0.2, fontSize: 8, color: '64748b', fontFace: 'Calibri',
  });

  // ── Slide 6: Alertas ────────────────────────────────────────────────────────
  const s6 = pptx.addSlide();
  addSlideTitle(s6, 'Alertas del Sistema', `Fecha: ${fechaLabel}`);

  const alertas = generarAlertas(data);

  if (alertas.length === 0) {
    s6.addText('Sin alertas activas.', { x: 0.5, y: 2.5, w: 9, h: 0.3, fontSize: 14, color: '16a34a', align: 'center', fontFace: 'Calibri' });
  } else {
    const alertHeader = [groupHeaderCell('Nivel'), groupHeaderCell('Grupo'), groupHeaderCell('Descripción')];
    const alertRows = alertas.slice(0, 15).map(a => {
      const nivColor = a.nivel === 'critico' ? 'fecaca' : a.nivel === 'advertencia' ? 'fef9c3' : 'dbeafe';
      return [
        dataCell(a.nivel === 'critico' ? 'CRÍTICO' : a.nivel === 'advertencia' ? 'ADVERTENCIA' : 'INFO', 'center', true, nivColor),
        dataCell(a.grupo, 'left'),
        dataCell(a.mensaje, 'left'),
      ];
    });
    s6.addTable([alertHeader, ...alertRows], {
      x: 0.3, y: 0.85, w: 9.4,
      rowH: 0.28,
      colW: [1.4, 1.4, 6.6],
      border: { type: 'solid', color: 'E2E8F0', pt: 0.5 },
      fontFace: 'Calibri',
    });
  }

  // ── Slide 7: Cierre ────────────────────────────────────────────────────────
  const s7 = pptx.addSlide();
  s7.addShape('rect' as Parameters<typeof s7.addShape>[0], { x: 0, y: 0, w: '100%', h: '100%', fill: { color: AZUL } });
  s7.addText('ELARED S.A.', { x: 0.5, y: 2.5, w: 9, h: 0.5, fontSize: 24, bold: true, color: BLANCO, align: 'center', fontFace: 'Calibri' });
  s7.addText('Informe generado automáticamente', { x: 0.5, y: 3.1, w: 9, h: 0.3, fontSize: 11, color: 'bfdbfe', align: 'center', fontFace: 'Calibri' });
  s7.addText(fechaLabel, { x: 0.5, y: 3.5, w: 9, h: 0.25, fontSize: 10, color: '93c5fd', align: 'center', fontFace: 'Calibri' });

  await pptx.writeFile({ fileName: `atencion_cliente_${data.fecha}.pptx` });
}
