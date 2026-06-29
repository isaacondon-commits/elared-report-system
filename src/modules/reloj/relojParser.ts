import * as XLSX from 'xlsx';
import { type HorarioPersona, buscarHorarioPersona, getHorarioDia } from '../../data/horarios_personal';

// ─── Types ─────────────────────────────────────────────────────────────────────

export type RolMarcacion =
  | 'INGRESO'
  | 'SALIDA_DESCANSO'
  | 'REGRESO_DESCANSO'
  | 'SALIDA_FINAL'
  | 'DATO_INCOMPLETO'
  | 'MARCACION_EXTRA';

export type EstadoDia =
  | 'OK'
  | 'TARDANZA'
  | 'TARDANZA_GRAVE'
  | 'DESCANSO_EXTENDIDO'
  | 'SALIDA_ANTICIPADA'
  | 'DATO_INCOMPLETO'
  | 'AUSENTE'
  | 'FIN_SEMANA';

export interface Marcacion {
  minutos: number;
  hora: string;
  rol: RolMarcacion;
}

export interface DiaData {
  fecha: string;
  marcaciones: Marcacion[];
  ingreso: string | null;
  salidaDescanso: string | null;
  regresoDescanso: string | null;
  salidaFinal: string | null;
  minutosIngreso: number | null;
  minutosSalidaDescanso: number | null;
  minutosRegresoDescanso: number | null;
  minutosSalidaFinal: number | null;
  minutosJornada: number | null;
  minutosDescanso: number | null;
  minutosTardanza: number;
  minutosDescansoExtra: number;
  minutosSalidaAnticipada: number;
  horasExtrasMinutos: number;
  estado: EstadoDia;
}

export interface HorarioEsperado {
  ingresoEsperado: string;
  salidaEsperada: string;
  descansoSalida: string;
  descansoRegreso: string;
  duracionDescansoMinutos: number;
  toleranciaIngreso: number;
  diasConDatosCompletos: number;
  fuenteHorario: 'horario_oficial' | 'horario_custom' | 'inferido';
  nombreEnConfig?: string;
  horarioPersona?: HorarioPersona;
}

export interface EmpleadoData {
  nombre: string;
  id: string;
  departamento: string;
  dias: Map<string, DiaData>;
  horario: HorarioEsperado;
  fechaMin: string;
  fechaMax: string;
  diasLaborables: number;
  diasPresentes: number;
  tardanzas: number;
  tardanzasGraves: number;
  minutosTardanzaTotal: number;
  descansosExtendidos: number;
  salidasAnticipadas: number;
  ausencias: number;
  diasIncompletos: number;
  puntualidadPct: number;
  jornadaPromedioMinutos: number;
  totalHorasExtrasMinutos: number;
  diasConExtras: number;
  promedioExtrasMinutos: number;
}

export interface RelojData {
  empleados: EmpleadoData[];
  fechaMin: string;
  fechaMax: string;
  totalMarcaciones: number;
}

// ─── Low-level helpers ─────────────────────────────────────────────────────────

export function minsToHHMM(mins: number): string {
  const h = Math.floor(Math.abs(mins) / 60);
  const m = Math.abs(mins) % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function parseHHMM(hhmm: string): number {
  if (!hhmm) return 0;
  const parts = hhmm.split(':');
  return parseInt(parts[0] ?? '0') * 60 + parseInt(parts[1] ?? '0');
}

function mediana(sorted: number[]): number {
  if (sorted.length === 0) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : sorted[mid];
}

function parseFechaCell(val: unknown): string | null {
  if (val === null || val === undefined || val === '') return null;

  if (typeof val === 'number') {
    // Excel date serial — offset is 25569 days from 1970-01-01 to 1899-12-30
    const d = new Date(Math.round((val - 25569) * 86400000));
    const y = d.getUTCFullYear();
    if (y < 1990 || y > 2100) return null;
    return `${y}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  }

  if (typeof val === 'string') {
    const iso = val.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
    const dmy = val.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
    return null;
  }

  if (val instanceof Date) {
    const y = val.getUTCFullYear();
    if (y < 1990 || y > 2100) return null;
    return `${y}-${String(val.getUTCMonth() + 1).padStart(2, '0')}-${String(val.getUTCDate()).padStart(2, '0')}`;
  }

  return null;
}

function parseHoraCell(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null;

  if (typeof val === 'number') {
    const frac = val >= 1 ? val - Math.floor(val) : val;
    const mins = Math.round(frac * 24 * 60) % (24 * 60);
    return mins >= 0 ? mins : null;
  }

  if (typeof val === 'string') {
    const m = val.match(/(\d{1,2})[:\.](\d{2})/);
    if (m) return parseInt(m[1]) * 60 + parseInt(m[2]);
    return null;
  }

  if (val instanceof Date) {
    return val.getUTCHours() * 60 + val.getUTCMinutes();
  }

  return null;
}

function normalizarNombre(raw: string): string {
  return raw.trim().replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
}

// Returns all Mon-Fri days in the range (legacy export, used by calendar/charts)
export function getLaborableDays(fechaMin: string, fechaMax: string): string[] {
  const days: string[] = [];
  if (!fechaMin || !fechaMax) return days;
  const d = new Date(fechaMin + 'T12:00:00');
  const end = new Date(fechaMax + 'T12:00:00');
  while (d <= end) {
    if (d.getDay() !== 0 && d.getDay() !== 6) {
      days.push(
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
      );
    }
    d.setDate(d.getDate() + 1);
  }
  return days;
}

// Returns days the person actually works — respects official schedule (including Sat/Sun)
function getDiasLaborablesPersona(
  fechaMin: string,
  fechaMax: string,
  horarioPersona: HorarioPersona | undefined,
): string[] {
  const days: string[] = [];
  if (!fechaMin || !fechaMax) return days;
  const d = new Date(fechaMin + 'T12:00:00');
  const end = new Date(fechaMax + 'T12:00:00');
  while (d <= end) {
    const dow = d.getDay();
    const trabaja = horarioPersona
      ? getHorarioDia(horarioPersona, dow).trabaja
      : dow !== 0 && dow !== 6;
    if (trabaja) {
      days.push(
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
      );
    }
    d.setDate(d.getDate() + 1);
  }
  return days;
}

// ─── Core algorithms ───────────────────────────────────────────────────────────

function inferirRolMarcacion(mcs: Marcacion[]): void {
  const n = mcs.length;
  if (n === 0) return;

  if (n === 1) {
    mcs[0].rol = 'DATO_INCOMPLETO';
    return;
  }

  if (n === 2) {
    mcs[0].rol = mcs[0].minutos < 12 * 60 ? 'INGRESO' : 'DATO_INCOMPLETO';
    mcs[1].rol = mcs[1].minutos > 14 * 60 ? 'SALIDA_FINAL' : 'DATO_INCOMPLETO';
    return;
  }

  if (n === 3) {
    mcs[0].rol = 'INGRESO';
    mcs[1].rol = 'SALIDA_DESCANSO';
    mcs[2].rol = mcs[2].minutos > 17 * 60 ? 'SALIDA_FINAL' : 'REGRESO_DESCANSO';
    return;
  }

  // n >= 4: día completo
  mcs[0].rol = 'INGRESO';
  mcs[1].rol = 'SALIDA_DESCANSO';
  mcs[2].rol = 'REGRESO_DESCANSO';
  mcs[3].rol = 'SALIDA_FINAL';
  for (let i = 4; i < n; i++) mcs[i].rol = 'MARCACION_EXTRA';
}

function detectarHorarioEsperado(dias: Map<string, DiaData>, nombre: string): HorarioEsperado {
  // Try official/custom schedule first
  const resultado = buscarHorarioPersona(nombre);
  if (resultado) {
    const { persona, fuente } = resultado;
    const repr = persona.lunesAMiercoles.trabaja ? persona.lunesAMiercoles : persona.jueveYViernes;
    return {
      ingresoEsperado: repr.trabaja ? repr.ingreso : '09:00',
      salidaEsperada: repr.trabaja ? repr.salida : '18:00',
      descansoSalida: '13:00',
      descansoRegreso: '14:00',
      duracionDescansoMinutos: 60,
      toleranciaIngreso: 10,
      diasConDatosCompletos: 0,
      fuenteHorario: fuente,
      nombreEnConfig: persona.nombre,
      horarioPersona: persona,
    };
  }

  // Fall back to inference from marcaciones
  const diasCompletos = Array.from(dias.values()).filter(
    d =>
      d.marcaciones.length >= 4 &&
      d.minutosIngreso !== null &&
      d.minutosSalidaDescanso !== null &&
      d.minutosRegresoDescanso !== null &&
      d.minutosSalidaFinal !== null &&
      d.minutosDescanso !== null &&
      d.minutosDescanso > 0,
  );

  if (diasCompletos.length === 0) {
    const diasParciales = Array.from(dias.values()).filter(
      d => d.minutosIngreso !== null && d.minutosSalidaFinal !== null,
    );
    if (diasParciales.length > 0) {
      const ingresos = diasParciales.map(d => d.minutosIngreso!).sort((a, b) => a - b);
      const salidas = diasParciales.map(d => d.minutosSalidaFinal!).sort((a, b) => a - b);
      return {
        ingresoEsperado: minsToHHMM(mediana(ingresos)),
        salidaEsperada: minsToHHMM(mediana(salidas)),
        descansoSalida: '13:00',
        descansoRegreso: '14:00',
        duracionDescansoMinutos: 60,
        toleranciaIngreso: 10,
        diasConDatosCompletos: 0,
        fuenteHorario: 'inferido',
      };
    }
    return {
      ingresoEsperado: '09:00',
      salidaEsperada: '18:00',
      descansoSalida: '13:00',
      descansoRegreso: '14:00',
      duracionDescansoMinutos: 60,
      toleranciaIngreso: 10,
      diasConDatosCompletos: 0,
      fuenteHorario: 'inferido',
    };
  }

  const s = (a: number, b: number) => a - b;
  return {
    ingresoEsperado:          minsToHHMM(mediana(diasCompletos.map(d => d.minutosIngreso!).sort(s))),
    salidaEsperada:           minsToHHMM(mediana(diasCompletos.map(d => d.minutosSalidaFinal!).sort(s))),
    descansoSalida:           minsToHHMM(mediana(diasCompletos.map(d => d.minutosSalidaDescanso!).sort(s))),
    descansoRegreso:          minsToHHMM(mediana(diasCompletos.map(d => d.minutosRegresoDescanso!).sort(s))),
    duracionDescansoMinutos:  mediana(diasCompletos.map(d => d.minutosDescanso!).sort(s)),
    toleranciaIngreso:        10,
    diasConDatosCompletos:    diasCompletos.length,
    fuenteHorario:            'inferido',
  };
}

export function calcularMetricas(
  dias: Map<string, DiaData>,
  horario: HorarioEsperado,
): Pick<
  EmpleadoData,
  | 'tardanzas'
  | 'tardanzasGraves'
  | 'minutosTardanzaTotal'
  | 'descansosExtendidos'
  | 'salidasAnticipadas'
  | 'ausencias'
  | 'diasIncompletos'
  | 'diasPresentes'
  | 'puntualidadPct'
  | 'jornadaPromedioMinutos'
  | 'totalHorasExtrasMinutos'
  | 'diasConExtras'
  | 'promedioExtrasMinutos'
> {
  let tardanzas = 0, tardanzasGraves = 0, minutosTardanzaTotal = 0;
  let descansosExtendidos = 0, salidasAnticipadas = 0, ausencias = 0;
  let diasIncompletos = 0, diasPresentes = 0;
  let totalJornada = 0, diasConJornada = 0;
  let totalHorasExtrasMinutos = 0, diasConExtras = 0;

  for (const dia of dias.values()) {
    const dow = new Date(dia.fecha + 'T12:00:00').getDay();

    // Determine if this day is a workday and get the expected times
    let ingresoEsp: number;
    let salidaEsp: number;
    let esLaborable: boolean;

    if (horario.horarioPersona) {
      const hDia = getHorarioDia(horario.horarioPersona, dow);
      esLaborable = hDia.trabaja;
      ingresoEsp = hDia.trabaja ? parseHHMM(hDia.ingreso) : parseHHMM(horario.ingresoEsperado);
      salidaEsp  = hDia.trabaja ? parseHHMM(hDia.salida)  : parseHHMM(horario.salidaEsperada);
    } else {
      esLaborable = dow !== 0 && dow !== 6;
      ingresoEsp = parseHHMM(horario.ingresoEsperado);
      salidaEsp  = parseHHMM(horario.salidaEsperada);
    }

    if (!esLaborable) {
      dia.estado = 'FIN_SEMANA';
      dia.minutosTardanza = 0; dia.minutosDescansoExtra = 0; dia.minutosSalidaAnticipada = 0;
      dia.horasExtrasMinutos = 0;
      continue;
    }

    if (dia.marcaciones.length === 0) {
      dia.estado = 'AUSENTE';
      dia.minutosTardanza = 0; dia.minutosDescansoExtra = 0; dia.minutosSalidaAnticipada = 0;
      dia.horasExtrasMinutos = 0;
      ausencias++;
      continue;
    }

    diasPresentes++;

    if (dia.minutosIngreso === null) {
      dia.estado = 'DATO_INCOMPLETO';
      dia.minutosTardanza = 0; dia.minutosDescansoExtra = 0; dia.minutosSalidaAnticipada = 0;
      dia.horasExtrasMinutos = 0;
      diasIncompletos++;
      continue;
    }

    const retraso = dia.minutosIngreso - ingresoEsp;
    // Tolerancia cero: cualquier minuto de retraso es tardanza
    dia.minutosTardanza = Math.max(0, retraso);

    dia.minutosDescansoExtra = dia.minutosDescanso !== null
      ? Math.max(0, dia.minutosDescanso - horario.duracionDescansoMinutos - 15)
      : 0;

    // Umbral: 30 min mínimo para considerar salida anticipada como significativa. Menos de 30 min = margen normal.
    const minutosAntes = dia.minutosSalidaFinal !== null ? salidaEsp - dia.minutosSalidaFinal : 0;
    dia.minutosSalidaAnticipada = minutosAntes >= 30 ? minutosAntes : 0;

    // Horas extras: solo si hay salida final registrada
    if (dia.minutosIngreso !== null && dia.minutosSalidaFinal !== null) {
      const descReal = dia.minutosDescanso !== null && dia.minutosDescanso > 0 ? dia.minutosDescanso : 0;
      const jornadaReal = dia.minutosSalidaFinal - dia.minutosIngreso - descReal;
      const jornadaEsperada = salidaEsp - ingresoEsp - 30;
      const extrasRaw = jornadaReal - jornadaEsperada;
      // Umbral: 30 min mínimo para considerar horas extras como significativas. Menos de 30 min = margen normal.
      dia.horasExtrasMinutos = extrasRaw >= 30 ? extrasRaw : 0;
    } else {
      dia.horasExtrasMinutos = 0;
    }

    if (dia.horasExtrasMinutos > 0) {
      totalHorasExtrasMinutos += dia.horasExtrasMinutos;
      diasConExtras++;
    }

    if (retraso > 60) {
      dia.estado = 'TARDANZA_GRAVE';
      tardanzasGraves++;
      tardanzas++;
      minutosTardanzaTotal += dia.minutosTardanza;
    } else if (dia.minutosTardanza > 0) {
      dia.estado = 'TARDANZA';
      tardanzas++;
      minutosTardanzaTotal += dia.minutosTardanza;
    } else if (dia.minutosDescansoExtra > 0) {
      dia.estado = 'DESCANSO_EXTENDIDO';
      descansosExtendidos++;
    } else if (dia.minutosSalidaAnticipada > 0) {
      dia.estado = 'SALIDA_ANTICIPADA';
      salidasAnticipadas++;
    } else if (dia.marcaciones.some(m => m.rol === 'DATO_INCOMPLETO')) {
      dia.estado = 'DATO_INCOMPLETO';
      diasIncompletos++;
    } else {
      dia.estado = 'OK';
    }

    if (dia.minutosJornada !== null && dia.minutosJornada > 0) {
      totalJornada += dia.minutosJornada;
      diasConJornada++;
    }
  }

  return {
    tardanzas,
    tardanzasGraves,
    minutosTardanzaTotal,
    descansosExtendidos,
    salidasAnticipadas,
    ausencias,
    diasIncompletos,
    diasPresentes,
    puntualidadPct: diasPresentes > 0
      ? Math.max(0, Math.round(((diasPresentes - tardanzas) / diasPresentes) * 100))
      : 100,
    jornadaPromedioMinutos: diasConJornada > 0 ? Math.round(totalJornada / diasConJornada) : 0,
    totalHorasExtrasMinutos,
    diasConExtras,
    promedioExtrasMinutos: diasConExtras > 0 ? Math.round(totalHorasExtrasMinutos / diasConExtras) : 0,
  };
}

// ─── Main export ───────────────────────────────────────────────────────────────

export async function parseReloj(file: File): Promise<RelojData> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array', raw: true });
  const ws = wb.Sheets[wb.SheetNames[0]];

  // raw: true preserves raw values; header:1 gives array-of-arrays
  const rawRows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null, raw: true });

  // Detect header row: row 0 is title, row 1 is real headers
  // But handle files where row 0 IS the headers (no title row)
  let headerRowIdx = 1;
  const row0 = (rawRows[0] as unknown[]) ?? [];
  const row1 = (rawRows[1] as unknown[]) ?? [];
  const row0Str = row0.map(c => String(c ?? '').toLowerCase());
  const row1Str = row1.map(c => String(c ?? '').toLowerCase());

  const hasNombresRow0 = row0Str.some(s => s.includes('nombre'));
  const hasNombresRow1 = row1Str.some(s => s.includes('nombre'));

  if (hasNombresRow0 && !hasNombresRow1) headerRowIdx = 0;

  const headers = ((rawRows[headerRowIdx] as unknown[]) ?? []).map(h => String(h ?? '').trim().toLowerCase());
  // NFD-normalized headers for accent-safe matching
  const headersNorm = headers.map(h => h.normalize('NFD').replace(/[̀-ͯ]/g, ''));

  const findCol = (...terms: string[]) => headers.findIndex(h => terms.some(t => h.includes(t)));
  const findColNorm = (...terms: string[]) => headersNorm.findIndex(h => terms.some(t => h.includes(t)));

  const idxNombre = findCol('nombres', 'nombre');
  const idxId     = findCol('id del empleado', 'id empleado', 'empleado id');
  const idxFecha  = findCol('fecha');
  const idxHora   = findCol('hora');
  const idxDepto  = findColNorm('departamento', 'dept', 'area', 'sector');

  if (idxNombre < 0) throw new Error('No se encontró la columna "Nombres". Verificá el archivo.');
  if (idxFecha < 0)  throw new Error('No se encontró la columna "Fecha". Verificá el archivo.');
  if (idxHora < 0)   throw new Error('No se encontró la columna "Hora". Verificá el archivo.');

  const grupoNombreFecha = new Map<string, Map<string, number[]>>();
  const grupoIds = new Map<string, string>();
  // nombre → (departamento → count)
  const grupoDepartamentos = new Map<string, Map<string, number>>();
  let totalMarcaciones = 0;

  for (let i = headerRowIdx + 1; i < rawRows.length; i++) {
    const row = rawRows[i] as unknown[];
    const rawNombre = String(row[idxNombre] ?? '').trim();
    if (!rawNombre) continue;

    const nombre = normalizarNombre(rawNombre);
    const fecha  = parseFechaCell(row[idxFecha]);
    const mins   = parseHoraCell(row[idxHora]);

    if (!fecha || mins === null) continue;

    totalMarcaciones++;
    if (idxId >= 0) grupoIds.set(nombre, String(row[idxId] ?? '').trim());

    if (idxDepto >= 0) {
      const dv = String(row[idxDepto] ?? '').trim();
      if (dv) {
        if (!grupoDepartamentos.has(nombre)) grupoDepartamentos.set(nombre, new Map());
        const dm = grupoDepartamentos.get(nombre)!;
        dm.set(dv, (dm.get(dv) ?? 0) + 1);
      }
    }

    if (!grupoNombreFecha.has(nombre)) grupoNombreFecha.set(nombre, new Map());
    const fm = grupoNombreFecha.get(nombre)!;
    if (!fm.has(fecha)) fm.set(fecha, []);
    fm.get(fecha)!.push(mins);
  }

  if (grupoNombreFecha.size === 0) {
    throw new Error('No se pudieron extraer datos del archivo. Verificá que el formato sea el de "Reporte de Marcaciones".');
  }

  const empleados: EmpleadoData[] = [];

  for (const [nombre, fechaMap] of grupoNombreFecha.entries()) {
    const dias = new Map<string, DiaData>();

    for (const [fecha, minutosArr] of fechaMap.entries()) {
      const sorted = [...minutosArr].sort((a, b) => a - b);
      const marcaciones: Marcacion[] = sorted.map(m => ({
        minutos: m,
        hora: minsToHHMM(m),
        rol: 'DATO_INCOMPLETO' as RolMarcacion,
      }));

      inferirRolMarcacion(marcaciones);

      const ing  = marcaciones.find(m => m.rol === 'INGRESO');
      const sDesc = marcaciones.find(m => m.rol === 'SALIDA_DESCANSO');
      const rDesc = marcaciones.find(m => m.rol === 'REGRESO_DESCANSO');
      const sFin  = marcaciones.find(m => m.rol === 'SALIDA_FINAL');

      const minutosDescanso   = sDesc && rDesc ? rDesc.minutos - sDesc.minutos : null;
      const minutosJornada    = ing && sFin ? sFin.minutos - ing.minutos : null;

      dias.set(fecha, {
        fecha, marcaciones,
        ingreso:        ing?.hora  ?? null,
        salidaDescanso: sDesc?.hora ?? null,
        regresoDescanso: rDesc?.hora ?? null,
        salidaFinal:    sFin?.hora  ?? null,
        minutosIngreso:         ing?.minutos  ?? null,
        minutosSalidaDescanso:  sDesc?.minutos ?? null,
        minutosRegresoDescanso: rDesc?.minutos ?? null,
        minutosSalidaFinal:     sFin?.minutos  ?? null,
        minutosJornada, minutosDescanso,
        minutosTardanza: 0, minutosDescansoExtra: 0, minutosSalidaAnticipada: 0,
        horasExtrasMinutos: 0,
        estado: 'DATO_INCOMPLETO',
      });
    }

    const fechasSorted = Array.from(dias.keys()).sort();
    const fechaMin = fechasSorted[0] ?? '';
    const fechaMax = fechasSorted[fechasSorted.length - 1] ?? '';

    const horario = detectarHorarioEsperado(dias, nombre);

    // Add AUSENTE days for all workdays this person has without marcaciones
    const laborables = getDiasLaborablesPersona(fechaMin, fechaMax, horario.horarioPersona);
    for (const f of laborables) {
      if (!dias.has(f)) {
        dias.set(f, {
          fecha: f, marcaciones: [],
          ingreso: null, salidaDescanso: null, regresoDescanso: null, salidaFinal: null,
          minutosIngreso: null, minutosSalidaDescanso: null,
          minutosRegresoDescanso: null, minutosSalidaFinal: null,
          minutosJornada: null, minutosDescanso: null,
          minutosTardanza: 0, minutosDescansoExtra: 0, minutosSalidaAnticipada: 0,
          horasExtrasMinutos: 0,
          estado: 'AUSENTE',
        });
      }
    }

    const metricas = calcularMetricas(dias, horario);

    // Compute most-frequent departamento from Excel rows
    let departamento = '';
    const dm = grupoDepartamentos.get(nombre);
    if (dm && dm.size > 0) {
      let best = '', bestCount = 0;
      for (const [k, v] of dm.entries()) {
        if (v > bestCount) { bestCount = v; best = k; }
      }
      departamento = best;
    }

    empleados.push({
      nombre, id: grupoIds.get(nombre) ?? '',
      departamento,
      dias, horario, fechaMin, fechaMax,
      diasLaborables: laborables.length,
      ...metricas,
    });
  }

  empleados.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

  const allFechas = [...new Set(empleados.flatMap(e => Array.from(e.dias.keys())))].sort();

  return {
    empleados,
    fechaMin: allFechas[0] ?? '',
    fechaMax: allFechas[allFechas.length - 1] ?? '',
    totalMarcaciones,
  };
}
