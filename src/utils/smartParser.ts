import * as XLSX from 'xlsx';

export type ModuleType = 'ventas' | 'reloj' | 'sanciones';

export interface ParseResult {
  headers: string[];
  rows: Record<string, unknown>[];
  confidence: number;
  columnMap: Record<string, string>;
  fileName: string;
  rowCount: number;
}

// ── Estado normalizado (backward compat) ─────────────────────────────────────
export type EstadoVenta = 'Vendido' | 'Control Antel' | 'Activar' | 'Rechazo' | 'Otro';

export function normalizeEstado(valor: string): EstadoVenta {
  const v = valor.toLowerCase().trim().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (v.includes('vendido'))                                                    return 'Vendido';
  if (v.includes('control') || v.includes('activo'))                           return 'Control Antel';
  if (v.includes('activar') || v.includes('a activar') || v.includes('pendiente')) return 'Activar';
  if (v.includes('rechazo') || v.includes('rechazado') || v.includes('baja'))  return 'Rechazo';
  return 'Otro';
}

// ── Normalizar fechas DD/MM/YYYY → YYYY-MM-DD ────────────────────────────────
export function normalizeFechaVenta(val: string): string {
  if (!val) return '';
  const s = val.trim().split('T')[0];
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  const m2 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
  if (m2) return `20${m2[3]}-${m2[2].padStart(2, '0')}-${m2[1].padStart(2, '0')}`;
  return '';
}

// ── Field alias maps ──────────────────────────────────────────────────────────

const VENTAS_FIELDS: Record<string, string[]> = {
  funcionario:  ['funcionario', 'vendedor', 'nombre', 'agente', 'representante', 'asesor'],
  fecha:        ['fecha de venta', 'fecha venta', 'fecha', 'dia', 'date', 'día'],
  motivo:       ['motivo de cambio de plan', 'motivo de cambio', 'motivo', 'razon de cambio', 'razon', 'razón', 'tipo de gestion', 'tipo de gestión'],
  nuevoPlan:    ['nuevo plan', 'plan contratado', 'plan nuevo', 'plan vigente', 'plan final'],
  planAnterior: ['plan anterior', 'descripcion de plan', 'plan previo', 'plan original', 'plan base'],
  empresa:      ['empresa', 'company', 'negocio', 'linea', 'línea', 'servicio'],
  estado:       ['estado', 'status', 'resultado', 'situacion', 'situación'],
  backOffice:   ['back-office', 'back office', 'backoffice', 'back_office'],
  departamento: ['departamento', 'provincia', 'localidad'],
  modalidad:    ['modalidad de venta', 'modalidad', 'canal de venta', 'canal'],
  contrato:     ['número de contrato', 'numero de contrato', 'nro contrato', 'contrato'],
  equipo:       ['equipo', 'team', 'grupo', 'sector'],
};

const RELOJ_FIELDS: Record<string, string[]> = {
  funcionario:  ['funcionario', 'nombre', 'empleado', 'agente', 'operador'],
  fecha:        ['fecha', 'dia', 'date', 'día'],
  entrada:      ['entrada', 'ingreso', 'checkin', 'hora entrada', 'hora de entrada', 'inicio', 'time in'],
  salida:       ['salida', 'egreso', 'checkout', 'hora salida', 'hora de salida', 'fin', 'time out'],
  departamento: ['departamento', 'sector', 'equipo', 'area', 'área'],
};

const SANCIONES_FIELDS: Record<string, string[]> = {
  funcionario:  ['funcionario', 'empleado', 'nombre', 'agente'],
  fecha:        ['fecha', 'date', 'dia', 'día'],
  tipo:         ['tipo', 'sancion', 'sanción', 'motivo', 'categoria', 'categoría'],
  descripcion:  ['descripcion', 'descripción', 'detalle', 'observaciones', 'observacion', 'nota'],
  nivel:        ['nivel', 'gravedad', 'severidad', 'grado'],
  estado:       ['estado', 'status', 'situacion', 'situación'],
};

const FIELD_MAPS: Record<ModuleType, Record<string, string[]>> = {
  ventas:    VENTAS_FIELDS,
  reloj:     RELOJ_FIELDS,
  sanciones: SANCIONES_FIELDS,
};

// ── Encoding / string helpers ─────────────────────────────────────────────────

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

function safeStr(val: unknown): string {
  if (val === null || val === undefined) return '';
  return fixEncoding(String(val));
}

function normalize(str: string): string {
  return str
    .toLowerCase().trim()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ');
}

// ── Column detection ──────────────────────────────────────────────────────────

function detectColumns(
  headers: string[],
  moduleType: ModuleType,
): { columnMap: Record<string, string>; confidence: number } {
  const fields = FIELD_MAPS[moduleType];
  const columnMap: Record<string, string> = {};
  const usedHeaders = new Set<string>();

  const sortedAsc = [...headers].sort((a, b) => a.length - b.length);

  for (const [fieldKey, aliases] of Object.entries(fields)) {
    // Pass 1: exact match — shorter headers are more specific
    for (const header of sortedAsc) {
      if (usedHeaders.has(header)) continue;
      const norm = normalize(header);
      if (aliases.some(alias => norm === normalize(alias))) {
        columnMap[fieldKey] = header;
        usedHeaders.add(header);
        break;
      }
    }
    if (columnMap[fieldKey]) continue;

    // Pass 2: substring match — shorter headers are more specific
    for (const header of sortedAsc) {
      if (usedHeaders.has(header)) continue;
      const norm = normalize(header);
      if (aliases.some(alias => norm.includes(normalize(alias)))) {
        columnMap[fieldKey] = header;
        usedHeaders.add(header);
        break;
      }
    }
  }

  const requiredFields = Object.keys(fields).slice(0, 3);
  const matched = requiredFields.filter(f => columnMap[f]).length;
  const confidence = Math.round((matched / requiredFields.length) * 100);

  return { columnMap, confidence };
}

// ── Excel helpers ─────────────────────────────────────────────────────────────

function formatDateCell(cell: XLSX.CellObject): string {
  if (cell.v instanceof Date) {
    const d = cell.v;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  if (typeof cell.v === 'number' && cell.t === 'n') {
    const d = XLSX.SSF.parse_date_code(cell.v);
    if (d) return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
  }
  return safeStr(cell.v);
}

function detectHeaders(sheet: XLSX.WorkSheet): { headers: string[]; headerRow: number } {
  const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
  for (let r = 0; r <= Math.min(5, range.e.r); r++) {
    const row: string[] = [];
    let textCount = 0;
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = sheet[XLSX.utils.encode_cell({ r, c })];
      const val = cell ? fixEncoding(String(cell.v ?? '').trim()) : '';
      row.push(val);
      if (val && isNaN(Number(val))) textCount++;
    }
    if (textCount >= 2 && row.some(v => v !== '')) return { headers: row, headerRow: r };
  }
  const firstRow: string[] = [];
  for (let c = range.s.c; c <= range.e.c; c++) {
    const cell = sheet[XLSX.utils.encode_cell({ r: 0, c })];
    firstRow.push(cell ? fixEncoding(String(cell.v ?? '').trim()) : `Col${c + 1}`);
  }
  return { headers: firstRow, headerRow: 0 };
}

// ── CSV parser ────────────────────────────────────────────────────────────────

function splitCsvLine(line: string, sep: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === sep && !inQuotes) {
      result.push(current); current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

async function parseCsvFile(file: File, moduleType: ModuleType): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const buffer = e.target?.result as ArrayBuffer;

        // Try windows-1252 (latin1) first — matches the spec
        let text: string;
        try {
          text = new TextDecoder('windows-1252').decode(buffer);
        } catch {
          text = new TextDecoder('utf-8').decode(buffer);
        }

        // Strip BOM if present
        text = text.replace(/^﻿/, '');

        // Auto-detect separator: prefer ; (spec) over ,
        const firstLine = text.split(/\r?\n/)[0] ?? '';
        const semiCount  = (firstLine.match(/;/g)  || []).length;
        const commaCount = (firstLine.match(/,/g)  || []).length;
        const sep = semiCount >= commaCount ? ';' : ',';

        const lines = text.split(/\r?\n/).filter(l => l.trim());
        if (lines.length < 2) throw new Error('El CSV está vacío o sin datos.');

        // Parse headers
        const headers = splitCsvLine(lines[0], sep).map(h =>
          h.trim().replace(/^"|"$/g, '').trim()
        );

        // Parse rows
        const rows: Record<string, unknown>[] = [];
        for (let i = 1; i < lines.length; i++) {
          const cells = splitCsvLine(lines[i], sep);
          const row: Record<string, unknown> = {};
          let hasData = false;
          headers.forEach((h, ci) => {
            const raw = (cells[ci] ?? '').trim().replace(/^"|"$/g, '').trim();
            row[h] = raw;
            if (raw) hasData = true;
          });
          if (hasData) rows.push(row);
        }

        const { columnMap, confidence } = detectColumns(headers, moduleType);
        resolve({
          headers: headers.filter(h => h !== ''),
          rows,
          confidence,
          columnMap,
          fileName: file.name,
          rowCount: rows.length,
        });
      } catch (err) {
        reject(new Error('No se pudo leer el CSV. Verificá el formato y encoding.'));
      }
    };
    reader.onerror = () => reject(new Error('Error al leer el archivo.'));
    reader.readAsArrayBuffer(file);
  });
}

// ── Excel parser ──────────────────────────────────────────────────────────────

async function parseExcelFile(file: File, moduleType: ModuleType): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'array', cellDates: true, cellText: false, codepage: 65001 });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const { headers, headerRow } = detectHeaders(sheet);
        const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');

        const rows: Record<string, unknown>[] = [];
        for (let r = headerRow + 1; r <= range.e.r; r++) {
          const row: Record<string, unknown> = {};
          let hasData = false;
          for (let c = range.s.c; c <= range.e.c; c++) {
            const cell = sheet[XLSX.utils.encode_cell({ r, c })];
            const header = headers[c - range.s.c] || `Col${c + 1}`;
            if (cell && cell.v !== undefined && cell.v !== null && cell.v !== '') {
              if (cell.t === 'd' || cell.v instanceof Date) row[header] = formatDateCell(cell);
              else if (typeof cell.v === 'string') row[header] = fixEncoding(cell.v);
              else row[header] = cell.v;
              hasData = true;
            } else {
              row[header] = '';
            }
          }
          if (hasData) rows.push(row);
        }

        const { columnMap, confidence } = detectColumns(headers, moduleType);
        resolve({ headers: headers.filter(h => h !== ''), rows, confidence, columnMap, fileName: file.name, rowCount: rows.length });
      } catch {
        reject(new Error('No se pudo leer el archivo Excel. Verificá que sea .xlsx, .xls o .csv válido.'));
      }
    };
    reader.onerror = () => reject(new Error('Error al leer el archivo.'));
    reader.readAsArrayBuffer(file);
  });
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function parseExcel(file: File, moduleType: ModuleType): Promise<ParseResult> {
  const ext = file.name.toLowerCase();
  if (ext.endsWith('.csv')) return parseCsvFile(file, moduleType);
  return parseExcelFile(file, moduleType);
}
