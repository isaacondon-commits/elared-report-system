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

export type Conector = {
  id: string;
  origenId: string;
  destinoId: string;
  tipo: 'linea' | 'flecha';
  color: string;
  label?: string;
};

export type PlanoData = {
  areas: AreaPiso[];
  estados: EstadoBox[];
  conectores: Conector[];
  ultimaActualizacion: string;
};

type PlanoSnapshot = { areas: AreaPiso[]; estados: EstadoBox[]; conectores: Conector[] };

const LS_KEY = 'elared_plano_callcenter';
const MAX_HISTORY = 20;

export function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function defaultPlano(): PlanoData {
  return {
    areas: [{ id: uid(), nombre: 'Piso Principal', x: 40, y: 40, width: 1200, height: 700, color: '#e3f2fd', boxes: [] }],
    estados: [...ESTADOS_BASE],
    conectores: [],
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
      return { ...parsed, estados: [...missing, ...parsed.estados], conectores: parsed.conectores ?? [] };
    }
  } catch {}
  return defaultPlano();
}

function snap(s: { areas: AreaPiso[]; estados: EstadoBox[]; conectores: Conector[] }): PlanoSnapshot {
  return JSON.parse(JSON.stringify({ areas: s.areas, estados: s.estados, conectores: s.conectores }));
}

interface PlanoStore {
  areas: AreaPiso[];
  estados: EstadoBox[];
  conectores: Conector[];
  savedAt: number | null;
  historyLen: number;
  futureLen: number;
  _history: PlanoSnapshot[];
  _future: PlanoSnapshot[];
  _persist: () => void;
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;
  addArea: (area: Omit<AreaPiso, 'id' | 'boxes'>) => void;
  updateArea: (areaId: string, patch: Partial<Omit<AreaPiso, 'id' | 'boxes'>>) => void;
  removeArea: (areaId: string) => void;
  addBox: (areaId: string, box: Omit<BoxPiso, 'id'>) => void;
  updateBox: (areaId: string, boxId: string, patch: Partial<BoxPiso>) => void;
  updateBoxes: (updates: { areaId: string; boxId: string; patch: Partial<BoxPiso> }[]) => void;
  removeBox: (areaId: string, boxId: string) => void;
  removeBoxes: (targets: { areaId: string; boxId: string }[]) => void;
  addBoxes: (items: { areaId: string; box: Omit<BoxPiso, 'id'> }[]) => string[];
  addEstado: (nombre: string, color: string) => void;
  updateEstado: (id: string, patch: { nombre?: string; color?: string }) => void;
  removeEstado: (id: string) => void;
  addConector: (c: Omit<Conector, 'id'>) => string;
  updateConector: (id: string, patch: Partial<Conector>) => void;
  removeConector: (id: string) => void;
}

const initial = loadFromLS();

export const usePlanoStore = create<PlanoStore>((set, get) => ({
  areas: initial.areas,
  estados: initial.estados,
  conectores: initial.conectores,
  savedAt: null,
  historyLen: 0,
  futureLen: 0,
  _history: [],
  _future: [],

  _persist: () => {
    const { areas, estados, conectores } = get();
    const data: PlanoData = { areas, estados, conectores, ultimaActualizacion: new Date().toISOString() };
    try { localStorage.setItem(LS_KEY, JSON.stringify(data)); } catch {}
    set({ savedAt: Date.now() });
  },

  pushHistory: () => {
    const s = get();
    const history = [...s._history, snap(s)].slice(-MAX_HISTORY);
    set({ _history: history, _future: [], historyLen: history.length, futureLen: 0 });
  },

  undo: () => {
    const { _history, _future } = get();
    if (_history.length === 0) return;
    const prev = _history[_history.length - 1];
    const current = snap(get());
    const future = [current, ..._future].slice(0, MAX_HISTORY);
    set({ areas: prev.areas, estados: prev.estados, conectores: prev.conectores, _history: _history.slice(0, -1), _future: future, historyLen: _history.length - 1, futureLen: future.length });
    get()._persist();
  },

  redo: () => {
    const { _history, _future } = get();
    if (_future.length === 0) return;
    const next = _future[0];
    const current = snap(get());
    const history = [..._history, current].slice(-MAX_HISTORY);
    set({ areas: next.areas, estados: next.estados, conectores: next.conectores, _history: history, _future: _future.slice(1), historyLen: history.length, futureLen: _future.length - 1 });
    get()._persist();
  },

  addArea: (area) => {
    get().pushHistory();
    set(s => ({ areas: [...s.areas, { ...area, id: uid(), boxes: [] }] }));
    get()._persist();
  },
  updateArea: (areaId, patch) => {
    set(s => ({ areas: s.areas.map(a => a.id === areaId ? { ...a, ...patch } : a) }));
    get()._persist();
  },
  removeArea: (areaId) => {
    get().pushHistory();
    const boxIds = new Set(get().areas.find(a => a.id === areaId)?.boxes.map(b => b.id) ?? []);
    set(s => ({
      areas: s.areas.filter(a => a.id !== areaId),
      conectores: s.conectores.filter(c => !boxIds.has(c.origenId) && !boxIds.has(c.destinoId)),
    }));
    get()._persist();
  },
  addBox: (areaId, box) => {
    get().pushHistory();
    set(s => ({ areas: s.areas.map(a => a.id === areaId ? { ...a, boxes: [...a.boxes, { ...box, id: uid() }] } : a) }));
    get()._persist();
  },
  updateBox: (areaId, boxId, patch) => {
    set(s => ({ areas: s.areas.map(a => a.id === areaId ? { ...a, boxes: a.boxes.map(b => b.id === boxId ? { ...b, ...patch } : b) } : a) }));
    get()._persist();
  },
  updateBoxes: (updates) => {
    const patchMap = new Map(updates.map(u => [u.boxId, u.patch]));
    set(s => ({ areas: s.areas.map(a => ({ ...a, boxes: a.boxes.map(b => { const p = patchMap.get(b.id); return p ? { ...b, ...p } : b; }) })) }));
    get()._persist();
  },
  removeBox: (areaId, boxId) => {
    get().pushHistory();
    set(s => ({
      areas: s.areas.map(a => a.id === areaId ? { ...a, boxes: a.boxes.filter(b => b.id !== boxId) } : a),
      conectores: s.conectores.filter(c => c.origenId !== boxId && c.destinoId !== boxId),
    }));
    get()._persist();
  },
  removeBoxes: (targets) => {
    get().pushHistory();
    const ids = new Set(targets.map(t => t.boxId));
    set(s => ({
      areas: s.areas.map(a => ({ ...a, boxes: a.boxes.filter(b => !ids.has(b.id)) })),
      conectores: s.conectores.filter(c => !ids.has(c.origenId) && !ids.has(c.destinoId)),
    }));
    get()._persist();
  },
  addBoxes: (items) => {
    get().pushHistory();
    const results: string[] = [];
    set(s => ({
      areas: s.areas.map(a => {
        const toAdd = items.filter(i => i.areaId === a.id);
        if (!toAdd.length) return a;
        const newBoxes = toAdd.map(i => { const id = uid(); results.push(id); return { ...i.box, id }; });
        return { ...a, boxes: [...a.boxes, ...newBoxes] };
      }),
    }));
    get()._persist();
    return results;
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
  addConector: (c) => {
    get().pushHistory();
    const id = uid();
    set(s => ({ conectores: [...s.conectores, { ...c, id }] }));
    get()._persist();
    return id;
  },
  updateConector: (id, patch) => {
    set(s => ({ conectores: s.conectores.map(c => c.id === id ? { ...c, ...patch } : c) }));
    get()._persist();
  },
  removeConector: (id) => {
    get().pushHistory();
    set(s => ({ conectores: s.conectores.filter(c => c.id !== id) }));
    get()._persist();
  },
}));
