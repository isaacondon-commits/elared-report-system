import { useState, useMemo, useRef } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, EyeOff } from 'lucide-react';
import type { VentasStats, FuncionarioStat } from './VentasModule';
import { getEquivalente, getEquivalenteColor } from '../../utils/smartParser';
import { abreviarPlan } from './VentasCharts';

const PAGE_SIZE = 10;

const RANK_BADGES = [
  { bg: '#FFD700', text: '#7a5800', emoji: '🥇' },
  { bg: '#C0C0C0', text: '#4a4a4a', emoji: '🥈' },
  { bg: '#CD7F32', text: '#5c3200', emoji: '🥉' },
];

type SortCol = 'rank' | 'nombre' | 'total' | 'renovaciones' | 'altas' | 'cambios' | 'pctRechazo' | 'diasActivos';

function formatFecha(iso: string): string {
  if (!iso) return '';
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

function pctRechazoColor(pct: number): string {
  if (pct < 5)  return '#28a745';
  if (pct <= 15) return '#fd7e14';
  return '#E3000F';
}

function getEstadoPrincipal(estadosRaw: Record<string, number>): string | null {
  const entries = Object.entries(estadosRaw).filter(([, v]) => v > 0);
  if (!entries.length) return null;
  return entries.sort(([, a], [, b]) => b - a)[0][0];
}

// ── Detail tabs inside expanded row ──────────────────────────────────────────
function DetailTabs({ f, onClose }: { f: FuncionarioStat; onClose: () => void }) {
  const [tab, setTab] = useState<'dia' | 'plan' | 'estado'>('dia');

  const diasData = useMemo(() => {
    return [...f.ventasPorDia].reverse().map(d => {
      const estadosDia = f.estadosRawPorDia[d.fecha] ?? {};
      const byEq: Record<string, number> = {};
      for (const [est, cnt] of Object.entries(estadosDia)) {
        const eq = getEquivalente(est) ?? est;
        byEq[eq] = (byEq[eq] ?? 0) + cnt;
      }
      return { ...d, byEq, hasEstados: Object.keys(estadosDia).length > 0 };
    });
  }, [f.ventasPorDia, f.estadosRawPorDia]);

  const planesData = useMemo(() => {
    return Object.entries(f.ventasPorPlan)
      .sort(([, a], [, b]) => b - a)
      .map(([plan, cnt]) => ({
        plan,
        cantidad: cnt,
        pct: f.total > 0 ? ((cnt / f.total) * 100).toFixed(1) : '0.0',
      }));
  }, [f.ventasPorPlan, f.total]);

  const estadosData = useMemo(() => {
    const totalEst = Object.values(f.estadosRaw).reduce((s, v) => s + v, 0);
    return Object.entries(f.estadosRaw)
      .filter(([, v]) => v > 0)
      .sort(([, a], [, b]) => b - a)
      .map(([est, cnt]) => ({
        estado: est,
        equivalente: getEquivalente(est),
        cantidad: cnt,
        pct: totalEst > 0 ? ((cnt / totalEst) * 100).toFixed(1) : '0.0',
      }));
  }, [f.estadosRaw]);

  const tabBtn = (label: string, key: typeof tab) => (
    <button
      onClick={() => setTab(key)}
      style={{
        padding: '6px 14px', fontSize: 12, cursor: 'pointer',
        fontWeight: tab === key ? 700 : 400,
        color: tab === key ? '#003DA5' : '#6c757d',
        background: 'none', border: 'none',
        borderBottom: tab === key ? '2px solid #003DA5' : '2px solid transparent',
      }}
    >
      {label}
    </button>
  );

  const thStyle: React.CSSProperties = {
    padding: '6px 10px', fontWeight: 600, fontSize: 11,
    color: '#475569', textAlign: 'left', background: '#e2e8f0',
  };
  const tdStyle: React.CSSProperties = { padding: '5px 10px', fontSize: 12 };
  const trStyle = (i: number): React.CSSProperties => ({
    background: i % 2 === 0 ? '#fff' : '#f1f5f9',
    borderTop: '1px solid #e9ecef',
  });

  return (
    <div style={{
      padding: '12px 20px 16px', background: '#f8fafc',
      borderTop: '1px solid #e2e8f0',
    }}>
      <div style={{ display: 'flex', gap: 0, marginBottom: 12, borderBottom: '1px solid #e2e8f0' }}>
        {tabBtn('Por Día', 'dia')}
        {planesData.length > 0 && tabBtn('Por Plan', 'plan')}
        {estadosData.length > 0 && tabBtn('Por Estado', 'estado')}
      </div>

      {/* Tab: Por Día */}
      {tab === 'dia' && (
        <div className="overflow-x-auto">
          {diasData.length === 0 ? (
            <p style={{ color: '#9ca3af', fontSize: 12 }}>Sin datos de fechas.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thStyle}>Fecha</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Ventas</th>
                  <th style={thStyle}>Estados</th>
                </tr>
              </thead>
              <tbody>
                {diasData.map((d, i) => (
                  <tr key={d.fecha} style={trStyle(i)}>
                    <td style={{ ...tdStyle, fontFamily: 'monospace', color: '#64748b' }}>{formatFecha(d.fecha)}</td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, color: '#003DA5' }}>{d.ventas}</td>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {Object.entries(d.byEq).sort(([, a], [, b]) => b - a).map(([eq, cnt]) => (
                          <span key={eq} style={{
                            fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 4,
                            background: getEquivalenteColor(eq) + '20',
                            color: getEquivalenteColor(eq),
                            border: `1px solid ${getEquivalenteColor(eq)}60`,
                          }}>
                            {eq}: {cnt}
                          </span>
                        ))}
                        {!d.hasEstados && (
                          <span style={{ color: '#adb5bd', fontSize: 11 }}>Sin estado</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Tab: Por Plan */}
      {tab === 'plan' && (
        <div className="overflow-x-auto">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thStyle}>Plan</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Cantidad</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>% del total</th>
              </tr>
            </thead>
            <tbody>
              {planesData.map((p, i) => (
                <tr key={p.plan} style={trStyle(i)}>
                  <td style={{ ...tdStyle, color: '#374151', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p.plan}>
                    {abreviarPlan(p.plan)}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, color: '#003DA5' }}>{p.cantidad}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', color: '#6c757d' }}>{p.pct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab: Por Estado */}
      {tab === 'estado' && (
        <div className="overflow-x-auto">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thStyle}>Estado</th>
                <th style={thStyle}>Equivalente</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Cantidad</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>%</th>
              </tr>
            </thead>
            <tbody>
              {estadosData.map((e, i) => (
                <tr key={e.estado} style={trStyle(i)}>
                  <td style={{ ...tdStyle, fontWeight: 500, color: '#374151' }}>{e.estado}</td>
                  <td style={tdStyle}>
                    {e.equivalente ? (
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 10,
                        color: '#fff', background: getEquivalenteColor(e.equivalente),
                      }}>
                        {e.equivalente}
                      </span>
                    ) : <span style={{ color: '#adb5bd', fontSize: 11 }}>—</span>}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, color: '#003DA5' }}>{e.cantidad}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', color: '#6c757d' }}>{e.pct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <button
        onClick={onClose}
        style={{
          marginTop: 12, fontSize: 12, color: '#6c757d', background: 'none',
          border: '1px solid #dee2e6', borderRadius: 6, padding: '4px 12px', cursor: 'pointer',
        }}
      >
        Cerrar ▴
      </button>
    </div>
  );
}

// ── Tabla maestra ─────────────────────────────────────────────────────────────
interface Props {
  stats: VentasStats;
  onHideVendedor?: (nombre: string) => void;
}

function getPageNums(current: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i);
  if (current < 4) {
    const nums: (number | '…')[] = Array.from({ length: Math.min(5, total) }, (_, i) => i);
    if (total > 5) { nums.push('…'); nums.push(total - 1); }
    return nums;
  }
  if (current > total - 5) {
    const nums: (number | '…')[] = [0, '…'];
    for (let i = Math.max(0, total - 5); i < total; i++) nums.push(i);
    return nums;
  }
  return [0, '…', current - 1, current, current + 1, '…', total - 1];
}

export default function VentasPerformanceTable({ stats, onHideVendedor }: Props) {
  const [page, setPage]             = useState(0);
  const [expandedNombre, setExpanded] = useState<string | null>(null);
  const [sortCol, setSortCol]       = useState<SortCol>('rank');
  const [sortDir, setSortDir]       = useState<'asc' | 'desc'>('asc');
  const [hovered, setHovered]       = useState<string | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  const [lastEmpresa, setLastEmpresa] = useState(stats.empresaActiva);
  if (stats.empresaActiva !== lastEmpresa) {
    setLastEmpresa(stats.empresaActiva);
    setPage(0);
    setExpanded(null);
  }

  function goToPage(p: number) {
    setPage(p);
    setTimeout(() => tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  }

  const sortedRows = useMemo(() => {
    const withRank = stats.byFuncionario.map((f, i) => ({
      ...f,
      rank: i,
      pctRechazo: f.total > 0 ? (f.rechazos / f.total) * 100 : 0,
    }));

    if (sortCol === 'rank') return sortDir === 'asc' ? withRank : [...withRank].reverse();

    return [...withRank].sort((a, b) => {
      let va: number | string = 0, vb: number | string = 0;
      if (sortCol === 'nombre')       { va = a.nombre; vb = b.nombre; }
      else if (sortCol === 'total')       { va = a.total; vb = b.total; }
      else if (sortCol === 'renovaciones') { va = a.renovaciones; vb = b.renovaciones; }
      else if (sortCol === 'altas')        { va = a.altas; vb = b.altas; }
      else if (sortCol === 'cambios')      { va = a.cambios; vb = b.cambios; }
      else if (sortCol === 'pctRechazo')   { va = a.pctRechazo; vb = b.pctRechazo; }
      else if (sortCol === 'diasActivos')  { va = a.diasActivos; vb = b.diasActivos; }
      if (typeof va === 'string') return sortDir === 'asc' ? va.localeCompare(vb as string) : (vb as string).localeCompare(va);
      return sortDir === 'asc' ? (va as number) - (vb as number) : (vb as number) - (va as number);
    });
  }, [stats.byFuncionario, sortCol, sortDir]);

  const totalPages = Math.ceil(sortedRows.length / PAGE_SIZE);
  const visible    = sortedRows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  function toggleSort(col: SortCol) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir(col === 'rank' ? 'asc' : 'desc'); }
    goToPage(0);
  }

  function SortTh({ col, label, right }: { col: SortCol; label: string; right?: boolean }) {
    const active = sortCol === col;
    return (
      <th
        onClick={() => toggleSort(col)}
        style={{
          padding: '10px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer',
          textAlign: right ? 'right' : 'left', userSelect: 'none',
          background: active ? '#002a7a' : '#003DA5', color: '#fff',
          whiteSpace: 'nowrap',
        }}
        title={`Ordenar por ${label}`}
      >
        {label} {active ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
      </th>
    );
  }

  return (
    <div ref={tableRef} className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">Tabla de Vendedores</h3>
        <span className="text-xs text-gray-400">
          Mostrando {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, sortedRows.length)} de {sortedRows.length} vendedores
        </span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <SortTh col="rank"         label="#"              />
              <SortTh col="nombre"       label="Vendedor"       />
              <SortTh col="total"        label="Total"    right />
              <SortTh col="renovaciones" label="Renov."   right />
              <SortTh col="altas"        label="Altas"    right />
              <SortTh col="cambios"      label="Cambios"  right />
              <SortTh col="pctRechazo"   label="% Rechazo" right />
              {stats.hasEstado && <th style={{ padding: '10px 12px', fontSize: 11, fontWeight: 600, background: '#003DA5', color: '#fff', textAlign: 'left' }}>Estado Principal</th>}
              <SortTh col="diasActivos"  label="Días Act." right />
              <th style={{ padding: '10px 12px', fontSize: 11, fontWeight: 600, background: '#003DA5', color: '#fff', textAlign: 'center' }}>Acción</th>
              {onHideVendedor && <th style={{ background: '#003DA5', width: 30 }} />}
            </tr>
          </thead>
          <tbody>
            {visible.map((f, idx) => {
              const globalRank = sortedRows.indexOf(f);
              const badge = RANK_BADGES[globalRank];
              const isTop3 = globalRank < 3;
              const rowBg  = isTop3 ? `${badge?.bg}15` : idx % 2 === 0 ? '#fff' : '#f8fafc';
              const expanded = expandedNombre === f.nombre;
              const estadoPrincipal = getEstadoPrincipal(f.estadosRaw);
              const eq = estadoPrincipal ? getEquivalente(estadoPrincipal) : null;
              const eqColor = eq ? getEquivalenteColor(eq) : '#adb5bd';

              return (
                <>
                  <tr
                    key={f.nombre}
                    style={{ background: rowBg, borderTop: '1px solid #f1f5f9' }}
                    onMouseEnter={() => setHovered(f.nombre)}
                    onMouseLeave={() => setHovered(null)}
                  >
                    {/* # */}
                    <td style={{ padding: '8px 10px', textAlign: 'center', width: 48 }}>
                      {badge ? (
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          width: 28, height: 28, borderRadius: '50%',
                          background: badge.bg, color: badge.text, fontSize: 12, fontWeight: 700,
                        }}>{badge.emoji}</span>
                      ) : (
                        <span style={{ color: '#9ca3af', fontSize: 11 }}>{globalRank + 1}</span>
                      )}
                    </td>

                    {/* Vendedor */}
                    <td style={{ padding: '8px 12px', fontWeight: 500, color: '#111827', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                      title={f.nombre}>
                      {f.nombre}
                    </td>

                    {/* Total */}
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: '#003DA5' }}>
                      {f.total.toLocaleString()}
                    </td>

                    {/* Renov */}
                    <td style={{ padding: '8px 12px', textAlign: 'right', color: '#374151' }}>{f.renovaciones}</td>

                    {/* Altas */}
                    <td style={{ padding: '8px 12px', textAlign: 'right', color: '#374151' }}>{f.altas}</td>

                    {/* Cambios */}
                    <td style={{ padding: '8px 12px', textAlign: 'right', color: '#374151' }}>{f.cambios}</td>

                    {/* % Rechazo */}
                    <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                      {stats.hasEstado ? (
                        <span style={{ fontWeight: 700, color: pctRechazoColor(f.pctRechazo) }}>
                          {f.pctRechazo.toFixed(1)}%
                        </span>
                      ) : <span style={{ color: '#d1d5db' }}>—</span>}
                    </td>

                    {/* Estado Principal */}
                    {stats.hasEstado && (
                      <td style={{ padding: '8px 12px' }}>
                        {estadoPrincipal ? (
                          <span style={{
                            fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 12,
                            background: eqColor + '20', color: eqColor,
                            border: `1px solid ${eqColor}50`,
                            whiteSpace: 'nowrap',
                          }}
                            title={eq ? `${estadoPrincipal} (${eq})` : estadoPrincipal}>
                            {estadoPrincipal.length > 14 ? estadoPrincipal.slice(0, 14) + '…' : estadoPrincipal}
                            {eq && ` (${eq})`}
                          </span>
                        ) : <span style={{ color: '#d1d5db', fontSize: 11 }}>—</span>}
                      </td>
                    )}

                    {/* Días Activos */}
                    <td style={{ padding: '8px 12px', textAlign: 'right', color: '#6b7280', fontSize: 12 }}>
                      {f.diasActivos > 0 ? f.diasActivos : <span style={{ color: '#d1d5db' }}>—</span>}
                    </td>

                    {/* Acción */}
                    <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                      <button
                        onClick={() => setExpanded(expanded ? null : f.nombre)}
                        style={{
                          fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 6,
                          border: `1px solid ${expanded ? '#003DA5' : '#e2e8f0'}`,
                          background: expanded ? '#003DA5' : '#fff',
                          color: expanded ? '#fff' : '#003DA5',
                          cursor: 'pointer', whiteSpace: 'nowrap',
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                        }}
                      >
                        {expanded ? <><ChevronUp size={12} /> Cerrar</> : <><ChevronDown size={12} /> Ver detalle</>}
                      </button>
                    </td>

                    {/* EyeOff */}
                    {onHideVendedor && (
                      <td style={{ padding: '8px 6px', textAlign: 'center' }}>
                        <button
                          onClick={() => onHideVendedor(f.nombre)}
                          style={{ opacity: hovered === f.nombre ? 1 : 0, transition: 'opacity 0.15s' }}
                          title={`Ocultar ${f.nombre}`}
                        >
                          <EyeOff size={13} style={{ color: '#9ca3af' }} />
                        </button>
                      </td>
                    )}
                  </tr>

                  {/* Fila expandida */}
                  {expanded && (
                    <tr key={`${f.nombre}-detail`}>
                      <td
                        colSpan={stats.hasEstado ? (onHideVendedor ? 11 : 10) : (onHideVendedor ? 10 : 9)}
                        style={{ padding: 0, borderTop: '1px solid #e2e8f0' }}
                      >
                        <DetailTabs f={f} onClose={() => setExpanded(null)} />
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
            {visible.length === 0 && (
              <tr>
                <td colSpan={stats.hasEstado ? (onHideVendedor ? 11 : 10) : (onHideVendedor ? 10 : 9)}
                  style={{ padding: '32px 16px', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
                  No hay vendedores para mostrar.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1 mt-4 flex-wrap">
          <button
            onClick={() => goToPage(Math.max(0, page - 1))}
            disabled={page === 0}
            style={{
              padding: '5px 10px', fontSize: 12, borderRadius: 6, cursor: page === 0 ? 'not-allowed' : 'pointer',
              border: '1px solid #e2e8f0', background: '#fff', color: '#374151',
              opacity: page === 0 ? 0.4 : 1, display: 'inline-flex', alignItems: 'center', gap: 2,
            }}
          >
            <ChevronLeft size={13} /> Anterior
          </button>

          {getPageNums(page, totalPages).map((p, i) =>
            p === '…' ? (
              <span key={`ellipsis-${i}`} style={{ padding: '5px 4px', fontSize: 12, color: '#9ca3af' }}>…</span>
            ) : (
              <button
                key={p}
                onClick={() => goToPage(p as number)}
                style={{
                  minWidth: 32, padding: '5px 8px', fontSize: 12, borderRadius: 6, cursor: 'pointer',
                  border: `1px solid #003DA5`,
                  background: p === page ? '#003DA5' : '#fff',
                  color: p === page ? '#fff' : '#003DA5',
                  fontWeight: p === page ? 700 : 400,
                }}
              >
                {(p as number) + 1}
              </button>
            )
          )}

          <button
            onClick={() => goToPage(Math.min(totalPages - 1, page + 1))}
            disabled={page === totalPages - 1}
            style={{
              padding: '5px 10px', fontSize: 12, borderRadius: 6,
              cursor: page === totalPages - 1 ? 'not-allowed' : 'pointer',
              border: '1px solid #e2e8f0', background: '#fff', color: '#374151',
              opacity: page === totalPages - 1 ? 0.4 : 1, display: 'inline-flex', alignItems: 'center', gap: 2,
            }}
          >
            Siguiente <ChevronRight size={13} />
          </button>
        </div>
      )}
    </div>
  );
}
