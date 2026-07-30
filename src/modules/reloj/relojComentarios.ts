// ─── Comentarios por empleado — historial general, no atado a un día puntual ────

export interface ComentarioEmpleado {
  id: string;
  nombre: string;
  fecha: string; // ISO, fecha de carga del comentario
  texto: string;
  autor?: string;
}

const STORAGE_KEY = 'elared_reloj_comentarios';

function normNombre(n: string): string {
  return n.trim().toLowerCase();
}

function loadAll(): ComentarioEmpleado[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as ComentarioEmpleado[];
  } catch { /* ignore */ }
  return [];
}

function saveAll(comentarios: ComentarioEmpleado[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(comentarios)); } catch { /* ignore */ }
}

export function getComentarios(nombre: string): ComentarioEmpleado[] {
  const key = normNombre(nombre);
  return loadAll()
    .filter(c => normNombre(c.nombre) === key)
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
}

export function agregarComentario(nombre: string, texto: string, autor?: string): ComentarioEmpleado {
  const nuevo: ComentarioEmpleado = {
    id: `${nombre}__${Date.now()}__${Math.random().toString(36).slice(2, 7)}`,
    nombre,
    fecha: new Date().toISOString(),
    texto,
    autor,
  };
  const all = loadAll();
  all.push(nuevo);
  saveAll(all);
  return nuevo;
}

export function eliminarComentario(id: string): void {
  saveAll(loadAll().filter(c => c.id !== id));
}
