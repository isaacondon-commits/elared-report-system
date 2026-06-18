import PptxGenJS from 'pptxgenjs';
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

export async function exportSancionesPptx(stats: SancionesStats, config: AppConfig): Promise<void> {
  const pptx = new PptxGenJS();
  pptx.layout  = 'LAYOUT_WIDE';
  pptx.author  = config.nombreEmpresa;
  pptx.company = config.nombreEmpresa;
  pptx.title   = 'Reporte de Sanciones';

  const W = 13.33;
  const H = 7.5;
  const fechaGen = new Date().toLocaleDateString('es-UY');

  const AZUL_OSC = '003DA5';
  const AZUL_MED = '0052CC';
  const AZUL_CLAR = 'DBEAFE';
  const ROJO    = 'E3000F';
  const BLANCO  = 'FFFFFF';
  const GRIS_OSC = '1E293B';
  const GRIS_MED = '64748B';
  const GRIS_CLAR = 'F1F5F9';
  const AMBAR   = 'F59E0B';

  type PptxSlide = ReturnType<typeof pptx.addSlide>;

  function r(slide: PptxSlide, x: number, y: number, w: number, h: number, color: string) {
    slide.addShape(pptx.ShapeType.rect, { x, y, w, h, fill: { color }, line: { color } });
  }

  function addHeader(slide: PptxSlide, titulo: string) {
    r(slide, 0, 0, W, 0.58, AZUL_OSC);
    r(slide, 0, 0.58, W, 0.04, ROJO);
    slide.addText(titulo, {
      x: 0.35, y: 0.07, w: 9.6, h: 0.46,
      color: BLANCO, fontSize: 17, bold: true, fontFace: 'Calibri', valign: 'middle',
    });
    slide.addText(config.nombreEmpresa, {
      x: 10.0, y: 0.08, w: 3.05, h: 0.44,
      color: AZUL_CLAR, fontSize: 9, align: 'right', fontFace: 'Calibri', valign: 'middle',
    });
  }

  function addFooter(slide: PptxSlide) {
    r(slide, 0, 7.35, W, 0.15, 'E2E8F0');
    slide.addText(`Generado el ${fechaGen}  ·  Elared Report System`, {
      x: 0.3, y: 7.36, w: 12.7, h: 0.12,
      color: GRIS_MED, fontSize: 7, fontFace: 'Calibri', valign: 'middle',
    });
  }

  function addPortadaSidebar(slide: PptxSlide, kpis: { label: string; value: string }[]) {
    r(slide, 0, 0, 4.0, H, '002578');
    r(slide, 4.0, 0, 0.07, H, ROJO);
    r(slide, 0.35, 0.42, 1.0, 0.07, ROJO);
    slide.addText(config.nombreEmpresa.toUpperCase(), {
      x: 0.35, y: 0.6, w: 3.25, h: 0.45,
      color: BLANCO, fontSize: 13, bold: true, fontFace: 'Calibri',
    });
    r(slide, 0.35, 1.06, 2.8, 0.04, AZUL_MED);
    kpis.forEach((k, i) => {
      const y = 1.35 + i * 1.4;
      slide.addText(k.label, {
        x: 0.35, y, w: 3.25, h: 0.27,
        color: AZUL_CLAR, fontSize: 8, bold: true, fontFace: 'Calibri', charSpacing: 1.5,
      });
      slide.addText(k.value, {
        x: 0.35, y: y + 0.26, w: 3.25, h: 0.8,
        color: BLANCO, fontSize: 20, bold: true, fontFace: 'Calibri',
      });
    });
    r(slide, 0, H - 0.18, 4.0, 0.18, ROJO);
  }

  // SLIDE 1 — PORTADA
  {
    const slide = pptx.addSlide();
    slide.background = { color: AZUL_OSC };
    addPortadaSidebar(slide, [
      { label: 'TOTAL SANCIONES', value: stats.total.toLocaleString()           },
      { label: 'FUNCIONARIOS',    value: stats.byFuncionario.length.toString()  },
      { label: 'TIPOS',          value: stats.byTipo.length.toString()          },
      { label: 'PATRONES',       value: stats.patrones.length.toString()        },
    ]);
    slide.addText('REPORTE DE', {
      x: 4.45, y: 1.55, w: 8.6, h: 0.5,
      color: AZUL_CLAR, fontSize: 15, fontFace: 'Calibri', charSpacing: 4.5,
    });
    slide.addText('SANCIONES', {
      x: 4.45, y: 1.95, w: 8.6, h: 1.55,
      color: BLANCO, fontSize: 58, bold: true, fontFace: 'Calibri',
    });
    r(slide, 4.45, 3.42, 5.5, 0.06, ROJO);
    slide.addText(`Generado: ${fechaGen}`, {
      x: 4.45, y: H - 0.5, w: 8.6, h: 0.32,
      color: GRIS_MED, fontSize: 9, fontFace: 'Calibri',
    });
    r(slide, 4.07, H - 0.18, W - 4.07, 0.18, AZUL_MED);
  }

  // SLIDE 2 — KPIs
  {
    const slide = pptx.addSlide();
    slide.background = { color: 'F8FAFC' };
    addHeader(slide, 'Resumen de Sanciones');
    addFooter(slide);

    const cards = [
      { label: 'TOTAL SANCIONES', value: stats.total.toLocaleString(),           sub: 'registros',           accent: ROJO,    valColor: ROJO    },
      { label: 'FUNCIONARIOS',    value: stats.byFuncionario.length.toString(),   sub: 'involucrados',        accent: AZUL_OSC, valColor: GRIS_OSC },
      { label: 'TIPOS DE SANCIÓN', value: stats.byTipo.length.toString(),         sub: 'categorías distintas', accent: AMBAR,  valColor: GRIS_OSC },
      { label: 'PATRONES',        value: stats.patrones.length.toString(),        sub: 'repeticiones detecc.', accent: '6f42c1', valColor: GRIS_OSC },
    ];

    cards.forEach((c, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x  = 0.4 + col * 6.5;
      const y  = 0.82 + row * 3.1;
      const cw = 6.1;
      const ch = 2.85;

      r(slide, x + 0.04, y + 0.04, cw, ch, 'E2E8F0');
      r(slide, x, y, cw, ch, BLANCO);
      r(slide, x, y, 0.07, ch, c.accent);
      slide.addText(c.label, {
        x: x + 0.2, y: y + 0.24, w: cw - 0.28, h: 0.32,
        color: GRIS_MED, fontSize: 9, bold: true, fontFace: 'Calibri', charSpacing: 2,
      });
      slide.addText(c.value, {
        x: x + 0.2, y: y + 0.52, w: cw - 0.28, h: 1.55,
        color: c.valColor, fontSize: 48, bold: true, fontFace: 'Calibri',
      });
      slide.addText(c.sub, {
        x: x + 0.2, y: y + 2.38, w: cw - 0.28, h: 0.3,
        color: GRIS_MED, fontSize: 9, fontFace: 'Calibri',
      });
      r(slide, x, y + ch - 0.05, cw, 0.05, c.accent);
    });
  }

  // SLIDE 3 — RANKING FUNCIONARIOS
  {
    const slide = pptx.addSlide();
    slide.background = { color: BLANCO };
    addHeader(slide, 'Ranking de Funcionarios con más Sanciones');
    addFooter(slide);

    const top15   = stats.byFuncionario.slice(0, 15);
    const maxTotal = top15[0]?.total ?? 1;

    const thY = 0.72;
    const thH = 0.27;
    r(slide, 0.3, thY, 12.73, thH, GRIS_OSC);

    type Align = 'left' | 'center' | 'right';
    const cols: { label: string; x: number; w: number; align: Align }[] = [
      { label: '#',            x: 0.30, w: 0.52, align: 'center' },
      { label: 'Funcionario',  x: 0.84, w: 5.5,  align: 'left'   },
      { label: 'Total',        x: 6.38, w: 1.5,  align: 'right'  },
      { label: 'Tipos principales', x: 7.92, w: 4.8, align: 'left' },
    ];

    cols.forEach(c =>
      slide.addText(c.label, {
        x: c.x, y: thY + 0.02, w: c.w, h: thH - 0.04,
        color: BLANCO, fontSize: 7.5, bold: true, fontFace: 'Calibri',
        align: c.align, valign: 'middle',
      })
    );

    const rowH   = 0.39;
    const barMaxW = 1.1;

    top15.forEach((f, ri) => {
      const y    = thY + thH + ri * rowH;
      const rowBg = ri % 2 === 0 ? BLANCO : 'F8FAFC';
      r(slide, 0.30, y, 12.73, rowH, rowBg);
      r(slide, 0.30, y + rowH - 0.01, 12.73, 0.01, 'E2E8F0');

      slide.addText(`${ri + 1}`, {
        x: cols[0].x, y, w: cols[0].w, h: rowH,
        color: ri < 3 ? ROJO : GRIS_MED,
        fontSize: 8.5, bold: ri < 3, fontFace: 'Calibri',
        align: 'center', valign: 'middle',
      });
      slide.addText(f.nombre, {
        x: cols[1].x, y, w: cols[1].w, h: rowH,
        color: GRIS_OSC, fontSize: 9, bold: ri < 3, fontFace: 'Calibri',
        align: 'left', valign: 'middle',
      });

      const barW = Math.max(0.04, (f.total / maxTotal) * barMaxW);
      const barY = y + rowH * 0.62;
      r(slide, cols[2].x, barY, barMaxW, 0.1, 'E2E8F0');
      r(slide, cols[2].x, barY, barW, 0.1, ri === 0 ? ROJO : AZUL_OSC);
      slide.addText(f.total.toLocaleString(), {
        x: cols[2].x, y, w: cols[2].w, h: rowH * 0.6,
        color: ri === 0 ? ROJO : GRIS_OSC,
        fontSize: 9, bold: ri === 0, fontFace: 'Calibri',
        align: 'right', valign: 'bottom',
      });

      const tipos = [...new Set(f.tipos)].slice(0, 2).join(', ');
      slide.addText(tipos, {
        x: cols[3].x, y, w: cols[3].w, h: rowH,
        color: GRIS_MED, fontSize: 8.5, fontFace: 'Calibri',
        align: 'left', valign: 'middle',
      });
    });
  }

  // SLIDE 4 — DISTRIBUCIÓN POR TIPO
  {
    const slide = pptx.addSlide();
    slide.background = { color: BLANCO };
    addHeader(slide, 'Distribución por Tipo de Sanción');
    addFooter(slide);

    const tipos    = stats.byTipo.slice(0, 7);
    const maxCount = Math.max(...tipos.map(t => t.count), 1);
    const barColors = [ROJO, AZUL_OSC, AMBAR, '0EA5E9', '6f42c1', GRIS_MED, '16A34A'];
    const barMaxW  = 8.2;
    const barH     = 0.58;
    const startX   = 0.5;
    const startY   = 0.9;
    const gap      = 0.78;

    tipos.forEach((t, i) => {
      const y     = startY + i * (barH + gap);
      const fillW = Math.max(0.06, (t.count / maxCount) * barMaxW);
      const pct   = Math.round((t.count / stats.total) * 100);
      const col   = barColors[i % barColors.length];

      slide.addText(t.tipo, {
        x: startX, y: y - 0.22, w: 8, h: 0.22,
        color: GRIS_OSC, fontSize: 11, bold: true, fontFace: 'Calibri',
      });
      r(slide, startX, y, barMaxW, barH, GRIS_CLAR);
      r(slide, startX, y, fillW, barH, col);

      if (fillW > 0.9) {
        slide.addText(t.count.toLocaleString(), {
          x: startX + 0.14, y, w: fillW - 0.2, h: barH,
          color: BLANCO, fontSize: 12, bold: true, fontFace: 'Calibri',
          align: 'left', valign: 'middle',
        });
      } else {
        slide.addText(t.count.toLocaleString(), {
          x: startX + fillW + 0.1, y, w: 1.5, h: barH,
          color: GRIS_OSC, fontSize: 11, bold: true, fontFace: 'Calibri',
          align: 'left', valign: 'middle',
        });
      }

      r(slide, 9.0, y + 0.09, 0.72, barH - 0.18, col);
      slide.addText(`${pct}%`, {
        x: 9.0, y: y + 0.09, w: 0.72, h: barH - 0.18,
        color: BLANCO, fontSize: 11, bold: true, fontFace: 'Calibri',
        align: 'center', valign: 'middle',
      });
    });
  }

  // SLIDE 5 — PATRONES (condicional)
  if (stats.patrones.length > 0) {
    const slide = pptx.addSlide();
    slide.background = { color: 'FFFBEB' };
    addHeader(slide, 'Patrones Detectados — Sanciones Repetidas');
    addFooter(slide);

    const patrones = stats.patrones.slice(0, 15);
    const thY = 0.72;
    const thH = 0.27;
    r(slide, 0.3, thY, 12.73, thH, AMBAR);

    type Align = 'left' | 'center' | 'right';
    const cols: { label: string; x: number; w: number; align: Align }[] = [
      { label: '#',             x: 0.30,  w: 0.52, align: 'center' },
      { label: 'Funcionario',   x: 0.84,  w: 5.5,  align: 'left'   },
      { label: 'Tipo sanción',  x: 6.38,  w: 5.5,  align: 'left'   },
      { label: 'Veces',         x: 11.92, w: 1.0,  align: 'center' },
    ];

    cols.forEach(c =>
      slide.addText(c.label, {
        x: c.x, y: thY + 0.02, w: c.w, h: thH - 0.04,
        color: BLANCO, fontSize: 7.5, bold: true, fontFace: 'Calibri',
        align: c.align, valign: 'middle',
      })
    );

    const rowH = 0.39;
    patrones.forEach((p, ri) => {
      const y     = thY + thH + ri * rowH;
      const rowBg = ri % 2 === 0 ? BLANCO : 'FFFBEB';
      r(slide, 0.30, y, 12.73, rowH, rowBg);
      r(slide, 0.30, y + rowH - 0.01, 12.73, 0.01, 'E2E8F0');
      slide.addText(`${ri + 1}`, {
        x: cols[0].x, y, w: cols[0].w, h: rowH,
        color: GRIS_MED, fontSize: 8.5, fontFace: 'Calibri', align: 'center', valign: 'middle',
      });
      slide.addText(p.nombre, {
        x: cols[1].x, y, w: cols[1].w, h: rowH,
        color: GRIS_OSC, fontSize: 9, bold: true, fontFace: 'Calibri', align: 'left', valign: 'middle',
      });
      slide.addText(p.tipo, {
        x: cols[2].x, y, w: cols[2].w, h: rowH,
        color: GRIS_MED, fontSize: 9, fontFace: 'Calibri', align: 'left', valign: 'middle',
      });
      r(slide, cols[3].x, y + 0.05, 1.0, rowH - 0.1, AMBAR);
      slide.addText(`${p.count}x`, {
        x: cols[3].x, y: y + 0.05, w: 1.0, h: rowH - 0.1,
        color: BLANCO, fontSize: 10, bold: true, fontFace: 'Calibri', align: 'center', valign: 'middle',
      });
    });
  }

  // SLIDE FINAL — CIERRE
  {
    const slide = pptx.addSlide();
    slide.background = { color: AZUL_OSC };
    addPortadaSidebar(slide, [
      { label: 'TOTAL SANCIONES', value: stats.total.toLocaleString()          },
      { label: 'FUNCIONARIOS',    value: stats.byFuncionario.length.toString() },
      { label: 'TIPOS',          value: stats.byTipo.length.toString()         },
    ]);
    slide.addText('GRACIAS', {
      x: 4.45, y: 1.7, w: 8.6, h: 1.45,
      color: BLANCO, fontSize: 64, bold: true, fontFace: 'Calibri',
    });
    r(slide, 4.45, 3.05, 4.8, 0.06, ROJO);
    slide.addText(`Informe de Sanciones — ${config.nombreEmpresa}`, {
      x: 4.45, y: 3.22, w: 8.6, h: 0.46,
      color: AZUL_CLAR, fontSize: 14, fontFace: 'Calibri',
    });
    slide.addText(`Generado el ${fechaGen}`, {
      x: 4.45, y: H - 0.5, w: 8.6, h: 0.32,
      color: GRIS_MED, fontSize: 9, fontFace: 'Calibri',
    });
    r(slide, 4.07, H - 0.18, W - 4.07, 0.18, AZUL_MED);
  }

  await pptx.writeFile({ fileName: `Sanciones_${fechaGen.replace(/\//g, '-')}.pptx` });
}
