// ─── Types ────────────────────────────────────────────────────────────────────

export type CondicionFibra = '80_sin_falta' | '50_o_falta';
export type FranjaRenovacion = '50_200' | '201_250' | '250_plus';
export type ModalidadFibra = 'telemarketing' | 'internet' | 'presencial';
export type MotivoFibra = 'Nuevo Servicio' | 'Renovacion' | 'Cambio de plan';

export interface PrecioFibra {
  alta: number;
  reno_50_200: number | null;
  reno_201_250: number | null;
  reno_250_plus: number | null;
}

export interface PrecioInternet {
  precio_50_o_falta: number;
  precio_80_sin_falta: number;
}

export interface VentaFibra {
  plan: string;
  motivo: MotivoFibra;
  modalidad: ModalidadFibra;
}

export interface VendedorFibraInput {
  nombre: string;
  ventas: VentaFibra[];
}

export interface DesglosePlanFibra {
  plan: string;
  modalidad: ModalidadFibra;
  altas: number;
  renovaciones: number;
  noRenovables: number;
  comision: number;
}

export interface ResultadoVendedorFibra {
  nombre: string;
  totalVentas: number;
  faltas: number;
  condicion: CondicionFibra;
  franja: FranjaRenovacion;
  noLlegoAlMinimo: boolean;
  bajoPorFalta: boolean;
  condicionOriginal?: CondicionFibra;
  esOverride: boolean;
  ventasTelemarketing: number;
  ventasInternet: number;
  altas: { cantidad: number; comision: number };
  renovaciones: { cantidad: number; comision: number };
  noRenovables: number;
  desglosePlanes: DesglosePlanFibra[];
  comisionTelemarketing: number;
  comisionInternet: number;
  comisionTotal: number;
}

export interface ResultadosFibra {
  vendedores: ResultadoVendedorFibra[];
  totalAPagar: number;
  vendedores80SinFalta: number;
  vendedores50OFalta: number;
  vendedoresBajoMinimo: number;
  totalNoRenovables: number;
  totalTelemarketing: number;
  totalInternet: number;
}

// ─── Price tables ─────────────────────────────────────────────────────────────

export const PRECIOS_80_SIN_FALTA: Record<string, PrecioFibra> = {
  'FIBRA BASICO':                   { alta: 102,   reno_50_200: 34,    reno_201_250: 44.2,  reno_250_plus: 51 },
  'FIBRA PLUS':                     { alta: 135,   reno_50_200: 45,    reno_201_250: 58.5,  reno_250_plus: 67.5 },
  'FIBRA ENTRETENIMIENTO ESTANDAR': { alta: 158,   reno_50_200: null,  reno_201_250: null,  reno_250_plus: null },
  'FIBRA DGO 1':                    { alta: 164,   reno_50_200: null,  reno_201_250: null,  reno_250_plus: null },
  'FIBRA ENTRETENIMIENTO PREMIUM':  { alta: 174,   reno_50_200: 75.4,  reno_201_250: 75.4,  reno_250_plus: 87 },
  'FIBRA ENTRETENIMIENTO NETFLIX':  { alta: 229.5, reno_50_200: null,  reno_201_250: null,  reno_250_plus: null },
  'FIBRA DGO 2':                    { alta: 186,   reno_50_200: null,  reno_201_250: null,  reno_250_plus: null },
  'FIBRA PREMIUM':                  { alta: 188,   reno_50_200: 93.75, reno_201_250: 93.75, reno_250_plus: 93.75 },
  'FIBRA SUPER ENTRETENIMIENTO':    { alta: 230,   reno_50_200: 153,   reno_201_250: 153,   reno_250_plus: 153 },
  'ULTRA':                          { alta: 291,   reno_50_200: 194,   reno_201_250: 194,   reno_250_plus: 194 },
  'FIBRA CON LIMITE 1':             { alta: 40.5,  reno_50_200: null,  reno_201_250: null,  reno_250_plus: null },
  'FIBRA CON LIMITE 2':             { alta: 73.5,  reno_50_200: null,  reno_201_250: null,  reno_250_plus: null },
};

export const PRECIOS_50_O_FALTA: Record<string, PrecioFibra> = {
  'FIBRA BASICO':                   { alta: 45,   reno_50_200: 22.5,  reno_201_250: 29.25, reno_250_plus: 33.75 },
  'FIBRA PLUS':                     { alta: 60,   reno_50_200: 30,    reno_201_250: 39,    reno_250_plus: 45 },
  'FIBRA ENTRETENIMIENTO ESTANDAR': { alta: 69,   reno_50_200: null,  reno_201_250: null,  reno_250_plus: null },
  'FIBRA DGO 1':                    { alta: 71,   reno_50_200: null,  reno_201_250: null,  reno_250_plus: null },
  'FIBRA ENTRETENIMIENTO PREMIUM':  { alta: 77,   reno_50_200: 50.05, reno_201_250: 50.05, reno_250_plus: 57.75 },
  'FIBRA ENTRETENIMIENTO NETFLIX':  { alta: 80.7, reno_50_200: null,  reno_201_250: null,  reno_250_plus: null },
  'FIBRA DGO 2':                    { alta: 81,   reno_50_200: null,  reno_201_250: null,  reno_250_plus: null },
  'FIBRA PREMIUM':                  { alta: 83,   reno_50_200: 62.25, reno_201_250: 62.25, reno_250_plus: 62.25 },
  'FIBRA SUPER ENTRETENIMIENTO':    { alta: 102,  reno_50_200: 102,   reno_201_250: 102,   reno_250_plus: 102 },
  'ULTRA':                          { alta: 129,  reno_50_200: 129,   reno_201_250: 129,   reno_250_plus: 129 },
  'FIBRA CON LIMITE 1':             { alta: 18,   reno_50_200: null,  reno_201_250: null,  reno_250_plus: null },
  'FIBRA CON LIMITE 2':             { alta: 32,   reno_50_200: null,  reno_201_250: null,  reno_250_plus: null },
};

export const PRECIOS_INTERNET: Record<string, PrecioInternet> = {
  'FIBRA BASICO':                   { precio_50_o_falta: 45,   precio_80_sin_falta: 67.5 },
  'FIBRA PLUS':                     { precio_50_o_falta: 60,   precio_80_sin_falta: 90 },
  'FIBRA ENTRETENIMIENTO ESTANDAR': { precio_50_o_falta: 69,   precio_80_sin_falta: 103.5 },
  'FIBRA DGO 1':                    { precio_50_o_falta: 71,   precio_80_sin_falta: 106.5 },
  'FIBRA ENTRETENIMIENTO PREMIUM':  { precio_50_o_falta: 77,   precio_80_sin_falta: 115.5 },
  'FIBRA ENTRETENIMIENTO NETFLIX':  { precio_50_o_falta: 80.7, precio_80_sin_falta: 121.05 },
  'FIBRA DGO 2':                    { precio_50_o_falta: 81,   precio_80_sin_falta: 121.5 },
  'FIBRA PREMIUM':                  { precio_50_o_falta: 83,   precio_80_sin_falta: 124.5 },
  'FIBRA SUPER ENTRETENIMIENTO':    { precio_50_o_falta: 102,  precio_80_sin_falta: 153 },
  'ULTRA':                          { precio_50_o_falta: 129,  precio_80_sin_falta: 193.5 },
};

// ─── Plan matching ─────────────────────────────────────────────────────────────

const PLAN_ALIASES: Record<string, string> = {
  'fibra basico':                   'FIBRA BASICO',
  'fibra plus':                     'FIBRA PLUS',
  'fibra entretenimiento estandar': 'FIBRA ENTRETENIMIENTO ESTANDAR',
  'fibra dgo 1':                    'FIBRA DGO 1',
  'fibra dgo1':                     'FIBRA DGO 1',
  'fibra entretenimiento premium':  'FIBRA ENTRETENIMIENTO PREMIUM',
  'fibra entretenimiento netflix':  'FIBRA ENTRETENIMIENTO NETFLIX',
  'fibra dgo 2':                    'FIBRA DGO 2',
  'fibra dgo2':                     'FIBRA DGO 2',
  'fibra premium':                  'FIBRA PREMIUM',
  'nc fibra premium':               'FIBRA PREMIUM',
  'fibra super entretenimiento':    'FIBRA SUPER ENTRETENIMIENTO',
  'ultra':                          'ULTRA',
  'fibra ultra':                    'ULTRA',
  'fibra con limite 1':             'FIBRA CON LIMITE 1',
  'fibra con limite 2':             'FIBRA CON LIMITE 2',
};

function normPlanFibra(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function matchearPlanFibra(planCSV: string): string | null {
  const n = normPlanFibra(planCSV);

  // Pass 1: direct match against canonical price table keys (handles tildes in CSV)
  for (const key of Object.keys(PRECIOS_80_SIN_FALTA)) {
    if (normPlanFibra(key) === n) return key;
  }

  // Pass 2: alias dictionary
  if (PLAN_ALIASES[n]) return PLAN_ALIASES[n];
  for (const [alias, canon] of Object.entries(PLAN_ALIASES)) {
    if (n.includes(alias)) return canon;
  }
  return null;
}

// ─── Condition & franja logic ─────────────────────────────────────────────────

export function getFranja(totalVentas: number): FranjaRenovacion {
  if (totalVentas <= 200) return '50_200';
  if (totalVentas <= 250) return '201_250';
  return '250_plus';
}

export function getCondicionFibra(
  totalVentas: number,
  faltas: number
): {
  condicion: CondicionFibra;
  noLlegoAlMinimo: boolean;
  bajoPorFalta: boolean;
  condicionOriginal?: CondicionFibra;
} {
  if (totalVentas >= 80 && faltas === 0) {
    return { condicion: '80_sin_falta', noLlegoAlMinimo: false, bajoPorFalta: false };
  }
  if (totalVentas >= 80 && faltas >= 1) {
    return { condicion: '50_o_falta', noLlegoAlMinimo: false, bajoPorFalta: true, condicionOriginal: '80_sin_falta' };
  }
  if (totalVentas >= 50) {
    return { condicion: '50_o_falta', noLlegoAlMinimo: false, bajoPorFalta: false };
  }
  return { condicion: '50_o_falta', noLlegoAlMinimo: true, bajoPorFalta: false };
}

// ─── Modalidad detection ──────────────────────────────────────────────────────

export function detectModalidadFibra(raw: string): ModalidadFibra {
  const n = raw.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (n.includes('internet')) return 'internet';
  if (n.includes('presencial')) return 'presencial';
  return 'telemarketing';
}

// ─── Motivo detection ─────────────────────────────────────────────────────────

export function detectMotivoFibra(raw: string): MotivoFibra {
  const n = raw.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (n.includes('nuevo') || n.includes('pasaje') || (n.includes('alta') && !n.includes('renovacion'))) return 'Nuevo Servicio';
  if (n.includes('cambio')) return 'Cambio de plan';
  return 'Renovacion';
}

// ─── Motivo classification for pricing ────────────────────────────────────────────

function normalizeMotivo(motivo: string): 'alta' | 'renovacion' {
  const m = motivo.trim().toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
  if (m === 'renovacion') return 'renovacion'
  return 'alta'
}

// ─── Core calculation ──────────────────────────────────────────────────────────

export function calcularComisionVendedorFibra(
  nombre: string,
  ventas: VentaFibra[],
  faltas: number,
  overrideCondicion?: CondicionFibra | null
): ResultadoVendedorFibra {
  const totalVentas = ventas.length;
  const esOverride = !!overrideCondicion;

  let condicion: CondicionFibra;
  let noLlegoAlMinimo = false;
  let bajoPorFalta = false;
  let condicionOriginal: CondicionFibra | undefined;

  if (overrideCondicion) {
    condicion = overrideCondicion;
  } else {
    const res = getCondicionFibra(totalVentas, faltas);
    condicion = res.condicion;
    noLlegoAlMinimo = res.noLlegoAlMinimo;
    bajoPorFalta = res.bajoPorFalta;
    condicionOriginal = res.condicionOriginal;
  }

  const franja = getFranja(totalVentas);

  let ventasTelemarketing = 0;
  let ventasInternet = 0;
  let altasCantidad = 0;
  let altasComision = 0;
  let renovacionesCantidad = 0;
  let renovacionesComision = 0;
  let noRenovablesTotal = 0;
  let comisionTelemarketing = 0;
  let comisionInternet = 0;

  const planMap = new Map<string, DesglosePlanFibra>();

  for (const venta of ventas) {
    const planCanon = matchearPlanFibra(venta.plan);

    if (venta.modalidad === 'internet') {
      // ── Internet branch: same price for all motivos, no franja logic ──────────
      ventasInternet++;

      const tabla = planCanon ? PRECIOS_INTERNET[planCanon] : null;
      const comision = tabla
        ? (condicion === '80_sin_falta' ? tabla.precio_80_sin_falta : tabla.precio_50_o_falta)
        : 0;

      comisionInternet += comision;

      const planKey = `${planCanon ?? venta.plan}::internet`;
      if (!planMap.has(planKey)) {
        planMap.set(planKey, { plan: planCanon ?? venta.plan, modalidad: 'internet', altas: 0, renovaciones: 0, noRenovables: 0, comision: 0 });
      }
      const entry = planMap.get(planKey)!;
      if (normalizeMotivo(venta.motivo) === 'alta') entry.altas++;
      else entry.renovaciones++;
      entry.comision += comision;

    } else {
      // ── Telemarketing / Presencial: alta vs renovación + franja ──────────────
      ventasTelemarketing++;

      const tipoMotivo = normalizeMotivo(venta.motivo);
      const esAlta = tipoMotivo === 'alta';
      const tablaFull = planCanon
        ? (condicion === '80_sin_falta' ? PRECIOS_80_SIN_FALTA[planCanon] : PRECIOS_50_O_FALTA[planCanon])
        : null;

      let comision = 0;
      let esNoRenovable = false;

      if (tablaFull) {
        if (esAlta) {
          comision = tablaFull.alta;
        } else {
          const precioReno =
            franja === '50_200'  ? tablaFull.reno_50_200 :
            franja === '201_250' ? tablaFull.reno_201_250 :
                                   tablaFull.reno_250_plus;
          if (precioReno === null) {
            esNoRenovable = true;
          } else {
            comision = precioReno;
          }
        }
      }

      comisionTelemarketing += comision;

      if (esAlta) {
        altasCantidad++;
        altasComision += comision;
      } else {
        renovacionesCantidad++;
        renovacionesComision += comision;
        if (esNoRenovable) noRenovablesTotal++;
      }

      const planKey = `${planCanon ?? venta.plan}::${venta.modalidad}`;
      if (!planMap.has(planKey)) {
        planMap.set(planKey, { plan: planCanon ?? venta.plan, modalidad: venta.modalidad, altas: 0, renovaciones: 0, noRenovables: 0, comision: 0 });
      }
      const entry = planMap.get(planKey)!;
      if (esAlta) {
        entry.altas++;
      } else {
        entry.renovaciones++;
        if (esNoRenovable) entry.noRenovables++;
      }
      entry.comision += comision;
    }
  }

  return {
    nombre,
    totalVentas,
    faltas,
    condicion,
    franja,
    noLlegoAlMinimo,
    bajoPorFalta,
    condicionOriginal,
    esOverride,
    ventasTelemarketing,
    ventasInternet,
    altas: { cantidad: altasCantidad, comision: altasComision },
    renovaciones: { cantidad: renovacionesCantidad, comision: renovacionesComision },
    noRenovables: noRenovablesTotal,
    desglosePlanes: [...planMap.values()].sort((a, b) => b.comision - a.comision),
    comisionTelemarketing,
    comisionInternet,
    comisionTotal: comisionTelemarketing + comisionInternet,
  };
}

// ─── Aggregate calculation ────────────────────────────────────────────────────

export function calcularComisionesFibra(
  vendedores: VendedorFibraInput[],
  faltasPorVendedor: Map<string, number>,
  overridesPorVendedor: Map<string, CondicionFibra | null>
): ResultadosFibra {
  const resultados = vendedores
    .map(({ nombre, ventas }) => {
      const faltas = faltasPorVendedor.get(nombre) ?? 0;
      const override = overridesPorVendedor.get(nombre) ?? null;
      return calcularComisionVendedorFibra(nombre, ventas, faltas, override ?? undefined);
    })
    .sort((a, b) => b.comisionTotal - a.comisionTotal);

  return {
    vendedores: resultados,
    totalAPagar:          resultados.reduce((s, v) => s + v.comisionTotal, 0),
    vendedores80SinFalta: resultados.filter(v => v.condicion === '80_sin_falta').length,
    vendedores50OFalta:   resultados.filter(v => v.condicion === '50_o_falta' && !v.noLlegoAlMinimo).length,
    vendedoresBajoMinimo: resultados.filter(v => v.noLlegoAlMinimo).length,
    totalNoRenovables:    resultados.reduce((s, v) => s + v.noRenovables, 0),
    totalTelemarketing:   resultados.reduce((s, v) => s + v.comisionTelemarketing, 0),
    totalInternet:        resultados.reduce((s, v) => s + v.comisionInternet, 0),
  };
}

// ─── Extract ventas from parsed rows ──────────────────────────────────────────

export function extractVentasFibra(
  rows: Record<string, unknown>[],
  mapping: Record<string, string>
): VendedorFibraInput[] {
  const byVendedor = new Map<string, VentaFibra[]>();

  for (const row of rows) {
    const vendedor    = String(row[mapping['funcionario']] ?? '').trim();
    const plan        = String(row[mapping['nuevoPlan']]   ?? '').trim();
    const motivoRaw   = String(row[mapping['motivo']]      ?? '').trim();
    const modalidadRaw = String(row[mapping['modalidad']]  ?? '').trim();

    if (!vendedor || !plan) continue;

    if (!byVendedor.has(vendedor)) byVendedor.set(vendedor, []);
    byVendedor.get(vendedor)!.push({
      plan,
      motivo:    detectMotivoFibra(motivoRaw),
      modalidad: detectModalidadFibra(modalidadRaw),
    });
  }

  return [...byVendedor.entries()].map(([nombre, ventas]) => ({ nombre, ventas }));
}

// ─── Format helper ────────────────────────────────────────────────────────────

export function fmtPesos(n: number): string {
  if (n === 0) return '$0';
  return `$${Math.round(n).toLocaleString('es-UY')}`;
}

// ─── Plan list ────────────────────────────────────────────────────────────────

export const PLANES_FIBRA = Object.keys(PRECIOS_80_SIN_FALTA);
