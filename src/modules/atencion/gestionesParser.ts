import * as XLSX from 'xlsx';
import { normalizeFechaVenta } from '../../utils/smartParser';

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface Gestion {
  area: string;
  empresa: string;
  numeroTramite: string;
  fechaCreacion: string; // ISO yyyy-mm-dd
  fechaCierre: string;   // ISO yyyy-mm-dd — vacío si el caso no tiene fecha de cierre registrada
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

/**
 * Parsea el CSV completo (no línea por línea) respetando comillas, incluyendo
 * campos entre comillas que contienen saltos de línea — algo muy probable en
 * "Observaciones" (texto libre largo). Si se separara primero por \n y
 * recién después por columnas, un salto de línea dentro de una observación
 * partía un registro en dos y desalineaba el conteo de columnas de ahí en más.
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

// ── Mapeo por POSICIÓN REAL (no por header) ────────────────────────────────────
//
// El CSV trae 20 headers en la fila 0, pero cada fila de datos tiene en
// realidad 24 columnas — la primera (Área) no tiene header propio y corre
// todo lo demás. Los headers de la fila 0 NO sirven para saber a qué
// corresponde cada dato; hay que ubicarlos por posición real.
//
// Posiciones verificadas contra un archivo real (1034 filas):
//   total=1034, Concepto CONSULTA=528/RECLAMO=293/SOLICITUD=191,
//   Estado SOLUCIONADO=886/SUPERVISION=80/ANTEL=38/COMERCIAL=14/
//   RECHAZADO=10/LLAMAR=6, Rol Operador=860/Supervisor=174 — coinciden
//   exactamente con estas posiciones.
//
// Caso especial — OPERADOR: cuando Rol es "Supervisor…" (col 20), el
// supervisor actuó directamente y su nombre queda en la col 19 en vez de
// la 21 (la 21 queda vacía). Cuando Rol es "Operador…", el nombre está en
// la col 21 normalmente.
//
// FECHA DE CIERRE (col 17): no hay una columna 100% limpia para esto en los
// datos reales — se probaron col 15 y col 17 (ambas con formato de fecha
// válido y sin fechas de cierre anteriores a la de creación). Se eligió
// col 17 por tener mayor cobertura (312/1034 filas vs 174/1034 de col 15,
// que resultó ser un subconjunto exacto con los mismos valores). Si algún
// promedio de "tiempo de resolución" se ve raro, este es el primer lugar
// para revisar.
const COL = {
  area: 0,
  empresa: 1,
  numeroTramite: 3,
  fechaCreacion: 5,
  concepto: 6,
  tipoProducto: 7,
  lugarContacto: 11,
  equipo: 12,
  plan: 13,
  fechaCierre: 17,
  rol: 20,
  operadorPrincipal: 21,   // usado cuando Rol = Operador
  operadorSupervisor: 19,  // usado cuando Rol = Supervisor
  estado: 22,
  observaciones: 23,
} as const;

const MIN_COLUMNAS = 20;

function celda(row: string[], idx: number): string {
  return fixEncoding((row[idx] ?? '').toString().trim());
}

function buildGestion(row: string[]): Gestion {
  const fechaRaw = celda(row, COL.fechaCreacion);
  const fechaCierreRaw = celda(row, COL.fechaCierre);
  const rol = celda(row, COL.rol);
  const esSupervisor = rol.toLowerCase().includes('supervisor');
  const operador = esSupervisor ? celda(row, COL.operadorSupervisor) : celda(row, COL.operadorPrincipal);

  return {
    area: celda(row, COL.area),
    empresa: celda(row, COL.empresa),
    numeroTramite: celda(row, COL.numeroTramite),
    fechaCreacion: fechaRaw ? normalizeFechaVenta(fechaRaw).substring(0, 10) : '',
    fechaCierre: fechaCierreRaw ? normalizeFechaVenta(fechaCierreRaw).substring(0, 10) : '',
    concepto: celda(row, COL.concepto).toUpperCase(),
    tipoProducto: celda(row, COL.tipoProducto),
    lugarContacto: celda(row, COL.lugarContacto),
    equipo: celda(row, COL.equipo),
    plan: celda(row, COL.plan),
    operador,
    rol,
    usuario: '',
    estado: celda(row, COL.estado).toUpperCase(),
    observaciones: celda(row, COL.observaciones),
  };
}

function buildGestiones(dataRows: string[][]): Gestion[] {
  const rows: Gestion[] = [];
  for (const row of dataRows) {
    const g = buildGestion(row);
    const estaVacia = Object.values(g).every(v => v === '');
    if (estaVacia) continue;
    rows.push(g);
  }
  return rows;
}

function buildDebug(dataRows: string[][], headerRow: string[]): ColumnDebugInfo[] {
  const entries: { field: string; idx: number | null; note?: string }[] = [
    { field: 'Área', idx: COL.area },
    { field: 'Empresa', idx: COL.empresa },
    { field: 'Número de trámite', idx: COL.numeroTramite },
    { field: 'Fecha creación', idx: COL.fechaCreacion },
    { field: 'Fecha cierre (baja confianza)', idx: COL.fechaCierre },
    { field: 'Concepto', idx: COL.concepto },
    { field: 'Tipo producto', idx: COL.tipoProducto },
    { field: 'Lugar de contacto', idx: COL.lugarContacto },
    { field: 'Equipo', idx: COL.equipo },
    { field: 'Plan', idx: COL.plan },
    { field: 'Rol', idx: COL.rol },
    { field: 'Operador', idx: null, note: `col ${COL.operadorPrincipal} (Operador) / col ${COL.operadorSupervisor} (si Rol = Supervisor)` },
    { field: 'Usuario', idx: null, note: 'sin columna confiable — se deja vacío' },
    { field: 'Estado', idx: COL.estado },
    { field: 'Observaciones', idx: COL.observaciones },
  ];

  return entries.map(({ field, idx, note }) => {
    if (idx === null) {
      return { field, columnIndex: null, sample: note ? [note] : [] };
    }
    // Busca los primeros valores NO vacíos en vez de las primeras 3 filas —
    // varios campos (Tipo producto, Equipo, Plan, Observaciones) solo se
    // completan en una fracción de las filas, así que tomar literalmente las
    // primeras 3 filas suele dar una muestra vacía y poco útil para depurar.
    const sample: string[] = [];
    for (const r of dataRows) {
      if (sample.length >= 3) break;
      const v = celda(r, idx);
      if (v) sample.push(v);
    }
    return {
      field,
      columnIndex: idx,
      sample: [`header original (no confiable): "${headerRow[idx] ?? ''}"`, ...sample],
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

// ── Parser CSV (latin1, separador ';') ─────────────────────────────────────────

async function parseGestionesCsv(file: File): Promise<GestionesData> {
  const buffer = await file.arrayBuffer();
  // Probar UTF-8 primero: si el archivo ya es UTF-8 válido (lo más común en
  // exports recientes) evita el problema de que fixEncoding no revierte bien
  // el mojibake de ciertas mayúsculas acentuadas (ej. "Ó") al decodificar como
  // windows-1252 de entrada. Solo se cae a windows-1252 si UTF-8 produce
  // caracteres de reemplazo (U+FFFD), señal de que el archivo es realmente latin1.
  let text = new TextDecoder('utf-8').decode(buffer);
  if (text.includes('�')) {
    try { text = new TextDecoder('windows-1252').decode(buffer); } catch { /* se queda con utf-8 */ }
  }
  text = text.replace(/^﻿/, '');

  const sep = ';';
  const allRows = parseCsvRows(text, sep).filter(r => !(r.length === 1 && r[0].trim() === ''));
  if (allRows.length < 2) throw new Error('El CSV de gestiones está vacío o sin datos.');

  const headerRow = allRows[0].map(h => h.trim());

  // Ya NO se descartan filas por no coincidir con la cantidad de headers
  // (los headers vienen corridos y no representan la cantidad real de
  // columnas de datos). Solo se exige un mínimo razonable de columnas.
  const dataRows: string[][] = [];
  let skippedRows = 0;
  for (let i = 1; i < allRows.length; i++) {
    const cells = allRows[i].map(c => c.trim());
    if (cells.length < MIN_COLUMNAS) { skippedRows++; continue; }
    dataRows.push(cells);
  }

  const rows = buildGestiones(dataRows);
  const debug = buildDebug(dataRows, headerRow);
  // eslint-disable-next-line no-console
  console.debug('[gestionesParser] columnas (posición fija):', debug);
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
  let skippedRows = 0;
  const dataRows: string[][] = [];
  for (let i = 1; i < aoa.length; i++) {
    const row = aoa[i].map(v => String(v ?? '').trim());
    if (row.length < MIN_COLUMNAS) { skippedRows++; continue; }
    dataRows.push(row);
  }

  const rows = buildGestiones(dataRows);
  const debug = buildDebug(dataRows, headerRow);
  // eslint-disable-next-line no-console
  console.debug('[gestionesParser] columnas (posición fija):', debug);
  return finalizeData(rows, debug, skippedRows);
}

// ── API pública ─────────────────────────────────────────────────────────────────

export async function parseGestiones(file: File): Promise<GestionesData> {
  const ext = file.name.toLowerCase();
  if (ext.endsWith('.csv')) return parseGestionesCsv(file);
  return parseGestionesExcel(file);
}
