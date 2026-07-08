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
};

export type ParseResult = {
  results: ChipResult[];
  detectedDate: Date;
  windowStart: Date;
  windowEnd: Date;
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function fixMojibake(s: string): string {
  if (/[ÃÂ]/.test(s)) {
    try { return decodeURIComponent(escape(s)); } catch { /* fall through */ }
  }
  return s;
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
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addMonths(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(1);
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

    if (row.length >= 6) midsConComision.add(mid);

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
        deliveryMap: {}, recent3m: 0, prev3m: 0,
      });
    }

    const agg = pdvAgg.get(idPdv)!;

    if (emp)     agg.empresa        = emp;
    if (nomDist) agg.distribuidor   = nomDist;
    if (idDist)  agg.idDistribuidor = idDist;
    if (nomPdv)  agg.pdvNombre      = nomPdv;

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
      }
    }
  }

  // ── Parse PUNTOS DE VENTA ─────────────────────────────────────────────────

  const wsPdv  = wb.Sheets[sheetNames[iPuntos]];
  const pdvRaw = XLSX.utils.sheet_to_json<unknown[]>(wsPdv, { header: 1, defval: null, raw: true });

  type PdvInfo = {
    nombre: string; departamento: string;
    estadoVisita: string; fechaCambio: Date | null; vencimiento: Date | null;
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

    for (let i = 1; i < pdvRaw.length; i++) {
      const row = pdvRaw[i] as unknown[];
      if (!row || !row.length) continue;
      const id = String(pId >= 0 ? (row[pId] ?? '') : '').trim();
      if (!id) continue;

      pdvInfo.set(id, {
        nombre:       String(pNombre    >= 0 ? (row[pNombre]  ?? '') : '').trim(),
        departamento: String(pDepto     >= 0 ? (row[pDepto]   ?? '') : '').trim(),
        estadoVisita: String(pEstVis    >= 0 ? (row[pEstVis]  ?? '') : '').trim(),
        fechaCambio:  excelDateToJs(pFechaCambio >= 0 ? row[pFechaCambio] : null),
        vencimiento:  excelDateToJs(pVenc        >= 0 ? row[pVenc]        : null),
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
      const raw = agg.prev3m === 0
        ? (agg.recent3m > 0 ? 9.99 : 0)
        : (agg.recent3m - agg.prev3m) / agg.prev3m;
      alertaPct = raw;
      if (raw <= -0.45) alerta = 'baja';
      else if (raw >= 0.45) alerta = 'suba';
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
    });
  }

  results.sort((a, b) => b.sugerido - a.sugerido || b.activaciones8m - a.activaciones8m);

  return {
    results,
    detectedDate,
    windowStart: eightMonthsAgo,
    windowEnd:   today,
  };
}
