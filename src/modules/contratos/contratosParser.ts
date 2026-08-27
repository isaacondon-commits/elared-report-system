import PizZip from 'pizzip';

// ── Plantillas ────────────────────────────────────────────────────────────────
// Los .docx viven en public/plantillas-contratos/ (no embebidos en el bundle
// como base64 para no inflar el JS) y se piden por fetch al generar.

export type Empresa = 'Elared' | 'Phonehouse' | 'Relpont';
export type TipoContrato = 'Móvil' | 'Fibra';

const ARCHIVO_PLANTILLA: Record<Empresa, Record<TipoContrato, string>> = {
  Elared:     { Móvil: 'elared_movil.docx',     Fibra: 'elared_fibra.docx' },
  Phonehouse: { Móvil: 'phonehouse_movil.docx', Fibra: 'phonehouse_fibra.docx' },
  Relpont:    { Móvil: 'relpont_movil.docx',    Fibra: 'relpont_fibra.docx' },
};

// Plantillas todavía no disponibles (ver panel de Armado de Contratos para el
// motivo exacto) — se listan acá para poder avisar en la UI en vez de fallar
// con un error de red poco claro. Las 6 combinaciones ya están cargadas.
export const PLANTILLAS_PENDIENTES: Partial<Record<`${Empresa}_${TipoContrato}`, string>> = {};

export function getPlantillaUrl(empresa: Empresa, tipo: TipoContrato): string {
  const archivo = ARCHIVO_PLANTILLA[empresa][tipo];
  return `${import.meta.env.BASE_URL}plantillas-contratos/${archivo}`;
}

export function plantillaPendiente(empresa: Empresa, tipo: TipoContrato): string | null {
  return PLANTILLAS_PENDIENTES[`${empresa}_${tipo}`] ?? null;
}

// ── Extracción de datos del empleado ───────────────────────────────────────────

export interface DatosContrato {
  dia: string;
  mes: string;
  anio: string;
  nombre: string;
  cedula: string;
  direccion: string;
}

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

/**
 * Extrae del texto pegado (formato libre "Campo: valor" por línea) los 3 datos
 * que las 6 plantillas necesitan además de la fecha. El resto de los campos
 * que suele traer el mensaje (teléfono, banco, hijos a cargo, etc.) no se usan
 * en ninguna plantilla — se verificó contra los .docx reales.
 */
// Los campos se buscan anclados al INICIO de línea (con ":" obligatorio
// después de la etiqueta) — no como substring en cualquier parte del texto.
// Antes "CI" (sin ancla y con [:\s]* opcional) matcheaba el "ci" que hay
// dentro de "naCImiento" en "Fecha de nacimiento: ...", capturando
// "miento: 14-02-2007" como si fuera la cédula.
export function extraerDatosEmpleado(texto: string, fecha: Date): DatosContrato {
  const nombre = (texto.match(/^\s*(?:Nombre Completo|Nombre)\s*:\s*([^\n]+)/im) || [])[1]?.trim() || '______________';
  const cedula = (texto.match(/^\s*(?:C[ée]dula|C\.I\.?|CI|Documento)\s*:\s*([^\n]+)/im) || [])[1]?.trim() || '______________';
  const direccion = (texto.match(/^\s*(?:Dirección|Direccion|Domicilio)\s*:\s*([^\n]+)/im) || [])[1]?.trim() || '______________';

  return {
    dia: fecha.getDate().toString(),
    mes: MESES[fecha.getMonth()],
    anio: fecha.getFullYear().toString(),
    nombre,
    cedula,
    direccion,
  };
}

// ── Carga masiva ──────────────────────────────────────────────────────────────

const INICIO_BLOQUE_RE = /^\s*(?:nombre completo|nombre)\s*:/i;

/**
 * Divide un texto con los datos de varias personas pegados uno atrás del otro
 * en un bloque por persona. Cada persona debe empezar su bloque con una línea
 * "Nombre Completo: ..." (o "Nombre: ...") — no hace falta ningún separador
 * manual entre una persona y la siguiente, alcanza con pegar todos los
 * mensajes seguidos. Si no se detecta ningún inicio de bloque, se devuelve
 * todo el texto como un único bloque (compatible con pegar una sola persona).
 */
export function dividirEnBloques(texto: string): string[] {
  const lineas = texto.split(/\r?\n/);
  const inicios: number[] = [];
  lineas.forEach((linea, i) => { if (INICIO_BLOQUE_RE.test(linea)) inicios.push(i); });

  // Si no se detecta ningún "Nombre Completo:" / "Nombre:", se trata todo el
  // texto como una sola persona (compatible con pegar sin ese prefijo).
  if (inicios.length === 0) {
    const bloque = texto.trim();
    return bloque ? [bloque] : [];
  }

  // Cualquier texto ANTES del primer inicio detectado se descarta (es
  // preámbulo, no una persona) — evita generar un contrato vacío por un
  // encabezado suelto pegado antes de la primera persona.
  const bloques: string[] = [];
  for (let k = 0; k < inicios.length; k++) {
    const desde = inicios[k];
    const hasta = k + 1 < inicios.length ? inicios[k + 1] : lineas.length;
    const bloque = lineas.slice(desde, hasta).join('\n').trim();
    if (bloque) bloques.push(bloque);
  }
  return bloques;
}

// ── Generación del .docx ────────────────────────────────────────────────────────

export const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/**
 * Cuenta cuántos placeholders "XXXXXXXX" tiene una plantilla. Se usa para
 * avisar en la UI ("Contratos originales") si al editar el texto se borró
 * alguno sin querer — el armado necesita exactamente 6 (día, mes, año,
 * nombre, cédula, dirección).
 */
export function contarPlaceholders(plantillaBuffer: ArrayBuffer): number {
  try {
    const zip = new PizZip(plantillaBuffer);
    const file = zip.file('word/document.xml');
    if (!file) return 0;
    return (file.asText().match(/XXXXXXXX/g) || []).length;
  } catch {
    return 0;
  }
}

export const PLACEHOLDERS_ESPERADOS = 6;

/**
 * Reemplaza, en orden, los 6 placeholders "XXXXXXXX" del documento
 * (día, mes, año, nombre, cédula, dirección) y devuelve el .docx resultante.
 * Se verificó contra los 5 modelos reales que cada placeholder vive dentro de
 * un único run de Word (no está partido en fragmentos), así que el reemplazo
 * secuencial por texto plano es seguro.
 */
export function generarContratoDocx(plantillaBuffer: ArrayBuffer, datos: DatosContrato): Blob {
  const zip = new PizZip(plantillaBuffer);
  const documentXmlPath = 'word/document.xml';
  const file = zip.file(documentXmlPath);
  if (!file) throw new Error('La plantilla no tiene un word/document.xml válido — ¿es realmente un .docx?');

  let xml = file.asText();

  const ordenReemplazo = [datos.dia, datos.mes, datos.anio, datos.nombre, datos.cedula, datos.direccion];
  let reemplazos = 0;
  for (const valor of ordenReemplazo) {
    if (xml.includes('XXXXXXXX')) {
      xml = xml.replace('XXXXXXXX', escaparXml(valor));
      reemplazos++;
    }
  }
  if (reemplazos < ordenReemplazo.length) {
    throw new Error(`La plantilla tiene menos placeholders "XXXXXXXX" de los esperados (se reemplazaron ${reemplazos} de ${ordenReemplazo.length}).`);
  }

  zip.file(documentXmlPath, xml);

  return zip.generate({ type: 'blob', mimeType: DOCX_MIME }) as Blob;
}

// Escapa caracteres especiales de XML para que un nombre/dirección con
// "&", "<", ">" no rompa el documento generado.
function escaparXml(valor: string): string {
  return valor
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function nombreArchivoContrato(empresa: string, nombre: string): string {
  const sinAcentos = nombre.trim().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const safe = sinAcentos.replace(/\s+/g, '_').replace(/[^\w-]/g, '') || 'contrato';
  return `Contrato_${empresa}_${safe}.docx`;
}

export function descargarBlob(blob: Blob, nombreArchivo: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombreArchivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Empaqueta varios .docx generados en un único .zip para descargar todos juntos. */
export async function empaquetarContratosZip(
  items: { nombreArchivo: string; blob: Blob }[],
): Promise<Blob> {
  const zip = new PizZip();
  const nombresUsados = new Map<string, number>();

  for (const item of items) {
    let nombre = item.nombreArchivo;
    const usos = nombresUsados.get(nombre) ?? 0;
    if (usos > 0) {
      nombre = nombre.replace(/\.docx$/i, `_${usos + 1}.docx`);
    }
    nombresUsados.set(item.nombreArchivo, usos + 1);

    const buffer = await item.blob.arrayBuffer();
    zip.file(nombre, buffer);
  }

  return zip.generate({ type: 'blob', mimeType: 'application/zip' }) as Blob;
}
