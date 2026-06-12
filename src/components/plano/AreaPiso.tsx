import { useRef } from 'react';
import { Rnd } from 'react-rnd';
import { Plus, Trash2 } from 'lucide-react';
import type { AreaPiso, BoxPiso, EstadoBox } from '../../store/planoStore';
import BoxVendedor from './BoxVendedor';

interface Props {
  area: AreaPiso;
  estados: EstadoBox[];
  editMode: boolean;
  searchTerm: string;
  selectedBoxId: string | null;
  onBoxClick: (boxId: string) => void;
  onAreaUpdate: (patch: Partial<Omit<AreaPiso, 'id' | 'boxes'>>) => void;
  onAreaDelete: () => void;
  onBoxAdd: () => void;
  onBoxUpdate: (boxId: string, patch: Partial<BoxPiso>) => void;
}

function darken(hex: string): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, n));
  const r = clamp(parseInt(hex.slice(1, 3), 16) - 40);
  const g = clamp(parseInt(hex.slice(3, 5), 16) - 40);
  const b = clamp(parseInt(hex.slice(5, 7), 16) - 40);
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}

const BTN: React.CSSProperties = {
  background: 'rgba(255,255,255,0.8)',
  border: '1px solid rgba(0,0,0,0.1)',
  borderRadius: 4,
  padding: '2px 6px',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: 3,
  fontSize: 11,
  color: '#374151',
};

export default function AreaPisoComp({
  area, estados, editMode, searchTerm, selectedBoxId,
  onBoxClick, onAreaUpdate, onAreaDelete, onBoxAdd, onBoxUpdate,
}: Props) {
  const dragging = useRef(false);

  return (
    <Rnd
      position={{ x: area.x, y: area.y }}
      size={{ width: area.width, height: area.height }}
      disableDragging={!editMode}
      enableResizing={editMode}
      dragHandleClassName="plano-area-handle"
      minWidth={200}
      minHeight={120}
      onDragStart={() => { dragging.current = true; }}
      onDragStop={(_e, d) => {
        dragging.current = false;
        onAreaUpdate({ x: Math.max(0, d.x), y: Math.max(0, d.y) });
      }}
      onResizeStop={(_e, _dir, ref, _delta, pos) => {
        onAreaUpdate({
          width: parseInt(ref.style.width),
          height: parseInt(ref.style.height),
          x: Math.max(0, pos.x),
          y: Math.max(0, pos.y),
        });
      }}
      style={{ zIndex: 0 }}
    >
      <div style={{
        width: '100%', height: '100%',
        background: area.color,
        border: `2px solid ${darken(area.color)}`,
        borderRadius: 8,
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
      }}>
        {/* Header */}
        <div
          className="plano-area-handle"
          style={{
            padding: '5px 10px',
            background: 'rgba(0,0,0,0.07)',
            borderBottom: `1px solid ${darken(area.color)}40`,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            cursor: editMode ? 'move' : 'default',
            flexShrink: 0,
            userSelect: 'none',
            gap: 8,
          }}
        >
          <span style={{ fontSize: 12, fontWeight: 700, color: '#1e3a5f', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {area.nombre}
          </span>
          <span style={{ fontSize: 10, color: '#64748b', flexShrink: 0 }}>
            {area.boxes.length} box{area.boxes.length !== 1 ? 'es' : ''}
          </span>
          {editMode && (
            <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
              <button style={BTN} onClick={e => { e.stopPropagation(); onBoxAdd(); }} title="Agregar box">
                <Plus size={11} /> Box
              </button>
              <button
                style={{ ...BTN, color: '#ef4444', borderColor: '#fca5a5' }}
                onClick={e => {
                  e.stopPropagation();
                  if (confirm(`¿Eliminar área "${area.nombre}" y todos sus boxes?`)) onAreaDelete();
                }}
                title="Eliminar área"
              >
                <Trash2 size={11} />
              </button>
            </div>
          )}
        </div>

        {/* Canvas interno de boxes */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          {area.boxes.map(box => {
            const term = searchTerm.toLowerCase().trim();
            const isHighlighted = term.length > 0 &&
              !!(box.vendedor?.nombre?.toLowerCase().includes(term));

            return (
              <BoxVendedor
                key={box.id}
                box={box}
                estados={estados}
                editMode={editMode}
                isSelected={selectedBoxId === box.id}
                isHighlighted={isHighlighted}
                onSelect={() => onBoxClick(box.id)}
                onUpdate={patch => onBoxUpdate(box.id, patch)}
              />
            );
          })}

          {area.boxes.length === 0 && (
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              pointerEvents: 'none',
            }}>
              <span style={{ fontSize: 12, color: 'rgba(0,0,0,0.25)', fontStyle: 'italic' }}>
                {editMode ? 'Clic en "+ Box" para agregar' : 'Área vacía'}
              </span>
            </div>
          )}
        </div>
      </div>
    </Rnd>
  );
}
