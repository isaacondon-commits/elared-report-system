import { create } from 'zustand';

export type EstadoBox = {
  id: string;
  nombre: string;
  color: string;
  esDefault: boolean;
};

export const ESTADOS_BASE: EstadoBox[] = [
  { id: 'trabajando',    nombre: 'Trabajando',    color: '#28a745', esDefault: true },
  { id: 'ausente',       nombre: 'Ausente',       color: '#E3000F', esDefault: true },
  { id: 'descanso',      nombre: 'Descanso',      color: '#fd7e14', esDefault: true },
  { id: 'capacitacion',  nombre: 'Capacitación',  color: '#6f42c1', esDefault: true },
  { id: 'libre',         nombre: 'Libre',         color: '#6c757d', esDefault: true },
  { id: 'mantenimiento', nombre: 'Mantenimiento', color: '#003DA5', esDefault: true },
];

export type Vendedor = {
  nombre: string;
  foto?: string;
  usuarioSistema?: string;
  usuarioLogistica?: string;
  campania?: string;
  supervisor?: string;
  horario?: string;
  ventasRendimiento?: string;
  observaciones?: string;
  historial?: string[];
};

export type BoxPiso = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  estadoId: string;
  vendedor: Vendedor | null;
  label?: string;
};

export type AreaPiso = {
  id: string;
  nombre: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  boxes: BoxPiso[];
};

export type PlanoData = {
  areas: AreaPiso[];
  estados: EstadoBox[];
  ultimaActualizacion: string;
};

const LS_KEY = 'elared_plano_callcenter';

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function defaultPlano(): PlanoData {
  return {
    areas: [{
      id: uid(),
      nombre: 'Piso Principal',
      x: 40, y: 40,
      width: 1200, height: 700,
      color: '#e3f2fd',
      boxes: [],
    }],
    estados: [...ESTADOS_BASE],
    ultimaActualizacion: new Date().toISOString(),
  };
}

function loadFromLS(): PlanoData {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as PlanoData;
      const existingIds = new Set(parsed.estados.map(e => e.id));
      const missing = ESTADOS_BASE.filter(e => !existingIds.has(e.id));
      return { ...parsed, estados: [...missing, ...parsed.estados] };
    }
  } catch {}
  return defaultPlano();
}

interface PlanoStore {
  areas: AreaPiso[];
  estados: EstadoBox[];
  savedAt: number | null;
  _persist: () => void;
  addArea: (area: Omit<AreaPiso, 'id' | 'boxes'>) => void;
  updateArea: (areaId: string, patch: Partial<Omit<AreaPiso, 'id' | 'boxes'>>) => void;
  removeArea: (areaId: string) => void;
  addBox: (areaId: string, box: Omit<BoxPiso, 'id'>) => void;
  updateBox: (areaId: string, boxId: string, patch: Partial<BoxPiso>) => void;
  removeBox: (areaId: string, boxId: string) => void;
  addEstado: (nombre: string, color: string) => void;
  updateEstado: (id: string, patch: { nombre?: string; color?: string }) => void;
  removeEstado: (id: string) => void;
}

const initial = loadFromLS();

export const usePlanoStore = create<PlanoStore>((set, get) => ({
  areas: initial.areas,
  estados: initial.estados,
  savedAt: null,

  _persist: () => {
    const { areas, estados } = get();
    const data: PlanoData = { areas, estados, ultimaActualizacion: new Date().toISOString() };
    try { localStorage.setItem(LS_KEY, JSON.stringify(data)); } catch {}
    set({ savedAt: Date.now() });
  },

  addArea: (area) => {
    set(s => ({ areas: [...s.areas, { ...area, id: uid(), boxes: [] }] }));
    get()._persist();
  },
  updateArea: (areaId, patch) => {
    set(s => ({ areas: s.areas.map(a => a.id === areaId ? { ...a, ...patch } : a) }));
    get()._persist();
  },
  removeArea: (areaId) => {
    set(s => ({ areas: s.areas.filter(a => a.id !== areaId) }));
    get()._persist();
  },

  addBox: (areaId, box) => {
    set(s => ({
      areas: s.areas.map(a => a.id === areaId
        ? { ...a, boxes: [...a.boxes, { ...box, id: uid() }] }
        : a),
    }));
    get()._persist();
  },
  updateBox: (areaId, boxId, patch) => {
    set(s => ({
      areas: s.areas.map(a => a.id === areaId
        ? { ...a, boxes: a.boxes.map(b => b.id === boxId ? { ...b, ...patch } : b) }
        : a),
    }));
    get()._persist();
  },
  removeBox: (areaId, boxId) => {
    set(s => ({
      areas: s.areas.map(a => a.id === areaId
        ? { ...a, boxes: a.boxes.filter(b => b.id !== boxId) }
        : a),
    }));
    get()._persist();
  },

  addEstado: (nombre, color) => {
    const id = nombre.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Date.now();
    set(s => ({ estados: [...s.estados, { id, nombre, color, esDefault: false }] }));
    get()._persist();
  },
  updateEstado: (id, patch) => {
    set(s => ({ estados: s.estados.map(e => e.id === id ? { ...e, ...patch } : e) }));
    get()._persist();
  },
  removeEstado: (id) => {
    set(s => ({ estados: s.estados.filter(e => e.esDefault || e.id !== id) }));
    get()._persist();
  },
}));
