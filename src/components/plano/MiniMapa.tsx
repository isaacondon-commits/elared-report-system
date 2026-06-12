import { useRef } from 'react';
import type { AreaPiso } from '../../store/planoStore';
import { AREA_HEADER_H } from './AreaPiso';

const CANVAS_W = 3200;
const CANVAS_H = 2400;
const MINI_W = 180;
const MINI_H = 120;
const SCALE = MINI_W / CANVAS_W; // ~0.05625

interface Props {
  areas: AreaPiso[];
  panX: number;
  panY: number;
  zoom: number;
  containerW: number;
  containerH: number;
  onPan: (panX: number, panY: number) => void;
}

export default function MiniMapa({ areas, panX, panY, zoom, containerW, containerH, onPan }: Props) {
  const miniRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  // Viewport in canvas coords
  const vpX = -panX / zoom;
  const vpY = -panY / zoom;
  const vpW = containerW / zoom;
  const vpH = containerH / zoom;

  // Clamp viewport rect to canvas
  const vpLeft   = Math.max(0, Math.min(vpX, CANVAS_W)) * SCALE;
  const vpTop    = Math.max(0, Math.min(vpY, CANVAS_H)) * SCALE;
  const vpRight  = Math.max(0, Math.min(vpX + vpW, CANVAS_W)) * SCALE;
  const vpBottom = Math.max(0, Math.min(vpY + vpH, CANVAS_H)) * SCALE;

  function handleMiniClick(e: React.MouseEvent) {
    const rect = miniRef.current!.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const canvasX = mx / SCALE;
    const canvasY = my / SCALE;
    onPan(-(canvasX * zoom - containerW / 2), -(canvasY * zoom - containerH / 2));
  }

  function handleMouseDown(e: React.MouseEvent) {
    e.stopPropagation();
    draggingRef.current = true;
    handleMiniClick(e);

    function onMove(ev: MouseEvent) {
      if (!draggingRef.current) return;
      const rect = miniRef.current!.getBoundingClientRect();
      const mx = Math.max(0, Math.min(MINI_W, ev.clientX - rect.left));
      const my = Math.max(0, Math.min(MINI_H, ev.clientY - rect.top));
      const canvasX = mx / SCALE;
      const canvasY = my / SCALE;
      onPan(-(canvasX * zoom - containerW / 2), -(canvasY * zoom - containerH / 2));
    }
    function onUp() {
      draggingRef.current = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  return (
    <div
      ref={miniRef}
      onMouseDown={handleMouseDown}
      style={{
        position: 'absolute', bottom: 52, left: 12,
        width: MINI_W, height: MINI_H,
        background: 'rgba(255,255,255,0.92)',
        border: '1px solid #e5e7eb',
        borderRadius: 8,
        overflow: 'hidden',
        boxShadow: '0 2px 12px rgba(0,0,0,0.12)',
        cursor: 'crosshair',
        zIndex: 100,
        userSelect: 'none',
      }}
    >
      {/* Canvas background */}
      <div style={{ position: 'absolute', inset: 0, background: '#F5F7FA' }} />

      {/* Areas */}
      {areas.map(area => (
        <div key={area.id} style={{
          position: 'absolute',
          left: area.x * SCALE,
          top: area.y * SCALE,
          width: area.width * SCALE,
          height: area.height * SCALE,
          background: area.color,
          border: '1px solid rgba(0,0,0,0.1)',
          borderRadius: 2,
          overflow: 'hidden',
        }}>
          {/* Boxes as tiny dots */}
          {area.boxes.map(box => (
            <div key={box.id} style={{
              position: 'absolute',
              left: box.x * SCALE,
              top: (AREA_HEADER_H + box.y) * SCALE,
              width: Math.max(2, box.width * SCALE),
              height: Math.max(2, box.height * SCALE),
              background: 'rgba(0,0,0,0.25)',
              borderRadius: 1,
            }} />
          ))}
        </div>
      ))}

      {/* Viewport indicator */}
      <div style={{
        position: 'absolute',
        left: vpLeft,
        top: vpTop,
        width: Math.max(4, vpRight - vpLeft),
        height: Math.max(4, vpBottom - vpTop),
        border: '2px solid #003DA5',
        background: 'rgba(0,61,165,0.08)',
        borderRadius: 2,
        pointerEvents: 'none',
      }} />

      {/* Label */}
      <div style={{ position: 'absolute', bottom: 3, right: 5, fontSize: 9, color: '#9ca3af', pointerEvents: 'none' }}>Mapa</div>
    </div>
  );
}
