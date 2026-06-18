import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

export type PDFOptions = { titulo: string; subtitulo?: string; nombreArchivo: string };

const PDF_W_L = 297;
const PDF_H_L = 210;
const PDF_W_P = 210;
const PDF_H_P = 297;
const HDR_H   = 12;
const FTR_H   = 10;
const MARGIN  = 8;

function drawHeaderLandscape(doc: jsPDF, opciones: PDFOptions) {
  doc.setFillColor(0, 61, 165);
  doc.rect(0, 0, PDF_W_L, HDR_H - 2, 'F');
  doc.setFillColor(227, 0, 15);
  doc.rect(0, HDR_H - 2, PDF_W_L, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(opciones.titulo, MARGIN, 7);
  if (opciones.subtitulo) {
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(202, 220, 252);
    doc.text(opciones.subtitulo, PDF_W_L / 2, 7, { align: 'center' });
  }
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(202, 220, 252);
  doc.text(new Date().toLocaleDateString('es-UY'), PDF_W_L - MARGIN, 7, { align: 'right' });
}

function drawFooterLandscape(doc: jsPDF, page: number, total: number) {
  const fy = PDF_H_L - FTR_H;
  doc.setFillColor(232, 240, 254);
  doc.rect(0, fy, PDF_W_L, FTR_H, 'F');
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(74, 74, 106);
  doc.text('Elared S.A. · Reporte Eficiencia · Confidencial', MARGIN, fy + 6);
  doc.text(`Página ${page} / ${total}`, PDF_W_L - MARGIN, fy + 6, { align: 'right' });
}

export async function exportarPDFGeneral(elementId: string, opciones: PDFOptions): Promise<void> {
  const el = document.getElementById(elementId);
  if (!el) throw new Error(`Elemento #${elementId} no encontrado`);

  const canvas = await html2canvas(el, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
    logging: false,
  });

  const CONTENT_W = PDF_W_L - MARGIN * 2;
  const CONTENT_H = PDF_H_L - HDR_H - FTR_H;
  const pagePxH   = Math.round(CONTENT_H * canvas.width / CONTENT_W);
  const totalPages = Math.max(1, Math.ceil(canvas.height / pagePxH));

  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  for (let i = 0; i < totalPages; i++) {
    if (i > 0) pdf.addPage();

    drawHeaderLandscape(pdf, opciones);
    drawFooterLandscape(pdf, i + 1, totalPages);

    const srcY = i * pagePxH;
    const srcH = Math.min(pagePxH, canvas.height - srcY);

    const tmp = document.createElement('canvas');
    tmp.width  = canvas.width;
    tmp.height = srcH;
    tmp.getContext('2d')!.drawImage(canvas, 0, srcY, canvas.width, srcH, 0, 0, canvas.width, srcH);

    const sliceHMm = (srcH * CONTENT_W) / canvas.width;
    pdf.addImage(tmp.toDataURL('image/png'), 'PNG', MARGIN, HDR_H, CONTENT_W, sliceHMm);
  }

  pdf.save(`${opciones.nombreArchivo}.pdf`);
}

export async function exportarPDFIndividual(elementId: string, opciones: PDFOptions): Promise<void> {
  const el = document.getElementById(elementId);
  if (!el) throw new Error(`Elemento #${elementId} no encontrado`);

  const canvas = await html2canvas(el, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
    logging: false,
  });

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const CONTENT_W = PDF_W_P - MARGIN * 2;
  const CONTENT_H = PDF_H_P - HDR_H - FTR_H - 4;

  pdf.setFillColor(0, 61, 165);
  pdf.rect(0, 0, PDF_W_P, HDR_H - 2, 'F');
  pdf.setFillColor(227, 0, 15);
  pdf.rect(0, HDR_H - 2, PDF_W_P, 2, 'F');
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'bold');
  pdf.text(opciones.titulo, MARGIN, 7);
  if (opciones.subtitulo) {
    pdf.setFontSize(7);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(202, 220, 252);
    pdf.text(opciones.subtitulo, MARGIN, 10.5);
  }
  pdf.setFontSize(7);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(202, 220, 252);
  pdf.text(new Date().toLocaleDateString('es-UY'), PDF_W_P - MARGIN, 7, { align: 'right' });

  const fy = PDF_H_P - FTR_H;
  pdf.setFillColor(232, 240, 254);
  pdf.rect(0, fy, PDF_W_P, FTR_H, 'F');
  pdf.setFontSize(7);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(74, 74, 106);
  pdf.text('Elared S.A. · Confidencial', MARGIN, fy + 6);

  const imgRatio  = canvas.width / canvas.height;
  const imgW      = CONTENT_W;
  const imgH      = Math.min(CONTENT_H, imgW / imgRatio);

  pdf.addImage(canvas.toDataURL('image/png'), 'PNG', MARGIN, HDR_H + 2, imgW, imgH);
  pdf.save(`${opciones.nombreArchivo}.pdf`);
}
