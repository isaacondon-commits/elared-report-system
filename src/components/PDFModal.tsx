import { useState } from 'react';
import { FileText, User, X, Loader2 } from 'lucide-react';
import { exportarPDFGeneral, exportarPDFIndividual } from '../utils/pdfCapture';

interface PDFModalProps {
  elementId: string;
  titulo: string;
  nombreArchivo: string;
  onClose: () => void;
  subtitulo?: string;
  personaElementId?: string;
  personaNombre?: string;
}

export default function PDFModal({
  elementId, titulo, nombreArchivo, onClose,
  subtitulo, personaElementId, personaNombre,
}: PDFModalProps) {
  const [generando, setGenerando] = useState(false);
  const [mensaje, setMensaje] = useState('');

  async function handleGeneral() {
    setGenerando(true);
    setMensaje('Generando PDF...');
    try {
      await exportarPDFGeneral(elementId, { titulo, subtitulo, nombreArchivo });
      setMensaje('¡PDF descargado!');
      setTimeout(onClose, 1200);
    } catch {
      setMensaje('Error al generar el PDF');
      setTimeout(() => { setMensaje(''); setGenerando(false); }, 2000);
      return;
    }
    setGenerando(false);
  }

  async function handleIndividual() {
    if (!personaElementId) return;
    setGenerando(true);
    setMensaje('Generando PDF individual...');
    try {
      const safeName = (personaNombre ?? 'persona').replace(/[^a-zA-Z0-9]/g, '_');
      await exportarPDFIndividual(personaElementId, {
        titulo: personaNombre ?? titulo,
        subtitulo,
        nombreArchivo: `${nombreArchivo}_${safeName}`,
      });
      setMensaje('¡PDF descargado!');
      setTimeout(onClose, 1200);
    } catch {
      setMensaje('Error al generar el PDF');
      setTimeout(() => { setMensaje(''); setGenerando(false); }, 2000);
      return;
    }
    setGenerando(false);
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onClick={!generando ? onClose : undefined}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-bold text-gray-900">Exportar PDF</h2>
          {!generando && (
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X size={18} />
            </button>
          )}
        </div>

        {generando ? (
          <div className="flex flex-col items-center gap-3 py-6">
            <Loader2 size={32} className="animate-spin text-[#003DA5]" />
            <p className="text-sm text-gray-600">{mensaje}</p>
          </div>
        ) : mensaje ? (
          <div className="text-center py-6 text-green-600 font-semibold text-sm">{mensaje}</div>
        ) : (
          <div className="flex flex-col gap-2">
            <button
              onClick={handleGeneral}
              className="flex items-center gap-3 w-full px-4 py-3 bg-[#003DA5] text-white rounded-xl hover:bg-blue-800 transition-colors text-sm font-semibold"
            >
              <FileText size={17} />
              Reporte general
            </button>
            {personaElementId && (
              <button
                onClick={handleIndividual}
                className="flex items-center gap-3 w-full px-4 py-3 bg-gray-700 text-white rounded-xl hover:bg-gray-800 transition-colors text-sm font-semibold"
              >
                <User size={17} />
                {personaNombre ? `PDF de ${personaNombre.split(' ')[0]}` : 'Por persona'}
              </button>
            )}
            <button
              onClick={onClose}
              className="w-full px-4 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              Cancelar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
