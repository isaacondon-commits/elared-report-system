import { useState } from 'react';
import { Info, Headphones } from 'lucide-react';
import Header from '../components/Header';
import FileUploader from '../components/FileUploader';

export default function AtencionClientePage() {
  const [fileLoaded, setFileLoaded] = useState(false);

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Atención al Cliente"
        subtitle="Reporte de indicadores de atención y satisfacción"
      />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto space-y-5">

          {/* Info card */}
          <div className="bg-[#EDFAF2] border border-[#A8DFC0] rounded-xl p-5 flex items-start gap-4">
            <div className="bg-[#28a745]/10 p-2.5 rounded-lg flex-shrink-0 mt-0.5">
              <Info size={18} className="text-[#28a745]" />
            </div>
            <div>
              <h3 className="font-semibold text-[#1a7a34] text-sm mb-1">Módulo en configuración</h3>
              <p className="text-[#1a7a34]/80 text-sm leading-relaxed">
                Este módulo está en desarrollo. Próximamente podrás analizar indicadores de
                atención al cliente, tiempos de respuesta y métricas de satisfacción.
              </p>
            </div>
          </div>

          {/* File uploader */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Cargar reporte</h3>
            <FileUploader
              onFile={() => setFileLoaded(true)}
              label="Arrastrá tu reporte de atención aquí"
              sublabel="o hacé clic para seleccionarlo"
            />
          </div>

          {/* Empty state */}
          {!fileLoaded && (
            <div className="bg-white border border-gray-200 rounded-xl p-10 text-center">
              <div className="inline-flex bg-[#28a745]/10 rounded-full p-4 mb-4">
                <Headphones size={28} className="text-[#28a745]" />
              </div>
              <p className="font-semibold text-gray-700">Sin análisis disponible</p>
              <p className="text-gray-400 text-sm mt-1.5 max-w-xs mx-auto leading-relaxed">
                Cargá un reporte de atención al cliente para comenzar el análisis.
                La funcionalidad completa estará disponible próximamente.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
