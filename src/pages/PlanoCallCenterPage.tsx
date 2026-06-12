import { useState, useMemo, useEffect, useRef } from 'react';
import { LayoutGrid, Pencil, Eye, Search, Plus, Save } from 'lucide-react';
import Header from '../components/Header';
import AreaPisoComp from '../components/plano/AreaPiso';
import FichaVendedor from '../components/plano/FichaVendedor';
import GestionEstados from '../components/plano/GestionEstados';
import { usePlanoStore } from '../store/planoStore';
import type { BoxPiso } from '../store/planoStore';

const CANVAS_W = 3200;
const CANVAS_H = 2400;

// ── Modal nueva área ───────────────────────────────────────────────────────────

function ModalNuevaArea({ onClose, onAdd }: {
  onClose: () => void;
  onAdd: (nombre: string, color: string, w: number, h: number) => void;
}) {
  const [nombre, setNombre] = useState('');
  const [color, setColor] = useState('#e3f2fd');
  const [w, setW] = useState(800);
  const [h, setH] = useState(500);

  function handleAdd() {
    if (!nombre.trim()) return;
    onAdd(nombre.trim(), color, w, h);
    onClose();
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 12, width: 380, padding: '24px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ fontWeight: 700, fontSize: 16, color: '#111827', marginBottom: 20 }}>Nueva Área</div>

        <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Nombre *</label>
        <input
          value={nombre} onChange={e => setNombre(e.target.value)} autoFocus
          placeholder="Ej: Piso Principal, Sala B..."
          style={{ width: '100%', border: '1px solid #e5e7eb', borderRadius: 6, padding: '8px 10px', fontSize: 13, marginBottom: 14, boxSizing: 'border-box' }}
        />

        <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Color</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <input type="color" value={color} onChange={e => setColor(e.target.value)}
            style={{ width: 40, height: 36, border: 'none', cursor: 'pointer', borderRadius: 6, padding: 2 }} />
          <span style={{ fontSize: 12, color: '#374151' }}>{color}</span>
        </div>

        <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Ancho (px)</label>
            <input type="number" value={w} onChange={e => setW(parseInt(e.target.value) || 800)} min={200}
              style={{ width: '100%', border: '1px solid #e5e7eb', borderRadius: 6, padding: '8px 10px', fontSize: 13, boxSizing: 'border-box' }} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Alto (px)</label>
            <input type="number" value={h} onChange={e => setH(parseInt(e.target.value) || 500)} min={120}
              style={{ width: '100%', border: '1px solid #e5e7eb', borderRadius: 6, padding: '8px 10px', fontSize: 13, boxSizing: 'border-box' }} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '9px', border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', fontSize: 13, cursor: 'pointer' }}>
            Cancelar
          </button>
          <button onClick={handleAdd} disabled={!nombre.trim()}
            style={{ flex: 2, padding: '9px', border: 'none', borderRadius: 8, background: nombre.trim() ? '#003DA5' : '#e5e7eb', color: nombre.trim() ? '#fff' : '#9ca3af', fontSize: 13, fontWeight: 600, cursor: nombre.trim() ? 'pointer' : 'not-allowed' }}>
            Crear Área
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Página principal ───────────────────────────────────────────────────────────

export default function PlanoCallCenterPage() {
  const { areas, estados, savedAt, addArea, updateArea, removeArea, addBox, updateBox, addEstado, updateEstado, removeEstado } = usePlanoStore();

  const [editMode, setEditMode] = useState(() => {
    try { return localStorage.getItem('elared_plano_editmode') === 'true'; } catch { return false; }
  });
  const [selectedBox, setSelectedBox] = useState<{ areaId: string; boxId: string } | null>(null);
  const [showGestionEstados, setShowGestionEstados] = useState(false);
  const [showNuevaArea, setShowNuevaArea] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [savedIndicator, setSavedIndicator] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try { localStorage.setItem('elared_plano_editmode', String(editMode)); } catch {}
  }, [editMode]);

  useEffect(() => {
    if (!savedAt) return;
    setSavedIndicator(true);
    const t = setTimeout(() => setSavedIndicator(false), 1500);
    return () => clearTimeout(t);
  }, [savedAt]);

  // Auto-scroll a la primera coincidencia de búsqueda
  useEffect(() => {
    if (!searchTerm.trim()) return;
    const term = searchTerm.toLowerCase();
    for (const area of areas) {
      const match = area.boxes.find(b => b.vendedor?.nombre?.toLowerCase().includes(term));
      if (match) {
        canvasRef.current?.parentElement?.scrollTo({
          left: Math.max(0, area.x + match.x - 120),
          top: Math.max(0, area.y + match.y - 80),
          behavior: 'smooth',
        });
        setSelectedBox({ areaId: area.id, boxId: match.id });
        break;
      }
    }
  }, [searchTerm, areas]);

  const kpis = useMemo(() => ({
    areas: areas.length,
    boxes: areas.reduce((s, a) => s + a.boxes.length, 0),
    vendedores: areas.reduce((s, a) => s + a.boxes.filter(b => b.vendedor !== null).length, 0),
  }), [areas]);

  const selectedBoxData = useMemo(() => {
    if (!selectedBox) return null;
    const area = areas.find(a => a.id === selectedBox.areaId);
    const box = area?.boxes.find(b => b.id === selectedBox.boxId);
    return area && box ? { area, box } : null;
  }, [areas, selectedBox]);

  function handleAddBox(areaId: string) {
    const area = areas.find(a => a.id === areaId);
    if (!area) return;
    const newBox: Omit<BoxPiso, 'id'> = {
      x: 20, y: 40,
      width: 90, height: 90,
      estadoId: 'libre',
      vendedor: null,
      label: `B-${area.boxes.length + 1}`,
    };
    addBox(areaId, newBox);
  }

  const headerActions = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {/* Búsqueda */}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <Search size={13} style={{ position: 'absolute', left: 8, color: '#9ca3af', pointerEvents: 'none' }} />
        <input
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          placeholder="Buscar vendedor..."
          style={{ paddingLeft: 26, paddingRight: 10, paddingTop: 5, paddingBottom: 5, border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 12, width: 160, outline: 'none' }}
        />
      </div>

      <button
        onClick={() => setShowNuevaArea(true)}
        style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 11px', border: '1px solid #003DA5', borderRadius: 6, background: '#003DA5', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
      >
        <Plus size={13} /> Nueva Área
      </button>

      <button
        onClick={() => setShowGestionEstados(true)}
        style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 11px', border: '1px solid #e5e7eb', borderRadius: 6, background: '#fff', color: '#374151', fontSize: 12, cursor: 'pointer' }}
      >
        Estados
      </button>

      <button
        onClick={() => setEditMode(v => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '5px 11px', border: '1px solid #e5e7eb',
          borderRadius: 6, fontSize: 12, cursor: 'pointer',
          background: editMode ? '#fef3c7' : '#fff',
          color: editMode ? '#92400e' : '#374151',
          fontWeight: editMode ? 600 : 400,
        }}
      >
        {editMode ? <Pencil size={13} /> : <Eye size={13} />}
        {editMode ? 'Modo Edición' : 'Modo Vista'}
      </button>

      {savedIndicator && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#16a34a' }}>
          <Save size={12} /> Guardado
        </div>
      )}
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Plano del Call Center"
        subtitle={`${kpis.areas} área${kpis.areas !== 1 ? 's' : ''} · ${kpis.boxes} box${kpis.boxes !== 1 ? 'es' : ''} · ${kpis.vendedores} vendedor${kpis.vendedores !== 1 ? 'es' : ''} asignado${kpis.vendedores !== 1 ? 's' : ''}`}
        actions={headerActions}
      />

      {/* Canvas con scroll */}
      <div style={{ flex: 1, overflow: 'auto', position: 'relative' }}>
        <div
          ref={canvasRef}
          style={{
            width: CANVAS_W, height: CANVAS_H,
            position: 'relative',
            backgroundColor: '#F5F7FA',
            backgroundImage: 'radial-gradient(circle, #c8d3e0 1px, transparent 1px)',
            backgroundSize: '20px 20px',
          }}
        >
          {areas.map(area => (
            <AreaPisoComp
              key={area.id}
              area={area}
              estados={estados}
              editMode={editMode}
              searchTerm={searchTerm}
              selectedBoxId={selectedBox?.areaId === area.id ? selectedBox.boxId : null}
              onBoxClick={boxId => setSelectedBox({ areaId: area.id, boxId })}
              onAreaUpdate={patch => updateArea(area.id, patch)}
              onAreaDelete={() => { removeArea(area.id); if (selectedBox?.areaId === area.id) setSelectedBox(null); }}
              onBoxAdd={() => handleAddBox(area.id)}
              onBoxUpdate={(boxId, patch) => updateBox(area.id, boxId, patch)}
            />
          ))}

          {areas.length === 0 && (
            <div style={{
              position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
              textAlign: 'center', color: '#9ca3af',
            }}>
              <LayoutGrid size={48} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
              <div style={{ fontSize: 16, fontWeight: 600 }}>Sin áreas</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>Crea una nueva área para empezar</div>
            </div>
          )}
        </div>
      </div>

      {/* Ficha vendedor */}
      {selectedBox && selectedBoxData && (
        <FichaVendedor
          box={selectedBoxData.box}
          area={selectedBoxData.area}
          estados={estados}
          onClose={() => setSelectedBox(null)}
          onBoxUpdate={patch => updateBox(selectedBox.areaId, selectedBox.boxId, patch)}
        />
      )}

      {showGestionEstados && (
        <GestionEstados
          estados={estados}
          onClose={() => setShowGestionEstados(false)}
          onAdd={addEstado}
          onUpdate={updateEstado}
          onDelete={removeEstado}
        />
      )}

      {showNuevaArea && (
        <ModalNuevaArea
          onClose={() => setShowNuevaArea(false)}
          onAdd={(nombre, color, w, h) => {
            addArea({ nombre, color, width: w, height: h, x: 50, y: 50 });
          }}
        />
      )}
    </div>
  );
}
