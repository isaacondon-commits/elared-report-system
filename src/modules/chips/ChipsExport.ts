import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { ChipResult } from './chipsParser';

function fmt(d: Date | null): string {
  if (!d) return '—';
  return d.toLocaleDateString('es-UY');
}

function pctStr(v: number): string {
  return `${Math.round(v * 100)}%`;
}

export function exportChipsExcel(results: ChipResult[], filenameBase = 'Chips'): void {
  const fecha = new Date().toLocaleDateString('es-UY').replace(/\//g, '-');

  const headers = [
    'Empresa', 'Distribuidor', 'ID Dist.', 'Punto de Venta', 'ID PDV',
    'Depto', 'Visitas 8M', 'Chips 8M', 'Activos 8M', '% Activ',
    'Ritmo/Mes', 'Tendencia', 'Última Asig.', 'Últ. Cant.', 'Últ. Activos',
    'Últ. %', 'Vence', 'Situación', 'Sugerido',
  ];

  const rows = results.map(r => [
    r.empresa || '—',
    r.distribuidor || '—',
    r.idDistribuidor || '—',
    r.pdvNombre || r.pdvId,
    r.pdvId,
    r.departamento || '—',
    r.visitas8m,
    r.asignados8m,
    r.activaciones8m,
    pctStr(r.pct8m),
    r.ritmoReciente.toFixed(1),
    r.alerta
      ? `${r.alerta === 'baja' ? '▼' : '▲'} ${Math.round(Math.abs(r.alertaPct ?? 0) * 100)}%`
      : '—',
    fmt(r.ultimaAsignacion),
    r.ultimaQty || '—',
    r.ultimaActivos,
    r.ultimaQty > 0 ? pctStr(r.ultimaPct) : '—',
    r.vencimiento ? fmt(r.vencimiento) : '—',
    r.situacionLabel,
    r.sugerido > 0 ? r.sugerido : '—',
  ]);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

  ws['!cols'] = [
    { wch: 12 }, { wch: 22 }, { wch: 10 }, { wch: 30 }, { wch: 10 },
    { wch: 14 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 9 },
    { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 10 }, { wch: 14 },
    { wch: 9 },  { wch: 12 }, { wch: 26 }, { wch: 10 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Chips');
  XLSX.writeFile(wb, `${filenameBase}_${fecha}.xlsx`);
}

export function exportChipsPDF(results: ChipResult[]): void {
  const doc  = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const W    = 297;
  const fecha = new Date().toLocaleDateString('es-UY');

  function drawHeader() {
    doc.setFillColor(0, 61, 165);  doc.rect(0, 0, W, 14, 'F');
    doc.setFillColor(227, 0, 15);  doc.rect(0, 14, W, 1.5, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11); doc.setFont('helvetica', 'bold');
    doc.text('ELARED · Chips', 7, 9);
    doc.setFontSize(8); doc.setFont('helvetica', 'normal');
    doc.setTextColor(180, 210, 255);
    doc.text(`${results.length} puntos`, W / 2, 9, { align: 'center' });
    doc.text(fecha, W - 7, 9, { align: 'right' });
  }

  drawHeader();

  autoTable(doc, {
    startY: 20,
    head: [[
      'Empresa', 'Distribuidor', 'PdV', 'Depto',
      'Chips 8M', 'Activos', '% Activ', 'Ritmo/Mes',
      'Tendencia', 'Vence', 'Situación', 'Sug.',
    ]],
    body: results.map(r => [
      r.empresa || '—',
      r.distribuidor || '—',
      r.pdvNombre || r.pdvId,
      r.departamento || '—',
      r.asignados8m,
      r.activaciones8m,
      pctStr(r.pct8m),
      r.ritmoReciente.toFixed(1),
      r.alerta ? `${r.alerta === 'baja' ? '▼' : '▲'} ${Math.round(Math.abs(r.alertaPct ?? 0) * 100)}%` : '—',
      r.vencimiento ? fmt(r.vencimiento) : '—',
      r.situacionLabel,
      r.sugerido > 0 ? r.sugerido : '—',
    ]),
    headStyles:          { fillColor: [0, 61, 165], textColor: 255, fontSize: 7.5, fontStyle: 'bold' },
    bodyStyles:          { fontSize: 7 },
    alternateRowStyles:  { fillColor: [232, 240, 254] },
    margin:              { left: 7, right: 7 },
  });

  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFillColor(230, 238, 255); doc.rect(0, 200, W, 10, 'F');
    doc.setFontSize(7); doc.setTextColor(74, 74, 106); doc.setFont('helvetica', 'normal');
    doc.text('Chips · Confidencial', 7, 207);
    doc.text(`Pág. ${p}/${pages}`, W - 7, 207, { align: 'right' });
  }

  doc.save(`Chips_${fecha.replace(/\//g, '-')}.pdf`);
}
