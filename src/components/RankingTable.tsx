import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface Column {
  key: string;
  label: string;
  render?: (value: unknown, row: Record<string, unknown>) => React.ReactNode;
  align?: 'left' | 'center' | 'right';
}

interface RankingTableProps {
  columns: Column[];
  rows: Record<string, unknown>[];
  pageSize?: number;
  showRank?: boolean;
}

export default function RankingTable({ columns, rows, pageSize = 20, showRank = false }: RankingTableProps) {
  const [page, setPage] = useState(0);
  const totalPages = Math.ceil(rows.length / pageSize);
  const visible = rows.slice(page * pageSize, (page + 1) * pageSize);

  return (
    <div>
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#003DA5] text-white">
              {showRank && <th className="px-3 py-3 text-center font-semibold w-10">#</th>}
              {columns.map(col => (
                <th
                  key={col.key}
                  className={`px-4 py-3 font-semibold text-${col.align ?? 'left'}`}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="table-zebra">
            {visible.map((row, i) => (
              <tr key={i} className="border-t border-gray-100 hover:bg-blue-50/30 transition-colors">
                {showRank && (
                  <td className="px-3 py-2.5 text-center text-gray-400 font-mono text-xs">
                    {page * pageSize + i + 1}
                  </td>
                )}
                {columns.map(col => (
                  <td key={col.key} className={`px-4 py-2.5 text-${col.align ?? 'left'} text-gray-800`}>
                    {col.render ? col.render(row[col.key], row) : String(row[col.key] ?? '—')}
                  </td>
                ))}
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={columns.length + (showRank ? 1 : 0)} className="px-4 py-8 text-center text-gray-400">
                  Sin datos para mostrar
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-3 px-1">
          <span className="text-xs text-gray-500">
            {page * pageSize + 1}–{Math.min((page + 1) * pageSize, rows.length)} de {rows.length} registros
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="p-1.5 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="text-xs text-gray-600 px-2">
              {page + 1} / {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page === totalPages - 1}
              className="p-1.5 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
