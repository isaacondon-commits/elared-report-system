import PptxGenJS from 'pptxgenjs';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// ── Paleta Elared ─────────────────────────────────────────────────────────────
export const C = {
  AZUL_OSC:  '003DA5',
  AZUL_MED:  '0052CC',
  AZUL_CLAR: 'E8F0FE',
  ROJO:      'E3000F',
  GRIS_OSC:  '1A1A2E',
  GRIS_MED:  '4A4A6A',
  GRIS_CLAR: 'F5F7FA',
  BLANCO:    'FFFFFF',
  DORADO:    'FFD700',
  PLATA:     'C0C0C0',
  BRONCE:    'CD7F32',
  VERDE:     '28a745',
  NARANJA:   'fd7e14',
  VIOLETA:   '6f42c1',
} as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ShapeType = any;
export type PSlide = ReturnType<PptxGenJS['addSlide']>;

// ── Helpers de forma ──────────────────────────────────────────────────────────
export function rect(slide: PSlide, x: number, y: number, w: number, h: number, color: string, lineColor?: string) {
  slide.addShape('rect' as ShapeType, {
    x, y, w, h,
    fill: { color },
    line: lineColor ? { color: lineColor, pt: 0.5 } : { type: 'none' },
  });
}

function fmtFecha(): string {
  return new Date().toLocaleDateString('es-UY', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// ── createPptx ────────────────────────────────────────────────────────────────
export function createPptx(author = 'Elared S.A.', title = 'Reporte'): PptxGenJS {
  const pptx = new PptxGenJS();
  pptx.layout  = 'LAYOUT_16x9';
  pptx.author  = author;
  pptx.company = 'Elared S.A.';
  pptx.title   = title;
  return pptx;
}

// ── addSlideBase ──────────────────────────────────────────────────────────────
export function addSlideBase(
  pptx: PptxGenJS,
  titulo: string,
  moduloNombre: string,
): PSlide {
  const slide = pptx.addSlide();
  slide.background = { color: C.GRIS_CLAR };
  rect(slide, 0, 0, 10, 0.72, C.AZUL_OSC);
  slide.addText(titulo, {
    x: 0.3, y: 0.12, w: 7.5, h: 0.5,
    fontSize: 18, bold: true, color: C.BLANCO,
    fontFace: 'Calibri', valign: 'middle',
  });
  slide.addText('Elared S.A.', {
    x: 8.2, y: 0.12, w: 1.6, h: 0.5,
    fontSize: 11, color: 'CADCFC',
    fontFace: 'Calibri', align: 'right', valign: 'middle',
  });
  rect(slide, 0, 0.72, 10, 0.05, C.ROJO);
  rect(slide, 0, 5.55, 10, 0.08, C.AZUL_CLAR);
  slide.addText(`Elared S.A. · ${moduloNombre}`, {
    x: 0.3, y: 5.55, w: 5, h: 0.08,
    fontSize: 8, color: C.GRIS_MED, fontFace: 'Calibri', valign: 'middle',
  });
  slide.addText(`Confidencial · ${fmtFecha()}`, {
    x: 7, y: 5.55, w: 2.7, h: 0.08,
    fontSize: 8, color: C.GRIS_MED, fontFace: 'Calibri',
    align: 'right', valign: 'middle',
  });
  return slide;
}

// ── addPortada ────────────────────────────────────────────────────────────────
export function addPortada(
  pptx: PptxGenJS,
  titulo: string,
  subtitulo: string,
  stats: { label: string; valor: string }[],
): PSlide {
  const slide = pptx.addSlide();
  slide.background = { color: C.AZUL_OSC };
  rect(slide, 0, 0, 3.2, 5.63, C.AZUL_MED);
  rect(slide, 3.2, 0.3, 0.06, 5, C.ROJO);
  rect(slide, 0, 5.2, 10, 0.15, C.ROJO);
  slide.addText('ELARED', {
    x: 0.3, y: 0.35, w: 2.6, h: 0.6,
    fontSize: 24, bold: true, color: C.BLANCO,
    fontFace: 'Calibri', valign: 'middle',
  });
  slide.addText('Agente Oficial Antel', {
    x: 0.3, y: 0.95, w: 2.6, h: 0.35,
    fontSize: 11, color: 'CADCFC', fontFace: 'Calibri', valign: 'middle',
  });
  slide.addText(titulo, {
    x: 3.5, y: 1.1, w: 6.2, h: 1.2,
    fontSize: 38, bold: true, color: C.BLANCO,
    fontFace: 'Calibri', valign: 'middle',
  });
  slide.addText(subtitulo, {
    x: 3.5, y: 2.4, w: 6.2, h: 0.5,
    fontSize: 18, color: 'CADCFC', fontFace: 'Calibri', valign: 'middle',
  });
  const items = stats.slice(0, 4);
  const n = items.length;
  const cardW = n > 0 ? Math.min(1.45, 6.0 / n) : 1.45;
  const gap   = n > 1 ? (6.0 - cardW * n) / (n - 1) : 0;
  items.forEach((s, i) => {
    const cx = 3.5 + i * (cardW + gap);
    slide.addShape('rect' as ShapeType, {
      x: cx, y: 3.1, w: cardW, h: 1.6,
      fill: { color: '0A4B8C', transparency: 40 },
      line: { color: '2970C2', pt: 1 },
    });
    slide.addText(String(s.valor), {
      x: cx, y: 3.15, w: cardW, h: 0.9,
      fontSize: 20, bold: true, color: C.BLANCO,
      fontFace: 'Calibri', align: 'center', valign: 'middle', fit: 'shrink',
    });
    slide.addText(s.label, {
      x: cx, y: 4.05, w: cardW, h: 0.55,
      fontSize: 8, color: 'CADCFC', fontFace: 'Calibri',
      align: 'center', valign: 'top',
    });
  });
  slide.addText(`Generado el ${fmtFecha()}`, {
    x: 3.5, y: 5.1, w: 6.2, h: 0.3,
    fontSize: 10, color: '8899BB', fontFace: 'Calibri', valign: 'middle',
  });
  return slide;
}

// ── addPortadaCierre ──────────────────────────────────────────────────────────
export function addPortadaCierre(pptx: PptxGenJS, titulo: string, periodo: string): PSlide {
  const slide = pptx.addSlide();
  slide.background = { color: C.AZUL_OSC };
  rect(slide, 0, 0, 3.2, 5.63, C.AZUL_MED);
  rect(slide, 0, 5.2, 10, 0.15, C.ROJO);
  slide.addText('Elared S.A.', {
    x: 3.5, y: 1.8, w: 6, h: 0.8,
    fontSize: 36, bold: true, color: C.BLANCO,
    fontFace: 'Calibri', align: 'center', valign: 'middle',
  });
  slide.addText('Agente Oficial Antel', {
    x: 3.5, y: 2.65, w: 6, h: 0.4,
    fontSize: 16, color: 'CADCFC', fontFace: 'Calibri', align: 'center',
  });
  rect(slide, 3.5, 3.2, 6, 0.04, C.ROJO);
  slide.addText(`Reporte generado el ${fmtFecha()}`, {
    x: 3.5, y: 3.4, w: 6, h: 0.3,
    fontSize: 12, color: '8899BB', fontFace: 'Calibri', align: 'center',
  });
  if (periodo) {
    slide.addText(`Período: ${periodo}`, {
      x: 3.5, y: 3.75, w: 6, h: 0.3,
      fontSize: 12, color: '8899BB', fontFace: 'Calibri', align: 'center',
    });
  }
  slide.addText(titulo, {
    x: 3.5, y: 4.2, w: 6, h: 0.4,
    fontSize: 13, color: 'CADCFC', fontFace: 'Calibri', align: 'center',
  });
  return slide;
}

// ── addKPICard ────────────────────────────────────────────────────────────────
export function addKPICard(
  slide: PSlide,
  x: number, y: number, w: number, h: number,
  label: string, valor: string, sublabel: string, colorAccento: string,
) {
  slide.addShape('rect' as ShapeType, {
    x: x + 0.04, y: y + 0.04, w, h,
    fill: { color: 'D8E4F0', transparency: 40 },
    line: { type: 'none' },
  });
  slide.addShape('rect' as ShapeType, {
    x, y, w, h,
    fill: { color: C.BLANCO },
    line: { color: 'E2E8F0', pt: 0.5 },
  });
  rect(slide, x, y, 0.1, h, colorAccento);
  slide.addText(label.toUpperCase(), {
    x: x + 0.17, y: y + 0.1, w: w - 0.22, h: 0.28,
    fontSize: 9, bold: true, color: C.GRIS_MED,
    fontFace: 'Calibri', charSpacing: 1,
  });
  const fs = valor.length > 7 ? 26 : 36;
  slide.addText(valor, {
    x: x + 0.17, y: y + 0.33, w: w - 0.22, h: h * 0.45,
    fontSize: fs, bold: true, color: colorAccento,
    fontFace: 'Calibri', valign: 'middle', fit: 'shrink',
  });
  if (sublabel) {
    slide.addText(sublabel, {
      x: x + 0.17, y: y + h - 0.32, w: w - 0.22, h: 0.28,
      fontSize: 10, color: C.GRIS_MED, fontFace: 'Calibri',
    });
  }
}

// ── addBarraProgreso ──────────────────────────────────────────────────────────
export function addBarraProgreso(
  slide: PSlide,
  x: number, y: number, w: number, h: number,
  valor: number, maximo: number, color: string,
) {
  rect(slide, x, y, w, h, C.AZUL_CLAR);
  const fw = maximo > 0 ? Math.max(0, Math.min(w, (valor / maximo) * w)) : 0;
  if (fw > 0.01) rect(slide, x, y, fw, h, color);
}

// ── addTabla ──────────────────────────────────────────────────────────────────
export function addTabla(
  slide: PSlide,
  x: number, y: number, w: number,
  headers: string[],
  rows: string[][],
  colWidths?: number[],
  rowHighlights?: (string | undefined)[],
) {
  const cw = colWidths ?? headers.map(() => +(w / headers.length).toFixed(3));
  const hRow = headers.map(h => ({
    text: h,
    options: {
      bold: true, fontSize: 10, color: C.BLANCO,
      fill: { color: C.AZUL_OSC },
      align: 'center' as const, valign: 'middle' as const,
    },
  }));
  const dataRows = rows.map((row, ri) => {
    const bg = rowHighlights?.[ri] ?? (ri % 2 === 0 ? C.BLANCO : C.AZUL_CLAR);
    return row.map((cell, ci) => ({
      text: cell,
      options: {
        fontSize: 9, color: C.GRIS_OSC,
        fill: { color: bg },
        align: (ci === 0 ? 'center' : 'left') as 'center' | 'left',
        valign: 'middle' as const,
      },
    }));
  });

  slide.addTable([hRow, ...dataRows], {
    x, y, w,
    colW: cw,
    rowH: [0.38, ...rows.map(() => 0.3)],
    border: { type: 'solid', color: 'E2E8F0', pt: 0.5 },
    fontFace: 'Calibri',
  });
}

// ── Excel helpers ─────────────────────────────────────────────────────────────
export function autoWidth(rows: (string | number)[][]): XLSX.ColInfo[] {
  if (rows.length === 0) return [];
  const cols = rows[0]?.length ?? 0;
  const widths = Array.from({ length: cols }, () => 8);
  for (const row of rows) {
    row.forEach((cell, i) => {
      const len = String(cell ?? '').length;
      if (len + 2 > (widths[i] ?? 8)) widths[i] = len + 2;
    });
  }
  return widths.map(w => ({ wch: Math.min(w, 45) }));
}

export function styledExcelSheet(
  wb: XLSX.WorkBook,
  sheetName: string,
  headers: string[],
  rows: (string | number)[][],
  totals?: (string | number)[],
): XLSX.WorkSheet {
  const data: (string | number)[][] = [headers, ...rows];
  if (totals) data.push(totals);
  const ws = XLSX.utils.aoa_to_sheet(data);
  headers.forEach((_, ci) => {
    const ref = XLSX.utils.encode_cell({ r: 0, c: ci });
    if (ws[ref]) {
      ws[ref].s = {
        font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 },
        fill: { fgColor: { rgb: '003DA5' }, patternType: 'solid' },
        alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
        border: { bottom: { style: 'thin', color: { rgb: 'E3000F' } } },
      };
    }
  });
  rows.forEach((_, ri) => {
    const rowIdx = ri + 1;
    const bg = ri % 2 === 0 ? 'FFFFFF' : 'EEF3FF';
    headers.forEach((__, ci) => {
      const ref = XLSX.utils.encode_cell({ r: rowIdx, c: ci });
      if (ws[ref]) {
        ws[ref].s = {
          fill: { fgColor: { rgb: bg }, patternType: 'solid' },
          alignment: { vertical: 'center' },
          border: { bottom: { style: 'thin', color: { rgb: 'E2E8F0' } } },
        };
      }
    });
  });
  if (totals) {
    const ti = rows.length + 1;
    totals.forEach((_, ci) => {
      const ref = XLSX.utils.encode_cell({ r: ti, c: ci });
      if (ws[ref]) {
        ws[ref].s = {
          font: { bold: true, color: { rgb: 'FFFFFF' } },
          fill: { fgColor: { rgb: '4A4A6A' }, patternType: 'solid' },
        };
      }
    });
  }
  ws['!cols'] = autoWidth(data);
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  return ws;
}

// ── generatePDF ───────────────────────────────────────────────────────────────
export async function generatePDF(
  elementId: string,
  filename: string,
  modulo: string,
): Promise<void> {
  const element = document.getElementById(elementId);
  if (!element) { console.error(`generatePDF: #${elementId} no encontrado`); return; }

  const canvas = await html2canvas(element, {
    scale: 2, useCORS: true, backgroundColor: '#F5F7FA', logging: false,
    windowWidth: element.scrollWidth, windowHeight: element.scrollHeight,
  });

  const pageW = 297; const pageH = 210;
  const hdrH = 14;   const ftrH = 10;
  const contentH = pageH - hdrH - ftrH - 4;
  const ratio = pageW / (canvas.width / 2);
  const totalH = (canvas.height / 2) * ratio;
  const totalPages = Math.max(1, Math.ceil(totalH / contentH));

  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  for (let page = 1; page <= totalPages; page++) {
    if (page > 1) pdf.addPage();
    pdf.setFillColor(0, 61, 165); pdf.rect(0, 0, pageW, hdrH, 'F');
    pdf.setFillColor(227, 0, 15); pdf.rect(0, hdrH, pageW, 1.5, 'F');
    pdf.setFontSize(10); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(255, 255, 255);
    pdf.text('ELARED · Agente Oficial Antel', 6, 9);
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9); pdf.setTextColor(202, 220, 252);
    pdf.text(modulo, pageW / 2, 9, { align: 'center' });

    const srcYpx = ((page - 1) * contentH / ratio) * 2;
    const srcHpx = Math.min((contentH / ratio) * 2, canvas.height - srcYpx);
    if (srcHpx > 0) {
      const tmp = document.createElement('canvas');
      tmp.width = canvas.width; tmp.height = Math.ceil(srcHpx);
      tmp.getContext('2d')!.drawImage(canvas, 0, srcYpx, canvas.width, Math.ceil(srcHpx), 0, 0, canvas.width, Math.ceil(srcHpx));
      const rendH = (Math.ceil(srcHpx) / 2) * ratio;
      pdf.addImage(tmp.toDataURL('image/jpeg', 0.9), 'JPEG', 0, hdrH + 2, pageW, Math.min(contentH, rendH));
    }

    const fy = pageH - ftrH;
    pdf.setFillColor(232, 240, 254); pdf.rect(0, fy, pageW, ftrH, 'F');
    pdf.setFontSize(8); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(74, 74, 106);
    pdf.text(`Elared S.A. · Confidencial · ${new Date().toLocaleDateString('es-UY')}`, 6, fy + 6.5);
    pdf.text(`Página ${page} de ${totalPages}`, pageW - 6, fy + 6.5, { align: 'right' });
  }
  pdf.save(filename);
}

// ── Toast ─────────────────────────────────────────────────────────────────────
export function showToast(msg: string, type: 'success' | 'error' = 'success') {
  const div = document.createElement('div');
  div.style.cssText = [
    'position:fixed', 'bottom:24px', 'right:24px', 'z-index:9999',
    `background:${type === 'success' ? '#28a745' : '#E3000F'}`,
    'color:#fff', 'padding:12px 20px', 'border-radius:10px',
    'font:600 14px/1.4 system-ui,sans-serif', 'box-shadow:0 4px 18px rgba(0,0,0,.25)',
    'transition:opacity .4s', 'opacity:1',
  ].join(';');
  div.textContent = msg;
  document.body.appendChild(div);
  setTimeout(() => { div.style.opacity = '0'; setTimeout(() => div.remove(), 400); }, 3000);
}
