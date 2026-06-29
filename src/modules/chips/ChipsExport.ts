import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { ChipsData } from './chipsParser';
import type { ChipsAnalysis } from './chipAnalysis';

export function exportChipsExcel(data: ChipsData, analysis: ChipsAnalysis, empresaFiltro = 'Todas'): void {
  const wb = XLSX.utils.book_new();

  function aw(rows: (string | number)[][]): XLSX.ColInfo[] {
    if (!rows.length) return [];
    const w = Array.from({ length: rows[0]?.length ?? 0 }, () => 8);
    for (const r of rows) {
      r.forEach((c, i) => {
        const l = String(c ?? '').length + 2;
        if (l > (w[i] ?? 8)) w[i] = l;
      });
    }
    return w.map(v => ({ wch: Math.min(v, 42) }));
  }

  // Sheet 1: Resumen
  const pctCol = analysis.chipsActivos > 0
    ? `${Math.round((analysis.totalConPdv / analysis.chipsActivos) * 100)}%`
    : '0%';
  const resData: (string | number)[][] = [
    ['Indicador', 'Valor'],
    ['Chips Activos (con distribuidor)', analysis.chipsActivos],
    ['Stock en Sistema (sin distribuidor)', analysis.stockSistema],
    ['En Tránsito (sin PdV)', analysis.stockTransito],
    ['Colocados en PdV', analysis.totalConPdv],
    ['% Colocado', pctCol],
    ['Empresa', empresaFiltro],
    ['Fecha carga', new Date(data.fechaCarga).toLocaleDateString('es-UY')],
  ];
  const ws1 = XLSX.utils.aoa_to_sheet(resData);
  ws1['!cols'] = [{ wch: 36 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, ws1, 'Resumen');

  // Sheet 2: Chiperos
  const chipHeaders = ['Chipero', 'Total', 'En Tránsito', 'En PdV', '% Colocado'];
  const chipRows: (string | number)[][] = analysis.chiperos.map(c => [
    c.nombre, c.total, c.enTransito, c.enPdv, `${c.pctColocado}%`,
  ]);
  const ws2 = XLSX.utils.aoa_to_sheet([chipHeaders, ...chipRows]);
  ws2['!cols'] = aw([chipHeaders, ...chipRows]);
  XLSX.utils.book_append_sheet(wb, ws2, 'Chiperos');

  // Sheet 3: Efectividad
  const efHeaders = ['Distribuidor', 'Punto de Venta', 'Chips'];
  const efRows: (string | number)[][] = analysis.efectividad.map(e => [e.distribuidor, e.pdv, e.chips]);
  const ws3 = XLSX.utils.aoa_to_sheet([efHeaders, ...efRows]);
  ws3['!cols'] = aw([efHeaders, ...efRows]);
  XLSX.utils.book_append_sheet(wb, ws3, 'Efectividad');

  // Sheet 4: Datos completos
  const fullHeaders = [
    'MID', 'Empresa', 'Chip', 'F. Activación', 'F. Importación',
    'Estado', 'Tipo', 'Lote', 'Sub-lote',
    'Distribuidor', 'Punto de Venta',
    'F. Asig. Distribuidor', 'F. Asig. PdV',
  ];
  const filteredRows = empresaFiltro === 'Todas' ? data.rows : data.rows.filter(r => r.empresa === empresaFiltro);
  const fullRows: (string | number)[][] = filteredRows.map(r => [
    r.mid, r.empresa, r.chip,
    r.fechaActivacion, r.fechaImportacion,
    r.estadoActivacion, r.tipoActivacion,
    r.lote, r.subLote,
    r.nombreDistribuidor ?? '',
    r.puntoVenta ?? '',
    r.fechaAsignacionDistribuidor ?? '',
    r.fechaAsignacionPuntoVenta ?? '',
  ]);
  const ws4 = XLSX.utils.aoa_to_sheet([fullHeaders, ...fullRows]);
  ws4['!cols'] = aw([fullHeaders, ...fullRows.slice(0, 500)]);
  XLSX.utils.book_append_sheet(wb, ws4, 'Datos completos');

  const fecha = new Date().toLocaleDateString('es-UY').replace(/\//g, '-');
  const emp = empresaFiltro !== 'Todas' ? `_${empresaFiltro}` : '';
  XLSX.writeFile(wb, `Chips${emp}_${fecha}.xlsx`);
}

export function exportChipsPDF(data: ChipsData, analysis: ChipsAnalysis, empresaFiltro = 'Todas'): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const W = 297;
  const fecha = new Date().toLocaleDateString('es-UY');

  function hdr(titulo: string) {
    doc.setFillColor(0, 61, 165);
    doc.rect(0, 0, W, 15, 'F');
    doc.setFillColor(227, 0, 15);
    doc.rect(0, 15, W, 1.5, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('ELARED · Gestión de Chips', 7, 10);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(202, 220, 252);
    doc.text(titulo, W / 2, 10, { align: 'center' });
    doc.text(fecha, W - 7, 10, { align: 'right' });
  }

  function ftr(page: number, total: number) {
    doc.setFillColor(232, 240, 254);
    doc.rect(0, 200, W, 10, 'F');
    doc.setFontSize(7);
    doc.setTextColor(74, 74, 106);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `Chips${empresaFiltro !== 'Todas' ? ' · ' + empresaFiltro : ''} · Confidencial`,
      7, 207,
    );
    doc.text(`Pág. ${page}/${total}`, W - 7, 207, { align: 'right' });
  }

  const pctCol = analysis.chipsActivos > 0
    ? `${Math.round((analysis.totalConPdv / analysis.chipsActivos) * 100)}%`
    : '0%';

  hdr('Resumen General');
  autoTable(doc, {
    startY: 20,
    head: [['Indicador', 'Valor']],
    body: [
      ['Chips Activos (con distribuidor)', analysis.chipsActivos.toLocaleString()],
      ['Stock en Sistema (sin distribuidor)', analysis.stockSistema.toLocaleString()],
      ['En Tránsito (sin PdV)', analysis.stockTransito.toLocaleString()],
      ['Colocados en PdV', analysis.totalConPdv.toLocaleString()],
      ['% Colocado', pctCol],
      ['Empresa', empresaFiltro],
      ['Fecha de carga', new Date(data.fechaCarga).toLocaleDateString('es-UY')],
    ],
    headStyles: { fillColor: [0, 61, 165], textColor: 255, fontSize: 9, fontStyle: 'bold' },
    bodyStyles: { fontSize: 9 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 80 } },
    margin: { left: 7, right: 7 },
  });

  doc.addPage();
  hdr('Tabla de Chiperos');
  autoTable(doc, {
    startY: 20,
    head: [['Chipero', 'Total', 'En Tránsito', 'En PdV', '% Colocado']],
    body: analysis.chiperos.slice(0, 40).map(c => [
      c.nombre, c.total, c.enTransito, c.enPdv, `${c.pctColocado}%`,
    ]),
    headStyles: { fillColor: [0, 61, 165], textColor: 255, fontSize: 9, fontStyle: 'bold' },
    bodyStyles: { fontSize: 8.5 },
    alternateRowStyles: { fillColor: [232, 240, 254] },
    margin: { left: 7, right: 7 },
  });

  doc.addPage();
  hdr('Efectividad por Punto de Venta');
  autoTable(doc, {
    startY: 20,
    head: [['Distribuidor', 'Punto de Venta', 'Chips']],
    body: analysis.efectividad.slice(0, 40).map(e => [e.distribuidor, e.pdv, e.chips]),
    headStyles: { fillColor: [0, 61, 165], textColor: 255, fontSize: 9, fontStyle: 'bold' },
    bodyStyles: { fontSize: 8.5 },
    alternateRowStyles: { fillColor: [232, 240, 254] },
    margin: { left: 7, right: 7 },
  });

  const pg = doc.getNumberOfPages();
  for (let i = 1; i <= pg; i++) {
    doc.setPage(i);
    ftr(i, pg);
  }

  const emp = empresaFiltro !== 'Todas' ? `_${empresaFiltro}` : '';
  doc.save(`Chips${emp}_${fecha.replace(/\//g, '-')}.pdf`);
}
