// ── Registro de plantillas de contrato (IndexedDB) ────────────────────────────
// Las plantillas dejaron de ser 6 archivos .docx fijos en public/: ahora viven
// en IndexedDB para poder editarlas, agregar nuevas empresas/áreas y restaurar
// las originales, todo desde la app y sin volver a compilar.
//
// La primera vez que se abre el módulo, seedBuiltins() copia los 6 .docx que
// se siguen shippeando en public/plantillas-contratos/ dentro de la base. Esos
// 6 quedan marcados como builtin: se pueden editar y restaurar, pero no borrar.

import { getPlantillaUrl, contarPlaceholders, type Empresa, type TipoContrato } from './contratosParser';

const DB_NAME = 'elared-contratos';
const DB_VERSION = 1;
const STORE = 'plantillas';

export interface PlantillaRecord {
  id: string;           // slug `${empresa}__${area}` — clave primaria
  empresa: string;
  area: string;         // "Móvil", "Fibra" o una nueva área cargada por el usuario
  docx: Blob;           // .docx vigente (puede tener texto editado)
  builtin: boolean;     // true para las 6 plantillas que vienen con la app
  modificada: boolean;  // builtin cuyo texto se editó dentro de la app
  actualizada: number;  // Date.now() de la última edición / carga
  placeholders: number; // cantidad de "XXXXXXXX" en el .docx vigente
}

const BUILTINS: { empresa: Empresa; area: TipoContrato }[] = [
  { empresa: 'Elared', area: 'Móvil' },
  { empresa: 'Elared', area: 'Fibra' },
  { empresa: 'Phonehouse', area: 'Móvil' },
  { empresa: 'Phonehouse', area: 'Fibra' },
  { empresa: 'Relpont', area: 'Móvil' },
  { empresa: 'Relpont', area: 'Fibra' },
];

export function normalizar(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export function slugPlantilla(empresa: string, area: string): string {
  return `${normalizar(empresa)}__${normalizar(area)}`;
}

// ── Acceso a IndexedDB ────────────────────────────────────────────────────────

function abrirDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('No se pudo abrir la base de plantillas.'));
  });
}

function conStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return abrirDB().then(
    db =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = fn(t.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error ?? new Error('Error de IndexedDB.'));
        t.oncomplete = () => db.close();
      }),
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function descargarBuiltin(empresa: Empresa, area: TipoContrato): Promise<Blob> {
  const url = getPlantillaUrl(empresa, area);
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`No se pudo cargar la plantilla original (${resp.status}): ${url}`);
  return resp.blob();
}

async function contarPlaceholdersBlob(blob: Blob): Promise<number> {
  return contarPlaceholders(await blob.arrayBuffer());
}

// ── API pública ──────────────────────────────────────────────────────────────

/** Siembra en IndexedDB las 6 plantillas que trae la app, si todavía no están. */
export async function seedBuiltins(): Promise<void> {
  const existentes = new Set((await listarPlantillas()).map(p => p.id));
  for (const { empresa, area } of BUILTINS) {
    const id = slugPlantilla(empresa, area);
    if (existentes.has(id)) continue;
    const docx = await descargarBuiltin(empresa, area);
    const rec: PlantillaRecord = {
      id,
      empresa,
      area,
      docx,
      builtin: true,
      modificada: false,
      actualizada: Date.now(),
      placeholders: await contarPlaceholdersBlob(docx),
    };
    await conStore('readwrite', s => s.put(rec));
  }
}

export async function listarPlantillas(): Promise<PlantillaRecord[]> {
  const todas = await conStore<PlantillaRecord[]>('readonly', s => s.getAll() as IDBRequest<PlantillaRecord[]>);
  return todas.sort(
    (a, b) => a.empresa.localeCompare(b.empresa, 'es') || a.area.localeCompare(b.area, 'es'),
  );
}

export async function obtenerPlantilla(id: string): Promise<PlantillaRecord | undefined> {
  return conStore<PlantillaRecord | undefined>(
    'readonly',
    s => s.get(id) as IDBRequest<PlantillaRecord | undefined>,
  );
}

/** Reemplaza el .docx vigente de una plantilla (resultado de editar su texto). */
export async function guardarDocx(id: string, docx: Blob): Promise<void> {
  const actual = await obtenerPlantilla(id);
  if (!actual) throw new Error('La plantilla ya no existe.');
  const rec: PlantillaRecord = {
    ...actual,
    docx,
    modificada: true,
    actualizada: Date.now(),
    placeholders: await contarPlaceholdersBlob(docx),
  };
  await conStore('readwrite', s => s.put(rec));
}

/** Alta de una plantilla nueva (nueva empresa y/o nueva área) desde un .docx. */
export async function agregarPlantilla(input: {
  empresa: string;
  area: string;
  docx: Blob;
}): Promise<PlantillaRecord> {
  const empresa = input.empresa.trim();
  const area = input.area.trim();
  if (!empresa || !area) throw new Error('Completá empresa y área.');
  const id = slugPlantilla(empresa, area);
  if (await obtenerPlantilla(id)) {
    throw new Error(`Ya hay una plantilla para "${empresa} · ${area}". Editala en vez de duplicarla.`);
  }
  const rec: PlantillaRecord = {
    id,
    empresa,
    area,
    docx: input.docx,
    builtin: false,
    modificada: false,
    actualizada: Date.now(),
    placeholders: await contarPlaceholdersBlob(input.docx),
  };
  await conStore('readwrite', s => s.put(rec));
  return rec;
}

/** Borra una plantilla cargada por el usuario. Las builtin no se pueden borrar. */
export async function eliminarPlantilla(id: string): Promise<void> {
  const rec = await obtenerPlantilla(id);
  if (!rec) return;
  if (rec.builtin) throw new Error('Las plantillas originales de la app no se pueden eliminar, solo restaurar.');
  await conStore<undefined>('readwrite', s => s.delete(id));
}

/** Vuelve una plantilla builtin a su .docx original (el que trae la app). */
export async function restaurarBuiltin(id: string): Promise<void> {
  const rec = await obtenerPlantilla(id);
  if (!rec) throw new Error('La plantilla ya no existe.');
  if (!rec.builtin) throw new Error('Solo las plantillas originales de la app se pueden restaurar.');
  const docx = await descargarBuiltin(rec.empresa as Empresa, rec.area as TipoContrato);
  const restaurada: PlantillaRecord = {
    ...rec,
    docx,
    modificada: false,
    actualizada: Date.now(),
    placeholders: await contarPlaceholdersBlob(docx),
  };
  await conStore('readwrite', s => s.put(restaurada));
}
