import { create } from 'zustand';
import { HORARIOS_PERSONAL, buscarHorarioPersona } from '../data/horarios_personal';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface RegistroPersonal {
  id: string;
  nombre: string;
  turno: string;
  trabajaSabados: boolean;
  trabajaDomingos: boolean;

  faltasReloj: number;
  tardanzasReloj: number;
  horasExtrasReloj: number;
  ultimaSincReloj: string | null;

  comisionesMovil: number;
  comisionesFibra: number;
  ultimaSincComisiones: string | null;

  faltasManual: number | null;
  tardanzasManual: number | null;
  horasExtrasManual: number | null;
  comisionesManual: number | null;
  incentivos: number;
  metas: string;
  observaciones: string;

  departamento: string;
  cargo: string;
  fechaIngreso: string | null;   // "2024-03-15"
  fechaBaja: string | null;      // "2026-07-16" o null
  estado: 'activo' | 'baja';     // default 'activo'
  motivoBaja: string;
}

// ─── Antigüedad ─────────────────────────────────────────────────────────────────

export function getDiasTrabajados(r: RegistroPersonal): number | null {
  if (!r.fechaIngreso) return null;
  const ingreso = new Date(r.fechaIngreso + 'T00:00:00');
  const hasta = r.estado === 'baja' && r.fechaBaja ? new Date(r.fechaBaja + 'T00:00:00') : new Date();
  return Math.max(0, Math.round((hasta.getTime() - ingreso.getTime()) / 86400000));
}

export function formatAntiguedad(dias: number): string {
  if (dias < 60) return `${dias} día${dias === 1 ? '' : 's'}`;
  const meses = Math.floor(dias / 30.44);
  const anios = Math.floor(meses / 12);
  const mesesRestantes = meses % 12;
  if (anios > 0) {
    return mesesRestantes > 0
      ? `${anios} año${anios > 1 ? 's' : ''} ${mesesRestantes} mes${mesesRestantes > 1 ? 'es' : ''}`
      : `${anios} año${anios > 1 ? 's' : ''}`;
  }
  return `${meses} mes${meses > 1 ? 'es' : ''}`;
}

export function getAntiguedadBadge(dias: number): { label: string; bg: string; color: string } {
  const meses = dias / 30.44;
  if (meses < 3)  return { label: 'Nuevo',      bg: '#FDEBD3', color: '#C6821F' };
  if (meses <= 12) return { label: 'En período', bg: '#DCEAFB', color: '#1D5FA8' };
  return { label: 'Estable', bg: '#E6F1E8', color: '#3D7A4D' };
}

// ─── Computed values ───────────────────────────────────────────────────────────

export const getFaltas    = (r: RegistroPersonal) => r.faltasManual    ?? r.faltasReloj;
export const getTardanzas = (r: RegistroPersonal) => r.tardanzasManual ?? r.tardanzasReloj;
export const getHorasExtras = (r: RegistroPersonal) => r.horasExtrasManual ?? r.horasExtrasReloj;
export const getComisiones  = (r: RegistroPersonal) => r.comisionesManual ?? (r.comisionesMovil + r.comisionesFibra);

// ─── Persistence helpers ───────────────────────────────────────────────────────

function normId(n: string): string {
  return n.trim().toLowerCase()
    .replace(/[áàä]/g, 'a').replace(/[éèë]/g, 'e').replace(/[íìï]/g, 'i')
    .replace(/[óòö]/g, 'o').replace(/[úùü]/g, 'u').replace(/ñ/g, 'n')
    .replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
}

function buildRegistroFromHorarios(p: typeof HORARIOS_PERSONAL[0]): RegistroPersonal {
  const dia = p.lunesAMiercoles.trabaja ? p.lunesAMiercoles : p.jueveYViernes;
  const turno = dia.trabaja ? `${dia.ingreso} - ${dia.salida}` : 'Sin turno';
  return {
    id: normId(p.nombre),
    nombre: p.nombre,
    turno,
    trabajaSabados: p.sabado.trabaja,
    trabajaDomingos: p.domingo.trabaja,
    faltasReloj: 0, tardanzasReloj: 0, horasExtrasReloj: 0, ultimaSincReloj: null,
    comisionesMovil: 0, comisionesFibra: 0, ultimaSincComisiones: null,
    faltasManual: null, tardanzasManual: null, horasExtrasManual: null,
    comisionesManual: null, incentivos: 0, metas: '', observaciones: '',
    departamento: p.departamento ?? '', cargo: '',
    fechaIngreso: null, fechaBaja: null, estado: 'activo', motivoBaja: '',
  };
}

const STORAGE_KEY = 'elared_personal';
const EXTRA_KEY    = 'elared_personal_extra'; // personas agregadas manualmente (fuera de HORARIOS_PERSONAL)

function horarioIds(): Set<string> {
  return new Set(HORARIOS_PERSONAL.map(p => normId(p.nombre)));
}

function loadFromStorage(): RegistroPersonal[] {
  let horariosBased: RegistroPersonal[];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const stored: RegistroPersonal[] = raw ? (JSON.parse(raw) as RegistroPersonal[]) : [];
    const byId = new Map(stored.map(r => [r.id, r]));
    // Merge: always use HORARIOS_PERSONAL as the canonical list.
    // Spread stored overrides on top of freshly-built defaults so records saved
    // before campos nuevos existed still get sane defaults (estado, etc.).
    horariosBased = HORARIOS_PERSONAL.map(p => {
      const id = normId(p.nombre);
      const existing = byId.get(id);
      const base = buildRegistroFromHorarios(p);
      return existing ? { ...base, ...existing } : base;
    });
  } catch {
    horariosBased = HORARIOS_PERSONAL.map(buildRegistroFromHorarios);
  }

  let extra: RegistroPersonal[] = [];
  try {
    const raw = localStorage.getItem(EXTRA_KEY);
    extra = raw ? (JSON.parse(raw) as RegistroPersonal[]) : [];
  } catch { extra = []; }

  const ids = horarioIds();
  extra = extra.filter(r => !ids.has(r.id));

  return [...horariosBased, ...extra];
}

function persist(registros: RegistroPersonal[]): void {
  const ids = horarioIds();
  const horariosBased = registros.filter(r => ids.has(r.id));
  const extra = registros.filter(r => !ids.has(r.id));
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(horariosBased)); } catch {}
  try { localStorage.setItem(EXTRA_KEY, JSON.stringify(extra)); } catch {}
}

// ─── Store ─────────────────────────────────────────────────────────────────────

interface SincResult { actualizados: number; noMatcheados: string[] }

export interface NuevaPersona {
  nombre: string;
  cargo: string;
  departamento: string;
  fechaIngreso: string;
  estado: 'activo' | 'baja';
  fechaBaja: string | null;
  observaciones: string;
}

interface PersonalStore {
  registros: RegistroPersonal[];
  updateRegistro: (id: string, changes: Partial<RegistroPersonal>) => void;
  agregarPersona: (datos: NuevaPersona) => void;
  sincronizarReloj: (empleados: {
    nombre: string;
    ausencias: number;
    tardanzas: number;
    totalHorasExtrasMinutos: number;
  }[]) => SincResult;
  sincronizarComisiones: (
    vendedoresMovil: { nombre: string; comision: number }[],
    vendedoresFibra: { nombre: string; comision: number }[],
  ) => SincResult;
}

export const usePersonalStore = create<PersonalStore>((set) => ({
  registros: loadFromStorage(),

  updateRegistro: (id, changes) => {
    set(state => {
      const registros = state.registros.map(r => r.id === id ? { ...r, ...changes } : r);
      persist(registros);
      return { registros };
    });
  },

  agregarPersona: (datos) => {
    set(state => {
      const baseId = normId(datos.nombre);
      const existingIds = new Set(state.registros.map(r => r.id));
      let id = baseId, suffix = 1;
      while (existingIds.has(id)) { suffix++; id = `${baseId}-${suffix}`; }

      const nuevo: RegistroPersonal = {
        id, nombre: datos.nombre, turno: 'Sin turno',
        trabajaSabados: false, trabajaDomingos: false,
        faltasReloj: 0, tardanzasReloj: 0, horasExtrasReloj: 0, ultimaSincReloj: null,
        comisionesMovil: 0, comisionesFibra: 0, ultimaSincComisiones: null,
        faltasManual: null, tardanzasManual: null, horasExtrasManual: null,
        comisionesManual: null, incentivos: 0, metas: '',
        observaciones: datos.observaciones,
        departamento: datos.departamento, cargo: datos.cargo,
        fechaIngreso: datos.fechaIngreso,
        fechaBaja: datos.estado === 'baja' ? datos.fechaBaja : null,
        estado: datos.estado, motivoBaja: '',
      };

      const registros = [...state.registros, nuevo];
      persist(registros);
      return { registros };
    });
  },

  sincronizarReloj: (empleados) => {
    const now = new Date().toISOString();
    let actualizados = 0;
    const noMatcheados: string[] = [];

    set(state => {
      const registros = state.registros.map(r => ({ ...r }));
      for (const emp of empleados) {
        const match = buscarHorarioPersona(emp.nombre);
        if (!match) { noMatcheados.push(emp.nombre); continue; }
        const id = normId(match.persona.nombre);
        const reg = registros.find(r => r.id === id);
        if (!reg) { noMatcheados.push(emp.nombre); continue; }
        reg.faltasReloj = emp.ausencias;
        reg.tardanzasReloj = emp.tardanzas;
        reg.horasExtrasReloj = emp.totalHorasExtrasMinutos;
        reg.ultimaSincReloj = now;
        actualizados++;
      }
      persist(registros);
      return { registros };
    });

    return { actualizados, noMatcheados };
  },

  sincronizarComisiones: (vendedoresMovil, vendedoresFibra) => {
    const now = new Date().toISOString();
    let actualizados = 0;
    const noMatcheados: string[] = [];
    const updated = new Set<string>();

    set(state => {
      const registros = state.registros.map(r => ({ ...r }));

      for (const v of vendedoresMovil) {
        const match = buscarHorarioPersona(v.nombre);
        if (!match) { noMatcheados.push(v.nombre); continue; }
        const id = normId(match.persona.nombre);
        const reg = registros.find(r => r.id === id);
        if (!reg) { noMatcheados.push(v.nombre); continue; }
        reg.comisionesMovil = v.comision;
        reg.ultimaSincComisiones = now;
        updated.add(id);
      }

      for (const v of vendedoresFibra) {
        const match = buscarHorarioPersona(v.nombre);
        if (!match) { if (!noMatcheados.includes(v.nombre)) noMatcheados.push(v.nombre); continue; }
        const id = normId(match.persona.nombre);
        const reg = registros.find(r => r.id === id);
        if (!reg) { if (!noMatcheados.includes(v.nombre)) noMatcheados.push(v.nombre); continue; }
        reg.comisionesFibra = v.comision;
        reg.ultimaSincComisiones = now;
        updated.add(id);
      }

      actualizados = updated.size;
      persist(registros);
      return { registros };
    });

    return { actualizados, noMatcheados };
  },
}));
