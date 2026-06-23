import { useMemo } from 'react';
import { X } from 'lucide-react';

export interface FiltroState {
  desde: string | null;
  hasta: string | null;
  label: string | null;
}

interface Props {
  filtro: FiltroState;
  onChange: (f: FiltroState) => void;
  mesSeleccionado: string | null;
  onMesChange: (mes: string) => void;
  mesesDisponibles: string[];
  totalVentas: number;
  totalSinFiltro: number;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function calcularRangos(mes: string) {
  const [year, monthStr] = mes.split('-');
  const y = Number(year);
  const m = Number(monthStr);
  const lastDay = new Date(y, m, 0).getDate();
  const d = (day: number) => `${year}-${monthStr}-${pad2(day)}`;
  return {
    semana1:   { desde: d(1),  hasta: d(7) },
    semana2:   { desde: d(8),  hasta: d(14) },
    semana3:   { desde: d(15), hasta: d(21) },
    semana4:   { desde: d(22), hasta: d(lastDay) },
    quincena1: { desde: d(1),  hasta: d(15) },
    quincena2: { desde: d(16), hasta: d(lastDay) },
    esteMes:   { desde: d(1),  hasta: d(lastDay) },
  };
}

function getSemanaActual(): { desde: string; hasta: string } {
  const hoy = new Date();
  const dia = hoy.getDay();
  const diff = dia === 0 ? -6 : 1 - dia;
  const lunes = new Date(hoy);
  lunes.setDate(hoy.getDate() + diff);
  const domingo = new Date(lunes);
  domingo.setDate(lunes.getDate() + 6);
  return {
    desde: lunes.toISOString().split('T')[0],
    hasta: domingo.toISOString().split('T')[0],
  };
}

function formatMes(mes: string): string {
  const [year, month] = mes.split('-').map(Number);
  const nombres = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                   'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  return `${nombres[month - 1]} ${year}`;
}

function formatFechaCorta(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

type PillDef = { label: string; rango: { desde: string; hasta: string } | null };

const SEP = (
  <div style={{ width: 1, height: 24, background: '#E2E8F0', flexShrink: 0, alignSelf: 'center' }} />
);

export default function FiltroPeriodo({
  filtro,
  onChange,
  mesSeleccionado,
  onMesChange,
  mesesDisponibles,
  totalVentas,
  totalSinFiltro,
}: Props) {
  const rangos = useMemo(
    () => (mesSeleccionado ? calcularRangos(mesSeleccionado) : null),
    [mesSeleccionado],
  );

  const pills: PillDef[] = useMemo(() => {
    const semAct = getSemanaActual();
    return [
      { label: 'Todo',         rango: null },
      { label: 'Esta semana',  rango: semAct },
      { label: 'Semana 1',     rango: rangos?.semana1   ?? null },
      { label: 'Semana 2',     rango: rangos?.semana2   ?? null },
      { label: 'Semana 3',     rango: rangos?.semana3   ?? null },
      { label: 'Semana 4',     rango: rangos?.semana4   ?? null },
      { label: '1ra quincena', rango: rangos?.quincena1 ?? null },
      { label: '2da quincena', rango: rangos?.quincena2 ?? null },
      { label: 'Este mes',     rango: rangos?.esteMes   ?? null },
    ];
  }, [rangos]);

  const isActive = (pill: PillDef) => {
    if (pill.label === 'Todo') return filtro.desde === null;
    return filtro.label === pill.label;
  };

  const hayFiltro = filtro.desde !== null && filtro.hasta !== null;

  const handlePill = (pill: PillDef) => {
    if (pill.label === 'Todo') {
      onChange({ desde: null, hasta: null, label: null });
    } else if (pill.rango) {
      onChange({ desde: pill.rango.desde, hasta: pill.rango.hasta, label: pill.label });
    }
  };

  const handleDesde = (val: string) => {
    if (!val) { onChange({ desde: null, hasta: filtro.hasta, label: null }); return; }
    const newHasta = filtro.hasta && filtro.hasta >= val ? filtro.hasta : val;
    onChange({ desde: val, hasta: newHasta, label: null });
  };

  const handleHasta = (val: string) => {
    onChange({ desde: filtro.desde, hasta: val || null, label: null });
  };

  const counterText = hayFiltro
    ? `Mostrando ${totalVentas.toLocaleString()} de ${totalSinFiltro.toLocaleString()} ventas · ${formatFechaCorta(filtro.desde!)} – ${formatFechaCorta(filtro.hasta!)}`
    : `${totalVentas.toLocaleString()} ventas`;

  return (
    <div style={{
      background: '#fff',
      border: '1px solid #E2E8F0',
      borderRadius: 8,
      padding: '10px 16px',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      flexWrap: 'wrap',
    }}>
      {/* Label */}
      <span style={{ color: '#718096', fontSize: 13, whiteSpace: 'nowrap', flexShrink: 0 }}>
        Período:
      </span>

      {/* Month selector — only when multi-month data */}
      {mesesDisponibles.length > 1 && (
        <select
          value={mesSeleccionado ?? ''}
          onChange={e => onMesChange(e.target.value)}
          style={{
            fontSize: 12, border: '1px solid #E2E8F0', borderRadius: 6,
            padding: '3px 8px', background: '#F5F7FA', color: '#4A4A6A',
            cursor: 'pointer', flexShrink: 0,
          }}
        >
          {mesesDisponibles.map(m => (
            <option key={m} value={m}>{formatMes(m)}</option>
          ))}
        </select>
      )}

      {/* Pills */}
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', flex: '1 1 0', minWidth: 0 }}>
        {pills.map(pill => {
          const active = isActive(pill);
          const disabled = pill.label !== 'Todo' && pill.label !== 'Esta semana' && !rangos;
          return (
            <button
              key={pill.label}
              onClick={() => handlePill(pill)}
              disabled={disabled}
              style={{
                padding: '3px 10px',
                borderRadius: 20,
                fontSize: 12,
                border: `1px solid ${active ? '#003DA5' : '#E2E8F0'}`,
                background: active ? '#003DA5' : '#F5F7FA',
                color: active ? '#fff' : '#4A4A6A',
                cursor: disabled ? 'default' : 'pointer',
                opacity: disabled ? 0.4 : 1,
                whiteSpace: 'nowrap',
                transition: 'all 0.15s',
                fontWeight: active ? 600 : 400,
              }}
              onMouseEnter={e => {
                if (!active && !disabled)
                  (e.currentTarget as HTMLButtonElement).style.background = '#E8F0FE';
              }}
              onMouseLeave={e => {
                if (!active && !disabled)
                  (e.currentTarget as HTMLButtonElement).style.background = '#F5F7FA';
              }}
            >
              {pill.label}
            </button>
          );
        })}
      </div>

      {SEP}

      {/* Date range inputs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, color: '#718096' }}>Desde:</span>
        <input
          type="date"
          value={filtro.desde ?? ''}
          max={filtro.hasta ?? undefined}
          onChange={e => handleDesde(e.target.value)}
          style={{
            fontSize: 12, border: '1px solid #E2E8F0', borderRadius: 6,
            padding: '3px 6px', background: '#F5F7FA', color: '#4A4A6A',
          }}
        />
        <span style={{ fontSize: 12, color: '#A0AEC0' }}>→</span>
        <span style={{ fontSize: 12, color: '#718096' }}>Hasta:</span>
        <input
          type="date"
          value={filtro.hasta ?? ''}
          min={filtro.desde ?? undefined}
          onChange={e => handleHasta(e.target.value)}
          style={{
            fontSize: 12, border: '1px solid #E2E8F0', borderRadius: 6,
            padding: '3px 6px', background: '#F5F7FA', color: '#4A4A6A',
          }}
        />
      </div>

      {SEP}

      {/* Counter */}
      <span style={{ fontSize: 12, color: '#A0AEC0', whiteSpace: 'nowrap', flexShrink: 0 }}>
        {counterText}
      </span>

      {/* Clear button — only when filter is active */}
      {hayFiltro && (
        <button
          onClick={() => onChange({ desde: null, hasta: null, label: null })}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            fontSize: 12, color: '#E3000F', background: 'none',
            border: '1px solid #E3000F', borderRadius: 6,
            padding: '3px 10px', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
          }}
        >
          <X size={12} /> Limpiar
        </button>
      )}
    </div>
  );
}
