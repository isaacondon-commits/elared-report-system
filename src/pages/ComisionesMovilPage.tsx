import { useState } from 'react';
import { Info, Smartphone } from 'lucide-react';
import Header from '../components/Header';
import FileUploader from '../components/FileUploader';

export default function ComisionesMovilPage() {
  const [fileLoaded, setFileLoaded] = useState(false);

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Comisiones Móvil"
        subtitle="Análisis de comisiones por servicio móvil"
      />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto space-y-5">

          {/* Info card */}
          <div className="bg-[#EEF5FF] border border-[#B3CFFF] rounded-xl p-5 flex items-start gap-4">
            <div className="bg-[#0066CC]/10 p-2.5 rounded-lg flex-shrink-0 mt-0.5">
              <Info size={18} className="text-[#0066CC]" />
            </div>
            <div>
              <h3 className="font-semibold text-[#0047AA] text-sm mb-1">Módulo en configuración</h3>
              <p className="text-[#0047AA]/80 text-sm leading-relaxed">
                Este módulo está en desarrollo. Próximamente podrás cargar reportes de comisiones
                por línea móvil y obtener análisis detallados por vendedor y período.
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
              <div className="inline-flex bg-[#0066CC]/10 rounded-full p-4 mb-4">
                <Smartphone size={28} className="text-[#0066CC]" />
              </div>
              <p className="font-semibold text-gray-700">Sin análisis disponible</p>
              <p className="text-gray-400 text-sm mt-1.5 max-w-xs mx-auto leading-relaxed">
                Cargá un reporte de comisiones móviles para comenzar el análisis.
                La funcionalidad completa estará disponible próximamente.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
