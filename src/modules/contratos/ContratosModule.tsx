import { useCallback, useEffect, useRef, useState } from 'react';
import { Zap, Download, Printer, Pencil, Lock, AlertTriangle, Loader2, FileSignature } from 'lucide-react';
import * as docxPreview from 'docx-preview';
import Header from '../../components/Header';
import { recordActivity } from '../../utils/activityTracker';
import {
  extraerDatosEmpleado, generarContratoDocx, getPlantillaUrl, plantillaPendiente,
  nombreArchivoContrato, descargarBlob,
  type Empresa, type TipoContrato, type DatosContrato,
} from './contratosParser';

const EMPRESAS: Empresa[] = ['Elared', 'Phonehouse', 'Relpont'];
const TIPOS: TipoContrato[] = ['Móvil', 'Fibra'];

function hoyInputDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Aísla la impresión al documento generado: oculta todo lo demás de la app
// (sidebar global, header, panel de datos) mientras dura el print. Se agrega
// y se saca del <head> solo mientras este módulo está montado.
function usePrintScopedToPreview(previewAreaId: string) {
  useEffect(() => {
    const style = document.createElement('style');
    style.id = 'contratos-print-style';
    style.innerHTML = `
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
  const [docxBlob, setDocxBlob] = useState<Blob | null>(null);
  const [datosExtraidos, setDatosExtraidos] = useState<DatosContrato | null>(null);
  const [editable, setEditable] = useState(false);

  const previewRef = useRef<HTMLDivElement>(null);
  usePrintScopedToPreview('contrato-print-area');

  const pendiente = plantillaPendiente(empresa, tipo);

  const handleArmar = useCallback(async () => {
    setError('');
    if (!rawText.trim()) { setError('Pegá primero los datos del empleado.'); return; }
    if (pendiente) { setError(`No se puede armar este contrato todavía: ${pendiente}`); return; }

    setGenerando(true);
    try {
      const fechaContrato = fecha ? new Date(`${fecha}T12:00:00`) : new Date();
      const datos = extraerDatosEmpleado(rawText, fechaContrato);
      setDatosExtraidos(datos);

      const url = getPlantillaUrl(empresa, tipo);
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`No se pudo cargar la plantilla (${resp.status}). Archivo esperado: ${url}`);
      const plantillaBuffer = await resp.arrayBuffer();

      const blob = generarContratoDocx(plantillaBuffer, datos);
      setDocxBlob(blob);

      if (previewRef.current) {
        previewRef.current.innerHTML = '';
        await docxPreview.renderAsync(blob, previewRef.current, undefined, { className: 'docx-preview' });
      }
      recordActivity('contratos', `${empresa} ${tipo} — ${datos.nombre}`);
    } catch (e) {
      setError((e as Error).message || 'Error procesando el documento.');
      setDocxBlob(null);
    } finally {
      setGenerando(false);
    }
  }, [rawText, empresa, tipo, fecha, pendiente]);

  function toggleEditable() {
    setEditable(v => !v);
  }

  function handleDescargar() {
    if (!docxBlob || !datosExtraidos) return;
    descargarBlob(docxBlob, nombreArchivoContrato(empresa, datosExtraidos.nombre));
  }

  function handleImprimir() {
    window.print();
  }

  const hayDocumento = docxBlob !== null;

  return (
    <div className="flex flex-col h-full">
      <div className="print:hidden">
        <Header title="Armado de Contratos" subtitle="Generá contratos de trabajo a partir de las plantillas de cada empresa" />
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* ── Panel de datos ── */}
        <div className="w-[380px] flex-shrink-0 border-r border-gray-200 bg-white p-5 overflow-y-auto print:hidden">
          <div className="mb-4">
            <div className="inline-flex bg-blue-50 rounded-lg p-2.5 mb-2">
              <FileSignature size={20} className="text-[#003DA5]" />
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">
              Pegá los datos del empleado. Elegí la empresa y el tipo de contrato — la plantilla correspondiente ya está cargada.
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
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Datos del empleado</label>
            <textarea
              value={rawText}
              onChange={e => setRawText(e.target.value)}
              placeholder={'Pegá el mensaje completo acá. Ejemplo:\n\nNombre Completo: Juana Pérez\nCedula: 1.234.567-8\nDirección: Bulevar Artigas 1234, Montevideo'}
              className="w-full h-64 resize-y border border-gray-200 rounded-lg px-3 py-2 text-[13px] leading-relaxed focus:outline-none focus:border-[#003DA5] focus:ring-1 focus:ring-[#003DA5]"
            />
            <p className="text-[11px] text-gray-400 mt-1">Solo se usan Nombre, Cédula y Dirección — el resto del texto se ignora.</p>
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
            {generando ? 'Armando...' : 'Armar Contrato'}
          </button>
        </div>

        {/* ── Vista previa ── */}
        <div className="flex-1 flex flex-col overflow-hidden bg-gray-50">
          <div className="flex items-center justify-between px-5 py-3 bg-white border-b border-gray-200 print:hidden">
            <h3 className="text-sm font-semibold text-gray-800">Previsualización y Edición</h3>
            <div className="flex gap-2">
              <button
                onClick={toggleEditable}
                disabled={!hayDocumento}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors disabled:opacity-40 ${
                  editable ? 'bg-amber-50 border-amber-300 text-amber-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                {editable ? <Lock size={13} /> : <Pencil size={13} />}
                {editable ? 'Bloquear edición' : 'Permitir edición'}
              </button>
              <button
                onClick={handleDescargar}
                disabled={!hayDocumento}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-40 transition-colors"
              >
                <Download size={13} /> Descargar .docx
              </button>
              <button
                onClick={handleImprimir}
                disabled={!hayDocumento}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-white bg-[#E3000F] hover:opacity-90 disabled:opacity-40 transition-colors"
              >
                <Printer size={13} /> Imprimir
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
              {!hayDocumento && !generando && (
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
