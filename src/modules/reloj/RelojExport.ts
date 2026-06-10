import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
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
    'Empleado', 'Presencias', 'Laborables', 'Asistencia %',
    'Tardanzas', 'T. Graves', 'Min. tardanza', 'Desc. extendidos',
    'Sal. anticipadas', 'Ausencias', 'Hrs extras', 'Jornada prom.', 'Puntualidad %',
  ];
  const resumenRows = data.empleados.map(e => [[
    [e.nombre],
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
