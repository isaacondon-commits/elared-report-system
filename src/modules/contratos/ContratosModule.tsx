import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Zap, Download, Printer, Pencil, Lock, AlertTriangle, Loader2, FileSignature,
  Users, CheckCircle2, FileArchive, Eye,
} from 'lucide-react';
import * as docxPreview from 'docx-preview';
import Header from '../../components/Header';
import { recordActivity } from '../../utils/activityTracker';
import {
  extraerDatosEmpleado, generarContratoDocx, getPlantillaUrl, plantillaPendiente,
  nombreArchivoContrato, descargarBlob, dividirEnBloques, empaquetarContratosZip,
  type Empresa, type TipoContrato, type DatosContrato,
} from './contratosParser';

const EMPRESAS: Empresa[] = ['Elared', 'Phonehouse', 'Relpont'];
const TIPOS: TipoContrato[] = ['Móvil', 'Fibra'];

interface ResultadoContrato {
  datos: DatosContrato;
  blob: Blob;
  nombreArchivo: string;
  advertencia: string | null;
}

function hoyInputDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Aísla la impresión al documento seleccionado: oculta todo lo demás de la
// app (sidebar global, header, panel de datos) y fuerza tamaño A4. Se agrega
// y se saca del <head> solo mientras este módulo está montado.
function usePrintScopedToPreview(previewAreaId: string) {
  useEffect(() => {
    const style = document.createElement('style');
    style.id = 'contratos-print-style';
    style.innerHTML = `
      /* margin: 0 en @page — además de A4, esto es lo que hace que Chrome no
         tenga dónde dibujar el encabezado/pie por defecto (fecha, título de
         la pestaña, URL). El propio documento ya trae sus márgenes internos
         (docx-preview renderiza la página a tamaño real, márgenes incluidos),
         así que no hace falta un margen extra acá. */
      @page { size: A4; margin: 0; }
      @media print {
        body * { visibility: hidden; }
        #${previewAreaId}, #${previewAreaId} * { visibility: visible; }
        #${previewAreaId} { position: absolute; top: 0; left: 0; width: 100%; padding: 0; margin: 0; }
      }
    `;
    document.head.appendChild(style);
    return () => { style.remove(); };
  }, [previewAreaId]);
}

export default function ContratosModule() {
  const [empresa, setEmpresa] = useState<Empresa>('Elared');
  const [tipo, setTipo] = useState<TipoContrato>('Móvil');
  const [fecha, setFecha] = useState(hoyInputDate());
  const [rawText, setRawText] = useState('');
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState('');
  const [resultados, setResultados] = useState<ResultadoContrato[]>([]);
  const [seleccionado, setSeleccionado] = useState<number | null>(null);
  const [editable, setEditable] = useState(false);
  const [empaquetando, setEmpaquetando] = useState(false);

  const previewRef = useRef<HTMLDivElement>(null);
  usePrintScopedToPreview('contrato-print-area');

  const pendiente = plantillaPendiente(empresa, tipo);

  const personasDetectadas = useMemo(() => dividirEnBloques(rawText).length, [rawText]);

  const renderizarSeleccion = useCallback(async (idx: number, lista: ResultadoContrato[]) => {
    const item = lista[idx];
    if (!item || !previewRef.current) return;
    previewRef.current.innerHTML = '';
    await docxPreview.renderAsync(item.blob, previewRef.current, undefined, { className: 'docx-preview' });
  }, []);

  const handleArmar = useCallback(async () => {
    setError('');
    if (!rawText.trim()) { setError('Pegá primero los datos del empleado (uno o varios).'); return; }
    if (pendiente) { setError(`No se puede armar este contrato todavía: ${pendiente}`); return; }

    const bloques = dividirEnBloques(rawText);
    if (bloques.length === 0) { setError('No se encontraron datos para procesar.'); return; }

    setGenerando(true);
    setResultados([]);
    setSeleccionado(null);
    try {
      const fechaContrato = fecha ? new Date(`${fecha}T12:00:00`) : new Date();
      const url = getPlantillaUrl(empresa, tipo);
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`No se pudo cargar la plantilla (${resp.status}). Archivo esperado: ${url}`);
      const plantillaBuffer = await resp.arrayBuffer();

      const nuevos: ResultadoContrato[] = [];
      for (const bloque of bloques) {
        const datos = extraerDatosEmpleado(bloque, fechaContrato);
        const advertencia = datos.nombre === '______________'
          ? 'No se encontró el nombre en este bloque — revisalo antes de descargar.'
          : null;
        try {
          const blob = generarContratoDocx(plantillaBuffer, datos);
          nuevos.push({ datos, blob, nombreArchivo: nombreArchivoContrato(empresa, datos.nombre), advertencia });
        } catch (e) {
          nuevos.push({
            datos, blob: new Blob(), nombreArchivo: '',
            advertencia: `Error generando este contrato: ${(e as Error).message}`,
          });
        }
      }

      setResultados(nuevos);
      recordActivity('contratos', `${empresa} ${tipo} — ${nuevos.length} contrato${nuevos.length > 1 ? 's' : ''}`);

      const primeroValido = nuevos.findIndex(r => r.blob.size > 0);
      if (primeroValido >= 0) {
        setSeleccionado(primeroValido);
        await renderizarSeleccion(primeroValido, nuevos);
      }
    } catch (e) {
      setError((e as Error).message || 'Error procesando el documento.');
    } finally {
      setGenerando(false);
    }
  }, [rawText, empresa, tipo, fecha, pendiente, renderizarSeleccion]);

  async function handleSeleccionar(idx: number) {
    if (resultados[idx].blob.size === 0) return; // fila con error, nada para previsualizar
    setSeleccionado(idx);
    setEditable(false);
    await renderizarSeleccion(idx, resultados);
  }

  function toggleEditable() {
    setEditable(v => !v);
  }

  function handleDescargarSeleccionado() {
    if (seleccionado === null) return;
    const r = resultados[seleccionado];
    if (r.blob.size === 0) return;
    descargarBlob(r.blob, r.nombreArchivo);
  }

  async function handleDescargarTodos() {
    const validos = resultados.filter(r => r.blob.size > 0);
    if (validos.length === 0) return;
    setEmpaquetando(true);
    try {
      const zip = await empaquetarContratosZip(validos.map(r => ({ nombreArchivo: r.nombreArchivo, blob: r.blob })));
      descargarBlob(zip, `Contratos_${empresa}_${fecha}.zip`);
    } catch (e) {
      setError((e as Error).message || 'Error armando el .zip.');
    } finally {
      setEmpaquetando(false);
    }
  }

  function handleImprimir() {
    window.print();
  }

  const hayResultados = resultados.length > 0;
  const validosCount = resultados.filter(r => r.blob.size > 0).length;
  const itemSeleccionado = seleccionado !== null ? resultados[seleccionado] : null;

  return (
    <div className="flex flex-col h-full">
      <div className="print:hidden">
        <Header title="Armado de Contratos" subtitle="Generá uno o varios contratos de trabajo a partir de las plantillas de cada empresa" />
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* ── Panel de datos ── */}
        <div className="w-[400px] flex-shrink-0 border-r border-gray-200 bg-white p-5 overflow-y-auto print:hidden">
          <div className="mb-4">
            <div className="inline-flex bg-blue-50 rounded-lg p-2.5 mb-2">
              <FileSignature size={20} className="text-[#003DA5]" />
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">
              Pegá los datos de uno o varios empleados. Empresa y tipo aplican a todo el lote.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Empresa</label>
              <select
                value={empresa}
                onChange={e => setEmpresa(e.target.value as Empresa)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#003DA5] focus:ring-1 focus:ring-[#003DA5]"
              >
                {EMPRESAS.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Tipo</label>
              <select
                value={tipo}
                onChange={e => setTipo(e.target.value as TipoContrato)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#003DA5] focus:ring-1 focus:ring-[#003DA5]"
              >
                {TIPOS.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
          </div>

          {pendiente && (
            <div className="mb-4 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 text-xs text-amber-700">
              <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
              <span>{pendiente}</span>
            </div>
          )}

          <div className="mb-4">
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Fecha del contrato</label>
            <input
              type="date"
              value={fecha}
              onChange={e => setFecha(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#003DA5] focus:ring-1 focus:ring-[#003DA5]"
            />
          </div>

          <div className="mb-4">
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Datos de los empleados</label>
              {rawText.trim() !== '' && (
                <span className="flex items-center gap-1 text-[11px] font-medium text-[#003DA5]">
                  <Users size={11} /> {personasDetectadas} persona{personasDetectadas !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            <textarea
              value={rawText}
              onChange={e => setRawText(e.target.value)}
              placeholder={'Pegá uno o varios mensajes seguidos, cada uno empezando con "Nombre Completo:". Ejemplo:\n\nNombre Completo: Juana Pérez\nCedula: 1.234.567-8\nDirección: Bulevar Artigas 1234, Montevideo\n\nNombre Completo: Pedro Gómez\nCedula: 2.345.678-9\nDirección: ...'}
              className="w-full h-64 resize-y border border-gray-200 rounded-lg px-3 py-2 text-[13px] leading-relaxed focus:outline-none focus:border-[#003DA5] focus:ring-1 focus:ring-[#003DA5]"
            />
            <p className="text-[11px] text-gray-400 mt-1">
              Cada persona se detecta automáticamente por su línea "Nombre Completo:" — no hace falta separador manual.
              Solo se usan Nombre, Cédula y Dirección de cada bloque.
            </p>
          </div>

          {error && (
            <div className="mb-4 flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 text-xs text-red-700">
              <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <button
            onClick={handleArmar}
            disabled={generando}
            className="w-full flex items-center justify-center gap-2 bg-[#003DA5] text-white rounded-lg py-2.5 text-sm font-semibold hover:bg-blue-800 disabled:opacity-60 transition-colors"
          >
            {generando ? <Loader2 size={15} className="animate-spin" /> : <Zap size={15} />}
            {generando ? 'Armando...' : personasDetectadas > 1 ? `Armar ${personasDetectadas} Contratos` : 'Armar Contrato'}
          </button>

          {/* ── Resultados del lote ── */}
          {hayResultados && (
            <div className="mt-5 pt-4 border-t border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                  Resultados ({validosCount}/{resultados.length})
                </h4>
                {validosCount > 1 && (
                  <button
                    onClick={handleDescargarTodos}
                    disabled={empaquetando}
                    className="flex items-center gap-1 text-[11px] font-medium text-[#003DA5] hover:underline disabled:opacity-50"
                  >
                    {empaquetando ? <Loader2 size={11} className="animate-spin" /> : <FileArchive size={11} />}
                    Descargar todos (.zip)
                  </button>
                )}
              </div>
              <div className="space-y-1.5">
                {resultados.map((r, i) => {
                  const conError = r.blob.size === 0;
                  const isSel = seleccionado === i;
                  return (
                    <button
                      key={i}
                      onClick={() => handleSeleccionar(i)}
                      disabled={conError}
                      className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg border text-left text-xs transition-colors ${
                        isSel ? 'border-[#003DA5] bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
                      } ${conError ? 'opacity-60 cursor-not-allowed' : ''}`}
                    >
                      {conError ? (
                        <AlertTriangle size={13} className="text-red-500 flex-shrink-0" />
                      ) : r.advertencia ? (
                        <AlertTriangle size={13} className="text-amber-500 flex-shrink-0" />
                      ) : (
                        <CheckCircle2 size={13} className="text-green-600 flex-shrink-0" />
                      )}
                      <span className="flex-1 min-w-0 truncate font-medium text-gray-700">{r.datos.nombre}</span>
                      {!conError && <Eye size={12} className="text-gray-300 flex-shrink-0" />}
                    </button>
                  );
                })}
              </div>
              {resultados.some(r => r.advertencia) && (
                <p className="text-[11px] text-amber-600 mt-2">⚠ Algunos bloques tienen datos incompletos o faltantes — revisalos antes de entregar.</p>
              )}
            </div>
          )}
        </div>

        {/* ── Vista previa ── */}
        <div className="flex-1 flex flex-col overflow-hidden bg-gray-50">
          <div className="flex items-center justify-between px-5 py-3 bg-white border-b border-gray-200 print:hidden">
            <h3 className="text-sm font-semibold text-gray-800">
              Previsualización y Edición
              {itemSeleccionado && <span className="ml-2 font-normal text-gray-400">· {itemSeleccionado.datos.nombre}</span>}
            </h3>
            <div className="flex gap-2">
              <button
                onClick={toggleEditable}
                disabled={!itemSeleccionado}
                title="Los cambios acá solo afectan lo que se imprime, no el .docx descargado"
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors disabled:opacity-40 ${
                  editable ? 'bg-amber-50 border-amber-300 text-amber-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                {editable ? <Lock size={13} /> : <Pencil size={13} />}
                {editable ? 'Bloquear edición' : 'Permitir edición'}
              </button>
              <button
                onClick={handleDescargarSeleccionado}
                disabled={!itemSeleccionado}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-40 transition-colors"
              >
                <Download size={13} /> Descargar .docx
              </button>
              <button
                onClick={handleImprimir}
                disabled={!itemSeleccionado}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-white bg-[#E3000F] hover:opacity-90 disabled:opacity-40 transition-colors"
              >
                <Printer size={13} /> Imprimir (A4)
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 flex justify-center" id="contrato-print-area">
            <div
              ref={previewRef}
              contentEditable={editable}
              suppressContentEditableWarning
              className="bg-white shadow-sm rounded max-w-[800px] w-full min-h-[1000px] p-10 outline-none"
              style={editable ? { border: '2px dashed #003DA5' } : undefined}
            >
              {!hayResultados && !generando && (
                <p className="text-center text-gray-400 mt-24 text-sm">
                  Completá los datos y presioná <b>"Armar Contrato"</b> para ver el documento acá.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
