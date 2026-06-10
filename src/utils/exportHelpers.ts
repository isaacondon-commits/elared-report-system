import PptxGenJS from 'pptxgenjs';
import * as XLSX from 'xlsx';

const BLUE = '003DA5';
const RED = 'E3000F';
const WHITE = 'FFFFFF';
const GRAY = '334155';

export function createPptx(title: string, empresa: string): PptxGenJS {
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';
  pptx.author = empresa;
  pptx.company = empresa;
  pptx.title = title;
  return pptx;
}

export function addTitleSlide(pptx: PptxGenJS, title: string, subtitle: string, empresa: string): void {
  const slide = pptx.addSlide();
  slide.background = { color: BLUE };

  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: 4.5, w: '100%', h: 0.06,
    fill: { color: RED },
    line: { color: RED },
  });

  slide.addText(empresa, {
    x: 0.5, y: 0.5, w: 9, h: 0.5,
    color: WHITE, fontSize: 14, bold: false,
  });

  slide.addText(title, {
    x: 0.5, y: 1.5, w: 9, h: 1.5,
    color: WHITE, fontSize: 36, bold: true,
  });

  slide.addText(subtitle, {
    x: 0.5, y: 3.2, w: 9, h: 0.6,
    color: 'CBD5E1', fontSize: 16,
  });

  const now = new Date();
  slide.addText(`Generado: ${now.toLocaleDateString('es-UY')} ${now.toLocaleTimeString('es-UY', { hour: '2-digit', minute: '2-digit' })}`, {
    x: 0.5, y: 5.2, w: 9, h: 0.4,
    color: '93C5FD', fontSize: 11,
  });
}

export function addSectionSlide(pptx: PptxGenJS, sectionTitle: string): void {
  const slide = pptx.addSlide();
  slide.background = { color: '1E3A5F' };

  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: 0.12, h: '100%',
    fill: { color: RED },
    line: { color: RED },
  });

  slide.addText(sectionTitle, {
    x: 0.6, y: 2.2, w: 9, h: 1,
    color: WHITE, fontSize: 28, bold: true,
  });
}

export function addDataSlide(
  pptx: PptxGenJS,
  slideTitle: string,
  tableData: { headers: string[]; rows: (string | number)[][] },
  empresa: string
): void {
  const slide = pptx.addSlide();

  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: '100%', h: 0.7,
    fill: { color: BLUE },
    line: { color: BLUE },
  });

  slide.addText(slideTitle, {
    x: 0.3, y: 0.1, w: 8, h: 0.5,
    color: WHITE, fontSize: 16, bold: true,
  });

  slide.addText(empresa, {
    x: 8.5, y: 0.1, w: 3, h: 0.5,
    color: 'CBD5E1', fontSize: 10, align: 'right',
  });

  const tableRows = [
    tableData.headers.map(h => ({ text: h, options: { bold: true, color: WHITE, fill: { color: BLUE } } })),
    ...tableData.rows.map((row, i) =>
      row.map(cell => ({
        text: String(cell),
        options: { fill: { color: i % 2 === 0 ? WHITE : 'F1F5F9' }, color: GRAY },
      }))
    ),
  ];

  slide.addTable(tableRows, {
    x: 0.3, y: 0.9, w: 12, h: 4.8,
    border: { pt: 0.5, color: 'E2E8F0' },
    fontSize: 11,
  });
}

export function exportExcelMultiSheet(
  sheets: { name: string; headers: string[]; rows: (string | number | Date)[][] }[],
  fileName: string
): void {
  const wb = XLSX.utils.book_new();

  for (const sheet of sheets) {
    const wsData = [sheet.headers, ...sheet.rows];
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    const headerStyle = {
      font: { bold: true, color: { rgb: 'FFFFFF' } },
      fill: { fgColor: { rgb: '003DA5' } },
      alignment: { horizontal: 'center' },
    };

    sheet.headers.forEach((_, i) => {
      const cellRef = XLSX.utils.encode_cell({ r: 0, c: i });
      if (ws[cellRef]) {
        ws[cellRef].s = headerStyle;
      }
    });

    const colWidths = sheet.headers.map((h, i) => {
      const maxLen = Math.max(
        h.length,
        ...sheet.rows.map(r => String(r[i] ?? '').length)
      );
      return { wch: Math.min(Math.max(maxLen + 2, 10), 40) };
    });
    ws['!cols'] = colWidths;

    XLSX.utils.book_append_sheet(wb, ws, sheet.name);
  }

  XLSX.writeFile(wb, fileName);
}
