import { useEffect, useMemo, useRef, useState } from 'react';
// selId/onSelect vienen del contenedor para compartir la selección con la
// pestaña "Contratos originales".
import { Building2, Download, Pencil, FileText, Loader2, CheckCircle2 } from 'lucide-react';
import * as docxPreview from 'docx-preview';
import { descargarBlob } from './contratosParser';
import type { PlantillaRecord } from './plantillasStore';

interface Props {
  plantillas: PlantillaRecord[];
  loading: boolean;
  selId: string | null;
  onSelect: (id: string | null) => void;
  onEditar: (id: string) => void;
}

function pesoLegible(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function fechaLegible(ts: number): string {
  return new Date(ts).toLocaleDateString('es-UY', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function PlantillasCargadas({ plantillas, loading, selId, onSelect, onEditar }: Props) {
  const [renderizando, setRenderizando] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  const porEmpresa = useMemo(() => {
    const map = new Map<string, PlantillaRecord[]>();
    for (const p of plantillas) {
      const arr = map.get(p.empresa) ?? [];
      arr.push(p);
      map.set(p.empresa, arr);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], 'es'));
  }, [plantillas]);

  // Selección efectiva: si la elegida ya no existe, cae a la primera.
  const seleccionada = plantillas.find(p => p.id === selId) ?? plantillas[0] ?? null;

  useEffect(() => {
    let cancelado = false;
    async function render() {
      if (!seleccionada || !previewRef.current) return;
      setRenderizando(true);
      previewRef.current.innerHTML = '';
      try {
        await docxPreview.renderAsync(seleccionada.docx, previewRef.current, undefined, { className: 'docx-preview' });
      } catch {
        if (previewRef.current) previewRef.current.innerHTML = '<p style="color:#b91c1c;font-size:13px">No se pudo previsualizar este .docx.</p>';
      } finally {
        if (!cancelado) setRenderizando(false);
      }
    }
    render();
    return () => { cancelado = true; };
  }, [seleccionada]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 text-sm gap-2">
        <Loader2 size={16} className="animate-spin" /> Cargando plantillas…
      </div>
    );
  }

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Lista por empresa */}
      <div className="w-[340px] flex-shrink-0 border-r border-gray-200 bg-white overflow-y-auto p-4">
        <p className="text-xs text-gray-500 mb-4 leading-relaxed">
          Todas las plantillas de contrato cargadas en la app, agrupadas por empresa.
          Para cambiar una condición contractual, entrá a <b>Contratos originales</b>.
        </p>
        {porEmpresa.map(([empresa, items]) => (
          <div key={empresa} className="mb-5">
            <div className="flex items-center gap-1.5 mb-2 text-[11px] font-bold text-gray-500 uppercase tracking-wide">
              <Building2 size={12} /> {empresa}
              <span className="ml-auto font-medium text-gray-400 normal-case">{items.length}</span>
            </div>
            <div className="space-y-1.5">
              {items.map(p => {
                const isSel = p.id === selId;
                return (
                  <button
                    key={p.id}
                    onClick={() => onSelect(p.id)}
                    className={`w-full flex items-start gap-2 px-2.5 py-2 rounded-lg border text-left transition-colors ${
                      isSel ? 'border-[#003DA5] bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <FileText size={14} className="text-[#003DA5] flex-shrink-0 mt-0.5" />
                    <span className="flex-1 min-w-0">
                      <span className="block text-[13px] font-medium text-gray-800 truncate">{p.area}</span>
                      <span className="block text-[11px] text-gray-400">
                        {pesoLegible(p.docx.size)} · {fechaLegible(p.actualizada)}
                      </span>
                    </span>
                    {p.builtin
                      ? p.modificada
                        ? <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 rounded px-1.5 py-0.5 flex-shrink-0">Modif.</span>
                        : <span className="text-[10px] font-semibold text-gray-400 bg-gray-100 rounded px-1.5 py-0.5 flex-shrink-0">Original</span>
                      : <span className="text-[10px] font-semibold text-[#003DA5] bg-blue-50 rounded px-1.5 py-0.5 flex-shrink-0">Cargada</span>}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        {plantillas.length === 0 && (
          <p className="text-sm text-gray-400 text-center mt-10">No hay plantillas cargadas.</p>
        )}
      </div>

      {/* Previsualización */}
      <div className="flex-1 flex flex-col overflow-hidden bg-gray-50">
        {seleccionada ? (
          <>
            <div className="flex items-center justify-between px-5 py-3 bg-white border-b border-gray-200">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-gray-800 truncate">
                  {seleccionada.empresa} · {seleccionada.area}
                </h3>
                <p className="text-[11px] text-gray-400 flex items-center gap-1.5">
                  <CheckCircle2 size={11} className="text-green-600" />
                  {seleccionada.placeholders} campos automáticos · actualizada {fechaLegible(seleccionada.actualizada)}
                </p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button
                  onClick={() => onEditar(seleccionada.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <Pencil size={13} /> Editar
                </button>
                <button
                  onClick={() => descargarBlob(seleccionada.docx, `Plantilla_${seleccionada.empresa}_${seleccionada.area}.docx`)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-white bg-[#003DA5] hover:bg-blue-800 transition-colors"
                >
                  <Download size={13} /> Descargar .docx
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6 flex justify-center relative">
              {renderizando && (
                <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm gap-2 z-10">
                  <Loader2 size={16} className="animate-spin" /> Generando vista previa…
                </div>
              )}
              <div ref={previewRef} className="bg-white shadow-sm rounded max-w-[800px] w-full min-h-[1000px] p-10" />
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
            Seleccioná una plantilla para verla.
          </div>
        )}
      </div>
    </div>
  );
}
