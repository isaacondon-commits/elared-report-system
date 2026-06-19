import React from 'react';
import { Rnd } from 'react-rnd';
import type { BoxPiso, EstadoBox } from '../../store/planoStore';
import { Plus } from 'lucide-react';

interface Props {
  box: BoxPiso;
  estados: EstadoBox[];
  editMode: boolean;
  isSelected: boolean;
  isMultiSelected: boolean;
  isHighlighted: boolean;
  zoom: number;
  dragOffset?: { dx: number; dy: number };
  onSelect: (e: React.MouseEvent) => void;
  onUpdate: (patch: Partial<BoxPiso>) => void;
  onBoxMouseDown: (e: React.MouseEvent) => void;
}

function darken(hex: string): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, n));
  const r = clamp(parseInt(hex.slice(1, 3), 16) - 50);
  const g = clamp(parseInt(hex.slice(3, 5), 16) - 50);
  const b = clamp(parseInt(hex.slice(5, 7), 16) - 50);
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}

const BoxVendedor = React.memo(function BoxVendedor({
  box, estados, editMode, isSelected, isMultiSelected, isHighlighted, zoom,
  dragOffset, onSelect, onUpdate, onBoxMouseDown,
}: Props) {
  const estado = estados.find(e => e.id === box.estadoId) ?? estados.find(e => e.id === 'libre') ?? estados[0];
  const color = estado?.color ?? '#6c757d';
  const isEmpty = !box.vendedor;

  const displayX = dragOffset ? box.x + dragOffset.dx : box.x;
  const displayY = dragOffset ? box.y + dragOffset.dy : box.y;

  const isAnySelected = isSelected || isMultiSelected;

  const borderColor = isHighlighted
    ? '#facc15'
    : isAnySelected
    ? '#1d4ed8'
    : isEmpty
    ? '#CBD5E1'
    : darken(color);
  const borderWidth = isHighlighted || isAnySelected ? 3 : 2;
  const borderStyle = isEmpty ? 'dashed' : 'solid';

  const initials = box.vendedor?.nombre
    ? box.vendedor.nombre.split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('')
    : '';
  const shortName = box.vendedor?.nombre
    ? box.vendedor.nombre.split(' ').slice(0, 2).join(' ')
    : null;

  return (
    <Rnd
      position={{ x: displayX, y: displayY }}
      size={{ width: box.width, height: box.height }}
      disableDragging={true}
      enableResizing={editMode && !dragOffset}
      bounds="parent"
      scale={zoom}
      minWidth={60}
      minHeight={60}
      onResizeStop={(_e, _dir, ref, _delta, pos) => {
        onUpdate({
          width: parseInt(ref.style.width),
          height: parseInt(ref.style.height),
          x: Math.max(0, pos.x),
          y: Math.max(0, pos.y),
        });
      }}
      style={{ zIndex: isAnySelected ? 10 : 2 }}
    >
      <div
        onMouseDown={editMode ? onBoxMouseDown : undefined}
        onClick={onSelect}
        style={{
          width: '100%', height: '100%',
          background: isEmpty ? '#ffffff' : `${color}E6`,
          border: `${borderWidth}px ${borderStyle} ${borderColor}`,
          borderRadius: 8,
          cursor: editMode ? (dragOffset ? 'grabbing' : 'grab') : 'pointer',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          position: 'relative',
          userSelect: 'none',
          boxShadow: isHighlighted
            ? '0 0 0 3px #facc15, 0 2px 8px rgba(0,0,0,0.2)'
            : isAnySelected
            ? '0 0 0 2px #1d4ed8, 0 4px 12px rgba(29,78,216,0.18)'
            : isEmpty
            ? '0 1px 3px rgba(0,0,0,0.06)'
            : '0 2px 8px rgba(0,0,0,0.12)',
          overflow: 'hidden',
          transition: dragOffset ? 'none' : 'box-shadow 0.15s',
          outline: isMultiSelected ? '2px dashed #60a5fa' : 'none',
          outlineOffset: 1,
        }}
      >
        {/* Label chip top-left */}
        {box.label && (
          <span style={{
            position: 'absolute', top: 3, left: 4,
            fontSize: 9, fontWeight: 700, lineHeight: 1, pointerEvents: 'none',
            color: isEmpty ? '#94a3b8' : 'rgba(255,255,255,0.8)',
          }}>
            {box.label}
          </span>
        )}

        {isEmpty ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <Plus size={22} style={{ color: '#94a3b8' }} />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '16px 6px 6px' }}>
            {box.vendedor!.foto ? (
              <img
                src={box.vendedor!.foto} alt=""
                style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(255,255,255,0.7)', flexShrink: 0 }}
              />
            ) : (
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                background: 'rgba(255,255,255,0.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontWeight: 700, fontSize: 12, flexShrink: 0,
                border: '2px solid rgba(255,255,255,0.4)',
              }}>
                {initials}
              </div>
            )}
            <span style={{
              fontSize: 10, fontWeight: 700, color: '#fff',
              textAlign: 'center', lineHeight: 1.2,
              overflow: 'hidden', textOverflow: 'ellipsis',
              whiteSpace: 'nowrap', maxWidth: '100%',
            }}>
              {shortName}
            </span>
            <span style={{
              fontSize: 9, fontWeight: 600,
              background: 'rgba(255,255,255,0.9)',
              color,
              padding: '1px 6px', borderRadius: 10,
              whiteSpace: 'nowrap',
            }}>
              {estado?.nombre ?? ''}
            </span>
          </div>
        )}
      </div>
    </Rnd>
  );
});

export default BoxVendedor;
