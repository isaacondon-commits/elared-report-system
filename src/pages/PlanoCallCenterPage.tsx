import { useState, useMemo, useEffect, useRef } from 'react';
import { LayoutGrid } from 'lucide-react';
import Header from '../components/Header';
import AreaPisoComp, { AREA_HEADER_H } from '../components/plano/AreaPiso';
import FichaVendedor from '../components/plano/FichaVendedor';
import GestionEstados from '../components/plano/GestionEstados';
import ConectorLayer from '../components/plano/ConectorLayer';
import MiniMapa from '../components/plano/MiniMapa';
import ToolbarPlano from '../components/plano/ToolbarPlano';
import { usePlanoStore } from '../store/planoStore';
import type { BoxPiso, AreaPiso } from '../store/planoStore';

const CANVAS_W = 3200;
const CANVAS_H = 2400;
const ZOOM_MIN = 0.25;
const ZOOM_MAX = 2;
const ZOOM_STEP = 0.1;

// ── Modal nueva área ───────────────────────────────────────────────────────────

function ModalNuevaArea({ onClose, onAdd }: { onClose: () => void; onAdd: (nombre: string, color: string, w: number, h: number) => void }) {
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
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 12, width: 380, padding: '24px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }} onClick={e => e.stopPropagation()}>
        <div style={{ fontWeight: 700, fontSize: 16, color: '#111827', marginBottom: 20 }}>Nueva Área</div>

        <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Nombre *</label>
        <input value={nombre} onChange={e => setNombre(e.target.value)} autoFocus placeholder="Ej: Piso Principal..."
          style={{ width: '100%', border: '1px solid #e5e7eb', borderRadius: 6, padding: '8px 10px', fontSize: 13, marginBottom: 14, boxSizing: 'border-box' }} />

        <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}>Color</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <input type="color" value={color} onChange={e => setColor(e.target.value)} style={{ width: 40, height: 36, border: 'none', cursor: 'pointer', borderRadius: 6, padding: 2 }} />
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
          <button onClick={handleAdd} disabled={!nombre.trim()} style={{ flex: 2, padding: '9px', border: 'none', borderRadius: 8, background: nombre.trim() ? '#003DA5' : '#e5e7eb', color: nombre.trim() ? '#fff' : '#9ca3af', fontSize: 13, fontWeight: 600, cursor: nombre.trim() ? 'pointer' : 'not-allowed' }}>
            Crear Área
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────

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

// ── Página principal ───────────────────────────────────────────────────────────

export default function PlanoCallCenterPage() {
  const {
    areas, estados, conectores, savedAt, historyLen, futureLen,
    pushHistory, undo, redo,
    addArea, updateArea, removeArea, addBox, updateBox, updateBoxes, removeBoxes, addBoxes,
    addEstado, updateEstado, removeEstado,
    addConector, updateConector, removeConector,
  } = usePlanoStore();

  // ── View state ──
  const [editMode, setEditMode] = useState(() => { try { return localStorage.getItem('elared_plano_editmode') === 'true'; } catch { return false; } });
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
  const [conectMode, setConectMode] = useState(false);
  const [conectOrigen, setConectOrigen] = useState<string | null>(null);
  const [selectedConector, setSelectedConector] = useState<string | null>(null);

  // ── Clipboard ──
  const [clipboard, setClipboard] = useState<{ areaId: string; box: BoxPiso }[] | null>(null);

  // ── Modals ──
  const [showGestionEstados, setShowGestionEstados] = useState(false);
  const [showNuevaArea, setShowNuevaArea] = useState(false);

  // ── Refs for mouse state (avoid re-renders on every mousemove) ──
  const containerRef = useRef<HTMLDivElement>(null);
  const panningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0, px: 0, py: 0 });
  const selStartRef = useRef<{ cx: number; cy: number } | null>(null);
  const dragRef = useRef<{ boxes: { boxId: string; areaId: string; origX: number; origY: number }[]; startCX: number; startCY: number } | null>(null);
  const containerSizeRef = useRef({ w: 800, h: 600 });

  // ── Persist edit mode ──
  useEffect(() => { try { localStorage.setItem('elared_plano_editmode', String(editMode)); } catch {} }, [editMode]);

  // ── savedAt indicator ──
  useEffect(() => {
    if (!savedAt) return;
    setSavedIndicator(true);
    const t = setTimeout(() => setSavedIndicator(false), 1500);
    return () => clearTimeout(t);
  }, [savedAt]);

  // ── Track container size ──
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

  // ── Coordinate helpers ──
  function screenToCanvas(sx: number, sy: number) {
    const rect = containerRef.current!.getBoundingClientRect();
    return { x: (sx - rect.left - panX) / zoom, y: (sy - rect.top - panY) / zoom };
  }

  // ── Wheel handler ──
  function handleWheel(e: React.WheelEvent) {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      const rect = containerRef.current!.getBoundingClientRect();
      const fx = e.clientX - rect.left;
      const fy = e.clientY - rect.top;
      const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
      const newZoom = clampZoom(zoom + delta);
      setPanX(px => px + (fx - px) * (1 - newZoom / zoom));
      setPanY(py => py + (fy - py) * (1 - newZoom / zoom));
      setZoom(newZoom);
    } else {
      setPanX(px => px - e.deltaX);
      setPanY(py => py - e.deltaY);
    }
  }

  // ── Mouse events on container ──
  function handleContainerMouseDown(e: React.MouseEvent) {
    // Middle button or left in view mode → pan
    if (e.button === 1 || (!editMode && e.button === 0)) {
      panningRef.current = true;
      panStartRef.current = { x: e.clientX, y: e.clientY, px: panX, py: panY };
      return;
    }
    // Edit mode, left button → rubber-band selection
    if (editMode && e.button === 0) {
      const canvasPos = screenToCanvas(e.clientX, e.clientY);
      selStartRef.current = { cx: canvasPos.x, cy: canvasPos.y };
      setSelectionRect({ x: canvasPos.x, y: canvasPos.y, w: 0, h: 0 });
    }
  }

  function handleContainerMouseMove(e: React.MouseEvent) {
    if (panningRef.current) {
      setPanX(panStartRef.current.px + e.clientX - panStartRef.current.x);
      setPanY(panStartRef.current.py + e.clientY - panStartRef.current.y);
      return;
    }

    if (dragRef.current) {
      const canvasPos = screenToCanvas(e.clientX, e.clientY);
      const dx = canvasPos.x - dragRef.current.startCX;
      const dy = canvasPos.y - dragRef.current.startCY;
      const newOffsets = new Map<string, { dx: number; dy: number }>();
      for (const b of dragRef.current.boxes) newOffsets.set(b.boxId, { dx, dy });
      setDragOffsets(newOffsets);
      return;
    }

    if (selStartRef.current) {
      const canvasPos = screenToCanvas(e.clientX, e.clientY);
      const sx = selStartRef.current.cx;
      const sy = selStartRef.current.cy;
      setSelectionRect({
        x: Math.min(sx, canvasPos.x),
        y: Math.min(sy, canvasPos.y),
        w: Math.abs(canvasPos.x - sx),
        h: Math.abs(canvasPos.y - sy),
      });
    }
  }

  function handleContainerMouseUp(e: React.MouseEvent) {
    // End pan
    if (panningRef.current) { panningRef.current = false; return; }

    // End drag
    if (dragRef.current) {
      const canvasPos = screenToCanvas(e.clientX, e.clientY);
      const dx = canvasPos.x - dragRef.current.startCX;
      const dy = canvasPos.y - dragRef.current.startCY;
      if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
        pushHistory();
        const updates = dragRef.current.boxes.map(b => ({
          areaId: b.areaId,
          boxId: b.boxId,
          patch: { x: Math.max(0, b.origX + dx), y: Math.max(0, b.origY + dy) },
        }));
        updateBoxes(updates);
      }
      dragRef.current = null;
      setDragOffsets(new Map());
      return;
    }

    // End rubber-band selection
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
      } else if (selectionRect.w <= 4 && selectionRect.h <= 4) {
        // Click on empty space → deselect
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
      // Commit drag on leave
      const updates = dragRef.current.boxes.map(b => ({
        areaId: b.areaId, boxId: b.boxId,
        patch: { x: Math.max(0, b.origX + (dragOffsets.get(b.boxId)?.dx ?? 0)), y: Math.max(0, b.origY + (dragOffsets.get(b.boxId)?.dy ?? 0)) },
      }));
      if (updates.some(u => (u.patch.x !== 0 || u.patch.y !== 0))) {
        pushHistory();
        updateBoxes(updates);
      }
      dragRef.current = null;
      setDragOffsets(new Map());
    }
    if (selStartRef.current) { selStartRef.current = null; setSelectionRect(null); }
  }

  // ── Box interaction ──
  function handleBoxMouseDown(boxId: string, areaId: string, e: React.MouseEvent) {
    if (!editMode) return;
    e.stopPropagation();
    selStartRef.current = null;
    setSelectionRect(null);

    // Connect mode
    if (conectMode) {
      if (!conectOrigen) {
        setConectOrigen(boxId);
      } else if (conectOrigen !== boxId) {
        addConector({ origenId: conectOrigen, destinoId: boxId, tipo: 'flecha', color: '#4A4A6A' });
        setConectOrigen(null);
        setConectMode(false);
      }
      return;
    }

    // Shift-click: toggle selection
    if (e.shiftKey) {
      setMultiSelected(prev => {
        const next = new Set(prev);
        if (next.has(boxId)) next.delete(boxId); else next.add(boxId);
        return next;
      });
      return;
    }

    // Determine which boxes to drag
    let toDrag: { boxId: string; areaId: string; origX: number; origY: number }[];
    if (multiSelected.has(boxId) && multiSelected.size > 1) {
      toDrag = [...multiSelected].map(bid => {
        const found = findBoxGlobal(areas, bid);
        return found ? { boxId: bid, areaId: found.area.id, origX: found.box.x, origY: found.box.y } : null;
      }).filter(Boolean) as { boxId: string; areaId: string; origX: number; origY: number }[];
    } else {
      const found = findBoxGlobal(areas, boxId);
      toDrag = found ? [{ boxId, areaId, origX: found.box.x, origY: found.box.y }] : [];
      setMultiSelected(new Set([boxId]));
    }

    const canvasPos = screenToCanvas(e.clientX, e.clientY);
    dragRef.current = { boxes: toDrag, startCX: canvasPos.x, startCY: canvasPos.y };
  }

  function handleBoxClick(boxId: string, areaId: string, e: React.MouseEvent) {
    if (dragRef.current) return; // was dragging
    if (e.shiftKey) return;
    if (conectMode) return; // handled in mousedown
    setSelectedBox({ areaId, boxId });
  }

  // ── Keyboard shortcuts ──
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;

      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return; }
        if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) { e.preventDefault(); redo(); return; }
        if (e.key === 'c' && editMode && multiSelected.size > 0) {
          e.preventDefault();
          const items = [...multiSelected].map(bid => {
            const found = findBoxGlobal(areas, bid);
            return found ? { areaId: found.area.id, box: { ...found.box } } : null;
          }).filter(Boolean) as { areaId: string; box: BoxPiso }[];
          setClipboard(items);
          return;
        }
        if (e.key === 'v' && editMode && clipboard) {
          e.preventDefault();
          const newItems = addBoxes(clipboard.map(i => ({ areaId: i.areaId, box: { ...i.box, x: i.box.x + 20, y: i.box.y + 20 } })));
          setMultiSelected(new Set(newItems));
          return;
        }
        if (e.key === 'a' && editMode) {
          e.preventDefault();
          const all = areas.flatMap(a => a.boxes.map(b => b.id));
          setMultiSelected(new Set(all));
          return;
        }
      }

      if (e.key === 'Escape') {
        setMultiSelected(new Set());
        setSelectedBox(null);
        setConectMode(false);
        setConectOrigen(null);
        setSelectedConector(null);
        return;
      }

      if ((e.key === 'Delete' || e.key === 'Backspace') && editMode && multiSelected.size > 0) {
        e.preventDefault();
        const withVendedor = [...multiSelected].filter(bid => findBoxGlobal(areas, bid)?.box.vendedor);
        if (withVendedor.length > 0 && !confirm(`¿Eliminar ${multiSelected.size} box${multiSelected.size > 1 ? 'es' : ''}? ${withVendedor.length} tienen vendedor asignado.`)) return;
        removeBoxes([...multiSelected].map(bid => { const f = findBoxGlobal(areas, bid); return f ? { areaId: f.area.id, boxId: bid } : null; }).filter(Boolean) as { areaId: string; boxId: string }[]);
        setMultiSelected(new Set());
        setSelectedBox(null);
        return;
      }

      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && editMode && multiSelected.size > 0) {
        e.preventDefault();
        const d = e.shiftKey ? 10 : 1;
        const dx = e.key === 'ArrowLeft' ? -d : e.key === 'ArrowRight' ? d : 0;
        const dy = e.key === 'ArrowUp' ? -d : e.key === 'ArrowDown' ? d : 0;
        updateBoxes([...multiSelected].map(bid => {
          const f = findBoxGlobal(areas, bid);
          return f ? { areaId: f.area.id, boxId: bid, patch: { x: Math.max(0, f.box.x + dx), y: Math.max(0, f.box.y + dy) } } : null;
        }).filter(Boolean) as { areaId: string; boxId: string; patch: Partial<BoxPiso> }[]);
      }
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [editMode, multiSelected, areas, clipboard, undo, redo, addBoxes, removeBoxes, updateBoxes]);

  // ── Search auto-scroll + highlight ──
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

  // ── Derived data ──
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
  const cursor = conectMode ? 'crosshair'
    : panningRef.current ? 'grabbing'
    : selStartRef.current ? 'crosshair'
    : !editMode ? 'grab'
    : 'default';

  // ── Zoom controls ──
  function zoomIn() { const n = clampZoom(zoom + ZOOM_STEP); const { w, h } = containerSizeRef.current; setPanX(px => px + (w / 2 - px) * (1 - n / zoom)); setPanY(py => py + (h / 2 - py) * (1 - n / zoom)); setZoom(n); }
  function zoomOut() { const n = clampZoom(zoom - ZOOM_STEP); const { w, h } = containerSizeRef.current; setPanX(px => px + (w / 2 - px) * (1 - n / zoom)); setPanY(py => py + (h / 2 - py) * (1 - n / zoom)); setZoom(n); }
  function zoomReset() { setZoom(1); setPanX(40); setPanY(40); }

  function handleAddBox(areaId: string) {
    const area = areas.find(a => a.id === areaId);
    if (!area) return;
    const newBox: Omit<BoxPiso, 'id'> = { x: 20, y: 40, width: 90, height: 90, estadoId: 'libre', vendedor: null, label: `B-${area.boxes.length + 1}` };
    addBox(areaId, newBox);
  }

  return (
    <div className="flex flex-col h-full" style={{ overflow: 'hidden' }}>
      <Header
        title="Plano del Call Center"
        subtitle={`${kpis.areas} área${kpis.areas !== 1 ? 's' : ''} · ${kpis.boxes} box${kpis.boxes !== 1 ? 'es' : ''}`}
      />

      <ToolbarPlano
        editMode={editMode}
        onToggleEdit={() => setEditMode(v => !v)}
        searchTerm={searchTerm}
        onSearch={setSearchTerm}
        zoom={zoom}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onZoomReset={zoomReset}
        historyLen={historyLen}
        futureLen={futureLen}
        onUndo={undo}
        onRedo={redo}
        conectMode={conectMode}
        onToggleConect={() => { setConectMode(v => !v); setConectOrigen(null); }}
        onNuevaArea={() => setShowNuevaArea(true)}
        onGestionEstados={() => setShowGestionEstados(true)}
        kpis={kpis}
        savedIndicator={savedIndicator}
      />

      {/* Main canvas area */}
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
        <div
          style={{
            position: 'absolute', top: 0, left: 0,
            width: CANVAS_W, height: CANVAS_H,
            transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
            transformOrigin: '0 0',
            backgroundColor: '#F5F7FA',
            backgroundImage: 'radial-gradient(circle, #c8d3e0 1px, transparent 1px)',
            backgroundSize: '20px 20px',
          }}
        >
          {/* Connectors SVG layer */}
          <ConectorLayer
            areas={areas}
            conectores={conectores}
            editMode={editMode}
            selectedId={selectedConector}
            onSelect={setSelectedConector}
            onDelete={removeConector}
            onUpdate={updateConector}
          />

          {/* Areas + boxes */}
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
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', color: '#9ca3af' }}>
              <LayoutGrid size={48} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
              <div style={{ fontSize: 16, fontWeight: 600 }}>Sin áreas</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>Crea una nueva área para empezar</div>
            </div>
          )}

          {/* Connect mode: highlight origen */}
          {conectMode && conectOrigen && (() => {
            const found = findBoxGlobal(areas, conectOrigen);
            if (!found) return null;
            return (
              <div style={{
                position: 'absolute',
                left: found.area.x + found.box.x - 4,
                top: found.area.y + AREA_HEADER_H + found.box.y - 4,
                width: found.box.width + 8,
                height: found.box.height + 8,
                border: '3px solid #003DA5',
                borderRadius: 8,
                animation: 'pulse 1.5s ease-in-out infinite',
                pointerEvents: 'none',
                zIndex: 200,
              }} />
            );
          })()}

          {/* Rubber-band selection rect */}
          {selectionRect && selectionRect.w > 4 && (
            <div style={{
              position: 'absolute',
              left: selectionRect.x, top: selectionRect.y,
              width: selectionRect.w, height: selectionRect.h,
              border: '2px solid #3b82f6',
              background: 'rgba(59,130,246,0.08)',
              pointerEvents: 'none',
              zIndex: 300,
              borderRadius: 2,
            }} />
          )}
        </div>

        {/* Mini-map */}
        <MiniMapa
          areas={areas}
          panX={panX}
          panY={panY}
          zoom={zoom}
          containerW={containerSizeRef.current.w}
          containerH={containerSizeRef.current.h}
          onPan={(px, py) => { setPanX(px); setPanY(py); }}
        />

        {/* Zoom controls (bottom right) */}
        <div style={{ position: 'absolute', bottom: 12, right: 12, display: 'flex', flexDirection: 'column', gap: 4, zIndex: 100 }}>
          <button onClick={zoomIn} style={{ width: 32, height: 32, border: '1px solid #e5e7eb', borderRadius: 6, background: '#fff', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }}>+</button>
          <button onClick={zoomReset} style={{ width: 32, height: 18, border: '1px solid #e5e7eb', borderRadius: 4, background: '#fff', fontSize: 9, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.1)', fontVariantNumeric: 'tabular-nums', color: '#374151' }}>{Math.round(zoom * 100)}%</button>
          <button onClick={zoomOut} style={{ width: 32, height: 32, border: '1px solid #e5e7eb', borderRadius: 6, background: '#fff', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }}>−</button>
        </div>

        {/* Connect mode hint */}
        {conectMode && (
          <div style={{ position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '6px 14px', fontSize: 12, color: '#1d4ed8', pointerEvents: 'none', zIndex: 100 }}>
            {conectOrigen ? 'Ahora haz clic en el box destino' : 'Haz clic en el box origen'} · Esc para cancelar
          </div>
        )}
      </div>

      {/* Right panel: Ficha vendedor */}
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
        <ModalNuevaArea onClose={() => setShowNuevaArea(false)} onAdd={(nombre, color, w, h) => addArea({ nombre, color, width: w, height: h, x: 50, y: 50 })} />
      )}
    </div>
  );
}

// Helper: filter multiSelected to only boxes in this area
function multiSelectedIds_forArea(multiSelected: Set<string>, area: AreaPiso): Set<string> {
  const areaBoxIds = new Set(area.boxes.map(b => b.id));
  return new Set([...multiSelected].filter(id => areaBoxIds.has(id)));
}
