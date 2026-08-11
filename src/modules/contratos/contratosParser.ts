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
// con un error de red poco claro.
export const PLANTILLAS_PENDIENTES: Partial<Record<`${Empresa}_${TipoContrato}`, string>> = {
  Phonehouse_Móvil: 'La plantilla original está en formato .doc (Word antiguo) y todavía no se convirtió a .docx.',
};

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
export function extraerDatosEmpleado(texto: string, fecha: Date): DatosContrato {
  const nombre = (texto.match(/(?:Nombre Completo|Nombre)[:\s]*([^\n]+)/i) || [])[1]?.trim() || '______________';
  const cedula = (texto.match(/(?:Cedula|Cédula|C\.I\.?|CI)[:\s]*([^\n]+)/i) || [])[1]?.trim() || '______________';
  const direccion = (texto.match(/(?:Dirección|Direccion|Domicilio)[:\s]*([^\n]+)/i) || [])[1]?.trim() || '______________';

  return {
    dia: fecha.getDate().toString(),
    mes: MESES[fecha.getMonth()],
    anio: fecha.getFullYear().toString(),
    nombre,
    cedula,
    direccion,
  };
}

// ── Generación del .docx ────────────────────────────────────────────────────────

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

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
  const safe = nombre.trim().replace(/\s+/g, '_').replace(/[^\w-]/g, '') || 'contrato';
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
