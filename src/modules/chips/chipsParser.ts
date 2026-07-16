import * as XLSX from 'xlsx';

// ── Types ─────────────────────────────────────────────────────────────────────

export type ChipResult = {
  empresa: string;
  distribuidor: string;
  idDistribuidor: string;
  pdvNombre: string;
  pdvId: string;
  departamento: string;
  visitas8m: number;
  asignados8m: number;
  activaciones8m: number;
  pct8m: number;
  ritmoReciente: number;
  tieneDatosRecientes: boolean;
  alerta: 'baja' | 'suba' | null;
  alertaPct: number | null;
  ultimaAsignacion: Date | null;
  ultimaQty: number;
  ultimaActivos: number;
  ultimaPct: number;
  estadoVisita: string;
  fechaCambioEstado: Date | null;
  vencimiento: Date | null;
  daysToExpiry: number | null;
  situacion: string;
  situacionLabel: string;
  sugerido: number;
  yaPendiente: boolean;
  comMesActual: number;
};

export type ChipEliminado = {
  nombre: string;
  id: string;
  distribuidor: string;
  empresa: string;
  fechaEliminado: Date;
  asignados8m: number;
  activados8m: number;
};

export type ParseResult = {
  results: ChipResult[];
  detectedDate: Date;
  windowStart: Date;
  windowEnd: Date;
  eliminados: ChipEliminado[];
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function fixMojibake(s: string): string {
  if (typeof s !== 'string') return String(s ?? '');
  if (!/[ÃÂ]/.test(s)) return s;
  try {
    return decodeURIComponent(escape(s));
  } catch {
    return s
      .replace(/Ã³/g, 'ó').replace(/Ã©/g, 'é')
      .replace(/Ã¡/g, 'á').replace(/Ã­/g, 'í')
      .replace(/Ãº/g, 'ú').replace(/Ã±/g, 'ñ')
      .replace(/Ã/g, 'Á');
  }
}

function normalize(s: string): string {
  return fixMojibake(String(s ?? ''))
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}

function findCol(headers: string[], mustInclude: string[], mustExclude: string[] = []): number {
  return headers.findIndex(h => {
    const n = normalize(h);
    return mustInclude.every(m => n.includes(m)) && mustExclude.every(e => !n.includes(e));
  });
}

function cleanMid(v: unknown): string {
  return String(v ?? '').replace(/\D/g, '');
}

function excelDateToJs(v: unknown): Date | null {
  if (v === null || v === undefined || v === '') return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  if (typeof v === 'number') {
    const d = new Date((v - 25569) * 86400 * 1000);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof v === 'string' && v.trim()) {
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function toDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addMonths(d: Date, n: number): Date {
  const r = new Date(d);
  r.setMonth(r.getMonth() + n);
  return r;
}

// ── Main parser ───────────────────────────────────────────────────────────────

export async function parseChips(file: File, overrideDate?: Date): Promise<ParseResult> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true, cellText: false });

  const sheetNames = wb.SheetNames;
  const sheetNorm  = sheetNames.map(n => normalize(n));

  const iActiv  = sheetNorm.findIndex(n => n.includes('activacion'));
  const iComis  = sheetNorm.findIndex(n => n.includes('comision'));
  const iPuntos = sheetNorm.findIndex(n => n.includes('punto'));

  if (iActiv < 0 || iComis < 0 || iPuntos < 0) {
    const missing: string[] = [];
    if (iActiv  < 0) missing.push('activaciones');
    if (iComis  < 0) missing.push('comisiones');
    if (iPuntos < 0) missing.push('puntos de venta');
    throw new Error(
      `No encontré las 3 hojas esperadas (activaciones, comisiones, puntos de venta).\n` +
      `Hojas encontradas: ${sheetNames.join(', ')}\n` +
      `Faltantes: ${missing.join(', ')}`
    );
  }

  // ── Parse COMISIONES ──────────────────────────────────────────────────────

  const wsComis = wb.Sheets[sheetNames[iComis]];
  const comRows = XLSX.utils.sheet_to_json<unknown[]>(wsComis, { header: 1, defval: null, raw: true });

  const midsConComision = new Set<string>();
  const comMidToDate    = new Map<string, Date>();

  for (const row of comRows) {
    if (!Array.isArray(row) || row.length < 2) continue;
    const mid = cleanMid(row[0]);
    if (!mid) continue;

    if (mid.length >= 6) midsConComision.add(mid);

    const fecha = excelDateToJs(row[1]);
    if (fecha) {
      const existing = comMidToDate.get(mid);
      if (!existing || fecha < existing) comMidToDate.set(mid, fecha);
    }
  }

  // ── Parse ACTIVACIONES — detect columns & reference date ──────────────────

  const wsActiv  = wb.Sheets[sheetNames[iActiv]];
  const activRaw = XLSX.utils.sheet_to_json<unknown[]>(wsActiv, { header: 1, defval: null, raw: true });

  if (activRaw.length < 2) throw new Error('La hoja de activaciones está vacía.');

  const activHeaders = (activRaw[0] as unknown[]).map(h => String(h ?? ''));

  const cMid         = findCol(activHeaders, ['mid']);
  const cEmpresa     = findCol(activHeaders, ['empresa']);
  const cIdDist      = findCol(activHeaders, ['id', 'distribuidor']);
  const cNomDist     = findCol(activHeaders, ['nombre', 'distribuidor']);
  const cIdPdv       = findCol(activHeaders, ['id', 'punto', 'venta']);
  const cNomPdvReal  = findCol(activHeaders, ['punto', 'venta'], ['id', 'fecha']);
  const cFechaAsig   = findCol(activHeaders, ['fecha', 'asignacion', 'punto']);
  const cFecha       = cFechaAsig >= 0 ? cFechaAsig : findCol(activHeaders, ['fecha']);
  const cEstadoActiv = findCol(activHeaders, ['estado', 'activacion']);

  // Detect reference date from latest date in activaciones
  let detectedDate = new Date();
  if (!overrideDate) {
    let latestDate: Date | null = null;
    for (let i = 1; i < activRaw.length; i++) {
      const row = activRaw[i] as unknown[];
      if (!row || !row.length || cFecha < 0) continue;
      const f = excelDateToJs(row[cFecha]);
      if (f && (!latestDate || f > latestDate)) latestDate = f;
    }
    if (latestDate) detectedDate = latestDate;
  } else {
    detectedDate = overrideDate;
  }

  const today          = detectedDate;
  const eightMonthsAgo = addMonths(today, -8);
  const twoMonthsAgo   = addMonths(today, -2);
  const d90Ago         = new Date(today.getTime() - 90  * 86400000);
  const d180Ago        = new Date(today.getTime() - 180 * 86400000);

  // ── Parse ACTIVACIONES — aggregate per PdV ────────────────────────────────

  type DeliveryEntry = { date: Date; rows: { mid: string }[] };
  type PdvAgg = {
    empresa: string;
    distribuidor: string;
    idDistribuidor: string;
    pdvNombre: string;
    visitDates: Set<string>;
    asignados: number;
    activaciones: number;
    deliveryMap: Record<string, DeliveryEntry>;
    recent3m: number;
    prev3m: number;
    comMesActual: number;
  };

  const pdvAgg = new Map<string, PdvAgg>();

  for (let i = 1; i < activRaw.length; i++) {
    const row = activRaw[i] as unknown[];
    if (!row || row.length < 2) continue;

    // Solo filas con estado OK
    if (cEstadoActiv >= 0) {
      const est = normalize(String(row[cEstadoActiv] ?? '')).replace(/[^a-z0-9]/g, '');
      if (est !== 'ok') continue;
    }

    const idPdv = String(cIdPdv >= 0 ? (row[cIdPdv] ?? '') : '').trim();
    if (!idPdv) continue;

    const fecha = excelDateToJs(cFecha >= 0 ? row[cFecha] : null);
    if (!fecha || fecha < eightMonthsAgo) continue;

    const mid    = cleanMid(cMid >= 0 ? row[cMid] : null);
    const emp    = String(cEmpresa    >= 0 ? (row[cEmpresa]    ?? '') : '').trim();
    const idDist = String(cIdDist     >= 0 ? (row[cIdDist]     ?? '') : '').trim();
    const nomDist= String(cNomDist    >= 0 ? (row[cNomDist]    ?? '') : '').trim();
    const nomPdv = String(cNomPdvReal >= 0 ? (row[cNomPdvReal] ?? '') : '').trim();

    if (!pdvAgg.has(idPdv)) {
      pdvAgg.set(idPdv, {
        empresa: '', distribuidor: '', idDistribuidor: '', pdvNombre: '',
        visitDates: new Set(), asignados: 0, activaciones: 0,
        deliveryMap: {}, recent3m: 0, prev3m: 0, comMesActual: 0,
      });
    }

    const agg = pdvAgg.get(idPdv)!;

    if (emp)     agg.empresa        = emp;
    if (nomDist) agg.distribuidor   = fixMojibake(nomDist);
    if (idDist)  agg.idDistribuidor = idDist;
    if (nomPdv)  agg.pdvNombre      = fixMojibake(nomPdv);

    const fechaKey = toDateKey(fecha);
    agg.visitDates.add(fechaKey);
    agg.asignados++;

    if (!agg.deliveryMap[fechaKey]) {
      agg.deliveryMap[fechaKey] = { date: fecha, rows: [] };
    }
    agg.deliveryMap[fechaKey].rows.push({ mid });

    if (midsConComision.has(mid)) {
      agg.activaciones++;
      const comDate = comMidToDate.get(mid);
      if (comDate) {
        if (comDate >= d90Ago)               agg.recent3m++;
        else if (comDate >= d180Ago)         agg.prev3m++;
        if (
          comDate.getMonth() === today.getMonth() &&
          comDate.getFullYear() === today.getFullYear()
        ) {
          agg.comMesActual++;
        }
      }
    }
  }

  // ── Parse PUNTOS DE VENTA ─────────────────────────────────────────────────

  const wsPdv  = wb.Sheets[sheetNames[iPuntos]];
  const pdvRaw = XLSX.utils.sheet_to_json<unknown[]>(wsPdv, { header: 1, defval: null, raw: true });

  type PdvInfo = {
    nombre: string; departamento: string;
    estadoVisita: string; fechaCambio: Date | null; vencimiento: Date | null;
    eliminado: Date | null; distribuidorNombre: string;
  };
  const pdvInfo = new Map<string, PdvInfo>();

  if (pdvRaw.length >= 2) {
    const pdvHeaders  = (pdvRaw[0] as unknown[]).map(h => String(h ?? ''));
    const pId         = findCol(pdvHeaders, ['id']);
    const pNombre     = findCol(pdvHeaders, ['nombre']);
    const pDepto      = findCol(pdvHeaders, ['departamento']);
    const pEstVis     = findCol(pdvHeaders, ['estado', 'visita']);
    const pFechaCambio= findCol(pdvHeaders, ['fecha', 'cambio']);
    const pVenc       = findCol(pdvHeaders, ['fecha', 'vencimiento']);
    const pEliminado  = findCol(pdvHeaders, ['eliminado']);
    const pDistribuidorNombre = findColExact(pdvHeaders, 'distribuidor');

    for (let i = 1; i < pdvRaw.length; i++) {
      const row = pdvRaw[i] as unknown[];
      if (!row || !row.length) continue;
      const id = String(pId >= 0 ? (row[pId] ?? '') : '').trim();
      if (!id) continue;

      pdvInfo.set(id, {
        nombre:       fixMojibake(String(pNombre    >= 0 ? (row[pNombre]  ?? '') : '').trim()),
        departamento: fixMojibake(String(pDepto     >= 0 ? (row[pDepto]   ?? '') : '').trim()),
        estadoVisita: fixMojibake(String(pEstVis    >= 0 ? (row[pEstVis]  ?? '') : '').trim()),
        fechaCambio:  excelDateToJs(pFechaCambio >= 0 ? row[pFechaCambio] : null),
        vencimiento:  excelDateToJs(pVenc        >= 0 ? row[pVenc]        : null),
        eliminado:    excelDateToJs(pEliminado   >= 0 ? row[pEliminado]   : null),
        distribuidorNombre: fixMojibake(String(pDistribuidorNombre >= 0 ? (row[pDistribuidorNombre] ?? '') : '').trim()),
      });
    }
  }

  // ── Combine & compute ─────────────────────────────────────────────────────

  const results: ChipResult[] = [];
  const UMBRAL = 3;

  for (const [pdvId, agg] of pdvAgg.entries()) {
    const info = pdvInfo.get(pdvId);
    if (!info) continue; // dado de baja, no aparece en hoja puntos

    const deliveries = Object.values(agg.deliveryMap).sort((a, b) => a.date.getTime() - b.date.getTime());
    const last       = deliveries[deliveries.length - 1] ?? null;

    const pct8m = agg.asignados > 0 ? agg.activaciones / agg.asignados : 0;

    // Remanente (chips sin activar en últimos 2 meses)
    let remaining = 0;
    const recentDels = deliveries.filter(d => d.date >= twoMonthsAgo);
    if (recentDels.length > 0) {
      for (const d of recentDels) {
        const act = d.rows.filter(r => midsConComision.has(r.mid)).length;
        remaining += Math.max(0, d.rows.length - act);
      }
    } else if (last) {
      const lastAct = last.rows.filter(r => midsConComision.has(r.mid)).length;
      remaining = Math.max(0, last.rows.length - lastAct);
    }

    // Ritmo mensual
    const tieneDatosRecientes = (agg.recent3m + agg.prev3m) > 0;
    const monthlyRate = tieneDatosRecientes ? agg.recent3m / 3 : agg.activaciones / 8;

    // Alerta tendencia
    let alerta:   'baja' | 'suba' | null = null;
    let alertaPct: number | null         = null;
    if ((agg.recent3m + agg.prev3m) >= UMBRAL) {
      if (agg.prev3m > 0) {
        alertaPct = (agg.recent3m - agg.prev3m) / agg.prev3m;
        if (alertaPct <= -0.45) alerta = 'baja';
        else if (alertaPct >= 0.45) alerta = 'suba';
      } else if (agg.recent3m >= UMBRAL) {
        alerta = 'suba';
        alertaPct = null;
      }
    }

    // Última delivery
    const ultimaAsignacion = last?.date ?? null;
    const ultimaQty        = last?.rows.length ?? 0;
    const ultimaActivos    = last ? last.rows.filter(r => midsConComision.has(r.mid)).length : 0;
    const ultimaPct        = ultimaQty > 0 ? ultimaActivos / ultimaQty : 0;

    // Días hasta vencimiento
    const daysToExpiry = info.vencimiento
      ? Math.round((info.vencimiento.getTime() - today.getTime()) / 86400000)
      : null;

    // Necesita chequeo
    const esBueno            = pct8m >= 0.6 && monthlyRate >= 3;
    const diasSinCambio      = info.fechaCambio
      ? Math.round((today.getTime() - info.fechaCambio.getTime()) / 86400000)
      : 999;
    const necesitaChequeo = esBueno && diasSinCambio > 30;

    // Situación
    let situacion: string;
    let situacionLabel: string;
    let sugerido: number;

    if (daysToExpiry !== null && daysToExpiry <= 30) {
      const sinActConf  = agg.visitDates.size > 2  && ultimaActivos === 0;
      const sinActPrueba= agg.visitDates.size <= 2 && ultimaActivos === 0;
      const vencLabel   = daysToExpiry < 0 ? 'Vencido' : `Vence en ${daysToExpiry}d`;

      if (sinActConf) {
        sugerido       = 0;
        situacion      = 'expired_noact';
        situacionLabel = `${vencLabel} — sin actividad`;
      } else if (sinActPrueba) {
        sugerido       = 5;
        situacion      = 'expiring';
        situacionLabel = `${vencLabel} — a prueba (lote mínimo)`;
      } else {
        sugerido  = Math.max(5, Math.ceil(ultimaActivos / 5) * 5);
        situacion = daysToExpiry < 0 ? 'expired' : 'expiring';
        situacionLabel = daysToExpiry < 0 ? 'Vencido' : `Vence en ${daysToExpiry}d`;
      }
    } else {
      const proj = monthlyRate * 2 - remaining;
      if (proj > 0) {
        sugerido       = Math.ceil(proj / 5) * 5;
        situacion      = 'amber-plain';
        situacionLabel = 'Reposición';
      } else if (necesitaChequeo) {
        sugerido       = 0;
        situacion      = 'checkup';
        situacionLabel = 'Visitar (chequeo)';
      } else {
        sugerido       = 0;
        situacion      = 'ok';
        situacionLabel = 'Stock OK';
      }
    }

    const yaPendiente = normalize(info.estadoVisita) === 'pendiente';
    if (yaPendiente) situacionLabel = 'Visita pendiente';

    results.push({
      empresa: agg.empresa, distribuidor: agg.distribuidor,
      idDistribuidor: agg.idDistribuidor,
      pdvNombre: agg.pdvNombre || info.nombre, pdvId,
      departamento: info.departamento,
      visitas8m: agg.visitDates.size,
      asignados8m: agg.asignados, activaciones8m: agg.activaciones,
      pct8m, ritmoReciente: monthlyRate, tieneDatosRecientes,
      alerta, alertaPct,
      ultimaAsignacion, ultimaQty, ultimaActivos, ultimaPct,
      estadoVisita: info.estadoVisita, fechaCambioEstado: info.fechaCambio,
      vencimiento: info.vencimiento, daysToExpiry,
      situacion, situacionLabel, sugerido, yaPendiente,
      comMesActual: agg.comMesActual,
    });
  }

  results.sort((a, b) => b.sugerido - a.sugerido || b.activaciones8m - a.activaciones8m);

  // Mapa nombre distribuidor → empresa
  const nombreDistribuidorToEmpresa: Record<string, string> = {};
  for (let i = 1; i < activRaw.length; i++) {
    const row = activRaw[i] as unknown[];
    if (!row || !row.length) continue;
    const nomDist = String(cNomDist >= 0 ? (row[cNomDist] ?? '') : '').trim();
    const emp     = String(cEmpresa >= 0 ? (row[cEmpresa] ?? '') : '').trim();
    if (nomDist && emp) {
      nombreDistribuidorToEmpresa[normalize(fixMojibake(nomDist))] = emp;
    }
  }

  // Puntos eliminados dentro de la ventana de 8 meses
  const eliminados: ChipEliminado[] = [];
  for (const [id, info] of pdvInfo.entries()) {
    if (
      info.eliminado &&
      info.eliminado >= eightMonthsAgo &&
      info.eliminado <= today
    ) {
      const agg = pdvAgg.get(id);
      eliminados.push({
        nombre: info.nombre,
        id,
        distribuidor: info.distribuidorNombre,
        empresa: nombreDistribuidorToEmpresa[normalize(info.distribuidorNombre)] || '',
        fechaEliminado: info.eliminado,
        asignados8m: agg ? agg.asignados : 0,
        activados8m: agg ? agg.activaciones : 0,
      });
    }
  }

  return {
    results,
    detectedDate,
    windowStart: eightMonthsAgo,
    windowEnd:   today,
    eliminados,
  };
}

// ── Tab 2: Desempeño de distribuidores ─────────────────────────────────────────

function findColExact(headers: string[], exact: string): number {
  return headers.findIndex(h => normalize(h) === exact);
}

function parseFlexibleDate(v: unknown): Date | null {
  if (v === null || v === undefined || v === '') return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  if (typeof v === 'number') return excelDateToJs(v);
  const s = String(v).trim();
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return new Date(parseInt(m[3], 10), parseInt(m[2], 10) - 1, parseInt(m[1], 10));
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

export async function readAoaFromFile(file: File): Promise<unknown[][]> {
  const isCsv = /\.csv$/i.test(file.name);
  if (isCsv) {
    let text = await file.text();
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
    const lines = text.split(/\r\n|\n|\r/).filter(l => l.length > 0);
    if (lines.length === 0) return [];
    const delim = (lines[0].split(';').length >= lines[0].split(',').length) ? ';' : ',';
    return lines.map(l => l.split(delim));
  }
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
  const sh = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json<unknown[]>(sh, { header: 1, raw: true });
}

export type DesempenoFileKind = 'chips' | 'pdv' | 'visitas' | null;

export function classifyDesempenoFile(aoa: unknown[][]): DesempenoFileKind {
  if (!aoa || aoa.length < 2) return null;
  const headers = (aoa[0] as unknown[]).map(h => normalize(String(h ?? '')));
  if (headers.includes('mid')) return 'chips';
  if (headers.some(h => h.includes('departamento'))) return 'pdv';
  if (headers.some(h => h.includes('observaciones')) ||
      headers.some(h => h.includes('fecha') && h.includes('visita') && !h.includes('cambio'))) return 'visitas';
  return null;
}

export function defaultDesempenoPeriod(chipsAoa: unknown[][]): { start: Date; end: Date } {
  const headers = (chipsAoa[0] as unknown[]).map(h => String(h ?? ''));
  const cFechaAsigDist = findCol(headers, ['fecha', 'asign', 'distribuidor']);
  let maxD: Date | null = null;
  for (let r = 1; r < chipsAoa.length; r++) {
    const row = chipsAoa[r] as unknown[];
    if (!row) continue;
    const f = parseFlexibleDate(cFechaAsigDist >= 0 ? row[cFechaAsigDist] : null);
    if (f && (!maxD || f > maxD)) maxD = f;
  }
  if (!maxD) maxD = new Date();
  const start = new Date(maxD);
  start.setDate(start.getDate() - 30);
  return { start, end: maxD };
}

export type EmpresaRow = {
  empresa: string; armados: number; activados: number; noOkPct: number; sinDistribuidor: number;
};

export type DistribuidorRow = {
  id: string; nombre: string; empresa: string;
  asignados: number; conPdv: number; sinPdv: number;
  chipsAPdv: number; diasConEntrega: number;
  promedioDia: number; diasStock: number | null;
  pendientes: number; porVencer: number; creados: number;
  diasCount: number[];
};

export type DesempenoResult = {
  empresaRows: EmpresaRow[];
  distRows: DistribuidorRow[];
  hasVisitas: boolean;
};

export function parseDesempeno(
  chipsAoa: unknown[][],
  pdvAoa: unknown[][],
  visitasAoa: unknown[][] | null,
  periodStart: Date,
  periodEnd: Date,
): DesempenoResult {
  const getCell = (row: unknown[], idx: number): unknown => (idx >= 0 ? row[idx] : null);

  const chipsHeaders     = (chipsAoa[0] as unknown[]).map(h => String(h ?? ''));
  const cEmpresaCol      = findColExact(chipsHeaders, 'empresa');
  const cFechaActivCol   = findCol(chipsHeaders, ['fecha', 'activacion']);
  const cEstadoActivCol  = findCol(chipsHeaders, ['estado', 'activacion']);
  const cIdDistCol       = findCol(chipsHeaders, ['id', 'distribuidor']);
  const cNomDistCol      = findCol(chipsHeaders, ['nombre', 'distribuidor']);
  const cFechaAsigDistCol= findCol(chipsHeaders, ['fecha', 'asign', 'distribuidor']);
  const cIdPdvCol        = findCol(chipsHeaders, ['id', 'punto', 'venta']);
  const cFechaAsigPdvCol = findCol(chipsHeaders, ['fecha', 'asign', 'punto']);

  const pdvHeaders       = (pdvAoa[0] as unknown[]).map(h => String(h ?? ''));
  const pDistribuidorCol = findColExact(pdvHeaders, 'distribuidor');
  const pEstadoVisitaCol = findCol(pdvHeaders, ['estado', 'visita']);
  const pVencimientoCol  = findCol(pdvHeaders, ['fecha', 'vencimiento']);
  const pCreadoCol       = findColExact(pdvHeaders, 'creado');

  // ── Resumen por empresa ──
  type EmpresaAgg = { armados: number; activados: number; sinDistribuidor: number };
  const empresaAgg = new Map<string, EmpresaAgg>();
  for (let r = 1; r < chipsAoa.length; r++) {
    const row = chipsAoa[r] as unknown[];
    if (!row || row.length === 0) continue;
    const fAct = parseFlexibleDate(getCell(row, cFechaActivCol));
    if (!fAct || fAct < periodStart || fAct > periodEnd) continue;
    const emp = fixMojibake(String(getCell(row, cEmpresaCol) ?? '').trim()) || '(sin empresa)';
    if (!empresaAgg.has(emp)) empresaAgg.set(emp, { armados: 0, activados: 0, sinDistribuidor: 0 });
    const e = empresaAgg.get(emp)!;
    e.armados++;
    if (normalize(String(getCell(row, cEstadoActivCol) ?? '')) === 'ok') e.activados++;
    const idd = getCell(row, cIdDistCol);
    if (idd === null || idd === undefined || idd === '') e.sinDistribuidor++;
  }
  const empresaRows: EmpresaRow[] = Array.from(empresaAgg.entries()).map(([empresa, e]) => ({
    empresa, armados: e.armados, activados: e.activados,
    noOkPct: e.armados ? (e.armados - e.activados) / e.armados : 0,
    sinDistribuidor: e.sinDistribuidor,
  })).sort((a, b) => b.armados - a.armados);

  // ── Por distribuidor ──
  type DistAgg = {
    nombre: string; empresas: Set<string>; asignados: number; conPdv: number; sinPdv: number;
    chipsAPdv: number; diasSet: Set<string>; pendientes: number; porVencer: number; creados: number;
    diasCount: number[];
  };
  const dist = new Map<string, DistAgg>();
  for (let r = 1; r < chipsAoa.length; r++) {
    const row = chipsAoa[r] as unknown[];
    if (!row || row.length === 0) continue;
    if (normalize(String(getCell(row, cEstadoActivCol) ?? '')) !== 'ok') continue;
    const id = String(getCell(row, cIdDistCol) ?? '').trim();
    if (!id) continue;
    if (!dist.has(id)) {
      dist.set(id, {
        nombre: String(getCell(row, cNomDistCol) ?? ''), empresas: new Set(),
        asignados: 0, conPdv: 0, sinPdv: 0, chipsAPdv: 0, diasSet: new Set(),
        pendientes: 0, porVencer: 0, creados: 0, diasCount: [0, 0, 0, 0, 0, 0],
      });
    }
    const d = dist.get(id)!;
    const empVal = getCell(row, cEmpresaCol);
    if (empVal) d.empresas.add(fixMojibake(String(empVal).trim()));

    const fAsigDist = parseFlexibleDate(getCell(row, cFechaAsigDistCol));
    if (fAsigDist && fAsigDist >= periodStart && fAsigDist <= periodEnd) {
      d.asignados++;
      const pdvId = getCell(row, cIdPdvCol);
      if (pdvId !== null && pdvId !== undefined && pdvId !== '') d.conPdv++; else d.sinPdv++;
    }
    const fAsigPdv = parseFlexibleDate(getCell(row, cFechaAsigPdvCol));
    if (fAsigPdv && fAsigPdv >= periodStart && fAsigPdv <= periodEnd) {
      d.chipsAPdv++;
      d.diasSet.add(toDateKey(fAsigPdv));
    }
  }

  const nameToId = new Map<string, string>();
  for (const [id, d] of dist.entries()) nameToId.set(normalize(d.nombre), id);

  const today = new Date();
  for (let r = 1; r < pdvAoa.length; r++) {
    const row = pdvAoa[r] as unknown[];
    if (!row || row.length === 0) continue;
    const distNombre = getCell(row, pDistribuidorCol);
    if (!distNombre) continue;
    const id = nameToId.get(normalize(String(distNombre)));
    if (id === undefined) continue;
    const d = dist.get(id)!;
    if (normalize(String(getCell(row, pEstadoVisitaCol) ?? '')) === 'pendiente') d.pendientes++;
    const venc = parseFlexibleDate(getCell(row, pVencimientoCol));
    if (venc) {
      const days = Math.round((venc.getTime() - today.getTime()) / 86400000);
      if (days <= 30) d.porVencer++;
    }
    const creado = parseFlexibleDate(getCell(row, pCreadoCol));
    if (creado && creado >= periodStart && creado <= periodEnd) d.creados++;
  }

  let hasVisitas = false;
  if (visitasAoa && visitasAoa.length >= 2) {
    hasVisitas = true;
    const vHeaders         = (visitasAoa[0] as unknown[]).map(h => String(h ?? ''));
    const vDistribuidorCol = findColExact(vHeaders, 'distribuidor');
    const vFechaVisitaCol  = findCol(vHeaders, ['fecha', 'visita']);
    const dEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    for (let r = 1; r < visitasAoa.length; r++) {
      const row = visitasAoa[r] as unknown[];
      if (!row || row.length === 0) continue;
      const distNombre = getCell(row, vDistribuidorCol);
      if (!distNombre) continue;
      const id = nameToId.get(normalize(String(distNombre)));
      if (id === undefined) continue;
      const fVisita = parseFlexibleDate(getCell(row, vFechaVisitaCol));
      if (!fVisita) continue;
      const dVisita = new Date(fVisita.getFullYear(), fVisita.getMonth(), fVisita.getDate());
      const daysAgo = Math.round((dEnd.getTime() - dVisita.getTime()) / 86400000);
      if (daysAgo >= 0 && daysAgo <= 5) dist.get(id)!.diasCount[daysAgo]++;
    }
  }

  const distRows: DistribuidorRow[] = Array.from(dist.entries()).map(([id, d]) => {
    const promedioDia = d.diasSet.size ? d.chipsAPdv / d.diasSet.size : 0;
    const diasStock = promedioDia > 0 ? d.sinPdv / promedioDia : null;
    return {
      id, nombre: fixMojibake(d.nombre), empresa: Array.from(d.empresas).join(' / '),
      asignados: d.asignados, conPdv: d.conPdv, sinPdv: d.sinPdv,
      chipsAPdv: d.chipsAPdv, diasConEntrega: d.diasSet.size,
      promedioDia, diasStock,
      pendientes: d.pendientes, porVencer: d.porVencer, creados: d.creados,
      diasCount: d.diasCount,
    };
  }).sort((a, b) => b.asignados - a.asignados);

  return { empresaRows, distRows, hasVisitas };
}
