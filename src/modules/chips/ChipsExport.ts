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

  function rendimiento(v: number) {
    return v >= 7 ? 'Alto' : v >= 5 ? 'Normal' : 'Bajo';
  }
  function estado(pct: number) {
    return pct >= 90 ? 'Eficiente' : pct >= 70 ? 'Normal' : pct >= 50 ? 'Bajo' : 'Crítico';
  }

  const { chipsActivos, stockSistema, stockTransito, promEquipoChipsPorComercio } = analysis;
  const empresas = Object.keys(chipsActivos.porEmpresa).sort();

  // Sheet 1: Resumen KPIs por empresa
  const resHeaders = ['Indicador', 'Total', ...empresas];
  const resData: (string | number)[][] = [
    resHeaders,
    ['Chips Activos (fechaAsigDist no vacía)', chipsActivos.total, ...empresas.map(e => chipsActivos.porEmpresa[e] ?? 0)],
    ['Stock en Sistema (sin distribuidor)', stockSistema.total, ...empresas.map(e => stockSistema.porEmpresa[e] ?? 0)],
    ['Stock en Tránsito (sin PdV)', stockTransito.total, ...empresas.map(e => stockTransito.porEmpresa[e] ?? 0)],
    ['Prom. chips/comercio equipo', `${promEquipoChipsPorComercio.toFixed(1)}`, ...empresas.map(() => '')],
    ['Empresa filtro', empresaFiltro, ...empresas.map(() => '')],
    ['Total chips OK', data.totalOK, ...empresas.map(() => '')],
    ['Fecha carga', new Date(data.fechaCarga).toLocaleDateString('es-UY'), ...empresas.map(() => '')],
  ];
  const ws1 = XLSX.utils.aoa_to_sheet(resData);
  ws1['!cols'] = [{ wch: 36 }, { wch: 12 }, ...empresas.map(() => ({ wch: 14 }))];
  XLSX.utils.book_append_sheet(wb, ws1, 'Resumen KPIs');

  // Sheet 2: Efectividad visita
  const efHeaders = ['Distribuidor', 'Días Trabajados', 'Chips Total', 'Prom. Chips/Día', 'Prom. PdV/Día', 'Prom. Chips/Comercio', 'Rendimiento'];
  const efRows: (string | number)[][] = analysis.efectividad.map(e => [
    e.nombre, e.diasTrabajados, e.totalChips,
    e.promChipsPorDia.toFixed(1), e.promPdVPorDia.toFixed(1), e.promChipsPorComercio.toFixed(1),
    rendimiento(e.promChipsPorComercio),
  ]);
  const ws2 = XLSX.utils.aoa_to_sheet([efHeaders, ...efRows]);
  ws2['!cols'] = aw([efHeaders, ...efRows]);
  XLSX.utils.book_append_sheet(wb, ws2, 'Efectividad visita');

  // Sheet 3: Stock chiperos
  const chipHeaders = ['Distribuidor', 'Total', 'En Tránsito', 'En PdV', '% Colocado', 'Estado'];
  const chipRows: (string | number)[][] = analysis.chiperos.map(c => [
    c.nombre, c.total, c.enTransito, c.enPdV, `${c.pctColocado.toFixed(1)}%`, estado(c.pctColocado),
  ]);
  const ws3 = XLSX.utils.aoa_to_sheet([chipHeaders, ...chipRows]);
  ws3['!cols'] = aw([chipHeaders, ...chipRows]);
  XLSX.utils.book_append_sheet(wb, ws3, 'Stock chiperos');

  // Sheet 4: Detalle visitas (por distribuidor + día)
  const detHeaders = ['Distribuidor', 'Fecha Visita', 'PdV Visitados', 'Chips Entregados', 'Chips/Comercio'];
  const detRows: (string | number)[][] = [];
  for (const e of analysis.efectividad) {
    for (const d of e.detalleDias) {
      detRows.push([e.nombre, d.fecha, d.pdvVisitados, d.chipsEntregados, d.chipsPorComercio.toFixed(2)]);
    }
  }
  const ws4 = XLSX.utils.aoa_to_sheet([detHeaders, ...detRows]);
  ws4['!cols'] = aw([detHeaders, ...detRows.slice(0, 300)]);
  XLSX.utils.book_append_sheet(wb, ws4, 'Detalle visitas');

  // Sheet 5: Datos completos
  const fullHeaders = [
    'MID', 'Empresa', 'Chip', 'F. Activación', 'F. Importación',
    'Estado', 'Lote', 'Sub-lote',
    'Id Distribuidor', 'Distribuidor', 'F. Asig. Distribuidor',
    'Id PdV', 'Punto de Venta', 'F. Asig. PdV', 'F. Liquidación',
  ];
  const filteredRows = empresaFiltro === 'Todas' ? data.rows : data.rows.filter(r => r.empresa === empresaFiltro);
  const fullRows: (string | number)[][] = filteredRows.map(r => [
    r.mid, r.empresa, r.chip,
    r.fechaActivacion, r.fechaImportacion,
    r.estadoActivacion, r.lote, r.subLote,
    r.idDistribuidor ?? '', r.nombreDistribuidor ?? '', r.fechaAsignacionDistribuidor ?? '',
    r.idPuntoVenta ?? '', r.puntoVenta ?? '', r.fechaAsignacionPuntoVenta ?? '', r.fechaLiquidacion ?? '',
  ]);
  const ws5 = XLSX.utils.aoa_to_sheet([fullHeaders, ...fullRows]);
  ws5['!cols'] = aw([fullHeaders, ...fullRows.slice(0, 500)]);
  XLSX.utils.book_append_sheet(wb, ws5, 'Datos completos');

  const fecha = new Date().toLocaleDateString('es-UY').replace(/\//g, '-');
  const emp = empresaFiltro !== 'Todas' ? `_${empresaFiltro}` : '';
  XLSX.writeFile(wb, `Chips${emp}_${fecha}.xlsx`);
}

export function exportChipsPDF(data: ChipsData, analysis: ChipsAnalysis, empresaFiltro = 'Todas'): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const W = 297;
  const fecha = new Date().toLocaleDateString('es-UY');

  function hdr(titulo: string) {
    doc.setFillColor(0, 61, 165); doc.rect(0, 0, W, 15, 'F');
    doc.setFillColor(227, 0, 15); doc.rect(0, 15, W, 1.5, 'F');
    doc.setTextColor(255, 255, 255); doc.setFontSize(12); doc.setFont('helvetica', 'bold');
    doc.text('ELARED · Chips', 7, 10);
    doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(202, 220, 252);
    doc.text(titulo, W / 2, 10, { align: 'center' });
    doc.text(fecha, W - 7, 10, { align: 'right' });
  }

  function ftr(page: number, total: number) {
    doc.setFillColor(232, 240, 254); doc.rect(0, 200, W, 10, 'F');
    doc.setFontSize(7); doc.setTextColor(74, 74, 106); doc.setFont('helvetica', 'normal');
    doc.text(`Chips${empresaFiltro !== 'Todas' ? ' · ' + empresaFiltro : ''} · Confidencial`, 7, 207);
    doc.text(`Pág. ${page}/${total}`, W - 7, 207, { align: 'right' });
  }

  hdr('Resumen General');
  autoTable(doc, {
    startY: 20,
    head: [['Indicador', 'Valor']],
    body: [
      ['Chips Activos (con distribuidor)', analysis.chipsActivos.total.toLocaleString()],
      ['Stock en Sistema (sin distribuidor)', analysis.stockSistema.total.toLocaleString()],
      ['Stock en Tránsito (sin PdV)', analysis.stockTransito.total.toLocaleString()],
      ['Prom. chips/comercio equipo', `${analysis.promEquipoChipsPorComercio.toFixed(1)} chips/comercio`],
      ['Empresa', empresaFiltro],
      ['Fecha de carga', new Date(data.fechaCarga).toLocaleDateString('es-UY')],
    ],
    headStyles: { fillColor: [0, 61, 165], textColor: 255, fontSize: 9, fontStyle: 'bold' },
    bodyStyles: { fontSize: 9 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 80 } },
    margin: { left: 7, right: 7 },
  });

  doc.addPage();
  hdr('Stock por Distribuidor');
  autoTable(doc, {
    startY: 20,
    head: [['Distribuidor', 'Total', 'En Tránsito', 'En PdV', '% Colocado', 'Estado']],
    body: analysis.chiperos.map(c => [
      c.nombre, c.total, c.enTransito, c.enPdV, `${c.pctColocado.toFixed(1)}%`,
      c.pctColocado >= 90 ? 'Eficiente' : c.pctColocado >= 70 ? 'Normal' : c.pctColocado >= 50 ? 'Bajo' : 'Crítico',
    ]),
    headStyles: { fillColor: [0, 61, 165], textColor: 255, fontSize: 9, fontStyle: 'bold' },
    bodyStyles: { fontSize: 8.5 },
    alternateRowStyles: { fillColor: [232, 240, 254] },
    margin: { left: 7, right: 7 },
  });

  doc.addPage();
  hdr('Efectividad de Visita por Distribuidor');
  autoTable(doc, {
    startY: 20,
    head: [['Distribuidor', 'Días', 'Chips Total', 'Chips/Día', 'PdV/Día', 'Chips/Comercio', 'Rendimiento']],
    body: analysis.efectividad.map(e => [
      e.nombre, e.diasTrabajados, e.totalChips,
      e.promChipsPorDia.toFixed(1), e.promPdVPorDia.toFixed(1), e.promChipsPorComercio.toFixed(1),
      e.promChipsPorComercio >= 7 ? 'Alto' : e.promChipsPorComercio >= 5 ? 'Normal' : 'Bajo',
    ]),
    headStyles: { fillColor: [0, 61, 165], textColor: 255, fontSize: 9, fontStyle: 'bold' },
    bodyStyles: { fontSize: 8.5 },
    alternateRowStyles: { fillColor: [232, 240, 254] },
    margin: { left: 7, right: 7 },
  });

  const pg = doc.getNumberOfPages();
  for (let i = 1; i <= pg; i++) { doc.setPage(i); ftr(i, pg); }

  const emp = empresaFiltro !== 'Todas' ? `_${empresaFiltro}` : '';
  doc.save(`Chips${emp}_${fecha.replace(/\//g, '-')}.pdf`);
}
