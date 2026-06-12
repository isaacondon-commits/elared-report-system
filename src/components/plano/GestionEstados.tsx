import { useState } from 'react';
import { X, Plus, Trash2, Pencil, Check } from 'lucide-react';
import type { EstadoBox } from '../../store/planoStore';

interface Props {
  estados: EstadoBox[];
  onClose: () => void;
  onAdd: (nombre: string, color: string) => void;
  onUpdate: (id: string, patch: { nombre?: string; color?: string }) => void;
  onDelete: (id: string) => void;
}

export default function GestionEstados({ estados, onClose, onAdd, onUpdate, onDelete }: Props) {
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevoColor, setNuevoColor] = useState('#4f46e5');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNombre, setEditNombre] = useState('');
  const [editColor, setEditColor] = useState('');

  function handleAdd() {
    const n = nuevoNombre.trim();
    if (!n) return;
    onAdd(n, nuevoColor);
    setNuevoNombre('');
    setNuevoColor('#4f46e5');
  }

  function startEdit(e: EstadoBox) {
    setEditingId(e.id);
    setEditNombre(e.nombre);
    setEditColor(e.color);
  }

  function commitEdit() {
    if (!editingId) return;
    onUpdate(editingId, { nombre: editNombre.trim() || undefined, color: editColor });
    setEditingId(null);
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}
    >
      <div
        style={{ background: '#fff', borderRadius: 12, width: 440, maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 700, fontSize: 15, color: '#1f2937' }}>Gestionar Estados</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}>
            <X size={18} />
          </button>
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 20px' }}>
          {estados.map(e => (
            <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #f8fafc' }}>
              {editingId === e.id ? (
                <>
                  <input
                    type="color"
                    value={editColor}
                    onChange={ev => setEditColor(ev.target.value)}
                    style={{ width: 32, height: 32, border: 'none', cursor: 'pointer', borderRadius: 4, padding: 2 }}
                  />
                  <input
                    value={editNombre}
                    onChange={ev => setEditNombre(ev.target.value)}
                    onKeyDown={ev => { if (ev.key === 'Enter') commitEdit(); }}
                    style={{ flex: 1, border: '1px solid #3b82f6', borderRadius: 6, padding: '4px 8px', fontSize: 13 }}
                    autoFocus
                  />
                  <button onClick={commitEdit} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#16a34a' }}>
                    <Check size={16} />
                  </button>
                </>
              ) : (
                <>
                  <div style={{ width: 16, height: 16, borderRadius: '50%', background: e.color, flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: 13, color: '#374151' }}>{e.nombre}</span>
                  {e.esDefault && <span style={{ fontSize: 10, color: '#9ca3af', backgroundColor: '#f3f4f6', padding: '2px 6px', borderRadius: 10 }}>Base</span>}
                  <button onClick={() => startEdit(e)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: 4 }}>
                    <Pencil size={13} />
                  </button>
                  {!e.esDefault && (
                    <button
                      onClick={() => { if (confirm(`¿Eliminar estado "${e.nombre}"?`)) onDelete(e.id); }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 4 }}
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </>
              )}
            </div>
          ))}
        </div>

        {/* Add new */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid #f1f5f9', display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="color"
            value={nuevoColor}
            onChange={e => setNuevoColor(e.target.value)}
            style={{ width: 36, height: 36, border: 'none', cursor: 'pointer', borderRadius: 6, padding: 2 }}
          />
          <input
            value={nuevoNombre}
            onChange={e => setNuevoNombre(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
            placeholder="Nombre del nuevo estado"
            style={{ flex: 1, border: '1px solid #e5e7eb', borderRadius: 6, padding: '6px 10px', fontSize: 13 }}
          />
          <button
            onClick={handleAdd}
            disabled={!nuevoNombre.trim()}
            style={{
              background: nuevoNombre.trim() ? '#003DA5' : '#e5e7eb',
              color: nuevoNombre.trim() ? '#fff' : '#9ca3af',
              border: 'none', borderRadius: 6, padding: '6px 12px',
              cursor: nuevoNombre.trim() ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 600,
            }}
          >
            <Plus size={14} /> Agregar
          </button>
        </div>
      </div>
    </div>
  );
}
