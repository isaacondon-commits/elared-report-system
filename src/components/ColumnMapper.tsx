import { CheckCircle } from 'lucide-react';

interface Field {
  key: string;
  label: string;
  required: boolean;
}

interface ColumnMapperProps {
  fields: Field[];
  headers: string[];
  mapping: Record<string, string>;
  onChange: (key: string, value: string) => void;
  onConfirm: () => void;
  confidence: number;
}

export default function ColumnMapper({ fields, headers, mapping, onChange, onConfirm, confidence }: ColumnMapperProps) {
  const requiredMapped = fields.filter(f => f.required && mapping[f.key]).length;
  const requiredTotal = fields.filter(f => f.required).length;
  const canConfirm = requiredMapped === requiredTotal;

  return (
    <div className="bg-white rounded-xl border border-amber-200 p-6">
      <div className="flex items-start gap-3 mb-5">
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <div className="text-amber-700 font-semibold text-sm">Confirmación de columnas</div>
          <div className="text-amber-600 text-xs mt-0.5">
            Confianza de detección automática: <strong>{confidence}%</strong>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {fields.map(({ key, label, required }) => (
          <div key={key}>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {label}
              {required && <span className="text-[#E3000F] ml-1">*</span>}
              {!required && <span className="text-gray-400 ml-1 text-xs">(opcional)</span>}
            </label>
            <div className="relative">
              <select
                value={mapping[key] || ''}
                onChange={(e) => onChange(key, e.target.value)}
                className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003DA5] ${
                  mapping[key] ? 'border-green-300 bg-green-50' : required ? 'border-amber-300' : 'border-gray-300'
                }`}
              >
                <option value="">— No mapear —</option>
                {headers.map(h => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
              {mapping[key] && (
                <CheckCircle size={14} className="absolute right-8 top-2.5 text-green-600" />
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {requiredMapped}/{requiredTotal} campos requeridos asignados
        </p>
        <button
          onClick={onConfirm}
          disabled={!canConfirm}
          className={`px-5 py-2 rounded-lg font-semibold text-sm transition-colors ${
            canConfirm
              ? 'bg-[#003DA5] text-white hover:bg-blue-800'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          Analizar datos
        </button>
      </div>
    </div>
  );
}
