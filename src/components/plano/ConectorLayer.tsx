import { useState } from 'react';
import type { AreaPiso, Conector } from '../../store/planoStore';
import { AREA_HEADER_H } from './AreaPiso';

const CANVAS_W = 3200;
const CANVAS_H = 2400;
const ARROW_ID = 'plano-arrow';

interface Props {
  areas: AreaPiso[];
  conectores: Conector[];
  editMode: boolean;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, patch: Partial<Conector>) => void;
}

function getBoxCenter(areas: AreaPiso[], boxId: string): { x: number; y: number } | null {
  for (const area of areas) {
    const box = area.boxes.find(b => b.id === boxId);
    if (box) return { x: area.x + box.x + box.width / 2, y: area.y + AREA_HEADER_H + box.y + box.height / 2 };
  }
  return null;
}

function midpoint(x1: number, y1: number, x2: number, y2: number) {
  return { x: (x1 + x2) / 2, y: (y1 + y2) / 2 };
}

export default function ConectorLayer({ areas, conectores, editMode, selectedId, onSelect, onDelete, onUpdate }: Props) {
  const [hoverId, setHoverId] = useState<string | null>(null);

  const valid = conectores.filter(c => {
    const o = getBoxCenter(areas, c.origenId);
    const d = getBoxCenter(areas, c.destinoId);
    return o && d;
  });

  if (valid.length === 0) return null;

  return (
    <svg
      style={{ position: 'absolute', top: 0, left: 0, width: CANVAS_W, height: CANVAS_H, pointerEvents: 'none', zIndex: 50 }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <marker id={ARROW_ID} markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
          <polygon points="0 0, 10 3.5, 0 7" fill="#4A4A6A" />
        </marker>
      </defs>

      {valid.map(c => {
        const o = getBoxCenter(areas, c.origenId)!;
        const d = getBoxCenter(areas, c.destinoId)!;
        const mid = midpoint(o.x, o.y, d.x, d.y);
        const isSelected = selectedId === c.id;
        const isHovered = hoverId === c.id;
        const stroke = c.color;
        const sw = isSelected ? 3 : isHovered ? 2.5 : 2;

        // Dynamic arrow marker per conector color
        const markerId = `arrow-${c.id}`;

        return (
          <g key={c.id}>
            <defs>
              <marker id={markerId} markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill={stroke} />
              </marker>
            </defs>

            {/* Hit area (wide, transparent) */}
            <line
              x1={o.x} y1={o.y} x2={d.x} y2={d.y}
              stroke="transparent"
              strokeWidth={16}
              style={{ pointerEvents: editMode ? 'stroke' : 'none', cursor: 'pointer' }}
              onMouseEnter={() => setHoverId(c.id)}
              onMouseLeave={() => setHoverId(null)}
              onClick={e => { e.stopPropagation(); onSelect(isSelected ? null : c.id); }}
            />

            {/* Visible line */}
            <line
              x1={o.x} y1={o.y} x2={d.x} y2={d.y}
              stroke={stroke}
              strokeWidth={sw}
              markerEnd={c.tipo === 'flecha' ? `url(#${markerId})` : undefined}
              strokeDasharray={isSelected ? '8 4' : undefined}
              style={{ pointerEvents: 'none' }}
            />

            {/* Label */}
            {c.label && (
              <text x={mid.x} y={mid.y - 6} textAnchor="middle" fontSize={11} fill={stroke} style={{ pointerEvents: 'none', userSelect: 'none' }}>
                {c.label}
              </text>
            )}

            {/* Selection dot at midpoint */}
            {isSelected && (
              <circle cx={mid.x} cy={mid.y} r={5} fill="#fff" stroke={stroke} strokeWidth={2} style={{ pointerEvents: 'none' }} />
            )}
          </g>
        );
      })}

      {/* Selected connector toolbar (rendered as foreignObject) */}
      {selectedId && editMode && (() => {
        const c = conectores.find(x => x.id === selectedId);
        if (!c) return null;
        const o = getBoxCenter(areas, c.origenId);
        const d = getBoxCenter(areas, c.destinoId);
        if (!o || !d) return null;
        const mid = midpoint(o.x, o.y, d.x, d.y);
        return (
          <foreignObject x={mid.x - 90} y={mid.y + 10} width={180} height={44} style={{ overflow: 'visible', pointerEvents: 'all' }}>
            <div style={{ display: 'flex', gap: 4, background: '#fff', borderRadius: 8, padding: '4px 8px', boxShadow: '0 4px 16px rgba(0,0,0,0.18)', border: '1px solid #e5e7eb', alignItems: 'center' }}>
              <input type="color" value={c.color} onChange={e => onUpdate(c.id, { color: e.target.value })}
                style={{ width: 24, height: 24, border: 'none', cursor: 'pointer', borderRadius: 4, padding: 1, flexShrink: 0 }} title="Color" />
              <button
                onClick={() => onUpdate(c.id, { tipo: c.tipo === 'flecha' ? 'linea' : 'flecha' })}
                style={{ padding: '2px 6px', border: '1px solid #e5e7eb', borderRadius: 4, fontSize: 11, cursor: 'pointer', background: '#f9fafb', color: '#374151', flexShrink: 0 }}
                title="Tipo"
              >
                {c.tipo === 'flecha' ? '→' : '—'}
              </button>
              <button
                onClick={() => { onDelete(c.id); onSelect(null); }}
                style={{ padding: '2px 6px', border: '1px solid #fee2e2', borderRadius: 4, fontSize: 11, cursor: 'pointer', background: '#fff', color: '#ef4444', flexShrink: 0 }}
                title="Eliminar"
              >
                🗑
              </button>
            </div>
          </foreignObject>
        );
      })()}
    </svg>
  );
}
