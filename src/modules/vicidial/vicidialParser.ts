// ─── Pause classification ──────────────────────────────────────────────────────

export const PRODUCTIVAS = new Set(['VTAMOV', 'VENTA', 'CSUP', 'CONSUL', 'LLAMAD', 'GSA', 'WPP']);
export const TECNICAS    = new Set(['LAGGED', 'TECNIC', 'DISMX', 'MODIFI']);
const        NEUTRAS     = new Set(['AGUA', 'LOGIN', 'CHEQ', 'DCMX', 'DCMIX', 'PRESEN', 'RECLAM']);

export const PROGRAMADAS_LIMITES: Record<string, number> = {
  ALMUER: 30, ALMUÉR: 30, BAO: 10, BAÑO: 10, REUNIO: 60,
};

export const NOMBRES_LEGIBLES: Record<string, string> = {
  AGUA:   'Hidratación',      ALMUER:  'Almuerzo',         ALMUÉR:  'Almuerzo',
  BAO:    'Baño',             BAÑO:    'Baño',              CHEQ:    'Chequeo',
  CSUP:   'Cons. Supervisor', CONSUL:  'Consulta',          DCMX:    'Descanso Mix',
  DCMIX:  'Descanso Mix',     DISMX:   'Descanso Mix',      LAGGED:  'Lag técnico',
  LOGIN:  'Login',            MANUAL:  'Manual',            VTAMOV:  'Venta Móvil',
  VENTA:  'Venta',            GSA:     'Gestión SAC',       LLAMAD:  'Llamada',
  MODIFI: 'Modificación',     PRESEN:  'Presentismo',       RECLAM:  'Reclamo',
  REUNIO: 'Reunión',          TECNIC:  'Técnico',           WPP:     'WhatsApp',
};

export type PausaClasif = 'productiva' | 'programada' | 'tecnica' | 'neutra' | 'vigilar';

export function clasificarPausa(tipo: string): PausaClasif {
  if (PRODUCTIVAS.has(tipo)) return 'productiva';
  if (PROGRAMADAS_LIMITES[tipo] !== undefined) return 'programada';
  if (TECNICAS.has(tipo))  return 'tecnica';
  if (NEUTRAS.has(tipo))   return 'neutra';
  return 'vigilar';
}

export function getNombreLegible(tipo: string): string {
  return NOMBRES_LEGIBLES[tipo] ?? tipo;
}

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface VicidialAgente {
  usuario: string;
  id: string;
  llamadas: number;
  horaReloj: number;       // minutes
  inicioSesion: number;    // minutes
  enEspera: number;        // minutes
  pctEspera: number;
  hablando: number;        // minutes
  pctHablando: number;
  categorizando: number;   // minutes
  pctCategorizando: number;
  pausaTotal: number;      // minutes
  pctPausa: number;
  llamadaMuerta: number;   // minutes
  pctMuerta: number;
  pausas: Record<string, number>;
  pausaOciosa: number;
  pausaProductiva: number;
  eficiencia: number;      // pctHablando + pctCategorizando
  almuerzoExcedido: boolean;
  baoExcedido: boolean;
  manualAlto: boolean;
}

export interface VicidialData {
  fecha: string;
  rangoInicio: string;
  rangoFin: string;
  agentes: VicidialAgente[];
  totales: VicidialAgente;
  tiposPausa: string[];
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

export function parseVicidialTime(val: string): number {
  const s = (val ?? '').trim();
  if (!s) return 0;
  const parts = s.split(':');
  if (parts.length >= 3) {
    return parseInt(parts[0] ?? '0') * 60 + parseInt(parts[1] ?? '0') + parseInt(parts[2] ?? '0') / 60;
  }
  if (parts.length === 2) {
    return parseInt(parts[0] ?? '0') * 60 + parseInt(parts[1] ?? '0');
  }
  return 0;
}

export function parsePct(val: string): number {
  const s = (val ?? '').trim();
  if (!s) return 0;
  return parseFloat(s.replace('%', '').trim()) || 0;
}

export function fmtMins(mins: number): string {
  const m = Math.round(mins);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  if (rem === 0) return `${h}h`;
  return `${h}h ${String(rem).padStart(2, '0')}min`;
}

function norm(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

function findIdx(headers: string[], ...terms: string[]): number {
  const nh = headers.map(h => norm(h));
  const nt = terms.map(t => norm(t));
  return nh.findIndex(h => nt.some(t => h === t));
}

// Exported helpers for finding specific pause keys across modules
export function findAlmuerzoKey(tiposPausa: string[]): string | undefined {
  return tiposPausa.find(t => norm(t).startsWith('almu'));
}
export function findBaoKey(tiposPausa: string[]): string | undefined {
  return tiposPausa.find(t => norm(t) === 'bao' || norm(t) === 'bano');
}
export function findManualKey(tiposPausa: string[]): string | undefined {
  return tiposPausa.find(t => norm(t) === 'manual');
}
export function findVtamovKey(tiposPausa: string[]): string | undefined {
  return tiposPausa.find(t => norm(t) === 'vtamov' || norm(t) === 'venta');
}
export function findLaggedKey(tiposPausa: string[]): string | undefined {
  return tiposPausa.find(t => norm(t) === 'lagged' || norm(t) === 'tecnic');
}

// ─── Main parser ───────────────────────────────────────────────────────────────

export async function parseVicidial(file: File): Promise<VicidialData> {
  const text = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve((e.target?.result as string) ?? '');
    reader.onerror = () => reject(new Error('Error al leer el archivo'));
    reader.readAsText(file, 'UTF-8');
  });

  const lines = text.split(/\r?\n/);

  // Line 0: title with date "Tiempo detallado de agentes  YYYY-MM-DD HH:MM:SS"
  const fecha = (lines[0] ?? '').match(/(\d{4}-\d{2}-\d{2})/)?.[1] ?? '';

  // Line 1: time range
  const rangoLine = (lines[1] ?? '').trim();
  const rangoMatch = rangoLine.match(/(\d{1,2}:\d{2}(?::\d{2})?)\s*[-–a]\s*(\d{1,2}:\d{2}(?::\d{2})?)/);
  const rangoInicio = rangoMatch?.[1] ?? '';
  const rangoFin    = rangoMatch?.[2] ?? '';

  // Line 3: headers
  const headers = (lines[3] ?? '').split(',').map(h => h.trim());

  // Detect pause columns dynamically (between CONNECTED and VISIBLE)
  const connIdx = findIdx(headers, 'CONNECTED');
  const visIdx  = findIdx(headers, 'VISIBLE');
  const tiposPausa: string[] = [];
  if (connIdx >= 0 && visIdx > connIdx) {
    for (let i = connIdx + 1; i < visIdx; i++) {
      const t = headers[i]?.trim();
      if (t) tiposPausa.push(t);
    }
  }

  // Fixed column indices
  const IDX_USUARIO  = findIdx(headers, 'Usuario');
  const IDX_ID       = findIdx(headers, 'Identificación', 'Identificacion');
  const IDX_LLAMADAS = findIdx(headers, 'Llamadas');
  const IDX_H_RELOJ  = findIdx(headers, 'Hora reloj');
  const IDX_SESION   = findIdx(headers, 'Inicio sesión', 'Inicio sesion');
  const IDX_ESPERA   = findIdx(headers, 'En espera');
  const IDX_PESPERA  = findIdx(headers, '% Espera');
  const IDX_HABLA    = findIdx(headers, 'Hablando');
  const IDX_PHABLA   = findIdx(headers, '% Tiempo en conversación', '% Tiempo en conversacion');
  const IDX_CATEG    = findIdx(headers, 'Categorizando');
  const IDX_PCATEG   = findIdx(headers, '% Tiempo categorizando');
  const IDX_PAUSA    = findIdx(headers, 'Pausa');
  const IDX_PPAUSA   = findIdx(headers, '% Tiempo en pausa');
  const IDX_LMUERTA  = findIdx(headers, 'Llam. muerta');
  const IDX_PMUERTA  = findIdx(headers, '% Tiempo muerto');

  // Map each pause type to its column index
  const pausaIdxMap = new Map<string, number>();
  for (const tipo of tiposPausa) {
    const idx = headers.findIndex(h => h.trim() === tipo);
    if (idx >= 0) pausaIdxMap.set(tipo, idx);
  }

  const almuerzoKey = findAlmuerzoKey(tiposPausa);
  const baoKey      = findBaoKey(tiposPausa);
  const manualKey   = findManualKey(tiposPausa);

  const agentes: VicidialAgente[]  = [];
  let totalesRow: VicidialAgente | null = null;

  for (let i = 4; i < lines.length; i++) {
    const line = lines[i]?.trim();
    if (!line) continue;

    const cols = line.split(',').map(c => c.trim());
    const usuario = IDX_USUARIO >= 0 ? (cols[IDX_USUARIO] ?? '').trim() : '';
    if (!usuario) continue;

    const isTotales = usuario.toUpperCase() === 'TOTALES';
    const g = (idx: number) => (idx >= 0 ? (cols[idx] ?? '') : '').trim();

    const pausas: Record<string, number> = {};
    for (const tipo of tiposPausa) {
      const idx = pausaIdxMap.get(tipo) ?? -1;
      pausas[tipo] = idx >= 0 ? parseVicidialTime(cols[idx] ?? '') : 0;
    }

    const pausaTotal = parseVicidialTime(g(IDX_PAUSA));
    let sumProductivas = 0, sumTecnicas = 0;
    for (const tipo of tiposPausa) {
      const v = pausas[tipo] ?? 0;
      if (PRODUCTIVAS.has(tipo)) sumProductivas += v;
      if (TECNICAS.has(tipo))    sumTecnicas    += v;
    }

    const pctHablando      = parsePct(g(IDX_PHABLA));
    const pctCategorizando = parsePct(g(IDX_PCATEG));
    const almuerzoMins     = almuerzoKey ? (pausas[almuerzoKey] ?? 0) : 0;
    const baoMins          = baoKey      ? (pausas[baoKey]      ?? 0) : 0;
    const manualMins       = manualKey   ? (pausas[manualKey]   ?? 0) : 0;

    const agente: VicidialAgente = {
      usuario,
      id:               g(IDX_ID),
      llamadas:         parseInt(g(IDX_LLAMADAS)) || 0,
      horaReloj:        parseVicidialTime(g(IDX_H_RELOJ)),
      inicioSesion:     parseVicidialTime(g(IDX_SESION)),
      enEspera:         parseVicidialTime(g(IDX_ESPERA)),
      pctEspera:        parsePct(g(IDX_PESPERA)),
      hablando:         parseVicidialTime(g(IDX_HABLA)),
      pctHablando,
      categorizando:    parseVicidialTime(g(IDX_CATEG)),
      pctCategorizando,
      pausaTotal,
      pctPausa:         parsePct(g(IDX_PPAUSA)),
      llamadaMuerta:    parseVicidialTime(g(IDX_LMUERTA)),
      pctMuerta:        parsePct(g(IDX_PMUERTA)),
      pausas,
      pausaOciosa:      Math.max(0, pausaTotal - sumProductivas - sumTecnicas),
      pausaProductiva:  sumProductivas,
      eficiencia:       pctHablando + pctCategorizando,
      almuerzoExcedido: almuerzoMins > (almuerzoKey ? (PROGRAMADAS_LIMITES[almuerzoKey] ?? 30) : 30),
      baoExcedido:      baoMins > (baoKey ? (PROGRAMADAS_LIMITES[baoKey] ?? 10) : 10),
      manualAlto:       manualMins > 15,
    };

    if (isTotales) totalesRow = agente;
    else           agentes.push(agente);
  }

  if (agentes.length === 0) {
    throw new Error('No se pudieron extraer agentes del archivo. Verificá que sea el CSV de Vicidial "Tiempo detallado de agentes".');
  }

  // Synthetic totals if not present in file
  if (!totalesRow) {
    const n = agentes.length;
    const avg = (fn: (a: VicidialAgente) => number) => n > 0 ? agentes.reduce((s, a) => s + fn(a), 0) / n : 0;
    const sum = (fn: (a: VicidialAgente) => number) => agentes.reduce((s, a) => s + fn(a), 0);
    const sumPausas: Record<string, number> = {};
    for (const tipo of tiposPausa) {
      sumPausas[tipo] = sum(a => a.pausas[tipo] ?? 0);
    }
    totalesRow = {
      usuario: 'TOTALES', id: '',
      llamadas:         sum(a => a.llamadas),
      horaReloj:        sum(a => a.horaReloj),
      inicioSesion:     sum(a => a.inicioSesion),
      enEspera:         sum(a => a.enEspera),
      pctEspera:        avg(a => a.pctEspera),
      hablando:         sum(a => a.hablando),
      pctHablando:      avg(a => a.pctHablando),
      categorizando:    sum(a => a.categorizando),
      pctCategorizando: avg(a => a.pctCategorizando),
      pausaTotal:       sum(a => a.pausaTotal),
      pctPausa:         avg(a => a.pctPausa),
      llamadaMuerta:    sum(a => a.llamadaMuerta),
      pctMuerta:        avg(a => a.pctMuerta),
      pausas:           sumPausas,
      pausaOciosa:      sum(a => a.pausaOciosa),
      pausaProductiva:  sum(a => a.pausaProductiva),
      eficiencia:       avg(a => a.eficiencia),
      almuerzoExcedido: false, baoExcedido: false, manualAlto: false,
    };
  }

  return { fecha, rangoInicio, rangoFin, agentes, totales: totalesRow, tiposPausa };
}
