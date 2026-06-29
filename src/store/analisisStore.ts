import { create } from 'zustand';
import type { ParseResult } from '../utils/smartParser';
import type { VentasStats } from '../modules/ventas/VentasModule';
import type { RelojData, EmpleadoData } from '../modules/reloj/relojParser';
import type { SancionesStats } from '../modules/sanciones/SancionesModule';
import type { VicidialData } from '../modules/vicidial/vicidialParser';
import type { AtencionData } from '../modules/atencion/atencionParser';

// ─── Entry types ───────────────────────────────────────────────────────────────

export interface VentasEntry {
  data: VentasStats;
  parsed: ParseResult;
  mapping: Record<string, string>;
  empresas: { nombre: string; count: number }[];
  empresaActiva: string;
  nombreArchivo: string;
  fechaCarga: string;
}

export interface RelojEntry {
  data: RelojData;
  empleados: EmpleadoData[];
  nombreArchivo: string;
  fechaCarga: string;
}

export interface SancionesEntry {
  data: SancionesStats;
  nombreArchivo: string;
  fechaCarga: string;
}

export interface VicidialEntry {
  data: VicidialData;
  nombreArchivo: string;
  fechaCarga: string;
}

export interface AtencionEntry {
  data: AtencionData;
  nombreArchivo: string;
  fechaCarga: string;
}

export interface ComisionesEntry {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ventasRaw: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  config: any;
  resumen: { vendedores: number; planes: number; gestiones: number; fileName: string };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  empresaDetectada: any;
  faltasPorVendedor: Map<string, number>;
  overridesPorVendedor: Map<string, 'condicion1' | 'condicion2' | null>;
  nombreArchivo: string;
  fechaCarga: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

export function formatFechaCarga(iso: string | null | undefined): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const secs = Math.floor(diff / 1000);
  const mins = Math.floor(secs / 60);
  const hrs  = Math.floor(mins / 60);
  if (secs < 60)  return 'Cargado hace un momento';
  if (mins < 60)  return `Cargado hace ${mins} min`;
  if (hrs < 24)   return `Cargado hace ${hrs}h`;
  return `Cargado el ${new Date(iso).toLocaleDateString('es-UY')}`;
}

// ─── Store ─────────────────────────────────────────────────────────────────────

interface AnalisisStore {
  ventas:          VentasEntry    | null;
  reloj:           RelojEntry     | null;
  sanciones:       SancionesEntry | null;
  vicidial:        VicidialEntry  | null;
  atencion:        AtencionEntry  | null;
  comisionesMovil: ComisionesEntry | null;
  comisionesFibra: ComisionesEntry | null;

  setVentas:          (e: Omit<VentasEntry,    'fechaCarga'>) => void;
  setReloj:           (e: Omit<RelojEntry,     'fechaCarga'>) => void;
  setSanciones:       (e: Omit<SancionesEntry, 'fechaCarga'>) => void;
  setVicidial:        (e: Omit<VicidialEntry,  'fechaCarga'>) => void;
  setAtencion:        (e: Omit<AtencionEntry,  'fechaCarga'>) => void;
  setComisionesMovil: (e: Omit<ComisionesEntry,'fechaCarga'>) => void;
  setComisionesFibra: (e: Omit<ComisionesEntry,'fechaCarga'>) => void;

  clearVentas:          () => void;
  clearReloj:           () => void;
  clearSanciones:       () => void;
  clearVicidial:        () => void;
  clearAtencion:        () => void;
  clearComisionesMovil: () => void;
  clearComisionesFibra: () => void;
  clearAll:             () => void;
}

const ts = () => new Date().toISOString();

export const useAnalisisStore = create<AnalisisStore>((set) => ({
  ventas:          null,
  reloj:           null,
  sanciones:       null,
  vicidial:        null,
  atencion:        null,
  comisionesMovil: null,
  comisionesFibra: null,

  setVentas:          (e) => set({ ventas:          { ...e, fechaCarga: ts() } }),
  setReloj:           (e) => set({ reloj:           { ...e, fechaCarga: ts() } }),
  setSanciones:       (e) => set({ sanciones:       { ...e, fechaCarga: ts() } }),
  setVicidial:        (e) => set({ vicidial:        { ...e, fechaCarga: ts() } }),
  setAtencion:        (e) => set({ atencion:        { ...e, fechaCarga: ts() } }),
  setComisionesMovil: (e) => set({ comisionesMovil: { ...e, fechaCarga: ts() } }),
  setComisionesFibra: (e) => set({ comisionesFibra: { ...e, fechaCarga: ts() } }),

  clearVentas:          () => set({ ventas:          null }),
  clearReloj:           () => set({ reloj:           null }),
  clearSanciones:       () => set({ sanciones:       null }),
  clearVicidial:        () => set({ vicidial:        null }),
  clearAtencion:        () => set({ atencion:        null }),
  clearComisionesMovil: () => set({ comisionesMovil: null }),
  clearComisionesFibra: () => set({ comisionesFibra: null }),
  clearAll: () => set({
    ventas: null, reloj: null, sanciones: null, vicidial: null,
    atencion: null, comisionesMovil: null, comisionesFibra: null,
  }),
}));
