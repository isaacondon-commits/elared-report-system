import { useCallback, useEffect, useState } from 'react';
import { Loader2, AlertTriangle, RefreshCw } from 'lucide-react';
import Header from '../../components/Header';
import ArmadoContratos from './ArmadoContratos';
import PlantillasCargadas from './PlantillasCargadas';
import PlantillasOriginales from './PlantillasOriginales';
import { seedBuiltins, listarPlantillas, type PlantillaRecord } from './plantillasStore';

type Tab = 'armado' | 'cargados' | 'originales';

const TABS: { id: Tab; label: string; subtitle: string }[] = [
  { id: 'armado', label: 'Armado', subtitle: 'Generá uno o varios contratos a partir de las plantillas de cada empresa' },
  { id: 'cargados', label: 'Contratos cargados', subtitle: 'Todas las plantillas de contrato cargadas, separadas por empresa' },
  { id: 'originales', label: 'Contratos originales', subtitle: 'Editá el texto de los contratos, restaurá el original o agregá uno nuevo' },
];

const MSG_ERROR = 'No se pudieron cargar las plantillas de contrato.';

export default function ContratosModule() {
  const [tab, setTab] = useState<Tab>('armado');
  const [plantillas, setPlantillas] = useState<PlantillaRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorCarga, setErrorCarga] = useState('');
  const [selId, setSelId] = useState<string | null>(null);

  // Refresco manual (botón "Reintentar", y tras editar / agregar / borrar).
  const recargar = useCallback(async () => {
    setLoading(true);
    setErrorCarga('');
    try {
      await seedBuiltins();
      setPlantillas(await listarPlantillas());
    } catch (e) {
      setErrorCarga((e as Error).message || MSG_ERROR);
    } finally {
      setLoading(false);
    }
  }, []);

  // Carga inicial.
  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        await seedBuiltins();
        if (vivo) setPlantillas(await listarPlantillas());
      } catch (e) {
        if (vivo) setErrorCarga((e as Error).message || MSG_ERROR);
      } finally {
        if (vivo) setLoading(false);
      }
    })();
    return () => { vivo = false; };
  }, []);

  const subtitle = TABS.find(t => t.id === tab)?.subtitle;

  return (
    <div className="flex flex-col h-full min-w-0">
      <div className="print:hidden">
        <Header title="Armado de Contratos" subtitle={subtitle} />
        <div className="bg-white border-b border-gray-200 px-6 pt-3 flex gap-2">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 rounded-t-lg text-sm font-semibold transition-colors ${
                tab === t.id ? 'bg-[#1A1A2E] text-white' : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {errorCarga && (
        <div className="px-6 py-2.5 bg-red-50 border-b border-red-200 text-xs text-red-700 flex items-center gap-2 print:hidden">
          <AlertTriangle size={14} />
          <span>{errorCarga}</span>
          <button onClick={() => void recargar()} className="ml-auto flex items-center gap-1 font-medium hover:underline">
            <RefreshCw size={12} /> Reintentar
          </button>
        </div>
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        {loading && plantillas.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-gray-400 text-sm gap-2">
            <Loader2 size={16} className="animate-spin" /> Cargando plantillas de contrato…
          </div>
        ) : tab === 'armado' ? (
          <ArmadoContratos plantillas={plantillas} />
        ) : tab === 'cargados' ? (
          <PlantillasCargadas
            plantillas={plantillas}
            loading={loading}
            selId={selId}
            onSelect={setSelId}
            onEditar={(id) => { setSelId(id); setTab('originales'); }}
          />
        ) : (
          <PlantillasOriginales
            plantillas={plantillas}
            loading={loading}
            selId={selId}
            onSelect={setSelId}
            onCambio={(id) => { void recargar(); if (id) setSelId(id); }}
          />
        )}
      </div>
    </div>
  );
}
