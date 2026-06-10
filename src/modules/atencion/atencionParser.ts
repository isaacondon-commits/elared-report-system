// ─── Types ────────────────────────────────────────────────────────────────────

export interface HoraDesglose {
  hora: number;
  llamadas: number;
  respuestas: number;
  abandono: number;
  conversacionTotal: number; // seconds
  charlaPromedio: number;    // seconds
  tiempoTotalCola: number;   // seconds
  tiempoMedioCola: number;   // seconds
  tiempoMaxCola: number;     // seconds
  tasaRespuesta: number;     // 0-100
  tasaAbandono: number;      // 0-100
  esHoraPico: boolean;
  alertaAbandono: boolean;   // tasaAbandono > 15%
}

export interface GrupoAtencion {
  nombre: string;
  nombreLegible: string;
  llamadas: number;
  respuestas: number;
  abandono: number;
  conversacionTotal: number;
  charlaPromedio: number;
  tiempoTotalCola: number;
  tiempoMedioCola: number;
  tiempoMaxCola: number;
  tasaRespuesta: number;
  tasaAbandono: number;
  horasDesglose: HoraDesglose[];
}

export interface AtencionTotales {
  llamadas: number;
  respuestas: number;
  abandono: number;
  tasaRespuesta: number;
  tasaAbandono: number;
  conversacionTotal: number;
  charlaPromedio: number;
  tiempoMedioCola: number;
}

export interface AtencionData {
  fecha: string;
  grupos: GrupoAtencion[];
  totales: AtencionTotales;
}

// ─── Name mapping ─────────────────────────────────────────────────────────────

const NOMBRES_LEGIBLES: Record<string, string> = {
  ELAREDINGROUP:  'Elared',
  MOVILOGINGROUP: 'Móvil',
  PHINGROUP:      'Phin',
};

export function getNombreLegible(nombre: string): string {
  return NOMBRES_LEGIBLES[nombre] ?? nombre;
}

export const GRUPO_COLORS: Record<string, string> = {
  ELAREDINGROUP:  '#003DA5',
  MOVILOGINGROUP: '#6f42c1',
  PHINGROUP:      '#20c997',
};

export function getGrupoColor(nombre: string): string {
  return GRUPO_COLORS[nombre] ?? '#64748b';
}

// ─── Time helpers ─────────────────────────────────────────────────────────────

export function parseTimeSecs(val: string): number {
  const s = (val ?? '').trim();
  if (!s) return 0;
  const parts = s.split(':').map(p => parseInt(p) || 0);
  if (parts.length === 3) return (parts[0] ?? 0) * 3600 + (parts[1] ?? 0) * 60 + (parts[2] ?? 0);
  if (parts.length === 2) return (parts[0] ?? 0) * 60 + (parts[1] ?? 0);
  return parseInt(s) || 0;
}

// Strip surrounding quotes from a CSV column value
function cleanCol(s: string): string {
  return s.replace(/"/g, '').trim();
}

function parseCSVNumber(val: string): number {
  const limpio = cleanCol(val);
  const num = parseInt(limpio, 10);
  return isNaN(num) ? 0 : num;
}

function parseCSVTime(val: string): number {
  const limpio = cleanCol(val);
  if (!limpio) return 0;
  const partes = limpio.split(':');
  if (partes.length === 3)
    return (parseInt(partes[0]) || 0) * 3600 + (parseInt(partes[1]) || 0) * 60 + (parseInt(partes[2]) || 0);
  if (partes.length === 2)
    return (parseInt(partes[0]) || 0) * 60 + (parseInt(partes[1]) || 0);
  return 0;
}

export function fmtSecs(secs: number): string {
  const s = Math.round(secs);
  if (s <= 0) return '0seg';
  if (s < 60) return `${s}seg`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m >= 60) {
    const h = Math.floor(m / 60);
    const mm = m % 60;
    return mm > 0 ? `${h}h ${mm}min` : `${h}h`;
  }
  return `${m}:${String(r).padStart(2, '0')} min`;
}

// ─── Row parser ───────────────────────────────────────────────────────────────

interface RowData {
  llamadas: number; respuestas: number; abandono: number;
  conversacionTotal: number; charlaPromedio: number;
  tiempoTotalCola: number; tiempoMedioCola: number; tiempoMaxCola: number;
}

function parseRow(cols: string[]): RowData {
  return {
    llamadas:          parseCSVNumber(cols[1] ?? ''),
    respuestas:        parseCSVNumber(cols[2] ?? ''),
    conversacionTotal: parseCSVTime(cols[3] ?? ''),
    charlaPromedio:    parseCSVTime(cols[4] ?? ''),
    tiempoTotalCola:   parseCSVTime(cols[5] ?? ''),
    tiempoMedioCola:   parseCSVTime(cols[6] ?? ''),
    tiempoMaxCola:     parseCSVTime(cols[7] ?? ''),  // índice fijo — evita problema con \x81 en header
    abandono:          parseCSVNumber(cols[8] ?? ''),
  };
}

function tasa(num: number, den: number) { return den > 0 ? (num / den) * 100 : 0; }

// ─── Main parser ──────────────────────────────────────────────────────────────

export async function parseAtencion(file: File): Promise<AtencionData> {
  const text = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve((e.target?.result as string) ?? '');
    reader.onerror = () => reject(new Error('Error al leer el archivo'));
    reader.readAsText(file, 'latin1');
  });

  const lines = text.split(/\r?\n/);

  // Line 0: date
  const fecha = (lines[0] ?? '').match(/(\d{4}-\d{2}-\d{2})/)?.[1] ?? '';

  let idx = 2; // header line of summary

  // Skip headers row (idx=2)
  idx++;

  // Parse summary section
  const gruposMap = new Map<string, GrupoAtencion>();
  let totalesData: AtencionTotales = {
    llamadas: 0, respuestas: 0, abandono: 0,
    tasaRespuesta: 0, tasaAbandono: 0,
    conversacionTotal: 0, charlaPromedio: 0, tiempoMedioCola: 0,
  };

  while (idx < lines.length) {
    const line = (lines[idx] ?? '').trim();
    idx++;
    if (!line) break; // empty line ends summary section

    const cols = line.split(',').map(c => c.trim());
    const nombre = cleanCol(cols[0] ?? '');
    if (!nombre) continue;

    if (nombre.toUpperCase() === 'TOTALS') {
      const r = parseRow(cols);
      totalesData = {
        llamadas:          r.llamadas,
        respuestas:        r.respuestas,
        abandono:          r.abandono,
        tasaRespuesta:     tasa(r.respuestas, r.llamadas),
        tasaAbandono:      tasa(r.abandono, r.llamadas),
        conversacionTotal: r.conversacionTotal,
        charlaPromedio:    r.charlaPromedio,
        tiempoMedioCola:   r.tiempoMedioCola,
      };
      break;
    }

    // Skip header/label rows: group names are all-uppercase, headers have mixed case
    if (nombre !== nombre.toUpperCase()) continue;

    const r = parseRow(cols);
    gruposMap.set(nombre, {
      nombre,
      nombreLegible: getNombreLegible(nombre),
      ...r,
      tasaRespuesta: tasa(r.respuestas, r.llamadas),
      tasaAbandono:  tasa(r.abandono, r.llamadas),
      horasDesglose: [],
    });
  }

  // Skip remaining empty lines before hourly sections
  while (idx < lines.length && !(lines[idx] ?? '').trim()) idx++;

  // Parse hourly sections
  while (idx < lines.length) {
    const line = (lines[idx] ?? '').trim();
    idx++;
    if (!line) continue;

    // Group section header: "ELAREDINGROUP - ELAREDINGROUP" (may have surrounding quotes)
    const lineClean = line.replace(/"/g, '').trim();
    const dashIdx = lineClean.indexOf(' - ');
    if (dashIdx > 0) {
      const groupName = lineClean.substring(0, dashIdx).trim();
      // Next: "HOURLY BREAKDOWN:"
      if ((lines[idx] ?? '').trim().toUpperCase().includes('HOURLY')) idx++;
      // Next: headers
      idx++;

      const horas: HoraDesglose[] = [];

      while (idx < lines.length) {
        const horaLine = (lines[idx] ?? '').trim();
        idx++;
        if (!horaLine) break;

        const horaCols = horaLine.split(',').map(c => c.trim());
        const horaStr = cleanCol(horaCols[0] ?? '');
        if (horaStr.toUpperCase() === 'TOTALS') break;

        const horaNum = parseInt(horaStr, 10);
        if (isNaN(horaNum)) continue;

        const r = parseRow(horaCols);
        horas.push({
          hora: horaNum,
          ...r,
          tasaRespuesta:  tasa(r.respuestas, r.llamadas),
          tasaAbandono:   tasa(r.abandono, r.llamadas),
          esHoraPico:     false,
          alertaAbandono: r.llamadas > 0 && tasa(r.abandono, r.llamadas) > 15,
        });
      }

      // Mark hour with most calls as pico
      if (horas.length > 0) {
        const maxL = Math.max(...horas.map(h => h.llamadas));
        horas.forEach(h => { h.esHoraPico = h.llamadas === maxL && maxL > 0; });
      }

      // Assign hourly data to matching group
      const grupo = gruposMap.get(groupName)
        ?? Array.from(gruposMap.values()).find(g =>
            g.nombre.includes(groupName) || groupName.includes(g.nombre)
          );
      if (grupo) {
        grupo.horasDesglose = horas;
      } else if (horas.length > 0) {
        // Group appeared only in hourly section — derive summary from hourly
        const sum = horas.reduce((a, h) => ({
          llamadas:         a.llamadas + h.llamadas,
          respuestas:       a.respuestas + h.respuestas,
          abandono:         a.abandono + h.abandono,
          conversacionTotal: a.conversacionTotal + h.conversacionTotal,
          charlaPromedio:   0,
          tiempoTotalCola:  a.tiempoTotalCola + h.tiempoTotalCola,
          tiempoMedioCola:  0,
          tiempoMaxCola:    Math.max(a.tiempoMaxCola, h.tiempoMaxCola),
        }), { llamadas: 0, respuestas: 0, abandono: 0, conversacionTotal: 0, charlaPromedio: 0, tiempoTotalCola: 0, tiempoMedioCola: 0, tiempoMaxCola: 0 });

        gruposMap.set(groupName, {
          nombre:       groupName,
          nombreLegible: getNombreLegible(groupName),
          ...sum,
          tasaRespuesta: tasa(sum.respuestas, sum.llamadas),
          tasaAbandono:  tasa(sum.abandono, sum.llamadas),
          horasDesglose: horas,
        });
      }
    }
  }

  const grupos = Array.from(gruposMap.values());

  if (grupos.length === 0) {
    throw new Error('No se encontraron grupos. Verificá que sea el reporte "Informe Resumen de Entradas x Hora".');
  }

  // Compute totals from groups if not found
  if (totalesData.llamadas === 0) {
    const l = grupos.reduce((s, g) => s + g.llamadas, 0);
    const r = grupos.reduce((s, g) => s + g.respuestas, 0);
    const a = grupos.reduce((s, g) => s + g.abandono, 0);
    totalesData = {
      llamadas: l, respuestas: r, abandono: a,
      tasaRespuesta: tasa(r, l), tasaAbandono: tasa(a, l),
      conversacionTotal: grupos.reduce((s, g) => s + g.conversacionTotal, 0),
      charlaPromedio:    l > 0 ? grupos.reduce((s, g) => s + g.charlaPromedio * g.llamadas, 0) / l : 0,
      tiempoMedioCola:   l > 0 ? grupos.reduce((s, g) => s + g.tiempoMedioCola * g.llamadas, 0) / l : 0,
    };
  }

  return { fecha, grupos, totales: totalesData };
}

// ─── Hourly aggregation helper ────────────────────────────────────────────────

export function agregarHorasTodos(grupos: GrupoAtencion[]): HoraDesglose[] {
  const allHours = [...new Set(grupos.flatMap(g => g.horasDesglose.map(h => h.hora)))].sort((a, b) => a - b);
  return allHours.map(hora => {
    const hh = grupos.flatMap(g => g.horasDesglose.filter(h => h.hora === hora));
    const llamadas     = hh.reduce((s, h) => s + h.llamadas, 0);
    const respuestas   = hh.reduce((s, h) => s + h.respuestas, 0);
    const abandono     = hh.reduce((s, h) => s + h.abandono, 0);
    const convTotal    = hh.reduce((s, h) => s + h.conversacionTotal, 0);
    const colaTotal    = hh.reduce((s, h) => s + h.tiempoTotalCola, 0);
    const colaMedioW   = llamadas > 0 ? hh.reduce((s, h) => s + h.tiempoMedioCola * h.llamadas, 0) / llamadas : 0;
    const colaMax      = Math.max(0, ...hh.map(h => h.tiempoMaxCola));
    const charlaW      = llamadas > 0 ? hh.reduce((s, h) => s + h.charlaPromedio * h.llamadas, 0) / llamadas : 0;
    const tasaResp     = tasa(respuestas, llamadas);
    const tasaAban     = tasa(abandono, llamadas);
    return {
      hora, llamadas, respuestas, abandono,
      conversacionTotal: convTotal,
      charlaPromedio:    charlaW,
      tiempoTotalCola:   colaTotal,
      tiempoMedioCola:   colaMedioW,
      tiempoMaxCola:     colaMax,
      tasaRespuesta:     tasaResp,
      tasaAbandono:      tasaAban,
      esHoraPico:        false,
      alertaAbandono:    tasaAban > 15,
    };
  });
}
