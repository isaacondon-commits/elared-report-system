import { useState } from 'react';
import { X, Trash2, AlertTriangle, School, Users } from 'lucide-react';
import {
  TIPO_COLORS, TIPO_LABELS, CALENDARIO_LABELS, TIPOS_POR_CALENDARIO,
  crearEvento, crearEventosRecurrentes, actualizarEvento, eliminarEvento, hayConflicto,
  type EventoCalendario, type CalendarioId, type TipoEvento, type Recurrencia, type NuevoEvento,
} from '../../hooks/useCalendario';

const INPUT = 'w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#003DA5] focus:ring-1 focus:ring-[#003DA5] transition-colors';

function enumerarFechas(desde: string, hasta: string): string[] {
  const fechas: string[] = [];
  let d = new Date(desde + 'T12:00:00');
  const end = new Date(hasta + 'T12:00:00');
  while (d <= end) {
    fechas.push(d.toISOString().slice(0, 10));
    d = new Date(d.getTime() + 86400000);
  }
  return fechas;
}

interface Props {
  fechaInicial: string;
  calendarioInicial: CalendarioId;
  evento?: EventoCalendario;
  eventosDelRango: EventoCalendario[];
  creadoPorUid: string;
  creadoPorNombre: string;
  onClose: () => void;
  onSaved: () => void;
}

export default function EventoModal({
  fechaInicial, calendarioInicial, evento, eventosDelRango,
  creadoPorUid, creadoPorNombre, onClose, onSaved,
}: Props) {
  const [calendario, setCalendario] = useState<CalendarioId>(evento?.calendario ?? calendarioInicial);
  const [tipo, setTipo] = useState<TipoEvento>(evento?.tipo ?? TIPOS_POR_CALENDARIO[calendarioInicial][0]);
  const [fecha, setFecha] = useState(evento?.fecha ?? fechaInicial);
  const [variosDias, setVariosDias] = useState(false);
  const [fechaHasta, setFechaHasta] = useState(fechaInicial);
  const [titulo, setTitulo] = useState(evento?.titulo ?? '');
  const [descripcion, setDescripcion] = useState(evento?.descripcion ?? '');
  const [recurrencia, setRecurrencia] = useState<Recurrencia>('no');
  const [confirmandoConflicto, setConfirmandoConflicto] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function handleCalendarioChange(c: CalendarioId) {
    setCalendario(c);
    if (!TIPOS_POR_CALENDARIO[c].includes(tipo)) setTipo(TIPOS_POR_CALENDARIO[c][0]);
  }

  async function handleGuardar() {
    if (!titulo.trim()) { setError('El título es obligatorio.'); return; }
    setError('');

    if (!confirmandoConflicto && hayConflicto(eventosDelRango, fecha, tipo, evento?.id)) {
      setConfirmandoConflicto(true);
      return;
    }

    setSaving(true);
    try {
      if (evento) {
        // No se reasigna creadoPor/creadoPorNombre: se preserva la autoría original.
        // La descripción se manda siempre (aunque quede vacía) para poder borrarla.
        await actualizarEvento(evento.id, { calendario, tipo, fecha, titulo: titulo.trim(), descripcion: descripcion.trim() });
      } else {
        const base: Omit<NuevoEvento, 'fecha'> = {
          calendario, tipo, titulo: titulo.trim(),
          creadoPor: creadoPorUid, creadoPorNombre,
          ...(descripcion.trim() ? { descripcion: descripcion.trim() } : {}),
        };
        if (variosDias && fechaHasta && fechaHasta > fecha) {
          const fechas = enumerarFechas(fecha, fechaHasta);
          await Promise.all(fechas.map(f => crearEvento({ ...base, fecha: f })));
        } else {
          await crearEventosRecurrentes({ ...base, fecha }, recurrencia);
        }
      }
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar el evento.');
      setSaving(false);
    }
  }

  async function handleEliminar() {
    if (!evento) return;
    if (!confirm(`¿Eliminar el evento "${evento.titulo}"?`)) return;
    setSaving(true);
    try {
      await eliminarEvento(evento.id);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al eliminar el evento.');
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4 py-6 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg my-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900 text-base">{evento ? 'Editar evento' : 'Nuevo evento'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">

          {/* Calendario */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-widest">Calendario</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleCalendarioChange('sala')}
                className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  calendario === 'sala' ? 'bg-blue-50 border-[#003DA5] text-[#003DA5]' : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                }`}
              >
                <School size={14} /> {CALENDARIO_LABELS.sala}
              </button>
              <button
                type="button"
                onClick={() => handleCalendarioChange('personal')}
                className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  calendario === 'personal' ? 'bg-green-50 border-green-600 text-green-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                }`}
              >
                <Users size={14} /> {CALENDARIO_LABELS.personal}
              </button>
            </div>
          </div>

          {/* Tipo */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-widest">Tipo de evento</label>
            <select value={tipo} onChange={e => setTipo(e.target.value as TipoEvento)} className={INPUT}>
              {TIPOS_POR_CALENDARIO[calendario].map(t => (
                <option key={t} value={t}>{TIPO_LABELS[t]}</option>
              ))}
            </select>
          </div>

          {/* Fecha(s) */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-widest">Fecha</label>
              <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className={INPUT} />
            </div>
            {variosDias && (
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-widest">Fecha hasta</label>
                <input type="date" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)} className={INPUT} min={fecha} />
              </div>
            )}
          </div>

          {!evento && (
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input type="checkbox" checked={variosDias} onChange={e => setVariosDias(e.target.checked)} className="w-4 h-4 accent-[#003DA5]" />
              ¿Evento de varios días?
            </label>
          )}

          {/* Recurrencia */}
          {!evento && !variosDias && (
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-widest">¿Se repite?</label>
              <div className="grid grid-cols-4 gap-1.5">
                {(['no', 'semanal', 'quincenal', 'mensual'] as Recurrencia[]).map(r => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRecurrencia(r)}
                    className={`px-2 py-1.5 rounded-lg text-xs font-medium border transition-colors capitalize ${
                      recurrencia === r ? 'bg-[#003DA5] text-white border-[#003DA5]' : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    {r === 'no' ? 'No' : r}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Titulo */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-widest">Título</label>
            <input type="text" value={titulo} onChange={e => setTitulo(e.target.value)} className={INPUT} placeholder="Título del evento" />
          </div>

          {/* Descripcion */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-widest">Descripción (opcional)</label>
            <textarea value={descripcion} onChange={e => setDescripcion(e.target.value)} className={INPUT} rows={2} placeholder="Detalle adicional..." />
          </div>

          {/* Preview */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-widest">Vista previa</label>
            <div
              className="inline-block text-[11px] font-semibold text-white rounded px-2 py-1"
              style={{ background: TIPO_COLORS[tipo] }}
            >
              {titulo.trim() || 'Título del evento'}
            </div>
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          {confirmandoConflicto && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3.5 py-3 flex items-start gap-2">
              <AlertTriangle size={15} className="text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-xs text-amber-800">
                  Ya hay un evento de <b>{TIPO_LABELS[tipo]}</b> ese día. ¿Querés agregar otro igualmente?
                </p>
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => setConfirmandoConflicto(false)}
                    className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-white"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleGuardar}
                    disabled={saving}
                    className="text-xs px-3 py-1.5 rounded-lg bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50"
                  >
                    Agregar igual
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 px-6 py-4 border-t border-gray-100">
          <div>
            {evento && (
              <button
                onClick={handleEliminar}
                disabled={saving}
                className="flex items-center gap-1.5 text-sm text-red-600 hover:text-red-700 disabled:opacity-50"
              >
                <Trash2 size={14} /> Eliminar evento
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancelar
            </button>
            {!confirmandoConflicto && (
              <button
                onClick={handleGuardar}
                disabled={saving}
                className="px-4 py-2 text-sm bg-[#003DA5] text-white rounded-lg hover:bg-blue-800 disabled:opacity-50"
              >
                Guardar evento
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
