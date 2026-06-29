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
  };
}

const STORAGE_KEY = 'elared_personal';

function loadFromStorage(): RegistroPersonal[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const stored: RegistroPersonal[] = raw ? (JSON.parse(raw) as RegistroPersonal[]) : [];
    const byId = new Map(stored.map(r => [r.id, r]));
    // Merge: always use HORARIOS_PERSONAL as the canonical list
    return HORARIOS_PERSONAL.map(p => {
      const id = normId(p.nombre);
      return byId.get(id) ?? buildRegistroFromHorarios(p);
    });
  } catch {
    return HORARIOS_PERSONAL.map(buildRegistroFromHorarios);
  }
}

function persist(registros: RegistroPersonal[]): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(registros)); } catch {}
}

// ─── Store ─────────────────────────────────────────────────────────────────────

interface SincResult { actualizados: number; noMatcheados: string[] }

interface PersonalStore {
  registros: RegistroPersonal[];
  updateRegistro: (id: string, changes: Partial<RegistroPersonal>) => void;
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
