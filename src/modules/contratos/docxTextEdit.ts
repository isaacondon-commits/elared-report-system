// ── Edición de texto de un .docx dentro de la app ────────────────────────────
// Permite editar el contenido de una plantilla sin salir de la app: se listan
// los párrafos con texto de word/document.xml y, al guardar, se reescribe SOLO
// el texto de los párrafos que cambiaron. Todo lo demás del .docx (estilos,
// encabezados, tablas, imágenes, numeración) queda intacto byte a byte.
//
// Límite conocido: si un párrafo mezcla formatos (ej. una palabra en negrita
// en medio de la oración), al editarlo queda con un único formato — el del
// primer fragmento. Se avisa en la UI con `multiFormato`.

import PizZip from 'pizzip';
import { DOCX_MIME } from './contratosParser';

const DOC_XML = 'word/document.xml';

export interface ParrafoDocx {
  indice: number;      // posición del <w:p> en el documento — clave para reescribir
  texto: string;
  multiFormato: boolean;
}

function parsearXml(xml: string): Document {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length > 0) {
    throw new Error('No se pudo leer el XML interno del .docx.');
  }
  return doc;
}

function ancestro(node: Node, tag: string): Element | null {
  let actual: Node | null = node.parentNode;
  while (actual) {
    if (actual.nodeType === 1 && (actual as Element).tagName === tag) return actual as Element;
    actual = actual.parentNode;
  }
  return null;
}

// Los <w:t> que pertenecen a ESTE párrafo y no a un párrafo anidado (un
// cuadro de texto dentro de un run tiene sus propios <w:p> internos, que
// además aparecen por separado en la lista de párrafos).
function textosPropios(p: Element): Element[] {
  return Array.from(p.getElementsByTagName('w:t')).filter(t => ancestro(t, 'w:p') === p);
}

export async function extraerParrafos(blob: Blob): Promise<ParrafoDocx[]> {
  const zip = new PizZip(await blob.arrayBuffer());
  const file = zip.file(DOC_XML);
  if (!file) throw new Error('El .docx no tiene word/document.xml — ¿es un Word válido?');

  const doc = parsearXml(file.asText());
  const parrafos = Array.from(doc.getElementsByTagName('w:p'));
  const out: ParrafoDocx[] = [];

  parrafos.forEach((p, indice) => {
    const ts = textosPropios(p);
    const texto = ts.map(t => t.textContent ?? '').join('');
    if (texto.trim() === '') return; // párrafos vacíos: no se muestran ni se tocan
    const runs = new Set(ts.map(t => ancestro(t, 'w:r')).filter(Boolean));
    out.push({ indice, texto, multiFormato: runs.size > 1 });
  });

  return out;
}

/**
 * Reescribe el texto de los párrafos indicados (`ediciones`: índice -> texto
 * nuevo) y devuelve el .docx resultante. Los párrafos que no están en
 * `ediciones` no se tocan.
 */
export async function aplicarEdiciones(
  blob: Blob,
  ediciones: Record<number, string>,
): Promise<Blob> {
  const zip = new PizZip(await blob.arrayBuffer());
  const file = zip.file(DOC_XML);
  if (!file) throw new Error('El .docx no tiene word/document.xml — ¿es un Word válido?');

  const original = file.asText();
  const doc = parsearXml(original);
  const parrafos = Array.from(doc.getElementsByTagName('w:p'));

  for (const [clave, valor] of Object.entries(ediciones)) {
    const p = parrafos[Number(clave)];
    if (!p) continue;
    const ts = textosPropios(p);
    if (ts.length === 0) continue;
    ts[0].textContent = valor;
    ts[0].setAttribute('xml:space', 'preserve');
    for (let i = 1; i < ts.length; i++) ts[i].textContent = '';
  }

  let xml = new XMLSerializer().serializeToString(doc);
  const decl = original.match(/^<\?xml[^>]*\?>\s*/); // XMLSerializer se come la declaración
  if (decl && !xml.startsWith('<?xml')) xml = decl[0] + xml;

  zip.file(DOC_XML, xml);
  return zip.generate({ type: 'blob', mimeType: DOCX_MIME }) as Blob;
}
