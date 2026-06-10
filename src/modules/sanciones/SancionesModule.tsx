import { useState, useCallback } from 'react';
import { AlertTriangle, Download, Loader2, Filter } from 'lucide-react';
import { recordActivity } from '../../utils/activityTracker';
import FileUploader from '../../components/FileUploader';
import ColumnMapper from '../../components/ColumnMapper';
import KPICard from '../../components/KPICard';
import Header from '../../components/Header';
import RankingTable from '../../components/RankingTable';
import { parseExcel, type ParseResult } from '../../utils/smartParser';
import SancionesCharts from './SancionesCharts';
import { exportSancionesPdf } from './SancionesExport';
import { useConfig } from '../../hooks/useConfig';
import { useAnalisisStore, formatFechaCarga } from '../../store/analisisStore';

const SANCIONES_FIELDS = [
  { key: 'funcionario', label: 'Funcionario / Empleado', required: true },
  { key: 'fecha', label: 'Fecha', required: true },
  { key: 'tipo', label: 'Tipo / Sanción / Motivo', required: true },
  { key: 'descripcion', label: 'Descripción / Detalle', required: false },
  { key: 'nivel', label: 'Nivel / Gravedad', required: false },
  { key: 'estado', label: 'Estado / Status', required: false },
];

type Stage = 'upload' | 'mapping' | 'loading' | 'analysis';

export interface SancionRow {
  funcionario: string;
  fecha: string;
  tipo: string;
  descripcion?: string;
  nivel?: string;
  estado?: string;
}

export interface SancionesStats {
  rows: SancionRow[];
  byFuncionario: { nombre: string; total: number; tipos: string[] }[];
  byTipo: { tipo: string; count: number }[];
  byMes: { mes: string; count: number }[];
  patrones: { nombre: string; tipo: string; count: number }[];
  total: number;
}

function normalizeTipo(tipo: string): string {
  const t = tipo.toLowerCase().trim();
  if (t.includes('verbal') || t.includes('apercibimiento')) return 'Apercibimiento verbal';
  if (t.includes('escrito') || t.includes('amonest')) return 'Amonestación escrita';
  if (t.includes('suspend')) return 'Suspensión';
  if (t.includes('tardanza') || t.includes('tardía') || t.includes('llegada tarde')) return 'Tardanza';
  if (t.includes('falta') || t.includes('ausencia') || t.includes('inasist')) return 'Inasistencia';
  if (t.includes('conduct') || t.includes('actitud') || t.includes('comportamiento')) return 'Conducta';
  if (t.includes('rendimiento') || t.includes('desempeño') || t.includes('product')) return 'Rendimiento';
  return tipo.trim() || 'Sin categoría';
}

function processSanciones(parsed: ParseResult, mapping: Record<string, string>): SancionesStats {
  const rows: SancionRow[] = parsed.rows
    .map(r => ({
      funcionario: String(r[mapping.funcionario] ?? '').trim(),
      fecha: String(r[mapping.fecha] ?? '').split('T')[0],
      tipo: normalizeTipo(String(r[mapping.tipo] ?? '')),
      descripcion: mapping.descripcion ? String(r[mapping.descripcion] ?? '') : undefined,
      nivel: mapping.nivel ? String(r[mapping.nivel] ?? '') : undefined,
      estado: mapping.estado ? String(r[mapping.estado] ?? '') : undefined,
    }))
    .filter(r => r.funcionario && r.tipo);

  const funcMap = new Map<string, { total: number; tipos: string[] }>();
  for (const r of rows) {
    const prev = funcMap.get(r.funcionario) ?? { total: 0, tipos: [] };
    funcMap.set(r.funcionario, {
      total: prev.total + 1,
      tipos: [...prev.tipos, r.tipo],
    });
  }
  const byFuncionario = Array.from(funcMap.entries())
    .map(([nombre, d]) => ({ nombre, ...d }))
    .sort((a, b) => b.total - a.total);

  const tipoMap = new Map<string, number>();
  for (const r of rows) tipoMap.set(r.tipo, (tipoMap.get(r.tipo) ?? 0) + 1);
  const byTipo = Array.from(tipoMap.entries())
    .map(([tipo, count]) => ({ tipo, count }))
    .sort((a, b) => b.count - a.count);

  const mesMap = new Map<string, number>();
  for (const r of rows) {
    if (r.fecha && r.fecha.length >= 7) {
      const mes = r.fecha.slice(0, 7);
      mesMap.set(mes, (mesMap.get(mes) ?? 0) + 1);
    }
  }
  const byMes = Array.from(mesMap.entries())
    .map(([mes, count]) => ({ mes, count }))
    .sort((a, b) => a.mes.localeCompare(b.mes));

  const patronMap = new Map<string, number>();
  for (const r of rows) {
    const key = `${r.funcionario}||${r.tipo}`;
    patronMap.set(key, (patronMap.get(key) ?? 0) + 1);
  }
  const patrones = Array.from(patronMap.entries())
    .filter(([, count]) => count >= 2)
    .map(([key, count]) => {
      const [nombre, tipo] = key.split('||');
      return { nombre, tipo, count };
    })
    .sort((a, b) => b.count - a.count);

  return { rows, byFuncionario, byTipo, byMes, patrones, total: rows.length };
}

export default function SancionesModule() {
  const { config } = useConfig();
  const { sanciones: storeEntry, setSanciones: saveToStore, clearSanciones } = useAnalisisStore();

  const [stage, setStage] = useState<Stage>(() => storeEntry ? 'analysis' : 'upload');
  const [parsed, setParsed] = useState<ParseResult | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [stats, setStats] = useState<SancionesStats | null>(() => storeEntry?.data ?? null);
  const [error, setError] = useState('');
  const [filterFuncionario, setFilterFuncionario] = useState('');
  const [filterTipo, setFilterTipo] = useState('');

  const handleFile = useCallback(async (file: File) => {
    setError('');
    setStage('loading');
    try {
      const result = await parseExcel(file, 'sanciones');
      setParsed(result);
      setMapping(result.columnMap);
      setStage('mapping');
    } catch (e) {
      setError((e as Error).message);
      setStage('upload');
    }
  }, []);

  const handleConfirm = useCallback(() => {
    if (!parsed) return;
    setStage('loading');
    setTimeout(() => {
      const s = processSanciones(parsed, mapping);
      setStats(s);
      recordActivity('sanciones', parsed.fileName);
      saveToStore({ data: s, nombreArchivo: parsed.fileName });
      setStage('analysis');
    }, 300);
  }, [parsed, mapping, saveToStore]);

  const handleExport = useCallback(() => {
    if (!stats) return;
    exportSancionesPdf(stats, config);
  }, [stats, config]);

  const reset = () => { clearSanciones(); setStage('upload'); setParsed(null); setStats(null); setError(''); };

  const filteredRows = stats?.rows.filter(r =>
    (!filterFuncionario || r.funcionario.toLowerCase().includes(filterFuncionario.toLowerCase())) &&
    (!filterTipo || r.tipo === filterTipo)
  ) ?? [];

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Módulo Sanciones"
        subtitle={storeEntry ? `${storeEntry.data.total} sanciones · ${storeEntry.nombreArchivo} · ${formatFechaCarga(storeEntry.fechaCarga)}` : 'Registro y análisis de sanciones y advertencias'}
        actions={
          stage === 'analysis' && stats ? (
            <div className="flex gap-2">
              <button onClick={reset} className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
                Cargar otro archivo
              </button>
              <button
                onClick={handleExport}
                className="flex items-center gap-2 px-4 py-1.5 text-sm bg-[#E3000F] text-white rounded-lg hover:bg-red-800"
              >
                <Download size={15} />
                Exportar PDF
              </button>
            </div>
          ) : null
        }
      />

      <div className="flex-1 overflow-y-auto p-6">
        {stage === 'upload' && (
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-8">
              <div className="inline-flex bg-red-50 rounded-full p-4 mb-4">
                <AlertTriangle size={36} className="text-[#E3000F]" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Análisis de Sanciones</h2>
              <p className="text-gray-500 mt-2 text-sm">
                Cargá un Excel con el historial de sanciones. El sistema detecta patrones,
                agrupa tipos similares y genera el informe formal.
              </p>
            </div>
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
            )}
            <FileUploader onFile={handleFile} />
          </div>
        )}

        {stage === 'loading' && (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <Loader2 size={36} className="animate-spin text-[#003DA5] mx-auto mb-3" />
              <p className="text-gray-500">Procesando archivo...</p>
            </div>
          </div>
        )}

        {stage === 'mapping' && parsed && (
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-900 mb-3">
                Vista previa — {parsed.fileName}
                <span className="ml-2 text-sm font-normal text-gray-500">({parsed.rowCount} filas)</span>
              </h3>
              <div className="overflow-x-auto">
                <table className="text-xs w-full">
                  <thead>
                    <tr>
                      {parsed.headers.map(h => (
                        <th key={h} className="px-3 py-2 bg-gray-100 text-left font-medium text-gray-700 border-r border-gray-200">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.rows.slice(0, 5).map((row, i) => (
                      <tr key={i} className="border-t border-gray-100">
                        {parsed.headers.map(h => (
                          <td key={h} className="px-3 py-1.5 text-gray-600 border-r border-gray-100">{String(row[h] ?? '')}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <ColumnMapper
              fields={SANCIONES_FIELDS}
              headers={parsed.headers}
              mapping={mapping}
              onChange={(key, val) => setMapping(m => ({ ...m, [key]: val }))}
              onConfirm={handleConfirm}
              confidence={parsed.confidence}
            />
          </div>
        )}

        {stage === 'analysis' && stats && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KPICard label="Total sanciones" value={stats.total} icon={AlertTriangle} color="red" />
              <KPICard label="Funcionarios involucrados" value={stats.byFuncionario.length} icon={AlertTriangle} color="amber" />
              <KPICard label="Tipos de sanción" value={stats.byTipo.length} icon={Filter} color="blue" />
              <KPICard label="Patrones detectados" value={stats.patrones.length} icon={AlertTriangle} color="red" />
            </div>

            <SancionesCharts stats={stats} />

            {stats.patrones.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
                <h3 className="font-semibold text-amber-800 mb-3">Patrones detectados (misma sanción repetida)</h3>
                <div className="space-y-2">
                  {stats.patrones.map((p, i) => (
                    <div key={i} className="flex items-center gap-3 bg-white rounded-lg border border-amber-200 px-4 py-2.5">
                      <div className="bg-amber-100 text-amber-800 font-bold text-xs px-2 py-0.5 rounded">
                        {p.count}x
                      </div>
                      <div className="flex-1">
                        <span className="font-semibold text-gray-800">{p.nombre}</span>
                        <span className="text-gray-500 mx-2">·</span>
                        <span className="text-gray-600 text-sm">{p.tipo}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">Tabla maestra de sanciones</h3>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Buscar funcionario..."
                    value={filterFuncionario}
                    onChange={(e) => setFilterFuncionario(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-44 focus:outline-none focus:ring-2 focus:ring-[#003DA5]"
                  />
                  <select
                    value={filterTipo}
                    onChange={(e) => setFilterTipo(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#003DA5]"
                  >
                    <option value="">Todos los tipos</option>
                    {stats.byTipo.map(t => (
                      <option key={t.tipo} value={t.tipo}>{t.tipo}</option>
                    ))}
                  </select>
                </div>
              </div>
              <RankingTable
                columns={[
                  { key: 'funcionario', label: 'Funcionario' },
                  { key: 'fecha', label: 'Fecha' },
                  {
                    key: 'tipo', label: 'Tipo',
                    render: (v) => (
                      <span className="bg-red-50 text-red-700 border border-red-200 text-xs px-2 py-0.5 rounded-full">
                        {String(v)}
                      </span>
                    ),
                  },
                  {
                    key: 'nivel', label: 'Nivel',
                    render: (v) => v ? (
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${
                        String(v).toLowerCase().includes('grave')
                          ? 'bg-red-50 text-red-700 border-red-200'
                          : String(v).toLowerCase().includes('moder')
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-gray-50 text-gray-700 border-gray-200'
                      }`}>{String(v)}</span>
                    ) : <span className="text-gray-400">—</span>,
                  },
                  {
                    key: 'estado', label: 'Estado',
                    render: (v) => v ? String(v) : '—',
                  },
                  {
                    key: 'descripcion', label: 'Descripción',
                    render: (v) => v ? (
                      <span className="text-gray-600 text-xs" title={String(v)}>
                        {String(v).slice(0, 60)}{String(v).length > 60 ? '…' : ''}
                      </span>
                    ) : <span className="text-gray-400">—</span>,
                  },
                ]}
                rows={filteredRows as unknown as Record<string, unknown>[]}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
