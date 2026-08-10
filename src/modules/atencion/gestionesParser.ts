import * as XLSX from 'xlsx';
import { normalizeFechaVenta } from '../../utils/smartParser';

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface Gestion {
  area: string;
  empresa: string;
  numeroTramite: string;
  fechaCreacion: string; // ISO yyyy-mm-dd
  concepto: string;      // CONSULTA / RECLAMO / SOLICITUD
  tipoProducto: string;
  lugarContacto: string;
  equipo: string;
  plan: string;
  operador: string;
  rol: string;
  usuario: string;
  estado: string;
  observaciones: string;
}

export interface ColumnDebugInfo {
  field: string;
  columnIndex: number | null;
  sample: string[];
}

export interface GestionesData {
  total: number;
  rows: Gestion[];
  operadores: string[];
  empresas: string[];
  fechaMin: string;
  fechaMax: string;
  fechaCarga: string;
  debug: ColumnDebugInfo[];
  skippedRows: number;
}

// ── Encoding helpers (self-contenido, no depende de smartParser) ──────────────

function fixEncoding(str: string): string {
  try {
    return decodeURIComponent(escape(str));
  } catch {
    return str
      .replace(/Ã¡/g, 'á').replace(/Ã©/g, 'é').replace(/Ã­/g, 'í')
      .replace(/Ã³/g, 'ó').replace(/Ãº/g, 'ú').replace(/Ã/g, 'Á')
      .replace(/Ã‰/g, 'É').replace(/Ã"/g, 'Ó').replace(/Ãš/g, 'Ú')
      .replace(/Ã±/g, 'ñ').replace(/Ã'/g, 'Ñ').replace(/Ã¼/g, 'ü');
  }
}

function normalize(str: string): string {
  return fixEncoding(str)
    .toLowerCase().trim()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ');
}

/**
 * Parsea el CSV completo (no línea por línea) respetando comillas, incluyendo
 * campos entre comillas que contienen saltos de línea — algo muy probable en
 * "Observaciones" (texto libre largo). Si se separara primero por \n y
 * recién después por columnas, un salto de línea dentro de una observación
 * partía un registro en dos, desalineaba el conteo de columnas de casi TODAS
 * las filas siguientes y el filtro de líneas malformadas terminaba
 * descartando prácticamente todo el archivo.
 */
function parseCsvRows(text: string, sep: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  const n = text.length;
  let i = 0;
  while (i < n) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      field += ch; i++; continue;
    }
    if (ch === '"') { inQuotes = true; i++; continue; }
    if (ch === sep) { row.push(field); field = ''; i++; continue; }
    if (ch === '\r') { i++; continue; }
    if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; continue; }
    field += ch; i++;
  }
  if (field !== '' || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

// ── Detección de columnas por CONTENIDO ────────────────────────────────────────

type FieldKey =
  | 'estado' | 'concepto' | 'rol' | 'fechaCreacion' | 'area' | 'empresa'
  | 'tipoProducto' | 'equipo' | 'plan' | 'lugarContacto' | 'operador'
  | 'usuario' | 'numeroTramite' | 'observaciones';

const ESTADO_SET = ['solucionado', 'supervision', 'antel', 'rechazado', 'comercial', 'llamar'];
const CONCEPTO_SET = ['consulta', 'reclamo', 'solicitud'];
const DATE_RE = /^\d{1,2}\/\d{1,2}\/\d{2,4}$/;
const NAME_RE = /^[A-Za-zÀ-ÿ'.-]+(\s[A-Za-zÀ-ÿ'.-]+){1,2}$/;
const USER_RE = /^[A-Za-z0-9._-]{3,20}$/;
const EQUIPO_CODE_RE = /^[A-Za-z]\d{2,4}$/;

interface ColStats {
  index: number;
  values: string[];      // valores crudos no vacíos
  normValues: string[];  // normalizados
  distinctCount: number;
  topRatio: number;      // frecuencia del valor normalizado más común
  topValue: string;
  avgLen: number;
  dateRatio: number;
  numericRatio: number;
  nameRatio: number;
  userRatio: number;
}

function computeColStats(dataRows: string[][], numCols: number): ColStats[] {
  const stats: ColStats[] = [];
  for (let c = 0; c < numCols; c++) {
    // fixEncoding ANTES de analizar — si no, los acentos mal decodificados (mojibake)
    // rompen los regex de nombres/patrones (ej: "López" → "LÃ³pez").
    const raw = dataRows.map(r => fixEncoding((r[c] ?? '').toString().trim())).filter(v => v !== '');
    const norm = raw.map(normalize);
    const freq = new Map<string, number>();
    for (const v of norm) freq.set(v, (freq.get(v) ?? 0) + 1);
    let topValue = '', topCount = 0;
    for (const [v, n] of freq.entries()) if (n > topCount) { topCount = n; topValue = v; }
    const n = raw.length || 1;
    stats.push({
      index: c,
      values: raw,
      normValues: norm,
      distinctCount: freq.size,
      topRatio: topCount / n,
      topValue,
      avgLen: raw.reduce((s, v) => s + v.length, 0) / n,
      dateRatio: raw.filter(v => DATE_RE.test(v)).length / n,
      numericRatio: raw.filter(v => /^\d+$/.test(v)).length / n,
      nameRatio: raw.filter(v => NAME_RE.test(v) && !/\d/.test(v)).length / n,
      userRatio: raw.filter(v => USER_RE.test(v) && /[A-Za-z]/.test(v)).length / n,
    });
  }
  return stats;
}

function setMatchRatio(col: ColStats, set: string[]): number {
  if (col.values.length === 0) return 0;
  return col.normValues.filter(v => set.includes(v)).length / col.normValues.length;
}

function substringMatchRatio(col: ColStats, needles: string[]): number {
  if (col.values.length === 0) return 0;
  return col.normValues.filter(v => needles.some(n => v.includes(n))).length / col.normValues.length;
}

/**
 * Detecta a qué campo corresponde cada columna del CSV/Excel de Gestiones
 * mirando el CONTENIDO real de los datos, no los headers (que vienen corridos
 * / mal rotulados en el archivo real). Orden: primero vocabularios cerrados
 * (estado/concepto/rol) por ser los más inconfundibles, luego patrones
 * estructurales (fecha), luego columnas cuasi-constantes (área), y por último
 * las más "libres" (empresa/equipo/plan/lugar de contacto/operador/etc).
 */
function detectColumns(dataRows: string[][], numCols: number): { mapping: Record<FieldKey, number | null>; stats: ColStats[] } {
  const stats = computeColStats(dataRows, numCols);
  const claimed = new Set<number>();
  const mapping = {} as Record<FieldKey, number | null>;

  function pickBest(field: FieldKey, score: (c: ColStats) => number, threshold: number) {
    let best: ColStats | null = null;
    let bestScore = threshold;
    for (const c of stats) {
      if (claimed.has(c.index)) continue;
      const s = score(c);
      if (s > bestScore) { bestScore = s; best = c; }
    }
    mapping[field] = best ? best.index : null;
    if (best) claimed.add(best.index);
  }

  // 1-3: vocabularios cerrados
  pickBest('estado', c => setMatchRatio(c, ESTADO_SET), 0.6);
  pickBest('concepto', c => setMatchRatio(c, CONCEPTO_SET), 0.6);
  pickBest('rol', c => substringMatchRatio(c, ['operador', 'supervisor']), 0.6);

  // 4: primera columna (de izq. a derecha) con patrón de fecha d/M/yyyy
  {
    let found: ColStats | null = null;
    for (const c of stats) {
      if (claimed.has(c.index)) continue;
      if (c.dateRatio > 0.6) { found = c; break; }
    }
    mapping.fechaCreacion = found ? found.index : null;
    if (found) claimed.add(found.index);
  }

  // 5: área — columna casi constante que contiene "atencion"
  pickBest('area', c => (c.topRatio > 0.85 && c.topValue.includes('atencion')) ? c.topRatio : 0, 0.5);

  // 6: empresa — pocos valores distintos, cortos, sin fechas/números
  pickBest('empresa', c => {
    if (c.distinctCount < 2 || c.distinctCount > 15) return 0;
    if (c.avgLen > 25) return 0;
    if (c.dateRatio > 0.1 || c.numericRatio > 0.1) return 0;
    return 1 - c.avgLen / 25; // más corto = mejor puntaje
  }, 0.05);

  // 7: tipo de producto — baja cardinalidad, valor dominante tipo "fibra/movil/tv"
  pickBest('tipoProducto', c => {
    if (c.distinctCount > 8) return 0;
    if (!/fibra|movil|optic|tv|internet/.test(c.topValue)) return 0;
    return c.topRatio;
  }, 0.4);

  // 8: equipo — códigos cortos (F680, F660) o "FIBRA <palabra>"
  pickBest('equipo', c => {
    if (c.distinctCount < 2 || c.distinctCount > 80) return 0;
    const codeRatio = c.values.filter(v => EQUIPO_CODE_RE.test(v)).length / (c.values.length || 1);
    const fibraRatio = c.normValues.filter(v => /fibra\s+\w+/.test(v)).length / (c.normValues.length || 1);
    return Math.max(codeRatio, fibraRatio);
  }, 0.3);

  // 9: plan — similar a equipo pero en otra columna
  pickBest('plan', c => {
    if (c.distinctCount < 2 || c.distinctCount > 80) return 0;
    const score = c.normValues.filter(v => /fibra|plan/.test(v)).length / (c.normValues.length || 1);
    return score;
  }, 0.25);

  // 10: lugar de contacto — catálogo de motivos cortos que SE REPITEN mucho
  // (ojo: no confundir con "distintos" = mejor. Un texto libre único por fila,
  // como Observaciones, también tiene muchos valores distintos; lo que
  // diferencia a un catálogo de motivos es que los mismos valores se repiten
  // una y otra vez, así que se premia la REPETICIÓN, no la unicidad).
  pickBest('lugarContacto', c => {
    if (c.distinctCount < 6 || c.distinctCount > 60) return 0;
    if (c.avgLen < 3 || c.avgLen > 40) return 0;
    if (c.dateRatio > 0.1 || c.numericRatio > 0.2) return 0;
    const cardinalityRatio = c.distinctCount / (c.values.length || 1);
    if (cardinalityRatio > 0.5) return 0; // demasiado único → probablemente texto libre
    return 1 - cardinalityRatio;
  }, 0.3);

  // 11: operador — "Nombre Apellido"
  pickBest('operador', c => c.nameRatio, 0.6);

  // 12: número de trámite — numérico, mayormente único (antes que usuario para
  // que no se lo lleve un token corto que también matchea dígitos)
  pickBest('numeroTramite', c => {
    if (c.numericRatio < 0.8) return 0;
    return c.distinctCount / (c.values.length || 1);
  }, 0.7);

  // 13: usuario — token corto sin espacios, con al menos una letra
  pickBest('usuario', c => c.userRatio, 0.6);

  // 14: observaciones — lo que quede con el texto más largo en promedio
  pickBest('observaciones', c => c.avgLen, 12);

  return { mapping, stats };
}

// ── Construcción de filas Gestion a partir del mapeo ───────────────────────────

function buildGestiones(
  dataRows: string[][],
  mapping: Record<FieldKey, number | null>,
): Gestion[] {
  const get = (row: string[], field: FieldKey): string => {
    const idx = mapping[field];
    return idx === null ? '' : fixEncoding((row[idx] ?? '').toString().trim());
  };
  const rows: Gestion[] = [];
  for (const row of dataRows) {
    const fechaRaw = get(row, 'fechaCreacion');
    const g: Gestion = {
      area: get(row, 'area'),
      empresa: get(row, 'empresa'),
      numeroTramite: get(row, 'numeroTramite'),
      fechaCreacion: fechaRaw ? normalizeFechaVenta(fechaRaw).substring(0, 10) : '',
      concepto: get(row, 'concepto').toUpperCase(),
      tipoProducto: get(row, 'tipoProducto'),
      lugarContacto: get(row, 'lugarContacto'),
      equipo: get(row, 'equipo'),
      plan: get(row, 'plan'),
      operador: get(row, 'operador'),
      rol: get(row, 'rol'),
      usuario: get(row, 'usuario'),
      estado: get(row, 'estado').toUpperCase(),
      observaciones: get(row, 'observaciones'),
    };
    // Solo se descarta si TODOS los campos quedaron vacíos (fila realmente vacía).
    // Antes se exigía fecha+concepto+operador+estado no vacíos a la vez, lo que
    // borraba el archivo entero si alguno de esos 4 campos no se detectaba bien.
    const estaVacia = Object.values(g).every(v => v === '');
    if (estaVacia) continue;
    rows.push(g);
  }
  return rows;
}

function buildDebug(mapping: Record<FieldKey, number | null>, stats: ColStats[], headerRow: string[]): ColumnDebugInfo[] {
  const labels: Record<FieldKey, string> = {
    area: 'Área', empresa: 'Empresa', numeroTramite: 'Número de trámite',
    fechaCreacion: 'Fecha creación', concepto: 'Concepto', tipoProducto: 'Tipo producto',
    lugarContacto: 'Lugar de contacto', equipo: 'Equipo', plan: 'Plan', operador: 'Operador',
    rol: 'Rol', usuario: 'Usuario', estado: 'Estado', observaciones: 'Observaciones',
  };
  return (Object.keys(labels) as FieldKey[]).map(field => {
    const idx = mapping[field];
    const col = idx !== null ? stats.find(s => s.index === idx) : undefined;
    return {
      field: labels[field],
      columnIndex: idx,
      sample: idx !== null
        ? [`header original: "${headerRow[idx] ?? ''}"`, ...(col?.values.slice(0, 3) ?? [])]
        : [],
    };
  });
}

function finalizeData(rows: Gestion[], debug: ColumnDebugInfo[], skippedRows: number): GestionesData {
  const operadores = [...new Set(rows.map(r => r.operador).filter(Boolean))].sort();
  const empresas = [...new Set(rows.map(r => r.empresa).filter(Boolean))].sort();
  const fechas = rows.map(r => r.fechaCreacion).filter(f => /^\d{4}-\d{2}-\d{2}$/.test(f)).sort();
  return {
    total: rows.length,
    rows,
    operadores,
    empresas,
    fechaMin: fechas[0] ?? '',
    fechaMax: fechas[fechas.length - 1] ?? '',
    fechaCarga: new Date().toISOString(),
    debug,
    skippedRows,
  };
}

// ── Parser CSV (latin1, separador ';', skip de líneas malformadas) ────────────

async function parseGestionesCsv(file: File): Promise<GestionesData> {
  const buffer = await file.arrayBuffer();
  let text: string;
  try { text = new TextDecoder('windows-1252').decode(buffer); }
  catch { text = new TextDecoder('utf-8').decode(buffer); }
  text = text.replace(/^﻿/, '');

  const sep = ';';
  const allRows = parseCsvRows(text, sep).filter(r => !(r.length === 1 && r[0].trim() === ''));
  if (allRows.length < 2) throw new Error('El CSV de gestiones está vacío o sin datos.');

  const headerRow = allRows[0].map(h => h.trim());
  const expectedCols = headerRow.length;

  const dataRows: string[][] = [];
  let skippedRows = 0;
  for (let i = 1; i < allRows.length; i++) {
    const cells = allRows[i].map(c => c.trim());
    if (cells.length !== expectedCols) { skippedRows++; continue; } // on_bad_lines='skip'
    dataRows.push(cells);
  }

  const { mapping, stats } = detectColumns(dataRows, expectedCols);
  const rows = buildGestiones(dataRows, mapping);
  const debug = buildDebug(mapping, stats, headerRow);
  // eslint-disable-next-line no-console
  console.debug('[gestionesParser] columnas detectadas:', debug);
  return finalizeData(rows, debug, skippedRows);
}

// ── Parser Excel (fallback) ────────────────────────────────────────────────────

async function parseGestionesExcel(file: File): Promise<GestionesData> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: false });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' });
  if (aoa.length < 2) throw new Error('El Excel de gestiones está vacío o sin datos.');

  const headerRow = aoa[0].map(v => String(v ?? ''));
  const expectedCols = headerRow.length;
  const dataRows = aoa.slice(1).map(r => {
    const row = Array.from({ length: expectedCols }, (_, i) => String(r[i] ?? '').trim());
    return row;
  });

  const { mapping, stats } = detectColumns(dataRows, expectedCols);
  const rows = buildGestiones(dataRows, mapping);
  const debug = buildDebug(mapping, stats, headerRow);
  // eslint-disable-next-line no-console
  console.debug('[gestionesParser] columnas detectadas:', debug);
  return finalizeData(rows, debug, 0);
}

// ── API pública ─────────────────────────────────────────────────────────────────

export async function parseGestiones(file: File): Promise<GestionesData> {
  const ext = file.name.toLowerCase();
  if (ext.endsWith('.csv')) return parseGestionesCsv(file);
  return parseGestionesExcel(file);
}
