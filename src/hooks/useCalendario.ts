import { useState, useEffect } from 'react';
import {
  collection, query, where, onSnapshot,
  addDoc, updateDoc, deleteDoc, doc,
} from 'firebase/firestore';
import { db } from '../firebase';

// ── Tipos ─────────────────────────────────────────────────────────────────────

export type TipoEvento =
  | 'capacitacion_movil'
  | 'capacitacion_fibra'
  | 'entrevista'
  | 'ingreso_movil'
  | 'ingreso_fibra'
  | 'entrevista_movil_ph'
  | 'sala_ocupada'
  | 'otro';

export type CalendarioId = 'sala' | 'personal';

export type Recurrencia = 'no' | 'semanal' | 'quincenal' | 'mensual';

export interface EventoCalendario {
  id: string;
  fecha: string;               // "2026-07-15" (ISO)
  calendario: CalendarioId;
  tipo: TipoEvento;
  titulo: string;
  descripcion?: string;
  color: string;
  creadoPor: string;
  creadoPorNombre: string;
  creadoEn: string;
  actualizadoEn: string;
}

export type NuevoEvento = Omit<EventoCalendario, 'id' | 'color' | 'creadoEn' | 'actualizadoEn'>;

const COLLECTION = 'calendario_eventos';

// ── Colores y labels ──────────────────────────────────────────────────────────

export const TIPO_COLORS: Record<TipoEvento, string> = {
  capacitacion_movil:  '#6f42c1',
  capacitacion_fibra:  '#003DA5',
  entrevista:          '#28a745',
  ingreso_movil:       '#fd7e14',
  ingreso_fibra:       '#0052CC',
  entrevista_movil_ph: '#20c997',
  sala_ocupada:        '#E3000F',
  otro:                '#6c757d',
};

export const TIPO_LABELS: Record<TipoEvento, string> = {
  capacitacion_movil:  'Capacitación Móvil',
  capacitacion_fibra:  'Capacitación Fibra',
  entrevista:          'Entrevista',
  ingreso_movil:       'Ingreso Personal Móvil',
  ingreso_fibra:       'Ingreso Personal Fibra',
  entrevista_movil_ph: 'Entrevista Móvil Ph',
  sala_ocupada:        'Sala Ocupada',
  otro:                'Otro',
};

export const CALENDARIO_LABELS: Record<CalendarioId, string> = {
  sala:     'Sala de Capacitación',
  personal: 'Entrevistas e Ingresos',
};

export const TIPOS_POR_CALENDARIO: Record<CalendarioId, TipoEvento[]> = {
  sala:     ['capacitacion_movil', 'capacitacion_fibra', 'sala_ocupada', 'otro'],
  personal: ['entrevista', 'ingreso_movil', 'ingreso_fibra', 'entrevista_movil_ph', 'otro'],
};

export const NOTA_EXCEL =
  'Todos los ingresos van a ser de 9 personas, si necesitan menos, ingresan menos';

// ── Hook de suscripción por rango de fechas ────────────────────────────────────

export function useCalendario(rangeStart: string, rangeEnd: string) {
  const [eventos, setEventos] = useState<EventoCalendario[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const q = query(
      collection(db, COLLECTION),
      where('fecha', '>=', rangeStart),
      where('fecha', '<=', rangeEnd),
    );
    const unsub = onSnapshot(q, snap => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as EventoCalendario));
      docs.sort((a, b) => a.fecha.localeCompare(b.fecha));
      setEventos(docs);
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, [rangeStart, rangeEnd]);

  return { eventos, loading };
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

export async function crearEvento(data: NuevoEvento): Promise<void> {
  const now = new Date().toISOString();
  await addDoc(collection(db, COLLECTION), {
    ...data,
    color: TIPO_COLORS[data.tipo],
    creadoEn: now,
    actualizadoEn: now,
  });
}

function addDias(fecha: string, dias: number): string {
  const d = new Date(fecha + 'T12:00:00');
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** Crea el evento original + sus repeticiones dentro del mismo mes calendario del evento inicial. */
export async function crearEventosRecurrentes(data: NuevoEvento, recurrencia: Recurrencia): Promise<number> {
  const fechas: string[] = [data.fecha];
  if (recurrencia !== 'no') {
    const paso = recurrencia === 'semanal' ? 7 : recurrencia === 'quincenal' ? 14 : 30;
    const mesInicial = data.fecha.slice(0, 7); // "yyyy-mm"
    let siguiente = addDias(data.fecha, paso);
    while (siguiente.slice(0, 7) === mesInicial) {
      fechas.push(siguiente);
      siguiente = addDias(siguiente, paso);
    }
  }
  await Promise.all(fechas.map(fecha => crearEvento({ ...data, fecha })));
  return fechas.length;
}

export async function actualizarEvento(id: string, data: Partial<NuevoEvento>): Promise<void> {
  const patch: Record<string, unknown> = { ...data, actualizadoEn: new Date().toISOString() };
  if (data.tipo) patch.color = TIPO_COLORS[data.tipo];
  await updateDoc(doc(db, COLLECTION, id), patch);
}

export async function eliminarEvento(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTION, id));
}

// ── Conflictos ────────────────────────────────────────────────────────────────

export function hayConflicto(
  eventos: EventoCalendario[], fecha: string, tipo: TipoEvento, excludeId?: string,
): boolean {
  return eventos.some(e => e.fecha === fecha && e.tipo === tipo && e.id !== excludeId);
}
