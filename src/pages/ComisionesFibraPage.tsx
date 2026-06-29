import { useState } from 'react';
import { Info, Wifi } from 'lucide-react';
import Header from '../components/Header';
import FileUploader from '../components/FileUploader';

export default function ComisionesFibraPage() {
  const [fileLoaded, setFileLoaded] = useState(false);

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Comisiones Fibra"
        subtitle="Análisis de comisiones por servicio de fibra óptica"
      />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto space-y-5">

          {/* Info card */}
          <div className="bg-[#EEF2FF] border border-[#B3C4F5] rounded-xl p-5 flex items-start gap-4">
            <div className="bg-[#003DA5]/10 p-2.5 rounded-lg flex-shrink-0 mt-0.5">
              <Info size={18} className="text-[#003DA5]" />
            </div>
            <div>
              <h3 className="font-semibold text-[#003DA5] text-sm mb-1">Módulo en configuración</h3>
              <p className="text-[#003DA5]/80 text-sm leading-relaxed">
                Este módulo está en desarrollo. Próximamente podrás cargar reportes de comisiones
                de fibra óptica y analizar el rendimiento por zona y vendedor.
              </p>
            </div>
          </div>

          {/* File uploader */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Cargar reporte</h3>
            <FileUploader
              onFile={() => setFileLoaded(true)}
              label="Arrastrá tu reporte de comisiones aquí"
              sublabel="o hacé clic para seleccionarlo"
            />
          </div>

          {/* Empty state */}
          {!fileLoaded && (
            <div className="bg-white border border-gray-200 rounded-xl p-10 text-center">
              <div className="inline-flex bg-[#003DA5]/10 rounded-full p-4 mb-4">
                <Wifi size={28} className="text-[#003DA5]" />
              </div>
              <p className="font-semibold text-gray-700">Sin análisis disponible</p>
              <p className="text-gray-400 text-sm mt-1.5 max-w-xs mx-auto leading-relaxed">
                Cargá un reporte de comisiones de fibra para comenzar el análisis.
                La funcionalidad completa estará disponible próximamente.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
