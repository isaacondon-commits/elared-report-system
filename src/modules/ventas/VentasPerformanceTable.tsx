import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, EyeOff } from 'lucide-react';
import type { VentasStats } from './VentasModule';
import { getEstadoColor } from './VentasModule';

const PAGE_SIZE = 10;

const RANK_BADGES = [
  { bg: '#FFD700', text: '#7a5800', label: '1°' },
  { bg: '#C0C0C0', text: '#4a4a4a', label: '2°' },
  { bg: '#CD7F32', text: '#5c3200', label: '3°' },
];

function pctColor(pct: number): string {
  if (pct >= 60) return 'text-green-700';
  if (pct >= 40) return 'text-amber-700';
  return 'text-red-700';
}

interface Props {
  stats: VentasStats;
  onHideVendedor?: (nombre: string) => void;
}

export default function VentasPerformanceTable({ stats, onHideVendedor }: Props) {
  const [page, setPage] = useState(0);
  const [hovered, setHovered] = useState<string | null>(null);

  // Reset page when empresa cambia
  const [lastEmpresa, setLastEmpresa] = useState(stats.empresaActiva);
  if (stats.empresaActiva !== lastEmpresa) {
    setLastEmpresa(stats.empresaActiva);
    setPage(0);
  }

  const rows = useMemo(() => stats.byFuncionario, [stats.byFuncionario]);
  const totalPages = Math.ceil(rows.length / PAGE_SIZE);
  const visible    = rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">Tabla de Performance por Vendedor</h3>
        <span className="text-xs text-gray-400">{rows.length} vendedores</span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: '#003DA5', color: '#fff' }}>
              <th className="px-3 py-3 text-center font-semibold w-10">#</th>
              <th className="px-4 py-3 font-semibold text-left">Vendedor</th>
              <th className="px-4 py-3 font-semibold text-right">Total</th>
              <th className="px-4 py-3 font-semibold text-right">Días</th>
              <th className="px-4 py-3 font-semibold text-right">Renovac.</th>
              <th className="px-4 py-3 font-semibold text-right">Altas</th>
              <th className="px-4 py-3 font-semibold text-right">Cambios</th>
              <th className="px-4 py-3 font-semibold text-right">% Reno.</th>
              <th className="px-4 py-3 font-semibold text-right">Prom/día</th>
              {stats.hasEstado && (
                <th className="px-4 py-3 font-semibold text-left">Estados</th>
              )}
              {onHideVendedor && <th className="px-2 py-3 w-8" />}
            </tr>
          </thead>
          <tbody>
            {visible.map((f, idx) => {
              const rank   = page * PAGE_SIZE + idx;
              const badge  = RANK_BADGES[rank];
              const isTop3 = rank < 3;
              const rowBg  = isTop3
                ? `${badge?.bg}18`
                : idx % 2 === 0 ? '#ffffff' : '#f8fafc';
              const pctReno = f.total > 0 ? Math.round((f.renovaciones / f.total) * 100) : 0;
              const promDia = f.diasActivos > 0 ? (f.total / f.diasActivos).toFixed(1) : '—';
              const estadosRawEntries = Object.entries(f.estadosRaw)
                .filter(([, cnt]) => cnt > 0)
                .sort(([, a], [, b]) => b - a);

              return (
                <tr
                  key={f.nombre}
                  style={{ background: rowBg }}
                  className="border-t border-gray-100 group"
                  onMouseEnter={() => setHovered(f.nombre)}
                  onMouseLeave={() => setHovered(null)}
                >
                  <td className="px-3 py-2.5 text-center">
                    {badge ? (
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold"
                        style={{ background: badge.bg, color: badge.text }}>
                        {badge.label}
                      </span>
                    ) : (
                      <span className="text-gray-400 text-xs">{rank + 1}</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-gray-900 font-medium max-w-[200px] truncate" title={f.nombre}>
                    {f.nombre}
                  </td>
                  <td className="px-4 py-2.5 text-right font-bold text-[#003DA5]">
                    {f.total.toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5 text-right text-gray-500 text-xs">
                    {f.diasActivos > 0 ? f.diasActivos : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-2.5 text-right text-gray-700">{f.renovaciones.toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-right text-gray-700">{f.altas.toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-right text-gray-700">{f.cambios.toLocaleString()}</td>
                  <td className={`px-4 py-2.5 text-right font-semibold ${pctColor(pctReno)}`}>{pctReno}%</td>
                  <td className="px-4 py-2.5 text-right text-gray-500 text-xs font-mono">{promDia}</td>

                  {stats.hasEstado && (
                    <td className="px-4 py-2.5">
                      {estadosRawEntries.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {estadosRawEntries.slice(0, 4).map(([estado, cnt]) => (
                            <span
                              key={estado}
                              title={`${estado}: ${cnt}`}
                              style={{
                                background: getEstadoColor(estado),
                                color: '#fff',
                                borderRadius: 4,
                                padding: '2px 6px',
                                fontSize: 10,
                                fontWeight: 600,
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {estado.length > 10 ? estado.slice(0, 10) + '…' : estado} {cnt}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>
                  )}

                  {onHideVendedor && (
                    <td className="px-2 py-2.5 text-center">
                      <button
                        onClick={() => onHideVendedor(f.nombre)}
                        className="transition-opacity"
                        style={{ opacity: hovered === f.nombre ? 1 : 0 }}
                        title={`Ocultar ${f.nombre}`}
                      >
                        <EyeOff size={13} className="text-gray-400 hover:text-red-500" />
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
            {visible.length === 0 && (
              <tr>
                <td colSpan={stats.hasEstado ? (onHideVendedor ? 11 : 10) : (onHideVendedor ? 10 : 9)}
                  className="px-4 py-8 text-center text-gray-400 text-sm">
                  No hay vendedores para mostrar.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-3 px-1">
          <span className="text-xs text-gray-500">
            {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, rows.length)} de {rows.length} vendedores
          </span>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
              className="p-1.5 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-40">
              <ChevronLeft size={14} />
            </button>
            <span className="text-xs text-gray-600 px-2">{page + 1}/{totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page === totalPages - 1}
              className="p-1.5 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-40">
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
