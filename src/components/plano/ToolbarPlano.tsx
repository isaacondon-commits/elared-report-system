import { useState } from 'react';
import {
  MousePointer2, Hand, Square, LayoutDashboard,
  GitBranch, ZoomIn, ZoomOut, Maximize2, Undo2, Redo2,
} from 'lucide-react';

export type PlanoTool = 'select' | 'pan' | 'box' | 'area' | 'connect';

interface Props {
  tool: PlanoTool;
  onTool: (t: PlanoTool) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitAll: () => void;
}

const TOOL_ITEMS: { id: PlanoTool; Icon: React.ElementType; label: string; key: string }[] = [
  { id: 'select',  Icon: MousePointer2,  label: 'Seleccionar',  key: 'V' },
  { id: 'pan',     Icon: Hand,           label: 'Mover canvas', key: 'H' },
  { id: 'box',     Icon: Square,         label: 'Crear box',    key: 'B' },
  { id: 'area',    Icon: LayoutDashboard,label: 'Crear área',   key: 'A' },
  { id: 'connect', Icon: GitBranch,      label: 'Conector',     key: 'C' },
];

const ACTION_ITEMS: { id: string; Icon: React.ElementType; label: string; key?: string }[] = [
  { id: 'zoom-in',  Icon: ZoomIn,    label: 'Zoom in',       key: '+' },
  { id: 'zoom-out', Icon: ZoomOut,   label: 'Zoom out',      key: '−' },
  { id: 'fit',      Icon: Maximize2, label: 'Ajustar todo' },
];

const HISTORY_ITEMS: { id: string; Icon: React.ElementType; label: string; key: string }[] = [
  { id: 'undo', Icon: Undo2, label: 'Deshacer', key: 'Ctrl+Z' },
  { id: 'redo', Icon: Redo2, label: 'Rehacer',  key: 'Ctrl+Y' },
];

const SEP = (
  <div style={{ width: 28, height: 1, background: 'rgba(255,255,255,0.12)', margin: '4px 0', flexShrink: 0 }} />
);

export default function ToolbarPlano({
  tool, onTool, canUndo, canRedo, onUndo, onRedo, onZoomIn, onZoomOut, onFitAll,
}: Props) {
  const [hovered, setHovered] = useState<string | null>(null);

  const base: React.CSSProperties = {
    width: 40, height: 40, flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    border: 'none', borderRadius: 8, cursor: 'pointer',
    transition: 'background 0.12s',
  };

  function Tooltip({ id, label, shortcut }: { id: string; label: string; shortcut?: string }) {
    if (hovered !== id) return null;
    return (
      <div style={{
        position: 'absolute', left: 48, top: '50%', transform: 'translateY(-50%)',
        background: '#1e293b', color: '#fff', padding: '5px 10px', borderRadius: 6,
        fontSize: 12, whiteSpace: 'nowrap', zIndex: 9999, pointerEvents: 'none',
        boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
      }}>
        {label}
        {shortcut && (
          <span style={{
            marginLeft: 8, fontSize: 10, opacity: 0.6, fontWeight: 700,
            background: 'rgba(255,255,255,0.15)', padding: '1px 5px', borderRadius: 3,
          }}>{shortcut}</span>
        )}
      </div>
    );
  }

  return (
    <div style={{
      width: 60, flexShrink: 0,
      background: '#1A1A2E',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      paddingTop: 10, paddingBottom: 10, gap: 2,
      overflow: 'hidden',
    }}>
      {TOOL_ITEMS.map(({ id, Icon, label, key }) => {
        const isActive = tool === id;
        const isHov = hovered === id;
        return (
          <div key={id} style={{ position: 'relative' }}
            onMouseEnter={() => setHovered(id)}
            onMouseLeave={() => setHovered(null)}
          >
            <button
              onClick={() => onTool(id)}
              style={{
                ...base,
                background: isActive ? '#003DA5' : isHov ? 'rgba(255,255,255,0.08)' : 'transparent',
                color: isActive ? '#fff' : 'rgba(255,255,255,0.6)',
              }}
            >
              <Icon size={18} />
            </button>
            <Tooltip id={id} label={label} shortcut={key} />
          </div>
        );
      })}

      {SEP}

      {ACTION_ITEMS.map(({ id, Icon, label, key }) => {
        const action = id === 'zoom-in' ? onZoomIn : id === 'zoom-out' ? onZoomOut : onFitAll;
        const isHov = hovered === id;
        return (
          <div key={id} style={{ position: 'relative' }}
            onMouseEnter={() => setHovered(id)}
            onMouseLeave={() => setHovered(null)}
          >
            <button
              onClick={action}
              style={{ ...base, background: isHov ? 'rgba(255,255,255,0.08)' : 'transparent', color: 'rgba(255,255,255,0.6)' }}
            >
              <Icon size={18} />
            </button>
            <Tooltip id={id} label={label} shortcut={key} />
          </div>
        );
      })}

      {SEP}

      {HISTORY_ITEMS.map(({ id, Icon, label, key }) => {
        const disabled = id === 'undo' ? !canUndo : !canRedo;
        const action = id === 'undo' ? onUndo : onRedo;
        const isHov = hovered === id;
        return (
          <div key={id} style={{ position: 'relative' }}
            onMouseEnter={() => setHovered(id)}
            onMouseLeave={() => setHovered(null)}
          >
            <button
              onClick={action}
              disabled={disabled}
              style={{
                ...base,
                background: (!disabled && isHov) ? 'rgba(255,255,255,0.08)' : 'transparent',
                color: 'rgba(255,255,255,0.6)',
                opacity: disabled ? 0.28 : 1,
                cursor: disabled ? 'not-allowed' : 'pointer',
              }}
            >
              <Icon size={18} />
            </button>
            {!disabled && <Tooltip id={id} label={label} shortcut={key} />}
          </div>
        );
      })}
    </div>
  );
}
