import { useState, useMemo, useEffect, useRef } from 'react';
import { Search, Plus, Palette, Eye, Pencil } from 'lucide-react';
import AreaPisoComp, { AREA_HEADER_H } from '../components/plano/AreaPiso';
import FichaVendedor from '../components/plano/FichaVendedor';
import GestionEstados from '../components/plano/GestionEstados';
import ConectorLayer from '../components/plano/ConectorLayer';
import MiniMapa from '../components/plano/MiniMapa';
import ToolbarPlano, { type PlanoTool } from '../components/plano/ToolbarPlano';
import { usePlanoStore } from '../store/planoStore';
import type { BoxPiso, AreaPiso } from '../store/planoStore';

const CANVAS_W = 3200;
const CANVAS_H = 2400;
const ZOOM_MIN = 0.25;
const ZOOM_MAX = 3;
const ZOOM_STEP = 0.1;

// ── Modal nueva área ──────────────────────────────────────────────────────────

function ModalNuevaArea({ onClose, onAdd }: {
  onClose: () => void;
  onAdd: (nombre: string, color: string, w: number, h: number) => void;
}) {
  const [nombre, setNombre] = useState('');
  const [color, setColor] = useState('#4A90D9');
  const [w, setW] = useState(800);
  const [h, setH] = useState(500);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 14, width: 380, padding: '24px', boxShadow: '0 24px 64px rgba(0,0,0,0.28)' }} onClick={e => e.stopPropagation()}>
        <div style={{ fontWeight: 700, fontSize: 16, color: '#111827', marginBottom: 20 }}>Nueva Área</div>

        <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Nombre *</label>
        <input value={nombre} onChange={e => setNombre(e.target.value)} autoFocus placeholder="Ej: Piso Principal..."
          style={{ width: '100%', border: '1px solid #e5e7eb', borderRadius: 6, padding: '8px 10px', fontSize: 13, marginBottom: 14, boxSizing: 'border-box' }} />

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
          <button onClick={onClose} style={{ flex: 1, padding: '9px', border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
          <button onClick={() => { if (!nombre.trim()) return; onAdd(nombre.trim(), color, w, h); onClose(); }}
            disabled={!nombre.trim()}
            style={{ flex: 2, padding: '9px', border: 'none', borderRadius: 8, background: nombre.trim() ? '#003DA5' : '#e5e7eb', color: nombre.trim() ? '#fff' : '#9ca3af', fontSize: 13, fontWeight: 600, cursor: nombre.trim() ? 'pointer' : 'not-allowed' }}>
            Crear Área
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function findBoxGlobal(areas: AreaPiso[], boxId: string): { area: AreaPiso; box: BoxPiso } | null {
  for (const area of areas) {
    const box = area.boxes.find(b => b.id === boxId);
    if (box) return { area, box };
  }
  return null;
}

function clampZoom(z: number) { return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z)); }

function rectsIntersect(ax: number, ay: number, aw: number, ah: number, bx: number, by: number, bw: number, bh: number) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

function multiSelectedIds_forArea(multiSelected: Set<string>, area: AreaPiso): Set<string> {
  const areaBoxIds = new Set(area.boxes.map(b => b.id));
  return new Set([...multiSelected].filter(id => areaBoxIds.has(id)));
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function PlanoCallCenterPage() {
  const {
    areas, estados, conectores, savedAt, historyLen, futureLen,
    pushHistory, undo, redo,
    addArea, updateArea, removeArea, addBox, updateBox, updateBoxes, removeBoxes, addBoxes,
    addEstado, updateEstado, removeEstado,
    addConector, updateConector, removeConector,
  } = usePlanoStore();

  // ── Tool ──
  const [tool, setTool] = useState<PlanoTool>(() => {
    try { return (localStorage.getItem('elared_plano_tool') as PlanoTool) || 'select'; } catch { return 'select'; }
  });
  const [spaceActive, setSpaceActive] = useState(false);

  // ── View ──
  const [zoom, setZoom] = useState(0.8);
  const [panX, setPanX] = useState(40);
  const [panY, setPanY] = useState(40);
  const [searchTerm, setSearchTerm] = useState('');
  const [savedIndicator, setSavedIndicator] = useState(false);

  // ── Selection ──
  const [selectedBox, setSelectedBox] = useState<{ areaId: string; boxId: string } | null>(null);
  const [multiSelected, setMultiSelected] = useState<Set<string>>(new Set());
  const [selectionRect, setSelectionRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  // ── Drag ──
  const [dragOffsets, setDragOffsets] = useState<Map<string, { dx: number; dy: number }>>(new Map());

  // ── Connectors ──
  const [conectOrigen, setConectOrigen] = useState<string | null>(null);
  const [selectedConector, setSelectedConector] = useState<string | null>(null);

  // ── Clipboard ──
  const [clipboard, setClipboard] = useState<{ areaId: string; box: BoxPiso }[] | null>(null);

  // ── Modals ──
  const [showGestionEstados, setShowGestionEstados] = useState(false);
  const [showNuevaArea, setShowNuevaArea] = useState(false);

  // ── Refs ──
  const containerRef = useRef<HTMLDivElement>(null);
  const panningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0, px: 0, py: 0 });
  const selStartRef = useRef<{ cx: number; cy: number } | null>(null);
  const dragRef = useRef<{ boxes: { boxId: string; areaId: string; origX: number; origY: number }[]; startCX: number; startCY: number } | null>(null);
  const containerSizeRef = useRef({ w: 800, h: 600 });

  // ── Persist tool ──
  useEffect(() => { try { localStorage.setItem('elared_plano_tool', tool); } catch {} }, [tool]);

  // ── savedAt indicator ──
  useEffect(() => {
    if (!savedAt) return;
    setSavedIndicator(true);
    const t = setTimeout(() => setSavedIndicator(false), 2000);
    return () => clearTimeout(t);
  }, [savedAt]);

  // ── Container size tracker ──
  useEffect(() => {
    function update() {
      if (containerRef.current) {
        const r = containerRef.current.getBoundingClientRect();
        containerSizeRef.current = { w: r.width, h: r.height };
      }
    }
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // ── Helpers ──
  function screenToCanvas(sx: number, sy: number) {
    const rect = containerRef.current!.getBoundingClientRect();
    return { x: (sx - rect.left - panX) / zoom, y: (sy - rect.top - panY) / zoom };
  }

  // ── Wheel = zoom centered on cursor ──
  function handleWheel(e: React.WheelEvent) {
    e.preventDefault();
    const rect = containerRef.current!.getBoundingClientRect();
    const fx = e.clientX - rect.left;
    const fy = e.clientY - rect.top;
    const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
    const newZoom = clampZoom(zoom + delta);
    setPanX(px => px + (fx - px) * (1 - newZoom / zoom));
    setPanY(py => py + (fy - py) * (1 - newZoom / zoom));
    setZoom(newZoom);
  }

  // ── Container mouse events ──
  function handleContainerMouseDown(e: React.MouseEvent) {
    const isPanMode = tool === 'pan' || spaceActive;
    if (e.button === 1 || (isPanMode && e.button === 0)) {
      panningRef.current = true;
      panStartRef.current = { x: e.clientX, y: e.clientY, px: panX, py: panY };
      return;
    }
    if (tool === 'select' && e.button === 0) {
      const cp = screenToCanvas(e.clientX, e.clientY);
      selStartRef.current = { cx: cp.x, cy: cp.y };
      setSelectionRect({ x: cp.x, y: cp.y, w: 0, h: 0 });
    }
  }

  function handleContainerMouseMove(e: React.MouseEvent) {
    if (panningRef.current) {
      setPanX(panStartRef.current.px + e.clientX - panStartRef.current.x);
      setPanY(panStartRef.current.py + e.clientY - panStartRef.current.y);
      return;
    }
    if (dragRef.current) {
      const cp = screenToCanvas(e.clientX, e.clientY);
      const dx = cp.x - dragRef.current.startCX;
      const dy = cp.y - dragRef.current.startCY;
      const offsets = new Map<string, { dx: number; dy: number }>();
      for (const b of dragRef.current.boxes) offsets.set(b.boxId, { dx, dy });
      setDragOffsets(offsets);
      return;
    }
    if (selStartRef.current) {
      const cp = screenToCanvas(e.clientX, e.clientY);
      const sx = selStartRef.current.cx, sy = selStartRef.current.cy;
      setSelectionRect({ x: Math.min(sx, cp.x), y: Math.min(sy, cp.y), w: Math.abs(cp.x - sx), h: Math.abs(cp.y - sy) });
    }
  }

  function handleContainerMouseUp(e: React.MouseEvent) {
    if (panningRef.current) { panningRef.current = false; return; }

    if (dragRef.current) {
      const cp = screenToCanvas(e.clientX, e.clientY);
      const dx = cp.x - dragRef.current.startCX;
      const dy = cp.y - dragRef.current.startCY;
      if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
        pushHistory();
        updateBoxes(dragRef.current.boxes.map(b => ({
          areaId: b.areaId, boxId: b.boxId,
          patch: { x: Math.max(0, b.origX + dx), y: Math.max(0, b.origY + dy) },
        })));
      }
      dragRef.current = null;
      setDragOffsets(new Map());
      return;
    }

    // Box creation tool
    if (tool === 'box' && e.button === 0) {
      const cp = screenToCanvas(e.clientX, e.clientY);
      const area = areas.find(a =>
        cp.x >= a.x && cp.x <= a.x + a.width &&
        cp.y >= a.y + AREA_HEADER_H && cp.y <= a.y + a.height,
      );
      if (area) {
        addBox(area.id, {
          x: Math.max(0, cp.x - area.x - 45),
          y: Math.max(0, cp.y - area.y - AREA_HEADER_H - 45),
          width: 90, height: 90, estadoId: 'libre', vendedor: null,
          label: `B-${area.boxes.length + 1}`,
        });
      }
      return;
    }

    // Area creation tool
    if (tool === 'area' && e.button === 0) {
      setShowNuevaArea(true);
      return;
    }

    // Rubber-band selection end
    if (selStartRef.current && selectionRect) {
      if (selectionRect.w > 4 && selectionRect.h > 4) {
        const sel = new Set<string>();
        for (const area of areas) {
          for (const box of area.boxes) {
            const bx = area.x + box.x;
            const by = area.y + AREA_HEADER_H + box.y;
            if (rectsIntersect(selectionRect.x, selectionRect.y, selectionRect.w, selectionRect.h, bx, by, box.width, box.height)) {
              sel.add(box.id);
            }
          }
        }
        setMultiSelected(sel);
        if (sel.size === 1) {
          const boxId = [...sel][0];
          const found = findBoxGlobal(areas, boxId);
          if (found) setSelectedBox({ areaId: found.area.id, boxId });
        } else { setSelectedBox(null); }
      } else {
        setMultiSelected(new Set());
        setSelectedBox(null);
        setConectOrigen(null);
        setSelectedConector(null);
      }
      selStartRef.current = null;
      setSelectionRect(null);
    }
  }

  function handleContainerMouseLeave() {
    if (panningRef.current) { panningRef.current = false; }
    if (dragRef.current) {
      const updates = dragRef.current.boxes.map(b => ({
        areaId: b.areaId, boxId: b.boxId,
        patch: { x: Math.max(0, b.origX + (dragOffsets.get(b.boxId)?.dx ?? 0)), y: Math.max(0, b.origY + (dragOffsets.get(b.boxId)?.dy ?? 0)) },
      }));
      if (updates.some(u => u.patch.x !== 0 || u.patch.y !== 0)) { pushHistory(); updateBoxes(updates); }
      dragRef.current = null;
      setDragOffsets(new Map());
    }
    if (selStartRef.current) { selStartRef.current = null; setSelectionRect(null); }
  }

  // ── Box events ──
  function handleBoxMouseDown(boxId: string, areaId: string, e: React.MouseEvent) {
    if (tool !== 'select') return;
    e.stopPropagation();
    selStartRef.current = null;
    setSelectionRect(null);

    if (tool === 'select' as PlanoTool && false) { /* connect handled below */ }

    if (e.shiftKey) {
      setMultiSelected(prev => {
        const next = new Set(prev);
        if (next.has(boxId)) next.delete(boxId); else next.add(boxId);
        return next;
      });
      return;
    }

    let toDrag: { boxId: string; areaId: string; origX: number; origY: number }[];
    if (multiSelected.has(boxId) && multiSelected.size > 1) {
      toDrag = [...multiSelected].map(bid => {
        const f = findBoxGlobal(areas, bid);
        return f ? { boxId: bid, areaId: f.area.id, origX: f.box.x, origY: f.box.y } : null;
      }).filter(Boolean) as { boxId: string; areaId: string; origX: number; origY: number }[];
    } else {
      const found = findBoxGlobal(areas, boxId);
      toDrag = found ? [{ boxId, areaId, origX: found.box.x, origY: found.box.y }] : [];
      setMultiSelected(new Set([boxId]));
    }

    const cp = screenToCanvas(e.clientX, e.clientY);
    dragRef.current = { boxes: toDrag, startCX: cp.x, startCY: cp.y };
  }

  function handleBoxClick(boxId: string, areaId: string, e: React.MouseEvent) {
    if (dragRef.current) return;
    if (e.shiftKey) return;

    // Connect mode
    if (tool === 'connect') {
      if (!conectOrigen) {
        setConectOrigen(boxId);
      } else if (conectOrigen !== boxId) {
        addConector({ origenId: conectOrigen, destinoId: boxId, tipo: 'flecha', color: '#4A4A6A' });
        setConectOrigen(null);
        setTool('select');
      }
      return;
    }

    setSelectedBox({ areaId, boxId });
  }

  // ── Keyboard shortcuts ──
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;

      if (e.code === 'Space') { e.preventDefault(); setSpaceActive(true); return; }

      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return; }
        if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) { e.preventDefault(); redo(); return; }
        if (e.key === 'c' && multiSelected.size > 0) {
          e.preventDefault();
          const items = [...multiSelected].map(bid => {
            const f = findBoxGlobal(areas, bid);
            return f ? { areaId: f.area.id, box: { ...f.box } } : null;
          }).filter(Boolean) as { areaId: string; box: BoxPiso }[];
          setClipboard(items);
          return;
        }
        if (e.key === 'v' && clipboard) {
          e.preventDefault();
          const ids = addBoxes(clipboard.map(i => ({ areaId: i.areaId, box: { ...i.box, x: i.box.x + 20, y: i.box.y + 20 } })));
          setMultiSelected(new Set(ids));
          return;
        }
        if (e.key === 'a') {
          e.preventDefault();
          setMultiSelected(new Set(areas.flatMap(a => a.boxes.map(b => b.id))));
          return;
        }
      }

      if (e.key === 'Escape') {
        setMultiSelected(new Set()); setSelectedBox(null);
        setConectOrigen(null); setSelectedConector(null);
        return;
      }

      if ((e.key === 'Delete' || e.key === 'Backspace') && multiSelected.size > 0) {
        e.preventDefault();
        const withVendedor = [...multiSelected].filter(bid => findBoxGlobal(areas, bid)?.box.vendedor);
        if (withVendedor.length > 0 && !confirm(`¿Eliminar ${multiSelected.size} box${multiSelected.size > 1 ? 'es' : ''}? ${withVendedor.length} tienen vendedor asignado.`)) return;
        removeBoxes([...multiSelected].map(bid => { const f = findBoxGlobal(areas, bid); return f ? { areaId: f.area.id, boxId: bid } : null; }).filter(Boolean) as { areaId: string; boxId: string }[]);
        setMultiSelected(new Set()); setSelectedBox(null);
        return;
      }

      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && multiSelected.size > 0) {
        e.preventDefault();
        const d = e.shiftKey ? 10 : 1;
        const dx = e.key === 'ArrowLeft' ? -d : e.key === 'ArrowRight' ? d : 0;
        const dy = e.key === 'ArrowUp' ? -d : e.key === 'ArrowDown' ? d : 0;
        updateBoxes([...multiSelected].map(bid => {
          const f = findBoxGlobal(areas, bid);
          return f ? { areaId: f.area.id, boxId: bid, patch: { x: Math.max(0, f.box.x + dx), y: Math.max(0, f.box.y + dy) } } : null;
        }).filter(Boolean) as { areaId: string; boxId: string; patch: Partial<BoxPiso> }[]);
        return;
      }

      // Tool shortcuts (no modifier)
      switch (e.key.toLowerCase()) {
        case 'v': setTool('select'); break;
        case 'h': setTool('pan'); break;
        case 'b': setTool('box'); break;
        case 'a': setTool('area'); setShowNuevaArea(true); break;
        case 'c': setTool('connect'); setConectOrigen(null); break;
      }
    }

    function handleKeyUp(e: KeyboardEvent) {
      if (e.code === 'Space') setSpaceActive(false);
    }

    document.addEventListener('keydown', handleKey);
    document.addEventListener('keyup', handleKeyUp);
    return () => { document.removeEventListener('keydown', handleKey); document.removeEventListener('keyup', handleKeyUp); };
  }, [multiSelected, areas, clipboard, undo, redo, addBoxes, removeBoxes, updateBoxes]);

  // ── Search ──
  useEffect(() => {
    if (!searchTerm.trim()) return;
    const term = searchTerm.toLowerCase();
    for (const area of areas) {
      const match = area.boxes.find(b => b.vendedor?.nombre?.toLowerCase().includes(term));
      if (match) {
        const cx = area.x + match.x + match.width / 2;
        const cy = area.y + AREA_HEADER_H + match.y + match.height / 2;
        const { w, h } = containerSizeRef.current;
        setPanX(w / 2 - cx * zoom);
        setPanY(h / 2 - cy * zoom);
        setSelectedBox({ areaId: area.id, boxId: match.id });
        break;
      }
    }
  }, [searchTerm]);

  // ── Derived ──
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

  // ── Cursor ──
  const isPanActive = tool === 'pan' || spaceActive;
  const cursor = isPanActive
    ? (panningRef.current ? 'grabbing' : 'grab')
    : (tool === 'box' || tool === 'area' || tool === 'connect') ? 'crosshair'
    : selStartRef.current ? 'crosshair'
    : 'default';

  // editMode = can drag/resize areas and boxes
  const editMode = tool !== 'pan';

  // ── Zoom functions ──
  function zoomIn() {
    const { w, h } = containerSizeRef.current;
    const n = clampZoom(zoom + ZOOM_STEP);
    setPanX(px => px + (w / 2 - px) * (1 - n / zoom));
    setPanY(py => py + (h / 2 - py) * (1 - n / zoom));
    setZoom(n);
  }
  function zoomOut() {
    const { w, h } = containerSizeRef.current;
    const n = clampZoom(zoom - ZOOM_STEP);
    setPanX(px => px + (w / 2 - px) * (1 - n / zoom));
    setPanY(py => py + (h / 2 - py) * (1 - n / zoom));
    setZoom(n);
  }
  function zoomReset() { setZoom(1); setPanX(40); setPanY(40); }

  function fitAll() {
    if (areas.length === 0) { setZoom(0.8); setPanX(40); setPanY(40); return; }
    const { w, h } = containerSizeRef.current;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const a of areas) {
      minX = Math.min(minX, a.x); minY = Math.min(minY, a.y);
      maxX = Math.max(maxX, a.x + a.width); maxY = Math.max(maxY, a.y + a.height);
    }
    const cw = maxX - minX, ch = maxY - minY;
    const nz = clampZoom(Math.min((w - 80) / cw, (h - 80) / ch, 1.2));
    setPanX((w - cw * nz) / 2 - minX * nz);
    setPanY((h - ch * nz) / 2 - minY * nz);
    setZoom(nz);
  }

  function handleAddBox(areaId: string) {
    const area = areas.find(a => a.id === areaId);
    if (!area) return;
    addBox(areaId, { x: 20, y: 40, width: 90, height: 90, estadoId: 'libre', vendedor: null, label: `B-${area.boxes.length + 1}` });
  }

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* ── Top bar ── */}
      <div style={{
        height: 44, flexShrink: 0,
        background: '#fff', borderBottom: '1px solid #E2E8F0',
        display: 'flex', alignItems: 'center', gap: 10, padding: '0 14px',
        zIndex: 50,
      }}>
        {/* Title */}
        <span style={{ fontSize: 14, fontWeight: 700, color: '#1A1A2E', whiteSpace: 'nowrap' }}>Plano del Call Center</span>

        <div style={{ width: 1, height: 20, background: '#e5e7eb', flexShrink: 0 }} />

        {/* View / Edit toggle */}
        <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: 7, padding: 2, gap: 2, flexShrink: 0 }}>
          {[
            { value: 'pan'    as PlanoTool, icon: Eye,    label: 'Vista' },
            { value: 'select' as PlanoTool, icon: Pencil, label: 'Edición' },
          ].map(({ value, icon: Icon, label }) => {
            const isAct2 = value === 'pan' ? tool === 'pan' : tool !== 'pan';
            return (
              <button key={value} onClick={() => setTool(value)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px',
                  border: 'none', borderRadius: 5, cursor: 'pointer', fontSize: 12, fontWeight: 500,
                  background: isAct2 ? '#fff' : 'transparent',
                  color: isAct2 ? '#1A1A2E' : '#6b7280',
                  boxShadow: isAct2 ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  transition: 'all 0.15s',
                }}>
                <Icon size={12} />{label}
              </button>
            );
          })}
        </div>

        <div style={{ width: 1, height: 20, background: '#e5e7eb', flexShrink: 0 }} />

        {/* Search */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
          <Search size={12} style={{ position: 'absolute', left: 7, color: '#9ca3af', pointerEvents: 'none' }} />
          <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            placeholder="Buscar vendedor..."
            style={{ paddingLeft: 24, paddingRight: 8, paddingTop: 5, paddingBottom: 5, border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 12, width: 170, outline: 'none', background: '#fafafa' }} />
        </div>

        {/* Actions */}
        <button onClick={() => setShowGestionEstados(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', border: '1px solid #e5e7eb', borderRadius: 6, background: '#fff', fontSize: 12, cursor: 'pointer', color: '#374151', flexShrink: 0 }}>
          <Palette size={12} /> Estados
        </button>
        <button onClick={() => { setShowNuevaArea(true); }}
          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', border: 'none', borderRadius: 6, background: '#003DA5', fontSize: 12, cursor: 'pointer', color: '#fff', fontWeight: 600, flexShrink: 0 }}>
          <Plus size={12} /> Nueva Área
        </button>

        <div style={{ width: 1, height: 20, background: '#e5e7eb', flexShrink: 0 }} />

        {/* Zoom */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          <button onClick={zoomOut} style={{ width: 24, height: 24, border: '1px solid #e5e7eb', borderRadius: 4, background: '#fff', fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
          <button onClick={zoomReset} style={{ minWidth: 48, height: 24, border: '1px solid #e5e7eb', borderRadius: 4, background: '#fff', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontVariantNumeric: 'tabular-nums', color: '#374151' }}>{Math.round(zoom * 100)}%</button>
          <button onClick={zoomIn} style={{ width: 24, height: 24, border: '1px solid #e5e7eb', borderRadius: 4, background: '#fff', fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
        </div>

        <div style={{ flex: 1 }} />

        {/* Saved indicator + stats */}
        {savedIndicator && <span style={{ fontSize: 11, color: '#16a34a', fontWeight: 500, flexShrink: 0 }}>Guardado ✓</span>}
        <span style={{ fontSize: 11, color: '#9ca3af', whiteSpace: 'nowrap', flexShrink: 0 }}>
          {kpis.boxes} box{kpis.boxes !== 1 ? 'es' : ''} · {kpis.vendedores} asignado{kpis.vendedores !== 1 ? 's' : ''}
        </span>
      </div>

      {/* ── Body: toolbar + canvas ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* Left toolbar */}
        <ToolbarPlano
          tool={tool}
          onTool={(t) => { setTool(t); if (t !== 'connect') setConectOrigen(null); }}
          canUndo={historyLen > 0}
          canRedo={futureLen > 0}
          onUndo={undo}
          onRedo={redo}
          onZoomIn={zoomIn}
          onZoomOut={zoomOut}
          onFitAll={fitAll}
        />

        {/* Canvas */}
        <div
          ref={containerRef}
          style={{ flex: 1, overflow: 'hidden', position: 'relative', cursor, userSelect: 'none' }}
          onWheel={handleWheel}
          onMouseDown={handleContainerMouseDown}
          onMouseMove={handleContainerMouseMove}
          onMouseUp={handleContainerMouseUp}
          onMouseLeave={handleContainerMouseLeave}
        >
          {/* Transformed canvas */}
          <div style={{
            position: 'absolute', top: 0, left: 0,
            width: CANVAS_W, height: CANVAS_H,
            transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
            transformOrigin: '0 0',
            backgroundColor: '#F0F2F5',
            backgroundImage: 'radial-gradient(#CBD5E1 1px, transparent 1px)',
            backgroundSize: '20px 20px',
          }}>
            <ConectorLayer
              areas={areas}
              conectores={conectores}
              editMode={editMode}
              selectedId={selectedConector}
              onSelect={setSelectedConector}
              onDelete={removeConector}
              onUpdate={updateConector}
            />

            {areas.map(area => (
              <AreaPisoComp
                key={area.id}
                area={area}
                estados={estados}
                editMode={editMode}
                searchTerm={searchTerm}
                selectedBoxId={selectedBox?.areaId === area.id ? selectedBox.boxId : null}
                multiSelectedIds={multiSelectedIds_forArea(multiSelected, area)}
                zoom={zoom}
                dragOffsets={dragOffsets}
                onBoxClick={(boxId, e) => handleBoxClick(boxId, area.id, e)}
                onBoxMouseDown={(boxId, areaId, e) => handleBoxMouseDown(boxId, areaId, e)}
                onAreaUpdate={patch => updateArea(area.id, patch)}
                onAreaDelete={() => { removeArea(area.id); if (selectedBox?.areaId === area.id) setSelectedBox(null); }}
                onBoxAdd={() => handleAddBox(area.id)}
                onBoxUpdate={(boxId, patch) => updateBox(area.id, boxId, patch)}
              />
            ))}

            {/* Empty state */}
            {areas.length === 0 && (
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', textAlign: 'center', color: '#9ca3af' }}>
                <div style={{ fontSize: 48, marginBottom: 12, opacity: 0.2 }}>⊞</div>
                <div style={{ fontSize: 16, fontWeight: 600 }}>Sin áreas</div>
                <div style={{ fontSize: 13, marginTop: 4 }}>Presioná A o hacé clic en "Nueva Área" para empezar</div>
              </div>
            )}

            {/* Connect mode origin highlight */}
            {tool === 'connect' && conectOrigen && (() => {
              const found = findBoxGlobal(areas, conectOrigen);
              if (!found) return null;
              return (
                <div style={{
                  position: 'absolute',
                  left: found.area.x + found.box.x - 4,
                  top: found.area.y + AREA_HEADER_H + found.box.y - 4,
                  width: found.box.width + 8, height: found.box.height + 8,
                  border: '3px solid #003DA5', borderRadius: 8,
                  pointerEvents: 'none', zIndex: 200,
                  boxShadow: '0 0 0 4px rgba(0,61,165,0.2)',
                }} />
              );
            })()}

            {/* Rubber-band */}
            {selectionRect && selectionRect.w > 4 && (
              <div style={{
                position: 'absolute',
                left: selectionRect.x, top: selectionRect.y,
                width: selectionRect.w, height: selectionRect.h,
                border: '2px solid #3b82f6', background: 'rgba(59,130,246,0.08)',
                pointerEvents: 'none', zIndex: 300, borderRadius: 2,
              }} />
            )}
          </div>

          {/* Minimap */}
          <MiniMapa
            areas={areas}
            panX={panX} panY={panY} zoom={zoom}
            containerW={containerSizeRef.current.w}
            containerH={containerSizeRef.current.h}
            onPan={(px, py) => { setPanX(px); setPanY(py); }}
          />

          {/* Connect mode hint */}
          {tool === 'connect' && (
            <div style={{
              position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)',
              background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8,
              padding: '6px 14px', fontSize: 12, color: '#1d4ed8',
              pointerEvents: 'none', zIndex: 100,
            }}>
              {conectOrigen ? 'Haz clic en el box destino' : 'Haz clic en el box origen'} · Esc para cancelar
            </div>
          )}

          {/* Box tool hint */}
          {tool === 'box' && (
            <div style={{
              position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)',
              background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8,
              padding: '6px 14px', fontSize: 12, color: '#16a34a',
              pointerEvents: 'none', zIndex: 100,
            }}>
              Haz clic dentro de un área para crear un box
            </div>
          )}
        </div>
      </div>

      {/* Right panel */}
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
        <GestionEstados estados={estados} onClose={() => setShowGestionEstados(false)} onAdd={addEstado} onUpdate={updateEstado} onDelete={removeEstado} />
      )}

      {showNuevaArea && (
        <ModalNuevaArea
          onClose={() => setShowNuevaArea(false)}
          onAdd={(nombre, color, w, h) => addArea({ nombre, color, width: w, height: h, x: 50, y: 50 })}
        />
      )}
    </div>
  );
}
