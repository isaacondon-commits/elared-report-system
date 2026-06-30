import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { PdvData } from './pdvParser';
import type {
  DistribucionRow, EstadoRow, AlertaInactividad,
  AlertaVencimiento, RendimientoRow, NuevosPuntos,
} from './pdvAnalysis';

export type PdvExportData = {
  distribucion: DistribucionRow[];
  estados: EstadoRow[];
  inactividad: AlertaInactividad;
  vencimiento: AlertaVencimiento;
  rendimiento: RendimientoRow[];
  nuevosPuntos: NuevosPuntos;
};

function aw(rows: (string | number)[][]): XLSX.ColInfo[] {
  if (!rows.length) return [];
  const w = Array.from({ length: rows[0]?.length ?? 0 }, () => 8);
  for (const r of rows) {
    r.forEach((c, i) => {
      const l = String(c ?? '').length + 2;
      if (l > (w[i] ?? 8)) w[i] = l;
    });
  }
  return w.map(v => ({ wch: Math.min(v, 40) }));
}

function formatMes(mes: string): string {
  if (!mes) return '';
  const [y, m] = mes.split('-');
  const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  return `${meses[parseInt(m) - 1] ?? m} ${y}`;
}

export function exportPdvExcel(data: PdvData, analysis: PdvExportData): void {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Resumen
  const resData: (string | number)[][] = [
    ['Indicador', 'Valor'],
    ['Total puntos de venta', data.total],
    ['Distribuidores', data.distribuidores.length],
    ['Departamentos', data.departamentos.length],
    ['Inactivos +60 días', analysis.inactividad.total],
    ['Por vencer (30 días)', analysis.vencimiento.porVencer.total],
    ['Ya vencidos', analysis.vencimiento.yaVencidos.total],
    ['Nuevos en rango', analysis.nuevosPuntos.totalEnRango],
    ['Fecha carga', new Date(data.fechaCarga).toLocaleDateString('es-UY')],
  ];
  const ws1 = XLSX.utils.aoa_to_sheet(resData);
  ws1['!cols'] = [{ wch: 28 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, ws1, 'Resumen');

  // Sheet 2: Distribución por chipero
  const distHeaders = ['Distribuidor', 'Puntos Asignados', '% del Total'];
  const distRows: (string | number)[][] = analysis.distribucion.map(d => [
    d.distribuidor, d.cantidad, `${d.porcentaje.toFixed(1)}%`,
  ]);
  const ws2 = XLSX.utils.aoa_to_sheet([distHeaders, ...distRows]);
  ws2['!cols'] = aw([distHeaders, ...distRows]);
  XLSX.utils.book_append_sheet(wb, ws2, 'Distribución');

  // Sheet 3: Inactivos +60 días
  const inacHeaders = ['Punto de Venta', 'Distribuidor', 'Departamento', 'Última Visita', 'Días Inactivo'];
  const inacRows: (string | number)[][] = analysis.inactividad.puntos.map(p => [
    p.nombre, p.distribuidor, p.departamento, p.visitadoPorDistribuidor ?? 'Nunca', p.diasInactivo,
  ]);
  const ws3 = XLSX.utils.aoa_to_sheet([inacHeaders, ...inacRows]);
  ws3['!cols'] = aw([inacHeaders, ...inacRows.slice(0, 300)]);
  XLSX.utils.book_append_sheet(wb, ws3, 'Inactivos');

  // Sheet 4: Por vencer (combine both lists)
  const vencHeaders = ['Punto de Venta', 'Distribuidor', 'Departamento', 'Vence el', 'Días Restantes', 'Estado'];
  const vencPV: (string | number)[][] = analysis.vencimiento.porVencer.puntos.map(p => [
    p.nombre, p.distribuidor, p.departamento,
    p.fechaVencimientoChipMasViejo ?? '', p.diasParaVencer,
    p.diasParaVencer <= 7 ? 'Urgente' : p.diasParaVencer <= 15 ? 'Pronto' : 'Atención',
  ]);
  const vencYA: (string | number)[][] = analysis.vencimiento.yaVencidos.puntos.map(p => [
    p.nombre, p.distribuidor, p.departamento,
    p.fechaVencimientoChipMasViejo ?? '', p.diasParaVencer, 'Vencido',
  ]);
  const allVenc = [
    ['--- POR VENCER (próximos 30 días) ---', '', '', '', '', ''],
    ...vencPV,
    ['--- YA VENCIDOS ---', '', '', '', '', ''],
    ...vencYA,
  ];
  const ws4 = XLSX.utils.aoa_to_sheet([vencHeaders, ...allVenc]);
  ws4['!cols'] = aw([vencHeaders, ...vencPV.slice(0, 200)]);
  XLSX.utils.book_append_sheet(wb, ws4, 'Por vencer');

  // Sheet 5: Rendimiento chiperos
  const rendHeaders = ['Distribuidor', 'Días Activos', 'Total Visitas', 'Promedio Visitas/Día', 'Rendimiento'];
  const rendRows: (string | number)[][] = analysis.rendimiento.map(r => [
    r.nombre, r.diasActivos, r.totalVisitas, r.promedioVisitasDia.toFixed(1),
    r.promedioVisitasDia >= 10 ? 'Alto' : r.promedioVisitasDia >= 6 ? 'Normal' : 'Bajo',
  ]);
  const ws5 = XLSX.utils.aoa_to_sheet([rendHeaders, ...rendRows]);
  ws5['!cols'] = aw([rendHeaders, ...rendRows]);
  XLSX.utils.book_append_sheet(wb, ws5, 'Rendimiento');

  // Sheet 6: Nuevos puntos
  const npRows: (string | number)[][] = analysis.nuevosPuntos.porMes.map((m, i) => {
    const prev = i > 0 ? analysis.nuevosPuntos.porMes[i - 1].cantidad : null;
    const cambio = prev !== null && prev > 0
      ? `${((m.cantidad - prev) / prev * 100).toFixed(1)}%`
      : '—';
    return [formatMes(m.mes), m.cantidad, cambio];
  });
  const ws6 = XLSX.utils.aoa_to_sheet([
    ['Mes', 'Puntos Creados', 'VS Mes Anterior'],
    ...npRows,
    ['Total en rango', analysis.nuevosPuntos.totalEnRango, ''],
    ['Promedio mensual', analysis.nuevosPuntos.promedioMensual, ''],
  ]);
  ws6['!cols'] = [{ wch: 14 }, { wch: 16 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, ws6, 'Nuevos puntos');

  const fecha = new Date().toLocaleDateString('es-UY').replace(/\//g, '-');
  XLSX.writeFile(wb, `PdV_${fecha}.xlsx`);
}

export function exportPdvPDF(data: PdvData, analysis: PdvExportData): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const W = 297;
  const fecha = new Date().toLocaleDateString('es-UY');

  function hdr(titulo: string) {
    doc.setFillColor(0, 61, 165); doc.rect(0, 0, W, 15, 'F');
    doc.setFillColor(227, 0, 15); doc.rect(0, 15, W, 1.5, 'F');
    doc.setTextColor(255, 255, 255); doc.setFontSize(12); doc.setFont('helvetica', 'bold');
    doc.text('ELARED · Punto de Venta', 7, 10);
    doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(202, 220, 252);
    doc.text(titulo, W / 2, 10, { align: 'center' });
    doc.text(fecha, W - 7, 10, { align: 'right' });
  }
  function ftr(page: number, total: number) {
    doc.setFillColor(232, 240, 254); doc.rect(0, 200, W, 10, 'F');
    doc.setFontSize(7); doc.setTextColor(74, 74, 106); doc.setFont('helvetica', 'normal');
    doc.text('Punto de Venta · Confidencial', 7, 207);
    doc.text(`Pág. ${page}/${total}`, W - 7, 207, { align: 'right' });
  }

  hdr('Resumen General');
  autoTable(doc, {
    startY: 20,
    head: [['Indicador', 'Valor']],
    body: [
      ['Total puntos de venta', data.total.toLocaleString()],
      ['Distribuidores', data.distribuidores.length],
      ['Inactivos +60 días', analysis.inactividad.total.toLocaleString()],
      ['Por vencer (30 días)', analysis.vencimiento.porVencer.total.toLocaleString()],
      ['Ya vencidos', analysis.vencimiento.yaVencidos.total.toLocaleString()],
    ],
    headStyles: { fillColor: [0, 61, 165], textColor: 255, fontSize: 9, fontStyle: 'bold' },
    bodyStyles: { fontSize: 9 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 70 } },
    margin: { left: 7, right: 7 },
  });

  doc.addPage();
  hdr('Inactivos +60 Días');
  autoTable(doc, {
    startY: 20,
    head: [['Punto de Venta', 'Distribuidor', 'Departamento', 'Última Visita', 'Días']],
    body: analysis.inactividad.puntos.slice(0, 40).map(p => [
      p.nombre, p.distribuidor, p.departamento, p.visitadoPorDistribuidor ?? 'Nunca', p.diasInactivo,
    ]),
    headStyles: { fillColor: [227, 0, 15], textColor: 255, fontSize: 9, fontStyle: 'bold' },
    bodyStyles: { fontSize: 8 },
    alternateRowStyles: { fillColor: [254, 242, 242] },
    margin: { left: 7, right: 7 },
  });

  doc.addPage();
  hdr('Rendimiento por Chipero');
  autoTable(doc, {
    startY: 20,
    head: [['Distribuidor', 'Días Activos', 'Total Visitas', 'Prom. Visitas/Día', 'Rendimiento']],
    body: analysis.rendimiento.map(r => [
      r.nombre, r.diasActivos, r.totalVisitas, r.promedioVisitasDia.toFixed(1),
      r.promedioVisitasDia >= 10 ? 'Alto' : r.promedioVisitasDia >= 6 ? 'Normal' : 'Bajo',
    ]),
    headStyles: { fillColor: [0, 61, 165], textColor: 255, fontSize: 9, fontStyle: 'bold' },
    bodyStyles: { fontSize: 8.5 },
    alternateRowStyles: { fillColor: [232, 240, 254] },
    margin: { left: 7, right: 7 },
  });

  const pg = doc.getNumberOfPages();
  for (let i = 1; i <= pg; i++) { doc.setPage(i); ftr(i, pg); }

  doc.save(`PdV_${fecha.replace(/\//g, '-')}.pdf`);
}
