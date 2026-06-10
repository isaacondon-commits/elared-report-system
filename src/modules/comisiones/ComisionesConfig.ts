// ─── Types ────────────────────────────────────────────────────────────────────

export type TipoGestion = 'renovacion' | 'alta' | 'cambio';

export interface PrecioXTipo {
  renovacion: number;
  alta: number;
  cambio: number;
}

export interface PlanComision {
  id: string;
  nombre: string;
  activo: boolean;
  precios: {
    condicion1: PrecioXTipo;
    condicion2: PrecioXTipo;
  };
  noConfig?: boolean;
}

export interface Condicion {
  id: 'condicion1' | 'condicion2';
  nombre: string;
  minVentas: number;
  descripcion: string;
}

export interface EmpresaComision {
  id: string;
  nombre: string;
  condiciones: [Condicion, Condicion];
  planes: PlanComision[];
}

export interface ComisionesConfig {
  empresas: EmpresaComision[];
  ultimaActualizacion: string;
}

export interface DesgloseItem {
  plan: string;
  tipo: TipoGestion;
  cantidad: number;
  precioUnitario: number;
  comisionTotal: number;
}

export interface ResultadoCondicion {
  condicionId: 'condicion1' | 'condicion2';
  nombreCondicion: string;
  esOverride: boolean;
  bajoPorFalta: boolean;
  noLlegoAlMinimo: boolean;
  condicionOriginal?: 'condicion1' | 'condicion2';
}

export interface ResultadoVendedor {
  nombre: string;
  empresa: string;
  totalVentas: number;
  faltas: number;
  condicionAplicada: 'condicion1' | 'condicion2';
  nombreCondicion: string;
  esOverride: boolean;
  bajoPorFalta: boolean;
  noLlegoAlMinimo: boolean;
  condicionOriginal?: 'condicion1' | 'condicion2';
  sinCondicion: boolean; // = noLlegoAlMinimo, kept for export compat
  desglose: {
    renovaciones: { cantidad: number; comision: number };
    altas: { cantidad: number; comision: number };
    cambios: { cantidad: number; comision: number };
  };
  desglosePorPlan: DesgloseItem[];
  comisionTotal: number;
}

export interface ResumenPlan {
  plan: string;
  renovaciones: number;
  altas: number;
  cambios: number;
  total: number;
  comisionTotal: number;
}

export interface ResultadosComisiones {
  vendedores: ResultadoVendedor[];
  totalAPagar: number;
  vendedoresCondicion2: number;
  vendedoresSinCondicion: number;   // = noLlegoAlMinimo count
  vendedoresConFaltas: number;
  vendedoresBajoPorFalta: number;
  promedioComision: number;
  resumenPorPlan: ResumenPlan[];
}

// ─── VentaRaw ─────────────────────────────────────────────────────────────────

export interface VentaRaw {
  vendedor: string;
  plan: string;
  motivo: string;
  empresa: string;
}

// ─── Motivo classification ────────────────────────────────────────────────────

const MOTIVO_RENOVACION = ['renovacion', 'renov', 'renewal'];
const MOTIVO_ALTA       = ['nuevo servicio', 'alta nueva', 'nuevo cliente', 'new service'];
const MOTIVO_CAMBIO     = ['cambio de plan', 'cambio plan', 'plan change'];

function norm(s: string): string {
  return s.toLowerCase().trim().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export function classifyMotivo(raw: string): TipoGestion | 'otro' {
  const n = norm(raw);
  if (MOTIVO_RENOVACION.some(k => n.includes(k))) return 'renovacion';
  if (MOTIVO_ALTA.some(k => n.includes(k)))       return 'alta';
  if (MOTIVO_CAMBIO.some(k => n.includes(k)))     return 'cambio';
  return 'otro';
}

// ─── Empresa detection ────────────────────────────────────────────────────────

const EMPRESA_ALIASES: Record<string, string> = {
  sarandi:  'sarandi',
  'sarand': 'sarandi',
  internet: 'sarandi',
};

const EMPRESA_NOMBRES: Record<string, string> = {
  sarandi: 'Sarandí',
};

const KNOWN_EMPRESA_IDS = new Set(['sarandi']);

export function detectarEmpresaId(raw: string): string {
  const n = norm(raw);
  return EMPRESA_ALIASES[n] ?? n;
}

export function isEmpresaReconocida(id: string): boolean {
  return KNOWN_EMPRESA_IDS.has(id);
}

export function getNombreEmpresa(id: string): string {
  return EMPRESA_NOMBRES[id] ?? id;
}

// ─── Sarandí config ───────────────────────────────────────────────────────────

function p3(c1: number, c2: number): PlanComision['precios'] {
  return {
    condicion1: { renovacion: c1, alta: c1, cambio: c1 },
    condicion2: { renovacion: c2, alta: c2, cambio: c2 },
  };
}

export const SARANDI_CONFIG: EmpresaComision = {
  id: 'sarandi',
  nombre: 'Sarandí',
  condiciones: [
    { id: 'condicion1', nombre: '60 Ventas',  minVentas: 60, descripcion: 'Mínimo 60 ventas para comisionar' },
    { id: 'condicion2', nombre: '90 Ventas',  minVentas: 90, descripcion: 'Mínimo 90 ventas — reemplaza condición anterior' },
  ],
  planes: [
    { id: 'inicial1_40gb',        nombre: 'inicial1 40gb',                 activo: true, precios: p3(100, 150) },
    { id: 'inicial2_50gb',        nombre: 'inicial 2 50gb',                activo: true, precios: p3(125, 187.5) },
    { id: 'basico1_70gb',         nombre: 'basico 1 70 gb',                activo: true, precios: p3(100, 150) },
    { id: 'basico2_90gb',         nombre: 'basico 2 90 gb',                activo: true, precios: p3(250, 250) },
    { id: 'plus1_130gb',          nombre: 'plus 1 cl 130 gb',              activo: true, precios: p3(300, 300) },
    { id: 'plus2_160gb',          nombre: 'plus 2 cl 160gb',               activo: true, precios: p3(350, 350) },
    { id: 'plus3_180gb',          nombre: 'Plus 3 cl 180gb',               activo: true, precios: p3(400, 400) },
    { id: 'premium2_210gb',       nombre: 'premium 2 cl 210 gb',           activo: true, precios: p3(450, 450) },
    { id: 'entret_con_limite',    nombre: 'ENTRERENIMIENTO CON LIMITE',    activo: true, precios: p3(500, 500) },
    { id: 'entret_netflix_250gb', nombre: 'ENTRETENIMIENTO NETFLIX 250GB', activo: true, precios: p3(600, 600) },
    { id: 'entret_plus_300gb',    nombre: 'ENTRETENIMIENTO PLUS 300 GB',   activo: true, precios: p3(700, 700) },
  ],
};

// ─── Plan matching ────────────────────────────────────────────────────────────

function normPlan(s: string): string {
  return s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ');
}
function strippedPlan(s: string): string {
  return normPlan(s).replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
}
function compactedPlan(s: string): string {
  return strippedPlan(s).replace(/\s/g, '');
}

export function matchearPlan(planExcel: string, planesConfig: PlanComision[]): PlanComision | null {
  const ne = normPlan(planExcel);
  const se = strippedPlan(planExcel);
  const ce = compactedPlan(planExcel);

  const exact      = planesConfig.find(p => normPlan(p.nombre) === ne);
  if (exact)      return exact;
  const byStripped = planesConfig.find(p => strippedPlan(p.nombre) === se);
  if (byStripped) return byStripped;
  const byCompact  = planesConfig.find(p => compactedPlan(p.nombre) === ce);
  if (byCompact)  return byCompact;

  return planesConfig.find(p => {
    const kws = strippedPlan(p.nombre).split(' ').filter(w => w.length > 2 || /^\d{2,}$/.test(w));
    return kws.length > 0 && kws.every(kw => se.includes(kw));
  }) ?? null;
}

export function aplicarTemplateEmpresa(empresa: EmpresaComision, template: EmpresaComision): EmpresaComision {
  return {
    ...empresa,
    condiciones: [{ ...template.condiciones[0] }, { ...template.condiciones[1] }],
    planes: empresa.planes.map(p => {
      const matched = matchearPlan(p.nombre, template.planes);
      if (matched) {
        return { ...p, precios: { condicion1: { ...matched.precios.condicion1 }, condicion2: { ...matched.precios.condicion2 } }, noConfig: false };
      }
      return { ...p, noConfig: true };
    }),
  };
}

// ─── Condition logic ──────────────────────────────────────────────────────────

export function getCondicionAplicable(
  totalVentas: number,
  faltas: number,
  condiciones: [Condicion, Condicion],
  overrideCondicion?: 'condicion1' | 'condicion2' | null
): ResultadoCondicion {
  const cLow  = condiciones[0].minVentas <= condiciones[1].minVentas ? condiciones[0] : condiciones[1];
  const cHigh = condiciones[0].minVentas >  condiciones[1].minVentas ? condiciones[0] : condiciones[1];

  // 1. Override manual
  if (overrideCondicion) {
    const cond = condiciones.find(c => c.id === overrideCondicion)!;
    return { condicionId: overrideCondicion, nombreCondicion: cond.nombre, esOverride: true, bajoPorFalta: false, noLlegoAlMinimo: false };
  }

  // 2. Condición natural por ventas
  let condicionNatural: 'condicion1' | 'condicion2';
  let noLlegoAlMinimo = false;

  if (totalVentas >= cHigh.minVentas) {
    condicionNatural = cHigh.id;
  } else if (totalVentas >= cLow.minVentas) {
    condicionNatural = cLow.id;
  } else {
    condicionNatural = cLow.id; // siempre comisiona por condición base
    noLlegoAlMinimo = true;
  }

  // 3. Penalización por falta
  let condicionFinal = condicionNatural;
  let bajoPorFalta = false;
  let condicionOriginal: 'condicion1' | 'condicion2' | undefined;

  if (faltas >= 1 && condicionNatural === cHigh.id) {
    condicionFinal = cLow.id;
    bajoPorFalta = true;
    condicionOriginal = cHigh.id;
  }

  const condFinalObj = condiciones.find(c => c.id === condicionFinal)!;

  return { condicionId: condicionFinal, nombreCondicion: condFinalObj.nombre, esOverride: false, bajoPorFalta, noLlegoAlMinimo, condicionOriginal };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function PRECIO_VACIO(): PrecioXTipo {
  return { renovacion: 0, alta: 0, cambio: 0 };
}

// ─── localStorage ─────────────────────────────────────────────────────────────

export function loadConfig(storageKey: string): ComisionesConfig | null {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    return JSON.parse(raw) as ComisionesConfig;
  } catch {
    return null;
  }
}

export function saveConfig(storageKey: string, config: ComisionesConfig): void {
  const toSave: ComisionesConfig = { ...config, ultimaActualizacion: new Date().toISOString() };
  localStorage.setItem(storageKey, JSON.stringify(toSave));
}

export function initSarandiConfig(storageKey: string): void {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) {
      localStorage.setItem(storageKey, JSON.stringify({ empresas: [SARANDI_CONFIG], ultimaActualizacion: new Date().toISOString() }));
      return;
    }
    const config = JSON.parse(raw) as ComisionesConfig;
    if (!config.empresas?.some((e: EmpresaComision) => e.id === 'sarandi')) {
      config.empresas = [...(config.empresas ?? []), SARANDI_CONFIG];
      localStorage.setItem(storageKey, JSON.stringify(config));
    }
  } catch { /* ignore */ }
}

// ─── Build config from parsed data ───────────────────────────────────────────

export function buildConfigFromVentas(
  ventas: VentaRaw[],
  savedConfig: ComisionesConfig | null
): ComisionesConfig {
  const empresasMap = new Map<string, Set<string>>();
  for (const v of ventas) {
    const empresaId = detectarEmpresaId(v.empresa.trim()) || 'sin-empresa';
    const plan = v.plan.trim();
    if (!plan) continue;
    if (!empresasMap.has(empresaId)) empresasMap.set(empresaId, new Set());
    empresasMap.get(empresaId)!.add(plan);
  }

  const empresas: EmpresaComision[] = [];

  for (const [empresaId, planesSet] of empresasMap.entries()) {
    const savedEmpresa = savedConfig?.empresas.find(e => e.id === empresaId);

    const condiciones: [Condicion, Condicion] = savedEmpresa?.condiciones ?? [
      { id: 'condicion1', nombre: 'Condición Base',    minVentas: 60, descripcion: '60 ventas o más' },
      { id: 'condicion2', nombre: 'Condición Premium', minVentas: 90, descripcion: '90 ventas o más' },
    ];

    const planes: PlanComision[] = [...planesSet].sort().map(planName => {
      const savedPlan = savedEmpresa?.planes.find(p => p.id === planName);
      if (savedPlan) {
        return { id: planName, nombre: planName, activo: savedPlan.activo, precios: { condicion1: { ...savedPlan.precios.condicion1 }, condicion2: { ...savedPlan.precios.condicion2 } }, noConfig: false };
      }
      if (savedEmpresa) {
        const matched = matchearPlan(planName, savedEmpresa.planes);
        if (matched) {
          return { id: planName, nombre: planName, activo: matched.activo, precios: { condicion1: { ...matched.precios.condicion1 }, condicion2: { ...matched.precios.condicion2 } }, noConfig: false };
        }
      }
      return { id: planName, nombre: planName, activo: true, precios: { condicion1: PRECIO_VACIO(), condicion2: PRECIO_VACIO() }, noConfig: true };
    });

    empresas.push({ id: empresaId, nombre: getNombreEmpresa(empresaId) || empresaId, condiciones, planes });
  }

  return { empresas, ultimaActualizacion: new Date().toISOString() };
}

// ─── Extract VentaRaw from ParseResult rows ───────────────────────────────────

export function extractVentasRaw(
  rows: Record<string, unknown>[],
  mapping: Record<string, string>
): VentaRaw[] {
  return rows
    .map(row => ({
      vendedor: String(row[mapping['funcionario']] ?? '').trim(),
      plan:     String(row[mapping['nuevoPlan']]   ?? '').trim(),
      motivo:   String(row[mapping['motivo']]      ?? '').trim(),
      empresa:  String(row[mapping['empresa']]     ?? '').trim(),
    }))
    .filter(v => v.vendedor && v.plan);
}

// ─── Calculation ──────────────────────────────────────────────────────────────

export function calcularComisiones(
  ventas: VentaRaw[],
  config: ComisionesConfig,
  faltasPorVendedor?: Map<string, number>,
  overridesPorVendedor?: Map<string, 'condicion1' | 'condicion2' | null>
): ResultadosComisiones {
  const byVendedor = new Map<string, VentaRaw[]>();
  for (const v of ventas) {
    if (!v.vendedor) continue;
    if (!byVendedor.has(v.vendedor)) byVendedor.set(v.vendedor, []);
    byVendedor.get(v.vendedor)!.push(v);
  }

  const resultados: ResultadoVendedor[] = [];

  for (const [nombre, ventasVend] of byVendedor.entries()) {
    const totalVentas = ventasVend.length;
    const faltas = faltasPorVendedor?.get(nombre) ?? 0;
    const override = overridesPorVendedor?.get(nombre) ?? null;

    // Find dominant empresa
    const empresaCount = new Map<string, number>();
    for (const v of ventasVend) {
      const eid = detectarEmpresaId(v.empresa.trim()) || 'sin-empresa';
      empresaCount.set(eid, (empresaCount.get(eid) ?? 0) + 1);
    }
    const empresaId = [...empresaCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
    const empresaConfig = config.empresas.find(e => e.id === empresaId);

    const rc: ResultadoCondicion = empresaConfig
      ? getCondicionAplicable(totalVentas, faltas, empresaConfig.condiciones, override)
      : { condicionId: 'condicion1', nombreCondicion: 'Sin config', esOverride: false, bajoPorFalta: false, noLlegoAlMinimo: true };

    const condicionAplicada = rc.condicionId;

    let comisionTotal = 0;
    const planAccum = new Map<string, Record<TipoGestion, { cnt: number; precio: number }>>();
    const desglose = {
      renovaciones: { cantidad: 0, comision: 0 },
      altas:        { cantidad: 0, comision: 0 },
      cambios:      { cantidad: 0, comision: 0 },
    };

    for (const v of ventasVend) {
      const tipo = classifyMotivo(v.motivo);
      if (tipo === 'otro') continue;

      const plan = v.plan.trim();
      if (!planAccum.has(plan)) {
        planAccum.set(plan, { renovacion: { cnt: 0, precio: 0 }, alta: { cnt: 0, precio: 0 }, cambio: { cnt: 0, precio: 0 } });
      }
      const pa = planAccum.get(plan)!;

      const planConfig = empresaConfig?.planes.find(p => p.id === plan);
      const precio = planConfig?.activo ? (planConfig.precios[condicionAplicada][tipo] ?? 0) : 0;

      pa[tipo].cnt++;
      pa[tipo].precio = precio;
      comisionTotal += precio;

      if (tipo === 'renovacion')      { desglose.renovaciones.cantidad++; desglose.renovaciones.comision += precio; }
      else if (tipo === 'alta')        { desglose.altas.cantidad++;        desglose.altas.comision        += precio; }
      else                             { desglose.cambios.cantidad++;      desglose.cambios.comision      += precio; }
    }

    const desglosePorPlan: DesgloseItem[] = [];
    for (const [plan, data] of planAccum.entries()) {
      for (const tipo of ['renovacion', 'alta', 'cambio'] as TipoGestion[]) {
        const { cnt, precio } = data[tipo];
        if (cnt === 0) continue;
        desglosePorPlan.push({ plan, tipo, cantidad: cnt, precioUnitario: precio, comisionTotal: precio * cnt });
      }
    }

    resultados.push({
      nombre, empresa: empresaId, totalVentas, faltas,
      condicionAplicada, nombreCondicion: rc.nombreCondicion,
      esOverride: rc.esOverride, bajoPorFalta: rc.bajoPorFalta,
      noLlegoAlMinimo: rc.noLlegoAlMinimo, condicionOriginal: rc.condicionOriginal,
      sinCondicion: rc.noLlegoAlMinimo,
      desglose, desglosePorPlan, comisionTotal,
    });
  }

  resultados.sort((a, b) => b.comisionTotal - a.comisionTotal);

  const totalAPagar            = resultados.reduce((s, r) => s + r.comisionTotal, 0);
  const vendedoresCondicion2   = resultados.filter(r => r.condicionAplicada === 'condicion2').length;
  const vendedoresSinCondicion = resultados.filter(r => r.noLlegoAlMinimo).length;
  const vendedoresConFaltas    = resultados.filter(r => r.faltas > 0).length;
  const vendedoresBajoPorFalta = resultados.filter(r => r.bajoPorFalta).length;
  const comisionantes          = resultados.filter(r => r.comisionTotal > 0);
  const promedioComision       = comisionantes.length > 0 ? totalAPagar / comisionantes.length : 0;

  const planResumenMap = new Map<string, ResumenPlan>();
  for (const r of resultados) {
    for (const d of r.desglosePorPlan) {
      const prev = planResumenMap.get(d.plan) ?? { plan: d.plan, renovaciones: 0, altas: 0, cambios: 0, total: 0, comisionTotal: 0 };
      planResumenMap.set(d.plan, {
        plan: prev.plan,
        renovaciones: prev.renovaciones + (d.tipo === 'renovacion' ? d.cantidad : 0),
        altas:        prev.altas        + (d.tipo === 'alta'        ? d.cantidad : 0),
        cambios:      prev.cambios      + (d.tipo === 'cambio'      ? d.cantidad : 0),
        total: prev.total + d.cantidad,
        comisionTotal: prev.comisionTotal + d.comisionTotal,
      });
    }
  }

  const resumenPorPlan = [...planResumenMap.values()].sort((a, b) => b.comisionTotal - a.comisionTotal);

  return { vendedores: resultados, totalAPagar, vendedoresCondicion2, vendedoresSinCondicion, vendedoresConFaltas, vendedoresBajoPorFalta, promedioComision, resumenPorPlan };
}

// ─── Format helpers ───────────────────────────────────────────────────────────

export function fmtPesos(n: number): string {
  return `$${Math.round(n).toLocaleString('es-UY')}`;
}

export const TIPO_LABELS: Record<TipoGestion, string> = {
  renovacion: 'Renovación',
  alta:       'Alta',
  cambio:     'Cambio',
};

export const TIPO_COLORS: Record<TipoGestion, string> = {
  renovacion: '#16a34a',
  alta:       '#003DA5',
  cambio:     '#f59e0b',
};
