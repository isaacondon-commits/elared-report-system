import { useState } from 'react';
import { Settings, Save, CheckCircle } from 'lucide-react';
import Header from '../components/Header';
import { useConfig } from '../hooks/useConfig';
import type { AppConfig } from '../types';

export default function ConfigPage() {
  const { config, saveConfig } = useConfig();
  const [form, setForm] = useState<AppConfig>(config);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    saveConfig(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const field = (key: keyof AppConfig, label: string, type = 'text', help?: string) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type={type}
        value={String(form[key])}
        onChange={(e) => setForm(f => ({ ...f, [key]: type === 'number' ? Number(e.target.value) : e.target.value }))}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003DA5]"
      />
      {help && <p className="text-xs text-gray-500 mt-1">{help}</p>}
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Configuración"
        subtitle="Parámetros globales del sistema"
        actions={
          <button
            onClick={handleSave}
            className={`flex items-center gap-2 px-4 py-1.5 text-sm rounded-lg font-medium transition-colors ${
              saved ? 'bg-green-600 text-white' : 'bg-[#003DA5] text-white hover:bg-blue-800'
            }`}
          >
            {saved ? <CheckCircle size={15} /> : <Save size={15} />}
            {saved ? 'Guardado' : 'Guardar cambios'}
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-5">
              <Settings size={18} className="text-[#003DA5]" />
              <h2 className="font-semibold text-gray-900">Identidad de la empresa</h2>
            </div>
            <div className="space-y-4">
              {field('nombreEmpresa', 'Nombre de la empresa')}
              {field('logoUrl', 'URL del logo (opcional)', 'url', 'Se usará en exportaciones PDF y PowerPoint.')}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-5">
              <Settings size={18} className="text-[#003DA5]" />
              <h2 className="font-semibold text-gray-900">Parámetros de horario</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {field('horaEntrada', 'Hora de entrada estándar', 'time')}
              {field('horaSalida', 'Hora de salida estándar', 'time')}
              {field('toleranciaMinutos', 'Tolerancia para tardanza (minutos)', 'number',
                'Minutos de gracia después de la hora de entrada antes de marcar tardanza.')}
              {field('maxAlmuerzoMinutos', 'Duración máxima de almuerzo (minutos)', 'number',
                'Si el intervalo entre salida y reingreso supera este valor, se marca como jornada extendida.')}
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
            <strong>Nota:</strong> Estos parámetros se guardan localmente en el navegador. No se envían a ningún servidor.
          </div>
        </div>
      </div>
    </div>
  );
}
