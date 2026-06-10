import PptxGenJS from 'pptxgenjs';
import type { VentasStats } from './VentasModule';
import type { AppConfig } from '../../types';

// ── Paleta Antel / Elared ─────────────────────────────────────────────────────
const AZUL_OSCURO = '003DA5';
const AZUL_MEDIO  = '0052CC';
const AZUL_CLARO  = 'DBEAFE';
const ROJO        = 'E3000F';
const BLANCO      = 'FFFFFF';
const GRIS_OSCURO = '1E293B';
const GRIS_MEDIO  = '64748B';
const GRIS_CLARO  = 'F1F5F9';
const ORO         = 'F59E0B';
const VERDE       = '16A34A';

// Slide dimensions — LAYOUT_WIDE
const W = 13.33;
const H = 7.5;

// ── Utilidades ────────────────────────────────────────────────────────────────

function getMesAno(iso: string): string {
  if (!iso) return '';
  const [y, m] = iso.split('-');
  const meses = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  return `${meses[parseInt(m)]} ${y}`;
}

function pct(a: number, b: number): string {
  return b > 0 ? `${Math.round((a / b) * 100)}%` : '0%';
}

// ── Export principal ──────────────────────────────────────────────────────────

export function exportVentasPptx(
  stats: VentasStats,
  config: AppConfig,
  empresaActiva = 'Todas',
): void {
  const pptx = new PptxGenJS();
  pptx.layout  = 'LAYOUT_WIDE';
  pptx.author  = config.nombreEmpresa;
  pptx.company = config.nombreEmpresa;
  pptx.title   = 'Reporte de Ventas';

  type PptxSlide = ReturnType<typeof pptx.addSlide>;

  const fechaGen    = new Date().toLocaleDateString('es-UY');
  const periodo     = stats.fechaMin
    ? `${getMesAno(stats.fechaMin)} – ${getMesAno(stats.fechaMax)}`
    : fechaGen;
  const footerLabel = empresaActiva !== 'Todas'
    ? `${config.nombreEmpresa} · ${empresaActiva}`
    : config.nombreEmpresa;

  // ── Helpers con closure sobre pptx ──────────────────────────────────────

  function r(
    slide: PptxSlide,
    x: number, y: number, w: number, h: number,
    color: string,
  ) {
    slide.addShape(pptx.ShapeType.rect, {
      x, y, w, h,
      fill: { color },
      line: { color },
    });
  }

  function addSlideHeader(slide: PptxSlide, titulo: string) {
    r(slide, 0, 0, W, 0.58, AZUL_OSCURO);
    r(slide, 0, 0.58, W, 0.04, ROJO);
    slide.addText(titulo, {
      x: 0.35, y: 0.07, w: 9.6, h: 0.46,
      color: BLANCO, fontSize: 17, bold: true, fontFace: 'Calibri', valign: 'middle',
    });
    slide.addText(footerLabel, {
      x: 10.0, y: 0.08, w: 3.05, h: 0.44,
      color: AZUL_CLARO, fontSize: 9, align: 'right', fontFace: 'Calibri', valign: 'middle',
    });
  }

  function addSlideFooter(slide: PptxSlide) {
    r(slide, 0, 7.35, W, 0.15, 'E2E8F0');
    slide.addText(`Generado el ${fechaGen}  ·  Elared Report System  ·  ${periodo}`, {
      x: 0.3, y: 7.36, w: 12.7, h: 0.12,
      color: GRIS_MEDIO, fontSize: 7, fontFace: 'Calibri', valign: 'middle',
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
    r(slide, 0.35, 1.06, 2.8, 0.04, AZUL_MEDIO);
    kpis.forEach((k, i) => {
      const y = 1.35 + i * 1.4;
      slide.addText(k.label, {
        x: 0.35, y, w: 3.25, h: 0.27,
        color: AZUL_CLARO, fontSize: 8, bold: true, fontFace: 'Calibri', charSpacing: 1.5,
      });
      slide.addText(k.value, {
        x: 0.35, y: y + 0.26, w: 3.25, h: 0.8,
        color: BLANCO, fontSize: 20, bold: true, fontFace: 'Calibri',
      });
    });
    r(slide, 0, H - 0.18, 4.0, 0.18, ROJO);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // SLIDE 1 — PORTADA
  // ──────────────────────────────────────────────────────────────────────────
  {
    const slide = pptx.addSlide();
    slide.background = { color: AZUL_OSCURO };

    addPortadaSidebar(slide, [
      { label: 'GESTIONES TOTALES', value: stats.total.toLocaleString()     },
      { label: 'VENDEDORES',        value: stats.totalVendedores.toString() },
      { label: 'DÍAS CON DATOS',    value: stats.diasConDatos.toString()    },
      {
        label: stats.hasEstado && stats.tasaRechazoEquipo !== null ? 'TASA RECHAZO' : 'PLANES DISTINTOS',
        value: stats.hasEstado && stats.tasaRechazoEquipo !== null
          ? `${stats.tasaRechazoEquipo.toFixed(1)}%`
          : stats.planesDistintos.toString(),
      },
    ]);

    slide.addText('REPORTE DE', {
      x: 4.45, y: 1.55, w: 8.6, h: 0.5,
      color: AZUL_CLARO, fontSize: 15, fontFace: 'Calibri', charSpacing: 4.5,
    });
    slide.addText('VENTAS', {
      x: 4.45, y: 1.95, w: 8.6, h: 1.55,
      color: BLANCO, fontSize: 68, bold: true, fontFace: 'Calibri',
    });

    r(slide, 4.45, 3.42, 5.5, 0.06, ROJO);

    r(slide, 4.45, 3.62, 3.7, 0.44, ROJO);
    slide.addText(periodo, {
      x: 4.45, y: 3.63, w: 3.7, h: 0.42,
      color: BLANCO, fontSize: 12, bold: true, fontFace: 'Calibri',
      align: 'center', valign: 'middle',
    });

    if (empresaActiva !== 'Todas') {
      r(slide, 4.45, 4.18, 3.7, 0.38, AZUL_MEDIO);
      slide.addText(empresaActiva, {
        x: 4.45, y: 4.19, w: 3.7, h: 0.36,
        color: BLANCO, fontSize: 11, fontFace: 'Calibri',
        align: 'center', valign: 'middle',
      });
    }

    slide.addText(`Generado: ${fechaGen}`, {
      x: 4.45, y: H - 0.5, w: 8.6, h: 0.32,
      color: GRIS_MEDIO, fontSize: 9, fontFace: 'Calibri',
    });
    r(slide, 4.07, H - 0.18, W - 4.07, 0.18, AZUL_MEDIO);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // SLIDE 2 — KPIs PRINCIPALES (2×2)
  // ──────────────────────────────────────────────────────────────────────────
  {
    const slide = pptx.addSlide();
    slide.background = { color: 'F8FAFC' };
    addSlideHeader(slide, 'Indicadores Clave de Gestión');
    addSlideFooter(slide);

    const cards = [
      { label: 'TOTAL GESTIONES', value: stats.total.toLocaleString(),       sub: `Período: ${periodo}`,              accent: AZUL_OSCURO, valColor: AZUL_OSCURO },
      { label: 'RENOVACIONES',    value: stats.renovaciones.toLocaleString(), sub: `${pct(stats.renovaciones, stats.total)} del total`, accent: AZUL_MEDIO,  valColor: GRIS_OSCURO },
      { label: 'ALTAS NUEVAS',    value: stats.altas.toLocaleString(),        sub: `${pct(stats.altas, stats.total)} del total`,        accent: VERDE,       valColor: GRIS_OSCURO },
      { label: 'CAMBIOS DE PLAN', value: stats.cambios.toLocaleString(),      sub: `${pct(stats.cambios, stats.total)} del total`,      accent: ROJO,        valColor: GRIS_OSCURO },
    ];

    cards.forEach((c, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x   = 0.4 + col * 6.5;
      const y   = 0.82 + row * 3.1;
      const cw  = 6.1;
      const ch  = 2.85;

      r(slide, x + 0.04, y + 0.04, cw, ch, 'E2E8F0');
      r(slide, x, y, cw, ch, BLANCO);
      r(slide, x, y, 0.07, ch, c.accent);

      slide.addText(c.label, {
        x: x + 0.2, y: y + 0.24, w: cw - 0.28, h: 0.32,
        color: GRIS_MEDIO, fontSize: 9, bold: true, fontFace: 'Calibri', charSpacing: 2,
      });
      slide.addText(c.value, {
        x: x + 0.2, y: y + 0.52, w: cw - 0.28, h: 1.55,
        color: c.valColor, fontSize: 48, bold: true, fontFace: 'Calibri',
      });
      slide.addText(c.sub, {
        x: x + 0.2, y: y + 2.38, w: cw - 0.28, h: 0.3,
        color: GRIS_MEDIO, fontSize: 9, fontFace: 'Calibri',
      });
      r(slide, x, y + ch - 0.05, cw, 0.05, c.accent);
    });

    slide.addText(
      `Mejor vendedor: ${stats.mejor}  ·  Promedio diario: ${Math.round(stats.promedio).toLocaleString()}  ·  Vendedores activos: ${stats.totalVendedores}`,
      {
        x: 0.4, y: 7.1, w: W - 0.8, h: 0.2,
        color: GRIS_MEDIO, fontSize: 8, fontFace: 'Calibri', align: 'center',
      },
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // SLIDE 2b — KPIs DE ESTADO (condicional)
  // ──────────────────────────────────────────────────────────────────────────
  if (stats.hasEstado && stats.estadoKpis) {
    const { estadoKpis } = stats;
    const slide = pptx.addSlide();
    slide.background = { color: 'F8FAFC' };
    addSlideHeader(slide, 'Calidad de Ventas — Estado');
    addSlideFooter(slide);

    const tasaSub = stats.tasaRechazoEquipo !== null
      ? `Tasa equipo: ${stats.tasaRechazoEquipo.toFixed(1)}%`
      : `${estadoKpis.rechazoPct}% del total`;

    const estCards = [
      { label: 'VENDIDOS',      value: estadoKpis.vendido.toLocaleString(), sub: `${estadoKpis.vendidoPct}% del total`, accent: VERDE,       valColor: VERDE       },
      { label: 'EN CONTROL',    value: estadoKpis.control.toLocaleString(), sub: pct(estadoKpis.control, stats.total),  accent: AZUL_OSCURO, valColor: GRIS_OSCURO  },
      { label: 'A ACTIVAR',     value: estadoKpis.activar.toLocaleString(), sub: pct(estadoKpis.activar, stats.total),  accent: ORO,         valColor: GRIS_OSCURO  },
      { label: 'RECHAZOS',      value: estadoKpis.rechazo.toLocaleString(), sub: tasaSub,                               accent: ROJO,        valColor: ROJO         },
    ];

    estCards.forEach((c, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x   = 0.4 + col * 6.5;
      const y   = 0.82 + row * 3.1;
      const cw  = 6.1;
      const ch  = 2.85;

      r(slide, x + 0.04, y + 0.04, cw, ch, 'E2E8F0');
      r(slide, x, y, cw, ch, BLANCO);
      r(slide, x, y, 0.07, ch, c.accent);
      slide.addText(c.label, {
        x: x + 0.2, y: y + 0.24, w: cw - 0.28, h: 0.32,
        color: GRIS_MEDIO, fontSize: 9, bold: true, fontFace: 'Calibri', charSpacing: 2,
      });
      slide.addText(c.value, {
        x: x + 0.2, y: y + 0.52, w: cw - 0.28, h: 1.55,
        color: c.valColor, fontSize: 48, bold: true, fontFace: 'Calibri',
      });
      slide.addText(c.sub, {
        x: x + 0.2, y: y + 2.38, w: cw - 0.28, h: 0.3,
        color: GRIS_MEDIO, fontSize: 9, fontFace: 'Calibri',
      });
      r(slide, x, y + ch - 0.05, cw, 0.05, c.accent);
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // SLIDE 3 — RANKING TOP 10 (badges + progress bars)
  // ──────────────────────────────────────────────────────────────────────────
  {
    const slide = pptx.addSlide();
    slide.background = { color: BLANCO };
    addSlideHeader(slide, 'Ranking de Vendedores — Top 10');
    addSlideFooter(slide);

    const top10    = stats.byFuncionario.slice(0, 10);
    const maxTotal = top10[0]?.total ?? 1;

    const thY = 0.72;
    const thH = 0.27;
    r(slide, 0.3, thY, 12.73, thH, GRIS_OSCURO);

    type Align = 'left' | 'center' | 'right';
    const cols: { label: string; x: number; w: number; align: Align }[] = [
      { label: '#',        x: 0.30,  w: 0.52, align: 'center' },
      { label: 'Vendedor', x: 0.84,  w: 3.65, align: 'left'   },
      { label: 'Total',    x: 4.52,  w: 1.35, align: 'right'  },
      { label: 'Renov.',   x: 5.90,  w: 1.10, align: 'right'  },
      { label: 'Altas',    x: 7.03,  w: 1.05, align: 'right'  },
      { label: 'Cambios',  x: 8.11,  w: 1.10, align: 'right'  },
      { label: 'Otros',    x: 9.24,  w: 0.90, align: 'right'  },
      { label: '% Reno.',  x: 10.17, w: 0.95, align: 'right'  },
      { label: '% Altas',  x: 11.15, w: 0.95, align: 'right'  },
      { label: '% Camb.',  x: 12.13, w: 0.90, align: 'right'  },
    ];

    cols.forEach(c =>
      slide.addText(c.label, {
        x: c.x, y: thY + 0.02, w: c.w, h: thH - 0.04,
        color: BLANCO, fontSize: 7.5, bold: true, fontFace: 'Calibri',
        align: c.align, valign: 'middle',
      }),
    );

    const BADGE_CFG = [
      { bg: ORO,      fg: '7A4400' },
      { bg: '9CA3AF', fg: BLANCO   },
      { bg: 'CD7F32', fg: BLANCO   },
    ];

    const rowH    = 0.52;
    const barMaxW = 1.1;

    top10.forEach((f, ri) => {
      const y     = thY + thH + ri * rowH;
      const rowBg = ri === 0 ? 'FFFCE8' : ri === 1 ? 'F8FAFC' : ri === 2 ? 'FFF5EC' : ri % 2 === 0 ? BLANCO : 'F8FAFC';

      r(slide, 0.30, y, 12.73, rowH, rowBg);
      r(slide, 0.30, y + rowH - 0.01, 12.73, 0.01, 'E2E8F0');

      if (ri < 3) {
        const bc = BADGE_CFG[ri];
        r(slide, 0.38, y + 0.09, 0.34, 0.34, bc.bg);
        slide.addText(`${ri + 1}°`, {
          x: 0.38, y: y + 0.09, w: 0.34, h: 0.34,
          color: bc.fg, fontSize: 8, bold: true, fontFace: 'Calibri',
          align: 'center', valign: 'middle',
        });
      } else {
        slide.addText(`${ri + 1}`, {
          x: cols[0].x, y, w: cols[0].w, h: rowH,
          color: GRIS_MEDIO, fontSize: 8.5, fontFace: 'Calibri',
          align: 'center', valign: 'middle',
        });
      }

      slide.addText(f.nombre, {
        x: cols[1].x, y, w: cols[1].w, h: rowH,
        color: GRIS_OSCURO, fontSize: 9, bold: ri < 3, fontFace: 'Calibri',
        align: 'left', valign: 'middle',
      });

      // Total + mini progress bar
      const barW = Math.max(0.04, (f.total / maxTotal) * barMaxW);
      const barY = y + rowH * 0.62;
      r(slide, cols[2].x, barY, barMaxW, 0.1, 'E2E8F0');
      r(slide, cols[2].x, barY, barW, 0.1, ri === 0 ? ROJO : AZUL_OSCURO);
      slide.addText(f.total.toLocaleString(), {
        x: cols[2].x, y, w: cols[2].w, h: rowH * 0.6,
        color: ri === 0 ? ROJO : GRIS_OSCURO,
        fontSize: 9, bold: true, fontFace: 'Calibri',
        align: 'right', valign: 'bottom',
      });

      [f.renovaciones, f.altas, f.cambios, f.otros].forEach((val, ci) => {
        slide.addText(val.toLocaleString(), {
          x: cols[3 + ci].x, y, w: cols[3 + ci].w, h: rowH,
          color: GRIS_MEDIO, fontSize: 8.5, fontFace: 'Calibri',
          align: 'right', valign: 'middle',
        });
      });

      const pReno  = f.total > 0 ? Math.round((f.renovaciones / f.total) * 100) : 0;
      const pAltas = f.total > 0 ? Math.round((f.altas / f.total) * 100) : 0;
      const pCamb  = f.total > 0 ? Math.round((f.cambios / f.total) * 100) : 0;

      [
        { col: cols[7], v: pReno  },
        { col: cols[8], v: pAltas },
        { col: cols[9], v: pCamb  },
      ].forEach(({ col, v }) =>
        slide.addText(`${v}%`, {
          x: col.x, y, w: col.w, h: rowH,
          color: v >= 50 ? VERDE : GRIS_MEDIO,
          fontSize: 8.5, fontFace: 'Calibri',
          align: 'right', valign: 'middle',
        }),
      );
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // SLIDE 4 — DISTRIBUCIÓN POR TIPO (barras horizontales proporcionales)
  // ──────────────────────────────────────────────────────────────────────────
  {
    const slide = pptx.addSlide();
    slide.background = { color: BLANCO };
    addSlideHeader(slide, 'Distribución por Tipo de Gestión');
    addSlideFooter(slide);

    const motivos   = stats.byMotivo.slice(0, 6);
    const maxCount  = Math.max(...motivos.map(m => m.count), 1);
    const barColors = [AZUL_OSCURO, ROJO, VERDE, '0EA5E9', ORO, GRIS_MEDIO];
    const barMaxW   = 8.2;
    const barH      = 0.58;
    const startX    = 0.5;
    const startY    = 0.9;
    const gap       = 0.83;

    slide.addText('Cantidad y porcentaje de cada tipo sobre el total de gestiones', {
      x: startX, y: startY - 0.2, w: 10, h: 0.18,
      color: GRIS_MEDIO, fontSize: 8, fontFace: 'Calibri',
    });

    motivos.forEach((m, i) => {
      const y      = startY + i * (barH + gap);
      const fillW  = Math.max(0.06, (m.count / maxCount) * barMaxW);
      const pctVal = Math.round((m.count / stats.total) * 100);
      const col    = barColors[i % barColors.length];

      slide.addText(m.motivo, {
        x: startX, y: y - 0.22, w: 7, h: 0.22,
        color: GRIS_OSCURO, fontSize: 11, bold: true, fontFace: 'Calibri',
      });

      r(slide, startX, y, barMaxW, barH, GRIS_CLARO);
      r(slide, startX, y, fillW, barH, col);

      if (fillW > 0.9) {
        slide.addText(m.count.toLocaleString(), {
          x: startX + 0.14, y, w: fillW - 0.2, h: barH,
          color: BLANCO, fontSize: 12, bold: true, fontFace: 'Calibri',
          align: 'left', valign: 'middle',
        });
      } else {
        slide.addText(m.count.toLocaleString(), {
          x: startX + fillW + 0.1, y, w: 1.5, h: barH,
          color: GRIS_OSCURO, fontSize: 11, bold: true, fontFace: 'Calibri',
          align: 'left', valign: 'middle',
        });
      }

      r(slide, 9.0, y + 0.09, 0.72, barH - 0.18, col);
      slide.addText(`${pctVal}%`, {
        x: 9.0, y: y + 0.09, w: 0.72, h: barH - 0.18,
        color: BLANCO, fontSize: 11, bold: true, fontFace: 'Calibri',
        align: 'center', valign: 'middle',
      });

      slide.addText(m.count.toLocaleString(), {
        x: 9.84, y, w: 1.5, h: barH,
        color: GRIS_MEDIO, fontSize: 10, fontFace: 'Calibri',
        align: 'left', valign: 'middle',
      });
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // SLIDE 5 — TOP PLANES VENDIDOS (barras horizontales proporcionales)
  // ──────────────────────────────────────────────────────────────────────────
  {
    const slide = pptx.addSlide();
    slide.background = { color: BLANCO };
    addSlideHeader(slide, 'Top Planes Más Vendidos');
    addSlideFooter(slide);

    const planes    = stats.byPlan.slice(0, 8);
    const maxVentas = Math.max(...planes.map(p => p.ventas), 1);
    const barMaxW   = 7.5;
    const barH      = 0.46;
    const startX    = 0.5;
    const startY    = 0.86;
    const gap       = 0.62;
    const colores   = [AZUL_OSCURO, AZUL_MEDIO, '0066CC', '0080FF', '3399FF', '66B2FF', '99CCFF', AZUL_CLARO];

    planes.forEach((p, i) => {
      const y      = startY + i * (barH + gap);
      const fillW  = Math.max(0.06, (p.ventas / maxVentas) * barMaxW);
      const pctVal = Math.round((p.ventas / stats.total) * 100);
      const col    = colores[i % colores.length];
      const nombre = p.nombre.length > 38 ? p.nombre.slice(0, 37) + '…' : p.nombre;

      slide.addText(nombre, {
        x: startX, y: y - 0.2, w: 8.5, h: 0.21,
        color: GRIS_OSCURO, fontSize: 9, bold: i < 3, fontFace: 'Calibri',
      });

      r(slide, startX, y, barMaxW, barH, GRIS_CLARO);
      r(slide, startX, y, fillW, barH, col);

      if (fillW > 0.7) {
        slide.addText(p.ventas.toLocaleString(), {
          x: startX + fillW - 0.85, y, w: 0.8, h: barH,
          color: BLANCO, fontSize: 9, bold: true, fontFace: 'Calibri',
          align: 'right', valign: 'middle',
        });
      } else {
        slide.addText(p.ventas.toLocaleString(), {
          x: startX + fillW + 0.08, y, w: 1.0, h: barH,
          color: GRIS_OSCURO, fontSize: 9, bold: true, fontFace: 'Calibri',
          align: 'left', valign: 'middle',
        });
      }

      slide.addText(`${pctVal}%`, {
        x: 8.2, y, w: 0.7, h: barH,
        color: col, fontSize: 9, bold: true, fontFace: 'Calibri',
        align: 'right', valign: 'middle',
      });
    });

    if (stats.byPlan.length > 8) {
      slide.addText(`+ ${stats.byPlan.length - 8} planes adicionales`, {
        x: startX, y: 7.1, w: 6, h: 0.18,
        color: GRIS_MEDIO, fontSize: 8, fontFace: 'Calibri',
      });
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // SLIDE 6 — COMPOSICIÓN STACKED POR VENDEDOR (top 10, horizontal)
  // ──────────────────────────────────────────────────────────────────────────
  {
    const slide = pptx.addSlide();
    slide.background = { color: BLANCO };
    addSlideHeader(slide, 'Composición de Gestiones por Vendedor — Top 10');
    addSlideFooter(slide);

    const top10    = stats.byFuncionario.slice(0, 10);
    const maxTotal = Math.max(...top10.map(f => f.total), 1);
    const barMaxW  = 7.8;
    const barH     = 0.3;
    const rowH     = 0.55;
    const nameW    = 2.7;
    const barX     = 3.15;
    const startY   = 0.82;

    const segments = [
      { key: 'renovaciones' as const, label: 'Renovación',  color: AZUL_OSCURO },
      { key: 'altas'        as const, label: 'Alta Nueva',  color: VERDE       },
      { key: 'cambios'      as const, label: 'Cambio Plan', color: ROJO        },
      { key: 'otros'        as const, label: 'Otros',       color: GRIS_MEDIO  },
    ];

    // Legend
    segments.forEach((seg, i) => {
      const lx = 0.5 + i * 2.9;
      r(slide, lx, startY - 0.28, 0.14, 0.14, seg.color);
      slide.addText(seg.label, {
        x: lx + 0.19, y: startY - 0.31, w: 2.6, h: 0.2,
        color: GRIS_OSCURO, fontSize: 8, fontFace: 'Calibri',
      });
    });

    top10.forEach((f, i) => {
      const y     = startY + i * rowH;
      const rowBg = i % 2 === 0 ? BLANCO : GRIS_CLARO;

      r(slide, 0.30, y - 0.03, 12.73, rowH, rowBg);
      r(slide, 0.30, y + rowH - 0.04, 12.73, 0.01, 'E2E8F0');

      const shortName = f.nombre.split(' ').slice(0, 2).join(' ');
      slide.addText(shortName, {
        x: 0.35, y: y - 0.03, w: nameW, h: rowH,
        color: GRIS_OSCURO, fontSize: 9, fontFace: 'Calibri',
        align: 'left', valign: 'middle',
      });

      slide.addText(f.total.toLocaleString(), {
        x: nameW + 0.1, y: y - 0.03, w: 0.6, h: rowH,
        color: AZUL_OSCURO, fontSize: 8, bold: true, fontFace: 'Calibri',
        align: 'right', valign: 'middle',
      });

      const barYc = y + (rowH - barH) / 2 - 0.03;
      r(slide, barX, barYc, barMaxW, barH, 'E2E8F0');

      let curX = barX;
      segments.forEach(seg => {
        const val  = f[seg.key];
        const segW = (val / maxTotal) * barMaxW;
        if (segW > 0.02) {
          r(slide, curX, barYc, segW, barH, seg.color);
          curX += segW;
        }
      });

      slide.addText(`${pct(f.renovaciones, f.total)} reno.`, {
        x: barX + barMaxW + 0.1, y: y - 0.03, w: 1.5, h: rowH,
        color: GRIS_MEDIO, fontSize: 7.5, fontFace: 'Calibri', valign: 'middle',
      });
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // SLIDES 7–8 — TABLA COMPLETA DE VENDEDORES (paginada, max 2 slides)
  // ──────────────────────────────────────────────────────────────────────────
  const ROWS_PER_SLIDE = 19;
  const tableSlides    = Math.min(Math.ceil(stats.byFuncionario.length / ROWS_PER_SLIDE), 2);

  for (let si = 0; si < tableSlides; si++) {
    const slide    = pptx.addSlide();
    const rowSlice = stats.byFuncionario.slice(si * ROWS_PER_SLIDE, (si + 1) * ROWS_PER_SLIDE);
    const startI   = si * ROWS_PER_SLIDE;

    slide.background = { color: BLANCO };
    const titulo = tableSlides > 1
      ? `Performance Completa de Vendedores (${si + 1}/${tableSlides})`
      : 'Performance Completa de Vendedores';
    addSlideHeader(slide, titulo);
    addSlideFooter(slide);

    const thY = 0.72;
    const thH = 0.24;
    r(slide, 0.3, thY, 12.73, thH, GRIS_OSCURO);

    type ColDef = { label: string; x: number; w: number; align: 'left' | 'center' | 'right' };
    const cols: ColDef[] = [
      { label: '#',        x: 0.30,  w: 0.40,  align: 'center' },
      { label: 'Vendedor', x: 0.72,  w: 3.75,  align: 'left'   },
      { label: 'Total',    x: 4.50,  w: 1.05,  align: 'right'  },
      { label: 'Reno.',    x: 5.58,  w: 1.00,  align: 'right'  },
      { label: 'Altas',    x: 6.61,  w: 0.95,  align: 'right'  },
      { label: 'Cambios',  x: 7.59,  w: 1.05,  align: 'right'  },
      { label: 'Otros',    x: 8.67,  w: 0.88,  align: 'right'  },
      { label: '% Reno.',  x: 9.58,  w: 0.95,  align: 'right'  },
      { label: '% Altas',  x: 10.56, w: 0.92,  align: 'right'  },
      { label: '% Camb.',  x: 11.51, w: 0.92,  align: 'right'  },
      { label: 'Prom./d.', x: 12.46, w: 0.57,  align: 'right'  },
    ];

    cols.forEach(c =>
      slide.addText(c.label, {
        x: c.x, y: thY, w: c.w, h: thH,
        color: BLANCO, fontSize: 7, bold: true, fontFace: 'Calibri',
        align: c.align, valign: 'middle',
      }),
    );

    const availH = 7.32 - (thY + thH);
    const rowH   = availH / ROWS_PER_SLIDE;

    rowSlice.forEach((f, ri) => {
      const absIdx = startI + ri;
      const y      = thY + thH + ri * rowH;
      const rowBg  = absIdx < 3
        ? (absIdx === 0 ? 'FFFCE8' : absIdx === 1 ? 'F8FAFC' : 'FFF5EC')
        : ri % 2 === 0 ? BLANCO : 'F8FAFC';

      r(slide, 0.30, y, 12.73, rowH, rowBg);
      r(slide, 0.30, y + rowH - 0.01, 12.73, 0.01, 'E2E8F0');

      const pReno = f.total > 0 ? Math.round((f.renovaciones / f.total) * 100) : 0;
      const pAlt  = f.total > 0 ? Math.round((f.altas / f.total) * 100) : 0;
      const pCam  = f.total > 0 ? Math.round((f.cambios / f.total) * 100) : 0;
      const promD = stats.diasConDatos > 0 ? (f.total / stats.diasConDatos).toFixed(1) : '—';

      const cells = [
        { c: cols[0],  v: `${absIdx + 1}`,               color: GRIS_MEDIO,  bold: false },
        { c: cols[1],  v: f.nombre,                      color: GRIS_OSCURO, bold: absIdx < 3 },
        { c: cols[2],  v: f.total.toLocaleString(),      color: AZUL_OSCURO, bold: true        },
        { c: cols[3],  v: f.renovaciones.toLocaleString(), color: GRIS_OSCURO, bold: false    },
        { c: cols[4],  v: f.altas.toLocaleString(),      color: GRIS_OSCURO, bold: false       },
        { c: cols[5],  v: f.cambios.toLocaleString(),    color: GRIS_OSCURO, bold: false       },
        { c: cols[6],  v: f.otros.toLocaleString(),      color: GRIS_MEDIO,  bold: false       },
        { c: cols[7],  v: `${pReno}%`, color: pReno >= 50 ? VERDE : GRIS_MEDIO, bold: false    },
        { c: cols[8],  v: `${pAlt}%`,  color: pAlt  >= 50 ? VERDE : GRIS_MEDIO, bold: false    },
        { c: cols[9],  v: `${pCam}%`,  color: GRIS_MEDIO, bold: false                          },
        { c: cols[10], v: String(promD), color: GRIS_MEDIO, bold: false                        },
      ];

      cells.forEach(({ c, v, color, bold }) =>
        slide.addText(v, {
          x: c.x, y, w: c.w, h: rowH,
          color, fontSize: 8, bold, fontFace: 'Calibri',
          align: c.align, valign: 'middle',
        }),
      );
    });

    const shown = Math.min((si + 1) * ROWS_PER_SLIDE, stats.byFuncionario.length);
    slide.addText(
      `Mostrando ${si * ROWS_PER_SLIDE + 1}–${shown} de ${stats.byFuncionario.length} vendedores`,
      {
        x: 0.3, y: 7.14, w: 5, h: 0.17,
        color: GRIS_MEDIO, fontSize: 7, fontFace: 'Calibri',
      },
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // SLIDE FINAL — CIERRE
  // ──────────────────────────────────────────────────────────────────────────
  {
    const slide = pptx.addSlide();
    slide.background = { color: AZUL_OSCURO };

    addPortadaSidebar(slide, [
      { label: 'TOTAL GESTIONES', value: stats.total.toLocaleString() },
      { label: 'MEJOR VENDEDOR',  value: stats.mejor                  },
      { label: 'PERÍODO',         value: periodo                      },
    ]);

    slide.addText('GRACIAS', {
      x: 4.45, y: 1.7, w: 8.6, h: 1.45,
      color: BLANCO, fontSize: 64, bold: true, fontFace: 'Calibri',
    });
    r(slide, 4.45, 3.05, 4.8, 0.06, ROJO);

    slide.addText(`Reporte de Ventas — ${periodo}`, {
      x: 4.45, y: 3.22, w: 8.6, h: 0.46,
      color: AZUL_CLARO, fontSize: 14, fontFace: 'Calibri',
    });
    if (empresaActiva !== 'Todas') {
      slide.addText(empresaActiva, {
        x: 4.45, y: 3.72, w: 8.6, h: 0.38,
        color: 'CBD5E1', fontSize: 13, fontFace: 'Calibri',
      });
    }

    slide.addText(`Generado el ${fechaGen}`, {
      x: 4.45, y: H - 0.5, w: 8.6, h: 0.32,
      color: GRIS_MEDIO, fontSize: 9, fontFace: 'Calibri',
    });
    r(slide, 4.07, H - 0.18, W - 4.07, 0.18, AZUL_MEDIO);
  }

  // ── Guardar ───────────────────────────────────────────────────────────────
  const safePeriodo = periodo.replace(/\s*–\s*/g, '_').replace(/\s+/g, '_');
  const safeName    = [
    empresaActiva !== 'Todas' ? empresaActiva.replace(/[^a-zA-Z0-9]/g, '_') : '',
    safePeriodo.replace(/[^a-zA-Z0-9_]/g, '_'),
  ].filter(Boolean).join('_');

  pptx.writeFile({ fileName: `Ventas_${safeName || 'Reporte'}.pptx` });
}
