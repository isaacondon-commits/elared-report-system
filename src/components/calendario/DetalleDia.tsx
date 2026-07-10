import { format, parse } from 'date-fns';
import { es } from 'date-fns/locale';
import { X, Pencil, Trash2, Plus } from 'lucide-react';
import { CALENDARIO_LABELS, TIPO_LABELS, type EventoCalendario } from '../../hooks/useCalendario';

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

interface Props {
  fecha: string;
  eventos: EventoCalendario[];
  puedeEditar: boolean;
  onClose: () => void;
  onEditar: (evento: EventoCalendario) => void;
  onEliminar: (evento: EventoCalendario) => void;
  onAgregar: () => void;
}

export default function DetalleDia({ fecha, eventos, puedeEditar, onClose, onEditar, onEliminar, onAgregar }: Props) {
  const fechaTitulo = capitalize(
    format(parse(fecha, 'yyyy-MM-dd', new Date()), "EEEE d 'de' MMMM", { locale: es }),
  );

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-screen bg-white shadow-2xl z-50 flex flex-col" style={{ width: 340 }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <h2 className="font-bold text-gray-900 text-sm">{fechaTitulo}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {eventos.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-8">Sin eventos este día.</p>
          )}
          {eventos.map(ev => (
            <div key={ev.id} className="border border-gray-200 rounded-lg p-3" style={{ borderLeft: `4px solid ${ev.color}` }}>
              <div className="flex items-center justify-between gap-2">
                <span
                  className="inline-block text-[10px] font-semibold text-white rounded-full px-2 py-0.5"
                  style={{ background: ev.color }}
                >
                  {TIPO_LABELS[ev.tipo]}
                </span>
                <span className="text-[9px] text-gray-400 uppercase tracking-wide">{CALENDARIO_LABELS[ev.calendario]}</span>
              </div>
              <div className="text-sm font-semibold text-gray-800 mt-1.5">{ev.titulo}</div>
              {ev.descripcion && <div className="text-xs text-gray-500 mt-1">{ev.descripcion}</div>}
              <div className="text-[10px] text-gray-400 mt-2">Creado por {ev.creadoPorNombre}</div>
              {puedeEditar && (
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => onEditar(ev)}
                    className="flex items-center gap-1 text-xs text-[#003DA5] hover:underline"
                  >
                    <Pencil size={12} /> Editar
                  </button>
                  <button
                    onClick={() => onEliminar(ev)}
                    className="flex items-center gap-1 text-xs text-red-600 hover:underline"
                  >
                    <Trash2 size={12} /> Eliminar
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {puedeEditar && (
          <div className="px-5 py-4 border-t border-gray-100 flex-shrink-0">
            <button
              onClick={onAgregar}
              className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 bg-[#003DA5] text-white text-sm font-medium rounded-lg hover:bg-blue-800 transition-colors"
            >
              <Plus size={15} /> Agregar evento en este día
            </button>
          </div>
        )}
      </div>
    </>
  );
}
