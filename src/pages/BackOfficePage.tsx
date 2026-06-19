import { Briefcase } from 'lucide-react';
import Header from '../components/Header';
import FileUploader from '../components/FileUploader';

export default function BackOfficePage() {
  return (
    <div className="flex flex-col h-full">
      <Header title="Back Office" subtitle="Análisis de indicadores y gestión de back office" />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">

            <div className="flex flex-col items-center pt-10 pb-6 px-8 border-b border-gray-100">
              <div className="w-16 h-16 bg-purple-50 rounded-2xl flex items-center justify-center mb-4">
                <Briefcase size={32} className="text-[#6f42c1]" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Módulo Back Office</h2>
              <p className="text-sm text-gray-500 mt-1 text-center">Control de contratos y gestiones de back office</p>
              <span className="mt-3 inline-flex items-center gap-1.5 bg-purple-50 text-purple-700 text-xs font-semibold px-3 py-1 rounded-full border border-purple-200">
                <span className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-pulse" />
                En desarrollo
              </span>
            </div>

            <div className="px-8 py-5 border-b border-gray-100">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Funcionalidades planeadas</p>
              <ul className="space-y-2.5">
                {[
                  'Control de contratos por back office',
                  'Seguimiento de estado de gestiones',
                  'Reportes de productividad',
                ].map(f => (
                  <li key={f} className="flex items-center gap-2.5 text-sm text-gray-600">
                    <span className="w-1.5 h-1.5 bg-purple-400 rounded-full flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>

            <div className="px-8 py-6">
              <p className="text-sm font-medium text-gray-700 mb-3">Cargá tu archivo de back office para comenzar</p>
              <FileUploader
                onFile={() => {}}
                label="Arrastrá tu reporte de back office aquí"
                sublabel="o hacé clic para seleccionarlo"
              />
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
