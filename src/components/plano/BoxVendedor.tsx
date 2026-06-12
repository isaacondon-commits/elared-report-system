import React, { useRef } from 'react';
import { Rnd } from 'react-rnd';
import type { BoxPiso, EstadoBox } from '../../store/planoStore';
import { Plus } from 'lucide-react';

interface Props {
  box: BoxPiso;
  estados: EstadoBox[];
  editMode: boolean;
  isSelected: boolean;
  isHighlighted: boolean;
  onSelect: () => void;
  onUpdate: (patch: Partial<BoxPiso>) => void;
}

function hexRgb(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16) || 0;
  const g = parseInt(hex.slice(3, 5), 16) || 0;
  const b = parseInt(hex.slice(5, 7), 16) || 0;
  return `${r},${g},${b}`;
}

function darken(hex: string): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, n));
  const r = clamp(parseInt(hex.slice(1, 3), 16) - 50);
  const g = clamp(parseInt(hex.slice(3, 5), 16) - 50);
  const b = clamp(parseInt(hex.slice(5, 7), 16) - 50);
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}

const BoxVendedor = React.memo(function BoxVendedor({
  box, estados, editMode, isSelected, isHighlighted, onSelect, onUpdate,
}: Props) {
  const estado = estados.find(e => e.id === box.estadoId) ?? estados.find(e => e.id === 'libre') ?? estados[0];
  const dragging = useRef(false);
  const color = estado?.color ?? '#6c757d';

  const borderColor = isHighlighted ? '#facc15' : isSelected ? '#1d4ed8' : darken(color);
  const borderWidth = isHighlighted || isSelected ? 3 : 2;
  const abbrev = box.vendedor?.nombre
    ? box.vendedor.nombre.split(' ').slice(0, 2).join(' ')
    : null;

  return (
    <Rnd
      position={{ x: box.x, y: box.y }}
      size={{ width: box.width, height: box.height }}
      disableDragging={!editMode}
      enableResizing={editMode}
      bounds="parent"
      minWidth={60}
      minHeight={60}
      onDragStart={() => { dragging.current = true; }}
      onDragStop={(_e, d) => {
        dragging.current = false;
        onUpdate({ x: Math.max(0, d.x), y: Math.max(0, d.y) });
      }}
      onResizeStop={(_e, _dir, ref, _delta, pos) => {
        onUpdate({
          width: parseInt(ref.style.width),
          height: parseInt(ref.style.height),
          x: Math.max(0, pos.x),
          y: Math.max(0, pos.y),
        });
      }}
      style={{ zIndex: isSelected ? 10 : 2 }}
    >
      <div
        onClick={() => { if (!dragging.current) onSelect(); }}
        style={{
          width: '100%', height: '100%',
          background: `rgba(${hexRgb(color)},0.88)`,
          border: `${borderWidth}px solid ${borderColor}`,
          borderRadius: 6,
          cursor: editMode ? 'grab' : 'pointer',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          position: 'relative',
          userSelect: 'none',
          boxShadow: isHighlighted
            ? '0 0 0 3px #facc15, 0 2px 8px rgba(0,0,0,0.2)'
            : isSelected
            ? '0 0 0 2px #1d4ed8, 0 2px 8px rgba(0,0,0,0.2)'
            : '0 1px 4px rgba(0,0,0,0.15)',
          overflow: 'hidden',
          transition: 'box-shadow 0.15s',
        }}
      >
        {box.label && (
          <span style={{
            position: 'absolute', top: 3, left: 4,
            fontSize: 9, color: 'rgba(255,255,255,0.75)',
            fontWeight: 700, lineHeight: 1, pointerEvents: 'none',
          }}>
            {box.label}
          </span>
        )}

        {box.vendedor ? (
          <>
            {box.vendedor.foto && (
              <img
                src={box.vendedor.foto}
                alt=""
                style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', marginBottom: 4, border: '2px solid rgba(255,255,255,0.6)', flexShrink: 0 }}
              />
            )}
            <span style={{
              fontSize: 11, fontWeight: 700, color: '#fff',
              textAlign: 'center', lineHeight: 1.25,
              padding: '0 6px', overflow: 'hidden',
              textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              maxWidth: '100%',
            }}>
              {abbrev}
            </span>
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <Plus size={18} style={{ color: 'rgba(255,255,255,0.5)' }} />
            <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', letterSpacing: 0.5 }}>Vacío</span>
          </div>
        )}
      </div>
    </Rnd>
  );
});

export default BoxVendedor;
