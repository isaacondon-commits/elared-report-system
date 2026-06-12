import { Eye, Pencil, Search, Plus, Minus, RotateCcw, RotateCw, Link, Palette } from 'lucide-react';

interface Props {
  editMode: boolean;
  onToggleEdit: () => void;
  searchTerm: string;
  onSearch: (v: string) => void;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  historyLen: number;
  futureLen: number;
  onUndo: () => void;
  onRedo: () => void;
  conectMode: boolean;
  onToggleConect: () => void;
  onNuevaArea: () => void;
  onGestionEstados: () => void;
  kpis: { areas: number; boxes: number; vendedores: number };
  savedIndicator: boolean;
}

const SEP = <div style={{ width: 1, height: 24, background: '#e5e7eb', flexShrink: 0 }} />;

export default function ToolbarPlano({
  editMode, onToggleEdit,
  searchTerm, onSearch,
  zoom, onZoomIn, onZoomOut, onZoomReset,
  historyLen, futureLen, onUndo, onRedo,
  conectMode, onToggleConect,
  onNuevaArea, onGestionEstados,
  kpis, savedIndicator,
}: Props) {
  const btnBase: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 5,
    padding: '4px 10px', border: '1px solid #e5e7eb',
    borderRadius: 6, fontSize: 12, cursor: 'pointer',
    background: '#fff', color: '#374151', flexShrink: 0,
    whiteSpace: 'nowrap',
  };
  const btnActive: React.CSSProperties = { ...btnBase, background: '#fef3c7', color: '#92400e', borderColor: '#fde68a', fontWeight: 600 };
  const btnPrimary: React.CSSProperties = { ...btnBase, background: '#003DA5', color: '#fff', borderColor: '#003DA5' };
  const btnIcon: React.CSSProperties = { ...btnBase, padding: '4px 7px', gap: 0 };
  const btnDisabled: React.CSSProperties = { ...btnIcon, opacity: 0.35, cursor: 'not-allowed' };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 16px', height: 44, borderBottom: '1px solid #e5e7eb', background: '#fff', flexShrink: 0, overflowX: 'auto' }}>

      {/* Modo */}
      <button onClick={onToggleEdit} style={editMode ? btnActive : btnBase}>
        {editMode ? <Pencil size={13} /> : <Eye size={13} />}
        {editMode ? 'Edición' : 'Vista'}
      </button>

      {SEP}

      {/* Buscar */}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <Search size={12} style={{ position: 'absolute', left: 7, color: '#9ca3af', pointerEvents: 'none' }} />
        <input
          value={searchTerm}
          onChange={e => onSearch(e.target.value)}
          placeholder="Buscar vendedor..."
          style={{ paddingLeft: 24, paddingRight: 8, paddingTop: 4, paddingBottom: 4, border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 12, width: 148, outline: 'none', background: '#fafafa' }}
        />
      </div>

      {SEP}

      {/* Acciones edición */}
      {editMode && (
        <>
          <button onClick={onNuevaArea} style={btnPrimary}>
            <Plus size={13} /> Área
          </button>
          <button
            onClick={onToggleConect}
            style={conectMode ? { ...btnBase, background: '#eff6ff', color: '#1d4ed8', borderColor: '#bfdbfe', fontWeight: 600 } : btnBase}
            title="Modo conectar: clic en box origen → clic en box destino"
          >
            <Link size={13} /> Conector
          </button>
          <button onClick={onGestionEstados} style={btnBase}>
            <Palette size={13} /> Estados
          </button>

          {SEP}

          {/* Undo/Redo */}
          <button onClick={onUndo} disabled={historyLen === 0} style={historyLen === 0 ? btnDisabled : btnIcon} title="Deshacer (Ctrl+Z)">
            <RotateCcw size={14} />
          </button>
          <button onClick={onRedo} disabled={futureLen === 0} style={futureLen === 0 ? btnDisabled : btnIcon} title="Rehacer (Ctrl+Y)">
            <RotateCw size={14} />
          </button>

          {SEP}
        </>
      )}

      {/* Zoom */}
      <button onClick={onZoomOut} style={btnIcon} title="Alejar (Ctrl+scroll)"><Minus size={13} /></button>
      <button onClick={onZoomReset} style={{ ...btnBase, minWidth: 52, justifyContent: 'center', fontVariantNumeric: 'tabular-nums', fontSize: 12 }} title="Restablecer zoom">
        {Math.round(zoom * 100)}%
      </button>
      <button onClick={onZoomIn} style={btnIcon} title="Acercar (Ctrl+scroll)"><Plus size={13} /></button>

      {/* KPIs + guardado */}
      <div style={{ flex: 1 }} />
      {savedIndicator && <span style={{ fontSize: 11, color: '#16a34a', fontWeight: 500, flexShrink: 0 }}>💾 Guardado</span>}
      <span style={{ fontSize: 11, color: '#9ca3af', whiteSpace: 'nowrap' }}>
        {kpis.areas} área{kpis.areas !== 1 ? 's' : ''} · {kpis.boxes} box{kpis.boxes !== 1 ? 'es' : ''} · {kpis.vendedores} asignado{kpis.vendedores !== 1 ? 's' : ''}
      </span>
    </div>
  );
}
