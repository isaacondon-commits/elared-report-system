import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { SancionesStats } from './SancionesModule';
import type { AppConfig } from '../../types';

export function exportSancionesPdf(stats: SancionesStats, config: AppConfig): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const now = new Date();
  const fechaStr = now.toLocaleDateString('es-UY');
  const horaStr = now.toLocaleTimeString('es-UY', { hour: '2-digit', minute: '2-digit' });

  // Header
  doc.setFillColor(0, 61, 165);
  doc.rect(0, 0, 210, 30, 'F');
  doc.setFillColor(227, 0, 15);
  doc.rect(0, 30, 210, 2, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(config.nombreEmpresa, 15, 12);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text('Informe de Sanciones y Advertencias', 15, 22);

  doc.setTextColor(100, 116, 139);
  doc.setFontSize(9);
  doc.text(`Generado: ${fechaStr} ${horaStr}`, 150, 22, { align: 'right' });

  // KPIs
  doc.setTextColor(30, 41, 59);
  let y = 45;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Resumen', 15, y);
  y += 6;

  const kpis = [
    ['Total de sanciones', String(stats.total)],
    ['Funcionarios involucrados', String(stats.byFuncionario.length)],
    ['Tipos de sanción', String(stats.byTipo.length)],
    ['Patrones repetidos', String(stats.patrones.length)],
  ];

  autoTable(doc, {
    startY: y,
    head: [['Indicador', 'Valor']],
    body: kpis,
    theme: 'striped',
    headStyles: { fillColor: [0, 61, 165], textColor: 255, fontStyle: 'bold', fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
    margin: { left: 15, right: 15 },
  });

  y = (doc as any).lastAutoTable.finalY + 10;

  // Ranking
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text('Ranking de Funcionarios con más Sanciones', 15, y);
  y += 4;

  autoTable(doc, {
    startY: y,
    head: [['#', 'Funcionario', 'Total sanciones', 'Tipos']],
    body: stats.byFuncionario.slice(0, 20).map((f, i) => [
      i + 1,
      f.nombre,
      f.total,
      [...new Set(f.tipos)].slice(0, 3).join(', '),
    ]),
    theme: 'striped',
    headStyles: { fillColor: [0, 61, 165], textColor: 255, fontStyle: 'bold', fontSize: 9 },
    bodyStyles: { fontSize: 8 },
    columnStyles: { 0: { halign: 'center', cellWidth: 10 }, 2: { halign: 'center' } },
    margin: { left: 15, right: 15 },
  });

  y = (doc as any).lastAutoTable.finalY + 10;

  if (y > 240) {
    doc.addPage();
    y = 20;
  }

  // By tipo
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Distribución por Tipo de Sanción', 15, y);
  y += 4;

  autoTable(doc, {
    startY: y,
    head: [['Tipo de sanción', 'Cantidad', '% del total']],
    body: stats.byTipo.map(t => [
      t.tipo,
      t.count,
      `${Math.round((t.count / stats.total) * 100)}%`,
    ]),
    theme: 'striped',
    headStyles: { fillColor: [227, 0, 15], textColor: 255, fontStyle: 'bold', fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    columnStyles: { 1: { halign: 'center' }, 2: { halign: 'center' } },
    margin: { left: 15, right: 15 },
  });

  if (stats.patrones.length > 0) {
    doc.addPage();
    y = 20;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text('Patrones Detectados (sanciones repetidas del mismo tipo)', 15, y);
    y += 4;

    autoTable(doc, {
      startY: y,
      head: [['Funcionario', 'Tipo de sanción', 'Ocurrencias']],
      body: stats.patrones.map(p => [p.nombre, p.tipo, p.count]),
      theme: 'striped',
      headStyles: { fillColor: [245, 158, 11], textColor: 255, fontStyle: 'bold', fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      columnStyles: { 2: { halign: 'center', fontStyle: 'bold' } },
      margin: { left: 15, right: 15 },
    });
  }

  // Footer on all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFillColor(248, 250, 252);
    doc.rect(0, 285, 210, 12, 'F');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.setFont('helvetica', 'normal');
    doc.text(config.nombreEmpresa, 15, 291);
    doc.text(`Página ${i} de ${totalPages}`, 195, 291, { align: 'right' });
  }

  doc.save(`Sanciones_${fechaStr.replace(/\//g, '-')}.pdf`);
}
