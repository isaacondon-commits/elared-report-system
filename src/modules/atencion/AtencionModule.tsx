import { useState, useCallback } from 'react';
import { Upload, FileText, DownloadCloud, FileSpreadsheet, ChevronDown, ChevronUp } from 'lucide-react';
import { recordActivity } from '../../utils/activityTracker';
import Header from '../../components/Header';
import { parseAtencion, fmtSecs, agregarHorasTodos } from './atencionParser';
import type { AtencionData, GrupoAtencion } from './atencionParser';
import { LlamadasBarChart, HeatmapGrid, MultiLineChart, ColaBarChart, GaugeChart } from './AtencionCharts';
import { AtencionAlertas } from './AtencionAlertas';
import { exportarExcel, exportarPPTX, exportarPDF } from './AtencionExport';
import { useAnalisisStore } from '../../store/analisisStore';

// ─── Upload stage ──────────────────────────────────────────────────────────────

function UploadStage({ onFile }: { onFile: (f: File) => void }) {
  const [dragging, setDragging] = useState(false);

  const handle = useCallback((f: File | undefined | null) => {
    if (f && (f.name.endsWith('.csv') || f.type === 'text/csv' || f.type === 'text/plain')) onFile(f);
  }, [onFile]);

  return (
    <div className="flex flex-col h-full">
      <Header title="Atención al Cliente" />
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="max-w-lg w-full space-y-6">
          <div className="text-center">
            <div className="w-16 h-16 rounded-2xl bg-teal-100 flex items-center justify-center mx-auto mb-4">
              <FileText size={28} className="text-teal-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Informe Resumen de Entradas x Hora</h2>
            <p className="text-gray-500 text-sm">Cargá el CSV exportado desde Vicidial para analizar el tráfico de llamadas por grupo y franja horaria.</p>
          </div>

          <label
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={e => { e.preventDefault(); setDragging(false); handle(e.dataTransfer.files[0]); }}
            className={`flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-2xl p-12 cursor-pointer transition-all
              ${dragging ? 'border-teal-500 bg-teal-50' : 'border-gray-300 hover:border-teal-400 hover:bg-teal-50/40'}`}
          >
            <Upload size={32} className={dragging ? 'text-teal-500' : 'text-gray-400'} />
            <div className="text-center">
              <p className="font-semibold text-gray-700">Arrastrá el archivo CSV aquí</p>
              <p className="text-gray-400 text-sm mt-1">o hacé clic para seleccionar</p>
            </div>
            <input type="file" accept=".csv,text/csv,text/plain" className="hidden" onChange={e => handle(e.target.files?.[0])} />
          </label>

          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-xs text-gray-500 space-y-1">
            <p className="font-semibold text-gray-600 mb-2">Formato esperado:</p>
            <p>• Primera línea: "Informe Resumen de Entradas x Hora: YYYY-MM-DD …"</p>
            <p>• Sección de resumen por grupo (ELAREDINGROUP, MOVILOGINGROUP, PHINGROUP)</p>
            <p>• Sección de desglose horario por grupo (9:00 — 20:00)</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Loading stage ────────────────────────────────────────────────────────────

function LoadingStage() {
  return (
    <div className="flex flex-col h-full">
      <Header title="Atención al Cliente" />
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="w-14 h-14 border-4 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600 font-medium">Procesando informe…</p>
        </div>
      </div>
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, accent, bg }: { label: string; value: string; sub?: string; accent: string; bg: string }) {
  return (
    <div className={`${bg} rounded-xl p-4 border border-white/60`}>
      <p className="text-xs font-medium text-gray-500 mb-1">{label}</p>
      <p className="text-2xl font-bold" style={{ color: accent }}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="text-sm font-bold text-gray-800 mb-4 uppercase tracking-wide">{title}</h3>
      {children}
    </div>
  );
}

// ─── Group comparison table ───────────────────────────────────────────────────

function TablaGrupos({ grupos }: { grupos: GrupoAtencion[] }) {
  function badge(pct: number, inverse = false) {
    const good = inverse ? pct <= 10 : pct >= 80;
    const warn = inverse ? pct <= 20 : pct >= 60;
    const cls = good ? 'bg-green-100 text-green-700' : warn ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700';
    return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}>{pct.toFixed(1)}%</span>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            {['Grupo', 'Llamadas', 'Respondidas', 'Abandono', '% Respuesta', '% Abandono', 'T. Charla', 'T. Cola'].map(h => (
              <th key={h} className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grupos.map(g => (
            <tr key={g.nombre} className="border-b border-gray-100 hover:bg-gray-50">
              <td className="py-2.5 px-3 font-semibold text-gray-800">{g.nombreLegible}</td>
              <td className="py-2.5 px-3 text-gray-700 font-medium">{g.llamadas.toLocaleString()}</td>
              <td className="py-2.5 px-3 text-green-700 font-medium">{g.respuestas.toLocaleString()}</td>
              <td className="py-2.5 px-3 text-red-600 font-medium">{g.abandono.toLocaleString()}</td>
              <td className="py-2.5 px-3">{badge(g.tasaRespuesta)}</td>
              <td className="py-2.5 px-3">{badge(g.tasaAbandono, true)}</td>
              <td className="py-2.5 px-3 text-gray-600">{fmtSecs(g.charlaPromedio)}</td>
              <td className="py-2.5 px-3 text-gray-600">{fmtSecs(g.tiempoMedioCola)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Hourly tab panel ─────────────────────────────────────────────────────────

type HourlyTab = 'llamadas' | 'heatmap' | 'respuesta' | 'cola';

function SeccionHoraria({ data }: { data: AtencionData }) {
  const [tab, setTab] = useState<HourlyTab>('llamadas');
  const [grupoIdx, setGrupoIdx] = useState(0);

  const tabs: { id: HourlyTab; label: string }[] = [
    { id: 'llamadas', label: 'Llamadas y abandono' },
    { id: 'heatmap',  label: 'Mapa de calor' },
    { id: 'respuesta', label: 'Tasa respuesta' },
    { id: 'cola',     label: 'Tiempo en cola' },
  ];

  const grupo = data.grupos[grupoIdx];

  return (
    <div className="space-y-4">
      {/* Tab nav */}
      <div className="flex gap-2 flex-wrap">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all
              ${tab === t.id ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Group selector (for per-group charts) */}
      {(tab === 'llamadas') && data.grupos.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {data.grupos.map((g, i) => (
            <button
              key={g.nombre}
              onClick={() => setGrupoIdx(i)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all border
                ${grupoIdx === i ? 'border-teal-500 bg-teal-50 text-teal-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}
            >
              {g.nombreLegible}
            </button>
          ))}
          <button
            onClick={() => setGrupoIdx(-1)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-all border
              ${grupoIdx === -1 ? 'border-teal-500 bg-teal-50 text-teal-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}
          >
            Todos
          </button>
        </div>
      )}

      {/* Chart */}
      {tab === 'llamadas' && (
        grupoIdx >= 0 && grupo
          ? <LlamadasBarChart horas={grupo.horasDesglose} />
          : <LlamadasBarChart horas={agregarHorasTodos(data.grupos)} />
      )}
      {tab === 'heatmap' && <HeatmapGrid grupos={data.grupos} />}
      {tab === 'respuesta' && (
        <MultiLineChart
          grupos={data.grupos}
          metric="tasaRespuesta"
          unit="%"
          formatValue={v => `${v.toFixed(1)}%`}
        />
      )}
      {tab === 'cola' && <ColaBarChart grupos={data.grupos} />}
    </div>
  );
}

// ─── Quality section ──────────────────────────────────────────────────────────

function SeccionCalidad({ data }: { data: AtencionData }) {
  const horasCriticas = data.grupos.flatMap(g =>
    g.horasDesglose
      .filter(h => h.alertaAbandono && h.llamadas > 0)
      .map(h => ({ grupo: g.nombreLegible, ...h }))
  ).sort((a, b) => b.tasaAbandono - a.tasaAbandono);

  return (
    <div className="space-y-5">
      {/* Gauges */}
      <div className="flex gap-8 flex-wrap justify-center py-2">
        <GaugeChart
          value={data.totales.tasaRespuesta}
          label="Tasa de Respuesta"
          warnAt={80} badAt={60}
        />
        <GaugeChart
          value={data.totales.tasaAbandono}
          label="Tasa de Abandono"
          warnAt={20} badAt={10}
          inverse
        />
        <GaugeChart
          value={Math.min(100, (data.totales.tiempoMedioCola / 120) * 100)}
          label="T. Cola (% de 2min)"
          warnAt={70} badAt={50}
          inverse
          unit="seg"
        />
      </div>

      {/* Critical hours table */}
      {horasCriticas.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Horas críticas (abandono &gt;15%)</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  {['Grupo', 'Hora', 'Llamadas', 'Abandono', '% Abandono', 'T. Cola'].map(h => (
                    <th key={h} className="text-left py-2 px-3 text-xs font-semibold text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {horasCriticas.map((h, i) => (
                  <tr key={i} className="border-b border-gray-100 hover:bg-red-50/50">
                    <td className="py-2 px-3 font-medium text-gray-700">{h.grupo}</td>
                    <td className="py-2 px-3 text-gray-600">{h.hora}:00</td>
                    <td className="py-2 px-3">{h.llamadas}</td>
                    <td className="py-2 px-3 text-red-600 font-medium">{h.abandono}</td>
                    <td className="py-2 px-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${h.tasaAbandono > 25 ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                        {h.tasaAbandono.toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-2 px-3 text-gray-500">{fmtSecs(h.tiempoMedioCola)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {horasCriticas.length === 0 && (
        <p className="text-center text-sm text-green-600 font-medium py-2">Sin horas críticas — abandono bajo en todos los períodos.</p>
      )}
    </div>
  );
}

// ─── Analysis stage ───────────────────────────────────────────────────────────

function AnalysisStage({ data, fileName, onReset }: { data: AtencionData; fileName: string; onReset: () => void }) {
  const [exportingXls, setExportingXls]   = useState(false);
  const [exportingPptx, setExportingPptx] = useState(false);
  const [exportingPdf,  setExportingPdf]  = useState(false);
  const [showGrupos, setShowGrupos] = useState(true);

  const tot = data.totales;

  const handleExcelClick = () => {
    setExportingXls(true);
    setTimeout(() => { exportarExcel(data); setExportingXls(false); }, 50);
  };
  const handlePptxClick = async () => {
    setExportingPptx(true);
    try { await exportarPPTX(data); } finally { setExportingPptx(false); }
  };
  const handlePdfClick = () => {
    setExportingPdf(true);
    setTimeout(() => { exportarPDF(data); setExportingPdf(false); }, 50);
  };

  return (
    <div className="flex flex-col h-full">
      <Header title="Atención al Cliente" />
      <div className="flex-1 overflow-y-auto p-6">
        <div id="atencion-content" className="max-w-6xl mx-auto space-y-6">

          {/* Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-bold text-gray-900 text-lg">
                Reporte {data.fecha || '—'}
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">{fileName} · {data.grupos.length} grupos</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handlePptxClick}
                disabled={exportingPptx}
                className="flex items-center gap-2 px-4 py-2 text-white rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-60 transition-colors"
                style={{ background: '#C43B1C' }}
              >
                <DownloadCloud size={15} />
                {exportingPptx ? 'Exportando…' : 'PowerPoint'}
              </button>
              <button
                onClick={handleExcelClick}
                disabled={exportingXls}
                className="flex items-center gap-2 px-4 py-2 text-white rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-60 transition-colors"
                style={{ background: '#1D6F42' }}
              >
                <FileSpreadsheet size={15} />
                {exportingXls ? 'Exportando…' : 'Excel'}
              </button>
              <button
                onClick={handlePdfClick}
                disabled={exportingPdf}
                className="flex items-center gap-2 px-4 py-2 text-white rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-60 transition-colors"
                style={{ background: '#E3000F' }}
              >
                <DownloadCloud size={15} />
                {exportingPdf ? 'Generando…' : 'PDF'}
              </button>
              <button
                onClick={onReset}
                className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Nuevo archivo
              </button>
            </div>
          </div>

          {/* KPIs — Global */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <KpiCard label="Total Llamadas"  value={tot.llamadas.toLocaleString()}  accent="#003DA5" bg="bg-blue-50"   />
            <KpiCard label="Respondidas"     value={tot.respuestas.toLocaleString()} sub={`${tot.tasaRespuesta.toFixed(1)}%`} accent="#16a34a" bg="bg-green-50" />
            <KpiCard label="Abandonadas"     value={tot.abandono.toLocaleString()}   sub={`${tot.tasaAbandono.toFixed(1)}%`}  accent="#E3000F" bg="bg-red-50"   />
            <KpiCard label="T. Medio Cola"   value={fmtSecs(tot.tiempoMedioCola)}   accent="#7c3aed" bg="bg-purple-50" />
          </div>

          {/* KPIs — per group */}
          {data.grupos.length > 1 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {data.grupos.map(g => (
                <div key={g.nombre} className="bg-white border border-gray-200 rounded-xl p-4">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">{g.nombreLegible}</p>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-xs text-gray-400">Llamadas</p>
                      <p className="text-lg font-bold text-gray-800">{g.llamadas}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">% Resp.</p>
                      <p className={`text-lg font-bold ${g.tasaRespuesta >= 80 ? 'text-green-600' : g.tasaRespuesta >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
                        {g.tasaRespuesta.toFixed(1)}%
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">% Aban.</p>
                      <p className={`text-lg font-bold ${g.tasaAbandono <= 10 ? 'text-green-600' : g.tasaAbandono <= 20 ? 'text-yellow-600' : 'text-red-600'}`}>
                        {g.tasaAbandono.toFixed(1)}%
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Section 1: Group comparison */}
          <div className="bg-white rounded-xl border border-gray-200">
            <button
              className="w-full flex items-center justify-between p-5 text-left"
              onClick={() => setShowGrupos(!showGrupos)}
            >
              <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide">Comparativa por Grupo</h3>
              {showGrupos ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
            </button>
            {showGrupos && (
              <div className="px-5 pb-5">
                <TablaGrupos grupos={data.grupos} />
              </div>
            )}
          </div>

          {/* Section 2: Hourly */}
          <Section title="Análisis Horario">
            <SeccionHoraria data={data} />
          </Section>

          {/* Section 3: Quality */}
          <Section title="Indicadores de Calidad">
            <SeccionCalidad data={data} />
          </Section>

          {/* Section 4: Alerts */}
          <Section title="Alertas">
            <AtencionAlertas data={data} />
          </Section>

        </div>
      </div>
    </div>
  );
}

// ─── Module root ──────────────────────────────────────────────────────────────

type Stage = 'upload' | 'loading' | 'analysis';

export default function AtencionModule() {
  const { atencion: storeEntry, setAtencion: saveToStore, clearAtencion } = useAnalisisStore();

  const [stage, setStage] = useState<Stage>(() => storeEntry ? 'analysis' : 'upload');
  const [data, setData] = useState<AtencionData | null>(() => storeEntry?.data ?? null);
  const [fileName, setFileName] = useState(() => storeEntry?.nombreArchivo ?? '');
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback(async (file: File) => {
    setFileName(file.name);
    setError(null);
    setStage('loading');
    try {
      const parsed = await parseAtencion(file);
      setData(parsed);
      recordActivity('atencion_cliente', file.name);
      saveToStore({ data: parsed, nombreArchivo: file.name });
      setStage('analysis');
    } catch (e) {
      setError((e as Error).message ?? 'Error al procesar el archivo.');
      setStage('upload');
    }
  }, [saveToStore]);

  const handleReset = useCallback(() => {
    clearAtencion();
    setData(null);
    setStage('upload');
    setError(null);
  }, [clearAtencion]);

  if (stage === 'loading') return <LoadingStage />;
  if (stage === 'analysis' && data) {
    return <AnalysisStage data={data} fileName={fileName} onReset={handleReset} />;
  }

  return (
    <div className="flex flex-col h-full">
      <UploadStage onFile={handleFile} />
      {error && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-red-600 text-white text-sm font-medium px-5 py-2.5 rounded-xl shadow-lg">
          {error}
        </div>
      )}
    </div>
  );
}
