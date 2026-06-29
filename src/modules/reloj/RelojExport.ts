import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import PptxGenJS from 'pptxgenjs';
import type { EmpleadoData, RelojData, EstadoDia } from './relojParser';
import { minsToHHMM } from './relojParser';

// ─── Helpers ───────────────────────────────────────────────────────────────────

const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

function fmtFecha(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function fmtDiaSemana(iso: string): string {
  return DIAS_SEMANA[new Date(iso + 'T12:00:00').getDay()];
}

function fmtPct(n: number): string { return `${n}%`; }

const ESTADO_LABEL: Record<EstadoDia, string> = {
  OK:                 'OK',
  TARDANZA:           'Tardanza',
  TARDANZA_GRAVE:     'Tardanza grave',
  DESCANSO_EXTENDIDO: 'Desc. extendido',
  SALIDA_ANTICIPADA:  'Salida anticipada',
  DATO_INCOMPLETO:    'Dato incompleto',
  AUSENTE:            'Ausente',
  FIN_SEMANA:         'Fin de semana',
};

// ─── Styled multi-sheet Excel ──────────────────────────────────────────────────

function createStyledSheet(
  headers: string[],
  rows: (string | number)[][][],  // rows of cells, each cell is [value, style?]
): XLSX.WorkSheet {
  const wsData: (string | number)[][] = [
    headers,
    ...rows.map(r => r.map(c => c[0])),
  ];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Header style
  headers.forEach((_, ci) => {
    const ref = XLSX.utils.encode_cell({ r: 0, c: ci });
    if (ws[ref]) {
      ws[ref].s = {
        font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 },
        fill: { fgColor: { rgb: '003DA5' } },
        alignment: { horizontal: 'center', vertical: 'center' },
        border: {
          bottom: { style: 'thin', color: { rgb: 'CADCFC' } },
        },
      };
    }
  });

  // Data rows
  rows.forEach((row, ri) => {
    row.forEach((_cell, ci) => {
      const ref = XLSX.utils.encode_cell({ r: ri + 1, c: ci });
      if (!ws[ref]) return;
      const isEven = ri % 2 === 0;
      ws[ref].s = {
        fill: { fgColor: { rgb: isEven ? 'FFFFFF' : 'F0F4FF' } },
        alignment: { horizontal: ci === 0 ? 'left' : 'center', vertical: 'center' },
        border: {
          bottom: { style: 'hair', color: { rgb: 'E2E8F0' } },
        },
      };
    });
  });

  // Column widths
  const colWidths = headers.map((h, ci) => {
    const maxLen = Math.max(
      h.length,
      ...rows.map(r => String(r[ci]?.[0] ?? '').length),
    );
    return { wch: Math.min(Math.max(maxLen + 2, 10), 40) };
  });
  ws['!cols'] = colWidths;

  // Row heights
  ws['!rows'] = [{ hpt: 20 }, ...rows.map(() => ({ hpt: 16 }))];

  return ws;
}

// ─── Main export function ──────────────────────────────────────────────────────

export function exportRelojExcel(data: RelojData): void {
  const wb = XLSX.utils.book_new();
  const fecha = new Date().toLocaleDateString('es-UY').replace(/\//g, '-');

  // ── Hoja 1: Resumen General ───────────────────────────────────────────────

  const resumenHeaders = [
    'Empleado', 'Departamento', 'Presencias', 'Laborables', 'Asistencia %',
    'Tardanzas', 'T. Graves', 'Min. tardanza', 'Desc. extendidos',
    'Sal. anticipadas', 'Ausencias', 'Hrs extras', 'Jornada prom.', 'Puntualidad %',
  ];
  const resumenRows = data.empleados.map(e => [[
    [e.nombre],
    [e.horario.horarioPersona?.departamento ?? '—'],
    [e.diasPresentes],
    [e.diasLaborables],
    [fmtPct(e.diasLaborables > 0 ? Math.round((e.diasPresentes / e.diasLaborables) * 100) : 0)],
    [e.tardanzas],
    [e.tardanzasGraves],
    [e.minutosTardanzaTotal > 0 ? minsToHHMM(e.minutosTardanzaTotal) : '0m'],
    [e.descansosExtendidos],
    [e.salidasAnticipadas],
    [e.ausencias],
    [e.totalHorasExtrasMinutos > 0 ? minsToHHMM(e.totalHorasExtrasMinutos) : '—'],
    [e.jornadaPromedioMinutos > 0 ? minsToHHMM(e.jornadaPromedioMinutos) : '—'],
    [fmtPct(e.puntualidadPct)],
  ]]).flat();

  XLSX.utils.book_append_sheet(wb, createStyledSheet(resumenHeaders, resumenRows), 'Resumen General');

  // ── Hoja 2: Tardanzas ─────────────────────────────────────────────────────

  const tardanzasHeaders = [
    'Empleado', 'Fecha', 'Día semana', 'Ingreso esperado', 'Ingreso real', 'Minutos tarde', 'Tipo',
  ];
  const tardanzasRows: (string | number)[][][] = [];
  for (const emp of data.empleados) {
    for (const dia of emp.dias.values()) {
      if (dia.estado !== 'TARDANZA' && dia.estado !== 'TARDANZA_GRAVE') continue;
      tardanzasRows.push([
        [emp.nombre],
        [fmtFecha(dia.fecha)],
        [fmtDiaSemana(dia.fecha)],
        [emp.horario.ingresoEsperado],
        [dia.ingreso ?? '—'],
        [dia.minutosTardanza],
        [ESTADO_LABEL[dia.estado]],
      ]);
    }
  }
  tardanzasRows.sort((a, b) => String(a[1][0]).localeCompare(String(b[1][0])));
  XLSX.utils.book_append_sheet(wb, createStyledSheet(tardanzasHeaders, tardanzasRows), 'Tardanzas');

  // ── Hoja 3: Descansos ─────────────────────────────────────────────────────

  const descansosHeaders = [
    'Empleado', 'Fecha', 'Día semana', 'Descanso esperado', 'Salida desc.', 'Regreso desc.',
    'Duración real', 'Minutos excedidos',
  ];
  const descansosRows: (string | number)[][][] = [];
  for (const emp of data.empleados) {
    for (const dia of emp.dias.values()) {
      if (dia.estado !== 'DESCANSO_EXTENDIDO') continue;
      descansosRows.push([
        [emp.nombre],
        [fmtFecha(dia.fecha)],
        [fmtDiaSemana(dia.fecha)],
        [minsToHHMM(emp.horario.duracionDescansoMinutos)],
        [dia.salidaDescanso ?? '—'],
        [dia.regresoDescanso ?? '—'],
        [dia.minutosDescanso !== null ? minsToHHMM(dia.minutosDescanso) : '—'],
        [dia.minutosDescansoExtra],
      ]);
    }
  }
  XLSX.utils.book_append_sheet(wb, createStyledSheet(descansosHeaders, descansosRows), 'Descansos');

  // ── Hoja 4: Ausencias ─────────────────────────────────────────────────────

  const ausenciasHeaders = ['Empleado', 'Fecha', 'Día semana'];
  const ausenciasRows: (string | number)[][][] = [];
  for (const emp of data.empleados) {
    for (const dia of emp.dias.values()) {
      if (dia.estado !== 'AUSENTE') continue;
      ausenciasRows.push([
        [emp.nombre],
        [fmtFecha(dia.fecha)],
        [fmtDiaSemana(dia.fecha)],
      ]);
    }
  }
  ausenciasRows.sort((a, b) => String(a[0][0]).localeCompare(String(b[0][0])));
  XLSX.utils.book_append_sheet(wb, createStyledSheet(ausenciasHeaders, ausenciasRows), 'Ausencias');

  // ── Hoja 5: Salidas anticipadas ───────────────────────────────────────────

  const salidasHeaders = [
    'Empleado', 'Fecha', 'Día semana', 'Salida esperada', 'Salida real', 'Minutos anticipados',
  ];
  const salidasRows: (string | number)[][][] = [];
  for (const emp of data.empleados) {
    for (const dia of emp.dias.values()) {
      if (dia.estado !== 'SALIDA_ANTICIPADA') continue;
      salidasRows.push([
        [emp.nombre],
        [fmtFecha(dia.fecha)],
        [fmtDiaSemana(dia.fecha)],
        [emp.horario.salidaEsperada],
        [dia.salidaFinal ?? '—'],
        [dia.minutosSalidaAnticipada],
      ]);
    }
  }
  salidasRows.sort((a, b) => String(a[1][0]).localeCompare(String(b[1][0])));
  XLSX.utils.book_append_sheet(wb, createStyledSheet(salidasHeaders, salidasRows), 'Salidas Anticipadas');

  // ── Hoja 6: Detalle completo ──────────────────────────────────────────────

  const detalleHeaders = [
    'Empleado', 'Fecha', 'Día', 'Ingreso', 'Sal. Descanso', 'Reg. Descanso', 'Salida',
    'Jornada', 'Descanso', 'Min. tardanza', 'Min. desc. extra', 'Sal. anticipada min.', 'Estado',
  ];
  const detalleRows: (string | number)[][][] = [];
  for (const emp of data.empleados) {
    for (const dia of [...emp.dias.values()].sort((a, b) => a.fecha.localeCompare(b.fecha))) {
      if (dia.estado === 'FIN_SEMANA') continue;
      detalleRows.push([
        [emp.nombre],
        [fmtFecha(dia.fecha)],
        [fmtDiaSemana(dia.fecha)],
        [dia.ingreso ?? '—'],
        [dia.salidaDescanso ?? '—'],
        [dia.regresoDescanso ?? '—'],
        [dia.salidaFinal ?? '—'],
        [dia.minutosJornada !== null ? minsToHHMM(dia.minutosJornada) : '—'],
        [dia.minutosDescanso !== null ? minsToHHMM(dia.minutosDescanso) : '—'],
        [dia.minutosTardanza],
        [dia.minutosDescansoExtra],
        [dia.minutosSalidaAnticipada],
        [ESTADO_LABEL[dia.estado]],
      ]);
    }
  }
  XLSX.utils.book_append_sheet(wb, createStyledSheet(detalleHeaders, detalleRows), 'Detalle Completo');

  // ── Hoja 7: Horas Extras ──────────────────────────────────────────────────

  const extrasHeaders = [
    'Empleado', 'Fecha', 'Día', 'Ingreso', 'Salida', 'Jornada real',
    'Jornada esperada', 'Extras (min)', 'Extras (hh:mm)',
  ];
  const extrasRows: (string | number)[][][] = [];
  for (const emp of data.empleados) {
    for (const dia of [...emp.dias.values()].sort((a, b) => a.fecha.localeCompare(b.fecha))) {
      if (!dia.horasExtrasMinutos || dia.horasExtrasMinutos <= 0) continue;
      const ingresoEsp = emp.horario.ingresoEsperado;
      const salidaEsp = emp.horario.salidaEsperada;
      const jornadaEspMins = (parseInt(salidaEsp.split(':')[0] ?? '0') * 60 + parseInt(salidaEsp.split(':')[1] ?? '0')) -
        (parseInt(ingresoEsp.split(':')[0] ?? '0') * 60 + parseInt(ingresoEsp.split(':')[1] ?? '0')) - 30;
      extrasRows.push([
        [emp.nombre],
        [fmtFecha(dia.fecha)],
        [fmtDiaSemana(dia.fecha)],
        [dia.ingreso ?? '—'],
        [dia.salidaFinal ?? '—'],
        [dia.minutosJornada !== null ? minsToHHMM(dia.minutosJornada) : '—'],
        [jornadaEspMins > 0 ? minsToHHMM(jornadaEspMins) : '—'],
        [dia.horasExtrasMinutos],
        [minsToHHMM(dia.horasExtrasMinutos)],
      ]);
    }
  }
  if (extrasRows.length > 0) {
    XLSX.utils.book_append_sheet(wb, createStyledSheet(extrasHeaders, extrasRows), 'Horas Extras');
  }

  XLSX.writeFile(wb, `Reloj_${fecha}.xlsx`);
}

// ─── PDF export (individual employee) ─────────────────────────────────────────

export async function exportRelojPDF(emp: EmpleadoData, empresa: string): Promise<void> {

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = 210;
  const now = new Date();
  const fmtNow = `${now.getDate().toString().padStart(2,'0')}/${(now.getMonth()+1).toString().padStart(2,'0')}/${now.getFullYear()}`;

  // Header bar
  doc.setFillColor(0, 61, 165);
  doc.rect(0, 0, pageW, 30, 'F');
  doc.setFillColor(227, 0, 15);
  doc.rect(0, 30, pageW, 2, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('ELARED', 14, 12);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`${empresa} · Reporte de Asistencia`, 14, 20);

  doc.setFontSize(9);
  doc.text(fmtNow, pageW - 14, 20, { align: 'right' });

  // Employee name
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(emp.nombre, 14, 42);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(
    `Período: ${fmtFecha(emp.fechaMin)} – ${fmtFecha(emp.fechaMax)} · Horario detectado: ${emp.horario.ingresoEsperado} – ${emp.horario.salidaEsperada}`,
    14, 49,
  );

  // KPI boxes
  const kpis = [
    { label: 'Presencias', value: `${emp.diasPresentes}/${emp.diasLaborables}`, sub: `${emp.diasLaborables > 0 ? Math.round((emp.diasPresentes/emp.diasLaborables)*100) : 0}%` },
    { label: 'Tardanzas', value: String(emp.tardanzas), sub: emp.minutosTardanzaTotal > 0 ? minsToHHMM(emp.minutosTardanzaTotal) : '—' },
    { label: 'Ausencias', value: String(emp.ausencias), sub: '' },
    { label: 'Puntualidad', value: `${emp.puntualidadPct}%`, sub: '' },
  ];

  const kpiY = 56, kpiH = 18, kpiW = (pageW - 28 - 9) / 4;
  kpis.forEach((k, i) => {
    const x = 14 + i * (kpiW + 3);
    doc.setFillColor(240, 244, 255);
    doc.roundedRect(x, kpiY, kpiW, kpiH, 2, 2, 'F');
    doc.setFillColor(0, 61, 165);
    doc.rect(x, kpiY, kpiW, 1.5, 'F');
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text(k.label.toUpperCase(), x + kpiW / 2, kpiY + 6, { align: 'center' });
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(14);
    doc.text(k.value, x + kpiW / 2, kpiY + 13, { align: 'center' });
    if (k.sub) {
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text(k.sub, x + kpiW / 2, kpiY + kpiH - 1.5, { align: 'center' });
    }
  });

  // Day table
  const tableRows = [...emp.dias.values()]
    .filter(d => d.estado !== 'FIN_SEMANA')
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .map(d => [
      fmtFecha(d.fecha),
      fmtDiaSemana(d.fecha).slice(0, 3),
      d.ingreso ?? '—',
      d.salidaDescanso ?? '—',
      d.regresoDescanso ?? '—',
      d.salidaFinal ?? '—',
      d.minutosJornada !== null ? minsToHHMM(d.minutosJornada) : '—',
      ESTADO_LABEL[d.estado],
    ]);

  autoTable(doc, {
    startY: kpiY + kpiH + 6,
    head: [['Fecha', 'Día', 'Ingreso', 'Sal. desc.', 'Reg. desc.', 'Salida', 'Jornada', 'Estado']],
    body: tableRows,
    headStyles: {
      fillColor: [0, 61, 165],
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: 'bold',
      halign: 'center',
    },
    bodyStyles: { fontSize: 7.5, halign: 'center' },
    columnStyles: { 0: { halign: 'left' }, 1: { halign: 'left' } },
    alternateRowStyles: { fillColor: [240, 244, 255] },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 7) {
        const val = String(data.cell.raw);
        if (val === 'Tardanza' || val === 'Tardanza grave')
          data.cell.styles.textColor = [180, 30, 20];
        else if (val === 'Ausente')
          data.cell.styles.textColor = [190, 20, 20];
        else if (val === 'OK')
          data.cell.styles.textColor = [22, 101, 52];
      }
    },
    margin: { left: 14, right: 14 },
  });

  // Footer
  const pageCount = (doc as unknown as { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(`${empresa} · Uso interno · Generado ${fmtNow}`, 14, 290);
    doc.text(`${i} / ${pageCount}`, pageW - 14, 290, { align: 'right' });
  }

  doc.save(`Reloj_${emp.nombre.replace(/\s+/g, '_')}_${fmtNow.replace(/\//g, '-')}.pdf`);
}

// ─── PPTX export ──────────────────────────────────────────────────────────────

export async function exportRelojPPTX(data: RelojData, empresa: string): Promise<void> {
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_16x9';
  pptx.author = 'Elared S.A.';
  pptx.title = 'Reporte de Asistencia';
  const now = new Date().toLocaleDateString('es-UY');

  type S = ReturnType<typeof pptx.addSlide>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type ST = any;

  function r(s: S, x: number, y: number, w: number, h: number, c: string) {
    s.addShape('rect' as ST, { x, y, w, h, fill: { color: c }, line: { type: 'none' } });
  }
  function hdr(s: S, titulo: string) {
    r(s, 0, 0, 10, 0.72, '003DA5');
    r(s, 0, 0.72, 10, 0.05, 'E3000F');
    s.addText(titulo, { x: 0.3, y: 0.12, w: 7.5, h: 0.5, fontSize: 17, bold: true, color: 'FFFFFF', fontFace: 'Calibri', valign: 'middle' });
    s.addText('Elared S.A.', { x: 8.2, y: 0.12, w: 1.6, h: 0.5, fontSize: 10, color: 'CADCFC', fontFace: 'Calibri', align: 'right', valign: 'middle' });
    r(s, 0, 5.55, 10, 0.08, 'E8F0FE');
    s.addText(`${empresa} · Asistencia · ${now}`, { x: 0.3, y: 5.55, w: 9.4, h: 0.08, fontSize: 8, color: '4A4A6A', fontFace: 'Calibri', valign: 'middle' });
  }

  // Slide 1 — Portada
  {
    const s = pptx.addSlide();
    s.background = { color: '003DA5' };
    r(s, 0, 0, 3, 5.63, '0052CC');
    r(s, 3, 0.3, 0.06, 5, 'E3000F');
    s.addText('ELARED', { x: 0.3, y: 0.4, w: 2.4, h: 0.6, fontSize: 22, bold: true, color: 'FFFFFF', fontFace: 'Calibri' });
    s.addText('Agente Oficial Antel', { x: 0.3, y: 1.0, w: 2.4, h: 0.35, fontSize: 10, color: 'CADCFC', fontFace: 'Calibri' });
    s.addText('Reporte de Asistencia', { x: 3.3, y: 1.2, w: 6.4, h: 1.0, fontSize: 32, bold: true, color: 'FFFFFF', fontFace: 'Calibri', valign: 'middle' });
    s.addText(empresa, { x: 3.3, y: 2.3, w: 6.4, h: 0.45, fontSize: 16, color: 'CADCFC', fontFace: 'Calibri' });
    const kpis = [
      { l: 'Empleados', v: String(data.empleados.length) },
      { l: 'Con tardanzas', v: String(data.empleados.filter(e => e.tardanzas > 0).length) },
      { l: 'Con ausencias', v: String(data.empleados.filter(e => e.ausencias > 0).length) },
    ];
    kpis.forEach((k, i) => {
      const bx = 3.3 + i * 2.1;
      s.addShape('rect' as ST, { x: bx, y: 3.1, w: 2.0, h: 1.3, fill: { color: '0A4B8C', transparency: 40 }, line: { color: '2970C2', pt: 1 } });
      s.addText(k.v, { x: bx, y: 3.15, w: 2.0, h: 0.7, fontSize: 28, bold: true, color: 'FFFFFF', fontFace: 'Calibri', align: 'center', valign: 'middle' });
      s.addText(k.l, { x: bx, y: 3.85, w: 2.0, h: 0.45, fontSize: 9, color: 'CADCFC', fontFace: 'Calibri', align: 'center' });
    });
    s.addText(`Generado el ${now}`, { x: 3.3, y: 5.1, w: 6.4, h: 0.3, fontSize: 10, color: '8899BB', fontFace: 'Calibri' });
  }

  // Slide 2 — Resumen general (tabla)
  {
    const s = pptx.addSlide();
    s.background = { color: 'F5F7FA' };
    hdr(s, 'Resumen General de Empleados');

    const rows = data.empleados.map(e => {
      const pct = e.diasLaborables > 0 ? Math.round((e.diasPresentes / e.diasLaborables) * 100) : 0;
      return [e.nombre, `${e.diasPresentes}/${e.diasLaborables}`, `${pct}%`, String(e.tardanzas), String(e.ausencias), `${e.puntualidadPct}%`];
    });
    const hRow = ['Empleado', 'Presencias', 'Asistencia', 'Tardanzas', 'Ausencias', 'Puntualidad'].map(h => ({
      text: h, options: { bold: true, fontSize: 9, color: 'FFFFFF', fill: { color: '003DA5' }, align: 'center' as const, valign: 'middle' as const },
    }));
    const dRows = rows.map((row, ri) => row.map((cell, ci) => ({
      text: cell, options: {
        fontSize: 8.5, color: '1A1A2E',
        fill: { color: ri % 2 === 0 ? 'FFFFFF' : 'E8F0FE' },
        align: (ci === 0 ? 'left' : 'center') as 'left' | 'center', valign: 'middle' as const,
      },
    })));
    s.addTable([hRow, ...dRows], {
      x: 0.25, y: 0.88, w: 9.5,
      colW: [2.8, 1.1, 1.1, 1.1, 1.1, 1.3],
      rowH: [0.35, ...rows.map(() => 0.28)],
      border: { type: 'solid', color: 'E2E8F0', pt: 0.5 },
      fontFace: 'Calibri',
    });
  }

  // Slide 3 — Tardanzas (top 10)
  {
    const s = pptx.addSlide();
    s.background = { color: 'F5F7FA' };
    hdr(s, 'Tardanzas por Empleado');

    const sorted = [...data.empleados].sort((a, b) => b.tardanzas - a.tardanzas).filter(e => e.tardanzas > 0).slice(0, 10);
    if (sorted.length === 0) {
      s.addText('Sin tardanzas registradas.', { x: 1, y: 2.5, w: 8, h: 0.5, fontSize: 14, color: '28a745', align: 'center', fontFace: 'Calibri' });
    } else {
      const maxT = sorted[0]?.tardanzas ?? 1;
      sorted.forEach((e, i) => {
        const y = 0.95 + i * 0.42;
        r(s, 0.3, y + 0.09, 2.5, 0.26, 'FFFFFF');
        s.addText(e.nombre.split(' ').slice(0, 2).join(' '), { x: 0.3, y, w: 2.5, h: 0.42, fontSize: 9, color: '1A1A2E', fontFace: 'Calibri', valign: 'middle' });
        const bw = Math.max(0.1, (e.tardanzas / maxT) * 5.5);
        r(s, 2.9, y + 0.1, 5.5, 0.22, 'E8F0FE');
        r(s, 2.9, y + 0.1, bw, 0.22, 'E3000F');
        s.addText(`${e.tardanzas} tard. · ${e.minutosTardanzaTotal > 0 ? minsToHHMM(e.minutosTardanzaTotal) : '0m'}`, { x: 8.5, y, w: 1.5, h: 0.42, fontSize: 8.5, color: '4A4A6A', fontFace: 'Calibri', valign: 'middle' });
      });
    }
  }

  // Slide 4 — Ausencias
  {
    const s = pptx.addSlide();
    s.background = { color: 'F5F7FA' };
    hdr(s, 'Ausencias por Empleado');

    const ausRows = data.empleados.filter(e => e.ausencias > 0).map(e => ({
      text: e.nombre, options: { fontSize: 9, color: '1A1A2E' },
    }));
    if (ausRows.length === 0) {
      s.addText('Sin ausencias registradas.', { x: 1, y: 2.5, w: 8, h: 0.5, fontSize: 14, color: '28a745', align: 'center', fontFace: 'Calibri' });
    } else {
      const maxA = Math.max(...data.empleados.filter(e => e.ausencias > 0).map(e => e.ausencias), 1);
      data.empleados.filter(e => e.ausencias > 0).slice(0, 10).forEach((e, i) => {
        const y = 0.95 + i * 0.42;
        s.addText(e.nombre.split(' ').slice(0, 2).join(' '), { x: 0.3, y, w: 2.5, h: 0.42, fontSize: 9, color: '1A1A2E', fontFace: 'Calibri', valign: 'middle' });
        const bw = Math.max(0.1, (e.ausencias / maxA) * 5.5);
        r(s, 2.9, y + 0.1, 5.5, 0.22, 'E8F0FE');
        r(s, 2.9, y + 0.1, bw, 0.22, '1A1A2E');
        s.addText(`${e.ausencias} aus.`, { x: 8.5, y, w: 1.5, h: 0.42, fontSize: 8.5, color: '4A4A6A', fontFace: 'Calibri', valign: 'middle' });
      });
    }
  }

  // Slide 5 — Cierre
  {
    const s = pptx.addSlide();
    s.background = { color: '003DA5' };
    r(s, 0, 0, 3, 5.63, '0052CC');
    r(s, 0, 5.2, 10, 0.15, 'E3000F');
    s.addText('Elared S.A.', { x: 3.3, y: 1.8, w: 6.4, h: 0.8, fontSize: 30, bold: true, color: 'FFFFFF', fontFace: 'Calibri', align: 'center' });
    s.addText('Agente Oficial Antel', { x: 3.3, y: 2.7, w: 6.4, h: 0.4, fontSize: 14, color: 'CADCFC', fontFace: 'Calibri', align: 'center' });
    r(s, 3.3, 3.2, 6.4, 0.04, 'E3000F');
    s.addText(`Generado el ${now}`, { x: 3.3, y: 3.4, w: 6.4, h: 0.3, fontSize: 11, color: '8899BB', fontFace: 'Calibri', align: 'center' });
  }

  await pptx.writeFile({ fileName: `Reloj_${empresa.replace(/\s+/g, '_')}_${now.replace(/\//g, '-')}.pptx` });
}
