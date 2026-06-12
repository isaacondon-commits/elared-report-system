import { useState, useRef, useEffect } from 'react';
import { X, Upload, Trash2, RefreshCw, Plus } from 'lucide-react';
import type { BoxPiso, EstadoBox, Vendedor, AreaPiso } from '../../store/planoStore';

interface Props {
  box: BoxPiso;
  area: AreaPiso;
  estados: EstadoBox[];
  onClose: () => void;
  onBoxUpdate: (patch: Partial<BoxPiso>) => void;
}

// ── Inline editable field ──────────────────────────────────────────────────────

function InlineField({ label, value, onSave }: { label: string; value?: string; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (!editing) setDraft(value ?? ''); }, [value, editing]);
  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  function commit() {
    setEditing(false);
    onSave(draft.trim());
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: '1px solid #f1f5f9' }}>
      <span style={{ fontSize: 11, color: '#9ca3af', width: 130, flexShrink: 0 }}>{label}</span>
      {editing ? (
        <input
          ref={inputRef}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
          style={{ flex: 1, border: '1px solid #3b82f6', borderRadius: 4, padding: '3px 7px', fontSize: 12, outline: 'none' }}
        />
      ) : (
        <span
          onClick={() => setEditing(true)}
          style={{ flex: 1, fontSize: 12, cursor: 'text', color: value ? '#1f2937' : '#d1d5db', padding: '3px 7px', borderRadius: 4 }}
          title="Click para editar"
        >
          {value || '—'}
        </span>
      )}
    </div>
  );
}

// ── Formulario asignación ─────────────────────────────────────────────────────

function FormAsignacion({ estados, estadoActual, onSave, onCancel }: {
  estados: EstadoBox[];
  estadoActual: string;
  onSave: (v: Vendedor, estadoId: string) => void;
  onCancel?: () => void;
}) {
  const [nombre, setNombre] = useState('');
  const [usuarioSistema, setUsuarioSistema] = useState('');
  const [usuarioLogistica, setUsuarioLogistica] = useState('');
  const [campania, setCampania] = useState('');
  const [supervisor, setSupervisor] = useState('');
  const [horario, setHorario] = useState('');
  const [estadoId, setEstadoId] = useState(estadoActual);

  function handleSave() {
    if (!nombre.trim()) return;
    onSave({ nombre: nombre.trim(), usuarioSistema, usuarioLogistica, campania, supervisor, horario, historial: [] }, estadoId);
  }

  const field = (label: string, value: string, setter: (v: string) => void, placeholder = '') => (
    <div style={{ marginBottom: 10 }}>
      <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 3 }}>{label}</label>
      <input
        value={value}
        onChange={e => setter(e.target.value)}
        placeholder={placeholder}
        style={{ width: '100%', border: '1px solid #e5e7eb', borderRadius: 6, padding: '6px 10px', fontSize: 13, boxSizing: 'border-box', outline: 'none' }}
        onFocus={e => e.target.style.borderColor = '#3b82f6'}
        onBlur={e => e.target.style.borderColor = '#e5e7eb'}
      />
    </div>
  );

  return (
    <div style={{ padding: '0 20px 16px' }}>
      <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 14 }}>* Nombre es obligatorio</p>

      <div style={{ marginBottom: 10 }}>
        <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 3 }}>Nombre *</label>
        <input
          value={nombre}
          onChange={e => setNombre(e.target.value)}
          placeholder="Nombre completo"
          autoFocus
          style={{ width: '100%', border: `1px solid ${!nombre.trim() ? '#f87171' : '#e5e7eb'}`, borderRadius: 6, padding: '6px 10px', fontSize: 13, boxSizing: 'border-box', outline: 'none' }}
        />
      </div>

      {field('Usuario Sistema', usuarioSistema, setUsuarioSistema)}
      {field('Usuario Logística', usuarioLogistica, setUsuarioLogistica)}
      {field('Campaña', campania, setCampania)}
      {field('Supervisor', supervisor, setSupervisor)}
      {field('Horario', horario, setHorario, '09:00 - 18:00')}

      <div style={{ marginBottom: 14 }}>
        <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 3 }}>Estado inicial</label>
        <select
          value={estadoId}
          onChange={e => setEstadoId(e.target.value)}
          style={{ width: '100%', border: '1px solid #e5e7eb', borderRadius: 6, padding: '6px 10px', fontSize: 13, boxSizing: 'border-box' }}
        >
          {estados.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
        </select>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        {onCancel && (
          <button onClick={onCancel} style={{ flex: 1, padding: '8px', border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', fontSize: 13, cursor: 'pointer', color: '#374151' }}>
            Cancelar
          </button>
        )}
        <button
          onClick={handleSave}
          disabled={!nombre.trim()}
          style={{
            flex: 2, padding: '8px', border: 'none', borderRadius: 8,
            background: nombre.trim() ? '#003DA5' : '#e5e7eb',
            color: nombre.trim() ? '#fff' : '#9ca3af',
            fontSize: 13, fontWeight: 600, cursor: nombre.trim() ? 'pointer' : 'not-allowed',
          }}
        >
          Guardar Vendedor
        </button>
      </div>
    </div>
  );
}

// ── Panel principal ───────────────────────────────────────────────────────────

export default function FichaVendedor({ box, area, estados, onClose, onBoxUpdate }: Props) {
  const [asignando, setAsignando] = useState(!box.vendedor);
  const [nuevaNota, setNuevaNota] = useState('');

  useEffect(() => { setAsignando(!box.vendedor); }, [box.id, box.vendedor]);

  const estado = estados.find(e => e.id === box.estadoId) ?? estados[0];
  const v = box.vendedor;

  function patchVendedor(patch: Partial<Vendedor>) {
    if (!v) return;
    onBoxUpdate({ vendedor: { ...v, ...patch } });
  }

  function handleFoto(file: File) {
    const reader = new FileReader();
    reader.onload = () => patchVendedor({ foto: reader.result as string });
    reader.readAsDataURL(file);
  }

  function agregarNota() {
    const texto = nuevaNota.trim();
    if (!texto) return;
    const fecha = new Date().toLocaleString('es-UY', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const entrada = `${fecha} — ${texto}`;
    patchVendedor({ historial: [entrada, ...(v?.historial ?? [])] });
    setNuevaNota('');
  }

  const initials = (v?.nombre ?? '?').split(' ').slice(0, 2).map(w => w[0]?.toUpperCase()).join('');

  return (
    <>
      {/* Overlay */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,0.15)' }} onClick={onClose} />

      {/* Panel */}
      <div style={{
        position: 'fixed', top: 60, right: 0, bottom: 0, zIndex: 501,
        width: 380, background: '#fff',
        boxShadow: '-4px 0 24px rgba(0,0,0,0.12)',
        display: 'flex', flexDirection: 'column',
        animation: 'splashFadeIn 0.2s ease both',
      }}>
        {/* Header */}
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #f1f5f9', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600 }}>
              {area.nombre} · {box.label || 'Sin etiqueta'}
            </span>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: 4 }}>
              <X size={16} />
            </button>
          </div>

          {v && !asignando && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {v.foto ? (
                <img src={v.foto} alt="" style={{ width: 52, height: 52, borderRadius: '50%', objectFit: 'cover', border: '3px solid ' + (estado?.color ?? '#ddd'), flexShrink: 0 }} />
              ) : (
                <div style={{ width: 52, height: 52, borderRadius: '50%', background: estado?.color ?? '#003DA5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 18, flexShrink: 0 }}>
                  {initials}
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 16, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v.nombre}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: estado?.color ?? '#6c757d', flexShrink: 0 }} />
                  <select
                    value={box.estadoId}
                    onChange={e => onBoxUpdate({ estadoId: e.target.value })}
                    style={{ fontSize: 12, color: '#374151', border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, fontWeight: 500 }}
                  >
                    {estados.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                  </select>
                </div>
              </div>
            </div>
          )}

          {!v && !asignando && (
            <div style={{ color: '#9ca3af', fontSize: 14 }}>Box vacío</div>
          )}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {asignando ? (
            <FormAsignacion
              estados={estados}
              estadoActual={box.estadoId}
              onSave={(vendedor, estadoId) => {
                onBoxUpdate({ vendedor, estadoId });
                setAsignando(false);
              }}
              onCancel={v ? () => setAsignando(false) : undefined}
            />
          ) : v ? (
            <div style={{ padding: '12px 20px' }}>
              {/* Datos */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Datos</div>
                <InlineField label="Usuario Sistema"   value={v.usuarioSistema}  onSave={val => patchVendedor({ usuarioSistema: val })} />
                <InlineField label="Usuario Logística" value={v.usuarioLogistica} onSave={val => patchVendedor({ usuarioLogistica: val })} />
                <InlineField label="Campaña"           value={v.campania}         onSave={val => patchVendedor({ campania: val })} />
                <InlineField label="Supervisor"        value={v.supervisor}       onSave={val => patchVendedor({ supervisor: val })} />
                <InlineField label="Horario"           value={v.horario}          onSave={val => patchVendedor({ horario: val })} />
                <InlineField label="Ventas/Rendimiento" value={v.ventasRendimiento} onSave={val => patchVendedor({ ventasRendimiento: val })} />
              </div>

              {/* Foto */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Foto</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', border: '1px solid #e5e7eb', borderRadius: 6, cursor: 'pointer', fontSize: 12, color: '#374151' }}>
                    <Upload size={13} />
                    {v.foto ? 'Cambiar' : 'Subir foto'}
                    <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleFoto(f); }} />
                  </label>
                  {v.foto && (
                    <button onClick={() => patchVendedor({ foto: undefined })} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#ef4444' }}>
                      Quitar
                    </button>
                  )}
                </div>
              </div>

              {/* Observaciones */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Observaciones</div>
                <textarea
                  value={v.observaciones ?? ''}
                  onChange={e => patchVendedor({ observaciones: e.target.value })}
                  rows={3}
                  style={{ width: '100%', border: '1px solid #e5e7eb', borderRadius: 6, padding: '8px 10px', fontSize: 12, resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit', outline: 'none' }}
                  placeholder="Notas sobre el vendedor..."
                />
              </div>

              {/* Historial */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Historial</div>
                <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                  <input
                    value={nuevaNota}
                    onChange={e => setNuevaNota(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') agregarNota(); }}
                    placeholder="Agregar nota..."
                    style={{ flex: 1, border: '1px solid #e5e7eb', borderRadius: 6, padding: '5px 9px', fontSize: 12, outline: 'none' }}
                  />
                  <button
                    onClick={agregarNota}
                    disabled={!nuevaNota.trim()}
                    style={{ background: '#003DA5', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                  >
                    <Plus size={14} />
                  </button>
                </div>
                {(v.historial ?? []).map((nota, i) => (
                  <div key={i} style={{ fontSize: 11, color: '#374151', padding: '5px 0', borderBottom: '1px solid #f8fafc', lineHeight: 1.5 }}>
                    {nota}
                  </div>
                ))}
                {!v.historial?.length && (
                  <div style={{ fontSize: 11, color: '#d1d5db', fontStyle: 'italic' }}>Sin notas aún</div>
                )}
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        {v && !asignando && (
          <div style={{ padding: '12px 20px', borderTop: '1px solid #f1f5f9', display: 'flex', gap: 8, flexShrink: 0 }}>
            <button
              onClick={() => setAsignando(true)}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '7px', border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', fontSize: 12, cursor: 'pointer', color: '#374151' }}
            >
              <RefreshCw size={13} /> Cambiar vendedor
            </button>
            <button
              onClick={() => { if (confirm('¿Quitar vendedor del box?')) { onBoxUpdate({ vendedor: null }); } }}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '7px', border: '1px solid #fee2e2', borderRadius: 8, background: '#fff', fontSize: 12, cursor: 'pointer', color: '#ef4444' }}
            >
              <Trash2 size={13} /> Quitar vendedor
            </button>
          </div>
        )}
      </div>
    </>
  );
}
