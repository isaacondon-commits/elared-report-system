import * as XLSX from 'xlsx';
import { resolveOperador } from './operadores';

// ─── Types ─────────────────────────────────────────────────────────────────────

export type LlamadaCall = [number, number, number, number]; // [hora, userIdx, statusIdx, len]

export interface LlamadasDup {
  unique: number;
  multi: number;
  maxrepeat: number;
  bucket: Record<number, number>;
  top: [string, number][];
}

export interface LlamadasData {
  total: number;
  date_min: string;
  date_max: string;
  users: string[];
  stats: string[];
  status_name: Record<string, string>;
  calls: LlamadaCall[];
  dup: LlamadasDup;
  fnames: string[];
  skipped: number;
}

interface Accumulator {
  users: string[];
  uidx: Record<string, number>;
  stats: string[];
  sidx: Record<string, number>;
  status_name: Record<string, string>;
  calls: LlamadaCall[];
  dial: Record<string, number>;
  min: Date | null;
  max: Date | null;
  fnames: string[];
  skipped: number;
}

// ─── Column detection ────────────────────────────────────────────────────────

const COL_CANDIDATES = {
  date:   ['call_date', 'fecha', 'entry_date', 'modify_date', 'date'],
  phone:  ['phone_number_dialed', 'phone_number', 'telefono', 'numero'],
  status: ['status', 'estado'],
  user:   ['user', 'usuario', 'agente', 'agent'],
  len:    ['length_in_sec', 'length_in_seconds', 'length', 'duracion', 'duration', 'segundos'],
  sname:  ['status_name', 'estado_nombre'],
};

function norm(s: unknown): string {
  return String(s ?? '').trim().toLowerCase();
}

function findCol(headers: string[], names: string[]): number {
  for (const n of names) {
    const i = headers.indexOf(n);
    if (i >= 0) return i;
  }
  return -1;
}

// ─── Date helpers — sin cellDates (raw:true) para evitar desfasaje de huso horario ──

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function getHour(v: unknown): number {
  if (v instanceof Date) return v.getUTCHours();
  if (typeof v === 'number') {
    const d = new Date(Math.round((v - 25569) * 86400 * 1000));
    return d.getUTCHours();
  }
  if (typeof v === 'string') {
    const m = v.match(/(\d{1,2}):(\d{2})/);
    if (m) return parseInt(m[1] ?? '0', 10);
    const d = new Date(v);
    if (!isNaN(d.getTime())) return d.getHours();
  }
  return 0;
}

export function toDate(v: unknown): Date | null {
  if (v instanceof Date) return v;
  if (typeof v === 'number') return new Date(Math.round((v - 25569) * 86400 * 1000));
  if (typeof v === 'string') {
    const d = new Date(v.replace(' ', 'T'));
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

function fmtDate(d: Date | null): string {
  if (!d) return '—';
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

// ─── ingest — traducción de ingest() del HTML ──────────────────────────────────

function ingest(aoa: unknown[][], fname: string, acc: Accumulator): { rows: number } {
  if (!aoa || aoa.length < 2) throw new Error(`${fname}: archivo vacío.`);

  const hdr = (aoa[0] ?? []).map(x => norm(x));
  const ci = {
    date:   findCol(hdr, COL_CANDIDATES.date),
    phone:  findCol(hdr, COL_CANDIDATES.phone),
    status: findCol(hdr, COL_CANDIDATES.status),
    user:   findCol(hdr, COL_CANDIDATES.user),
    len:    findCol(hdr, COL_CANDIDATES.len),
    sname:  findCol(hdr, COL_CANDIDATES.sname),
  };

  if (ci.status < 0) throw new Error(`${fname}: no encontré la columna "status".`);
  if (ci.len < 0) {
    throw new Error(
      `${fname}: No encontré la columna de duración (length_in_sec). Ese archivo no sirve para el análisis de 120 seg.`,
    );
  }

  let rows = 0;
  for (let r = 1; r < aoa.length; r++) {
    const row = aoa[r];
    if (!row) continue;

    const st: unknown = row[ci.status];
    if (st == null || st === '') { acc.skipped++; continue; }
    const stStr = String(st).trim();

    const us: unknown = ci.user >= 0 ? row[ci.user] : null;
    const usStr = (us == null || us === '') ? '(sin user)' : resolveOperador(String(us).trim());

    const lenRaw = row[ci.len];
    const ln = typeof lenRaw === 'number' ? lenRaw : (parseInt(String(lenRaw ?? ''), 10) || 0);

    const h = ci.date >= 0 ? getHour(row[ci.date]) : 0;

    if (!(stStr in acc.sidx)) { acc.sidx[stStr] = acc.stats.length; acc.stats.push(stStr); }
    if (!(usStr in acc.uidx)) { acc.uidx[usStr] = acc.users.length; acc.users.push(usStr); }
    if (ci.sname >= 0 && row[ci.sname] && !(stStr in acc.status_name)) {
      acc.status_name[stStr] = String(row[ci.sname]).trim();
    }

    const uIdx = acc.uidx[usStr] ?? 0;
    const sIdx = acc.sidx[stStr] ?? 0;
    acc.calls.push([h, uIdx, sIdx, ln]);

    if (ci.phone >= 0) {
      const p = row[ci.phone];
      if (p != null && p !== '') {
        const key = String(p).trim();
        acc.dial[key] = (acc.dial[key] ?? 0) + 1;
      }
    }
    if (ci.date >= 0) {
      const d = toDate(row[ci.date]);
      if (d) {
        if (!acc.min || d < acc.min) acc.min = d;
        if (!acc.max || d > acc.max) acc.max = d;
      }
    }
    rows++;
  }
  return { rows };
}

// ─── parseLlamadas — traducción de handleFiles() del HTML, multi-archivo ───────

export async function parseLlamadas(files: File[]): Promise<LlamadasData> {
  const validFiles = files.filter(f => /\.(xlsx|xls|csv)$/i.test(f.name));
  if (validFiles.length === 0) {
    throw new Error('Elegí un archivo .xlsx, .xls o .csv');
  }

  const acc: Accumulator = {
    users: [], uidx: {}, stats: [], sidx: {}, status_name: {},
    calls: [], dial: {}, min: null, max: null, fnames: [], skipped: 0,
  };

  for (const f of validFiles) {
    const buf = await f.arrayBuffer();
    const wb = XLSX.read(buf); // sin cellDates: las fechas quedan como serial
    const ws = wb.Sheets[wb.SheetNames[0] ?? ''];
    if (!ws) throw new Error(`${f.name}: no se pudo leer la hoja.`);
    const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null }) as unknown[][];
    const res = ingest(aoa, f.name, acc);
    acc.fnames.push(`${f.name} (${res.rows.toLocaleString('es-UY')} filas)`);
  }

  if (acc.calls.length === 0) {
    throw new Error('No se encontraron filas válidas.');
  }

  let unique = 0, multi = 0, maxrepeat = 0;
  const bucket: Record<number, number> = {};
  for (const k in acc.dial) {
    const v = acc.dial[k] ?? 0;
    unique++;
    if (v > 1) multi++;
    if (v > maxrepeat) maxrepeat = v;
    bucket[v] = (bucket[v] ?? 0) + 1;
  }
  const top: [string, number][] = Object.entries(acc.dial)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 60)
    .map(([k, v]) => [k, v]);

  return {
    total: acc.calls.length,
    date_min: fmtDate(acc.min),
    date_max: fmtDate(acc.max),
    users: acc.users,
    stats: acc.stats,
    status_name: acc.status_name,
    calls: acc.calls,
    dup: { unique, multi, maxrepeat, bucket, top },
    fnames: acc.fnames,
    skipped: acc.skipped,
  };
}

// ─── Display helpers ───────────────────────────────────────────────────────────

export function ddmmyyyy(stored: string): string {
  const m = stored.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return stored;
  return `${m[3]}/${m[2]}/${m[1]}`;
}
