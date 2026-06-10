import { useState, useCallback, useEffect } from 'react';
import { Upload, FileText, Save, RotateCcw, DownloadCloud, FileSpreadsheet, Building2, Copy } from 'lucide-react';
import Header from '../../components/Header';
import { parseExcel } from '../../utils/smartParser';
import type { EmpresaComision, ComisionesConfig, ResultadosComisiones, Condicion } from './ComisionesConfig';
import {
  extractVentasRaw, buildConfigFromVentas, loadConfig, saveConfig,
  calcularComisiones, fmtPesos, getCondicionAplicable,
  detectarEmpresaId, isEmpresaReconocida, getNombreEmpresa,
  initSarandiConfig, SARANDI_CONFIG, aplicarTemplateEmpresa,
} from './ComisionesConfig';
import { recordActivity } from '../../utils/activityTracker';
import { useAnalisisStore } from '../../store/analisisStore';
import PlanesTable from './PlanesTable';
import ResultadosTable from './ResultadosTable';
import { RankingComisionesChart, VentasPorPlanChart, CondicionDonutChart } from './ComisionesCharts';
import { exportarExcelComisiones, exportarPPTXComisiones, exportarExcelProyeccion } from './ComisionesExport';

// ─── Module props ─────────────────────────────────────────────────────────────

interface ComisionesModuleProps {
  storageKey: string;
  titulo: string;
  accentColor: string;
}

type Stage = 'upload' | 'configure' | 'results';

interface EmpresaDetectada {
  id: string;
  nombre: string;
  reconocida: boolean;
}

// ─── Empresa card ─────────────────────────────────────────────────────────────

function EmpresaCard({
  empresaDetectada,
  onApplyTemplate,
}: {
  empresaDetectada: EmpresaDetectada;
  onApplyTemplate: (templateId: string) => void;
}) {
  const [selected, setSelected] = useState('');

  if (empresaDetectada.reconocida) {
    return (
      <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
        <Building2 size={20} className="text-emerald-600 shrink-0" />
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-emerald-800">{empresaDetectada.nombre}</span>
            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-full">
              Configuración precargada ✓
            </span>
          </div>
          <p className="text-xs text-emerald-600 mt-0.5">Podés ajustar los precios si hubo cambios</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 bg-orange-50 border border-orange-200 rounded-xl px-4 py-3">
      <Building2 size={20} className="text-orange-500 shrink-0 mt-0.5" />
      <div className="flex-1 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-orange-800">{empresaDetectada.nombre || 'Empresa desconocida'}</span>
          <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs font-semibold rounded-full">
            Empresa no reconocida
          </span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={selected}
            onChange={e => setSelected(e.target.value)}
            className="text-xs border border-orange-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 outline-none focus:border-orange-400"
          >
            <option value="">Aplicar precios predefinidos...</option>
            <option value="sarandi">Sarandí</option>
            <option value="manual">Configurar manualmente</option>
          </select>
          {selected && selected !== 'manual' && (
            <button
              onClick={() => { onApplyTemplate(selected); setSelected(''); }}
              className="text-xs font-semibold bg-orange-600 text-white px-3 py-1.5 rounded-lg hover:bg-orange-700 transition-colors"
            >
              Aplicar
            </button>
          )}
          {selected === 'manual' && (
            <span className="text-xs text-orange-600">Completá los precios manualmente en la tabla</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Step 1: Upload ───────────────────────────────────────────────────────────

function UploadStage({ titulo, accentColor, onFile }: { titulo: string; accentColor: string; onFile: (f: File) => void }) {
  const [dragging, setDragging] = useState(false);
  const handle = useCallback((f: File | undefined | null) => { if (f) onFile(f); }, [onFile]);

  return (
    <div className="flex flex-col h-full">
      <Header title={titulo} />
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="max-w-lg w-full space-y-6">
          <div className="text-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: `${accentColor}20` }}>
              <FileText size={28} style={{ color: accentColor }} />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">{titulo}</h2>
            <p className="text-gray-500 text-sm">Cargá el mismo Excel de ventas. El sistema detecta vendedores, planes y tipos de gestión automáticamente.</p>
          </div>
          <label
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={e => { e.preventDefault(); setDragging(false); handle(e.dataTransfer.files[0]); }}
            className={`flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-2xl p-12 cursor-pointer transition-all
              ${dragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50/30'}`}
          >
            <Upload size={32} className={dragging ? 'text-blue-500' : 'text-gray-400'} />
            <div className="text-center">
              <p className="font-semibold text-gray-700">Arrastrá el archivo Excel aquí</p>
              <p className="text-gray-400 text-sm mt-1">o hacé clic para seleccionar</p>
            </div>
            <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => handle(e.target.files?.[0])} />
          </label>
          <p className="text-center text-xs text-gray-400">
            Mismo formato que el módulo Ventas — Vendedor, Nuevo plan, Motivo de cambio, Empresa
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Step 2: Configure ────────────────────────────────────────────────────────

interface ConfigStageProps {
  titulo: string;
  storageKey: string;
  config: ComisionesConfig;
  onConfigChange: (c: ComisionesConfig) => void;
  resumenArchivo: { vendedores: number; planes: number; gestiones: number; fileName: string };
  empresaDetectada: EmpresaDetectada | null;
  onApplyTemplate: (templateId: string) => void;
  onCalcular: () => void;
  onReset: () => void;
}

function ConfigStage({ titulo, storageKey, config, onConfigChange, resumenArchivo, empresaDetectada, onApplyTemplate, onCalcular, onReset }: ConfigStageProps) {
  const [toast, setToast] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(null), 3000); }

  function handleSave() { saveConfig(storageKey, config); showToast('Configuración guardada ✓'); }

  function handleReset() {
    if (!confirmReset) { setConfirmReset(true); return; }
    onConfigChange({ ...config, empresas: config.empresas.map(e => ({ ...e, planes: e.planes.map(p => ({ ...p, precios: { condicion1: { renovacion: 0, alta: 0, cambio: 0 }, condicion2: { renovacion: 0, alta: 0, cambio: 0 } } })) })) });
    setConfirmReset(false);
    showToast('Precios reseteados');
  }

  function updateEmpresa(idx: number, emp: EmpresaComision) {
    const empresas = [...config.empresas];
    empresas[idx] = emp;
    onConfigChange({ ...config, empresas });
  }

  function updateCondicion(empIdx: number, condIdx: 0 | 1, field: 'nombre' | 'minVentas', val: string | number) {
    const emp = { ...config.empresas[empIdx] };
    const conds: [typeof emp.condiciones[0], typeof emp.condiciones[1]] = [{ ...emp.condiciones[0] }, { ...emp.condiciones[1] }];
    if (field === 'nombre') conds[condIdx] = { ...conds[condIdx], nombre: val as string };
    else conds[condIdx] = { ...conds[condIdx], minVentas: Number(val) || 0 };
    emp.condiciones = conds;
    updateEmpresa(empIdx, emp);
  }

  const noConfigCount = config.empresas.reduce((t, e) => t + e.planes.filter(p => p.noConfig).length, 0);

  return (
    <div className="flex flex-col h-full">
      <Header title={titulo} />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-6xl mx-auto space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-bold text-gray-900 text-lg">Configurar comisiones</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                {resumenArchivo.fileName} · {resumenArchivo.vendedores} vendedores · {resumenArchivo.planes} planes · {resumenArchivo.gestiones} gestiones
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button onClick={handleReset} className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                <RotateCcw size={13} />
                {confirmReset ? 'Confirmar reset' : 'Resetear precios'}
              </button>
              <button onClick={handleSave} className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                <Save size={13} />
                Guardar config
              </button>
              <button onClick={onCalcular} className="flex items-center gap-2 px-4 py-2 bg-[#003DA5] text-white rounded-lg text-sm font-semibold hover:bg-blue-800 transition-colors">
                Ver resultados →
              </button>
              <button onClick={onReset} className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-500 hover:bg-gray-50 transition-colors">
                Otro archivo
              </button>
            </div>
          </div>

          {empresaDetectada && <EmpresaCard empresaDetectada={empresaDetectada} onApplyTemplate={onApplyTemplate} />}

          {noConfigCount > 0 && (
            <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-xl px-4 py-2.5 text-sm text-orange-700">
              <span className="font-bold">⚠</span>
              <span><strong>{noConfigCount} {noConfigCount === 1 ? 'plan' : 'planes'}</strong> sin precio — aparecen al final de la tabla con botón "Agregar precio"</span>
            </div>
          )}

          {config.empresas.map((emp, empIdx) => (
            <div key={emp.id} className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              <div className="lg:col-span-1 bg-white border border-gray-200 rounded-xl p-5 space-y-4 h-fit">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-bold">{emp.nombre}</span>
                  <h3 className="font-semibold text-gray-800 text-sm">Condiciones</h3>
                </div>
                {([0, 1] as const).map(ci => {
                  const cond = emp.condiciones[ci];
                  return (
                    <div key={ci} className={`p-3 rounded-lg border ${ci === 0 ? 'border-blue-200 bg-blue-50' : 'border-purple-200 bg-purple-50'}`}>
                      <p className={`text-xs font-bold uppercase tracking-wide mb-2 ${ci === 0 ? 'text-blue-700' : 'text-purple-700'}`}>Condición {ci + 1}</p>
                      <div className="space-y-2">
                        <div>
                          <label className="text-xs text-gray-500 mb-0.5 block">Nombre</label>
                          <input type="text" value={cond.nombre} placeholder={ci === 0 ? 'ej: Condición Base' : 'ej: Condición Premium'} onChange={e => updateCondicion(empIdx, ci, 'nombre', e.target.value)} className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 mb-0.5 block">Mínimo de ventas</label>
                          <input type="number" value={cond.minVentas || ''} placeholder={ci === 0 ? 'ej: 60' : 'ej: 90'} min={0} onChange={e => updateCondicion(empIdx, ci, 'minVentas', e.target.value)} className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" />
                        </div>
                      </div>
                    </div>
                  );
                })}
                <p className="text-xs text-gray-400 leading-relaxed bg-gray-50 p-2 rounded">
                  Si un vendedor llega a <strong>{emp.condiciones[1].minVentas}</strong> ventas, aplica <strong>{emp.condiciones[1].nombre}</strong> en <em>todos</em> sus planes. Las condiciones no se suman.
                </p>
                {emp.condiciones[1].minVentas <= emp.condiciones[0].minVentas && emp.condiciones[1].minVentas > 0 && (
                  <p className="text-xs text-red-600 font-medium">⚠ Condición 2 debe tener más ventas que Condición 1</p>
                )}
              </div>
              <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl p-5">
                <h3 className="font-semibold text-gray-800 text-sm mb-3">Precios por plan</h3>
                <PlanesTable empresa={emp} onChange={updated => updateEmpresa(empIdx, updated)} />
              </div>
            </div>
          ))}
        </div>
      </div>
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-sm font-medium px-5 py-2.5 rounded-xl shadow-lg flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
          {toast}
        </div>
      )}
    </div>
  );
}

// ─── Step 3: Results ──────────────────────────────────────────────────────────

interface ResultsStageProps {
  titulo: string;
  accentColor: string;
  resultados: ResultadosComisiones;
  condiciones: [Condicion, Condicion];
  config: ComisionesConfig;
  fileName: string;
  onFaltaChange: (nombre: string, faltas: number) => void;
  onOverrideChange: (nombre: string, override: 'condicion1' | 'condicion2' | null) => void;
  onVolver: () => void;
  onReset: () => void;
}

function KpiCard({ label, value, sub, borderColor }: { label: string; value: string; sub?: string; borderColor: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4" style={{ borderTop: `3px solid ${borderColor}` }}>
      <p className="text-xs font-medium text-gray-500 mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function ResultsStage({ titulo, accentColor, resultados, condiciones, config, fileName, onFaltaChange, onOverrideChange, onVolver, onReset }: ResultsStageProps) {
  const [exportXls, setExportXls] = useState(false);
  const [exportPptx, setExportPptx] = useState(false);

  const totalVend = resultados.vendedores.length;
  const { vendedoresConFaltas, vendedoresBajoPorFalta, vendedoresSinCondicion } = resultados;

  return (
    <div className="flex flex-col h-full">
      <Header title={titulo} />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-6xl mx-auto space-y-6">

          {/* Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-bold text-gray-900 text-lg">Resultados — {titulo}</h2>
              <p className="text-xs text-gray-400 mt-0.5">{fileName} · {totalVend} vendedores</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => { setExportXls(true); setTimeout(() => { exportarExcelComisiones(resultados, config, titulo); setExportXls(false); }, 50); }}
                disabled={exportXls}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-60 transition-colors"
              >
                <FileSpreadsheet size={15} />
                {exportXls ? 'Exportando…' : 'Excel'}
              </button>
              <button
                onClick={async () => { setExportPptx(true); try { await exportarPPTXComisiones(resultados, config, titulo); } finally { setExportPptx(false); } }}
                disabled={exportPptx}
                className="flex items-center gap-2 px-4 py-2 bg-[#003DA5] text-white rounded-lg text-sm font-semibold hover:bg-blue-800 disabled:opacity-60 transition-colors"
              >
                <DownloadCloud size={15} />
                {exportPptx ? 'Exportando…' : 'PowerPoint'}
              </button>
              <button onClick={onVolver} className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
                Reconfigurar
              </button>
              <button onClick={onReset} className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-500 hover:bg-gray-50 transition-colors">
                Nuevo archivo
              </button>
            </div>
          </div>

          {/* KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
            <KpiCard label="Total a comisionar" value={fmtPesos(resultados.totalAPagar)} borderColor="#28a745" />
            <KpiCard
              label={`En condición alta`}
              value={String(resultados.vendedoresCondicion2)}
              sub={`de ${totalVend} vendedores`}
              borderColor={accentColor}
            />
            <KpiCard
              label="Bajo mínimo"
              value={String(vendedoresSinCondicion)}
              sub="Comisionan por condición base"
              borderColor="#E3000F"
            />
            <KpiCard
              label="Con faltas"
              value={String(vendedoresConFaltas)}
              sub={vendedoresBajoPorFalta > 0 ? `${vendedoresBajoPorFalta} bajaron de condición` : vendedoresConFaltas === 0 ? 'Sin faltas ✓' : 'Sin impacto en condición'}
              borderColor={vendedoresConFaltas > 0 ? '#fd7e14' : '#28a745'}
            />
            <KpiCard label="Promedio de comisión" value={fmtPesos(resultados.promedioComision)} borderColor="#6f42c1" />
          </div>

          {/* Main table */}
          <div className="bg-white border border-gray-200 rounded-xl">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-800 text-sm uppercase tracking-wide">Comisiones por Vendedor</h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Click en fila para ver desglose · Editá "Faltas" para recalcular en tiempo real · Lápiz ✏ para ajustar condición manualmente
              </p>
            </div>
            <ResultadosTable
              vendedores={resultados.vendedores}
              condiciones={condiciones}
              onFaltaChange={onFaltaChange}
              onOverrideChange={onOverrideChange}
            />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="font-bold text-gray-800 text-sm uppercase tracking-wide mb-3">Ranking de Comisiones</h3>
              <RankingComisionesChart vendedores={resultados.vendedores} />
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="font-bold text-gray-800 text-sm uppercase tracking-wide mb-3">Condiciones</h3>
              <CondicionDonutChart vendedores={resultados.vendedores} />
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h3 className="font-bold text-gray-800 text-sm uppercase tracking-wide mb-3">Ventas por Plan</h3>
            <VentasPorPlanChart planes={resultados.resumenPorPlan} />
          </div>

          {/* Resumen por plan */}
          <div className="bg-white border border-gray-200 rounded-xl">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-800 text-sm uppercase tracking-wide">Resumen por Plan</h3>
            </div>
            <div className="overflow-x-auto px-5 pb-5 pt-3">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    {['Plan', 'Renovaciones', 'Altas', 'Cambios', 'Total gest.', 'Comisión generada'].map(h => (
                      <th key={h} className="py-2 px-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {resultados.resumenPorPlan.map(p => (
                    <tr key={p.plan} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-2 px-3 font-medium text-gray-800">{p.plan}</td>
                      <td className="py-2 px-3 text-gray-600">{p.renovaciones}</td>
                      <td className="py-2 px-3 text-gray-600">{p.altas}</td>
                      <td className="py-2 px-3 text-gray-600">{p.cambios}</td>
                      <td className="py-2 px-3 font-semibold text-gray-800">{p.total}</td>
                      <td className="py-2 px-3 font-bold text-green-700">{fmtPesos(p.comisionTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

// ─── Proyeccion view ──────────────────────────────────────────────────────────

interface PlanQty { renov: number; altas: number; cambios: number; }

function ProyeccionView({ storageKey, titulo, accentColor }: { storageKey: string; titulo: string; accentColor: string }) {
  const config = loadConfig(storageKey);
  const [quantities, setQuantities] = useState<Map<string, PlanQty>>(() => new Map());
  const [copied, setCopied] = useState(false);

  const empresa = config?.empresas[0] ?? null;
  const planes = empresa?.planes.filter(p => p.activo && !p.noConfig) ?? [];
  const condiciones: [Condicion, Condicion] = empresa?.condiciones ?? [
    { id: 'condicion1', nombre: 'Condición 1', minVentas: 60, descripcion: '' },
    { id: 'condicion2', nombre: 'Condición 2', minVentas: 90, descripcion: '' },
  ];
  const [cond1, cond2] = condiciones;

  const totalRenov  = planes.reduce((s, p) => s + (quantities.get(p.id)?.renov  ?? 0), 0);
  const totalAltas  = planes.reduce((s, p) => s + (quantities.get(p.id)?.altas  ?? 0), 0);
  const totalCambios = planes.reduce((s, p) => s + (quantities.get(p.id)?.cambios ?? 0), 0);
  const totalVentas = totalRenov + totalAltas + totalCambios;

  const condResult = getCondicionAplicable(totalVentas, 0, condiciones);
  const condKey = condResult.condicionId;

  const comisionTotal = planes.reduce((sum, plan) => {
    const qty = quantities.get(plan.id);
    if (!qty) return sum;
    const pr = plan.precios[condKey];
    return sum + qty.renov * pr.renovacion + qty.altas * pr.alta + qty.cambios * pr.cambio;
  }, 0);

  const promedio = totalVentas > 0 ? comisionTotal / totalVentas : 0;

  const nextMin = condResult.condicionId === 'condicion1' ? cond2.minVentas : null;
  const progressPct = nextMin ? Math.min(100, (totalVentas / nextMin) * 100) : 100;

  const gainSiCond2 = condResult.condicionId === 'condicion1' ? (() => {
    const c2total = planes.reduce((sum, plan) => {
      const qty = quantities.get(plan.id);
      if (!qty) return sum;
      const pr = plan.precios['condicion2'];
      return sum + qty.renov * pr.renovacion + qty.altas * pr.alta + qty.cambios * pr.cambio;
    }, 0);
    return c2total - comisionTotal;
  })() : null;

  function updateQty(planId: string, field: keyof PlanQty, val: number) {
    setQuantities(prev => {
      const next = new Map(prev);
      const cur = next.get(planId) ?? { renov: 0, altas: 0, cambios: 0 };
      next.set(planId, { ...cur, [field]: Math.max(0, val) });
      return next;
    });
  }

  function handleCopiar() {
    const lines = [
      `Proyección — ${titulo}`,
      `Total ventas: ${totalVentas}`,
      `Condición: ${condResult.nombreCondicion}`,
      `Comisión proyectada: ${fmtPesos(comisionTotal)}`,
      `Promedio por venta: ${promedio > 0 ? fmtPesos(promedio) : '—'}`,
    ];
    navigator.clipboard.writeText(lines.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleExportar() {
    const rows = planes.map(plan => {
      const qty = quantities.get(plan.id) ?? { renov: 0, altas: 0, cambios: 0 };
      const pr = plan.precios[condKey];
      return {
        plan: plan.nombre,
        renov: qty.renov,
        altas: qty.altas,
        cambios: qty.cambios,
        subtotal: qty.renov * pr.renovacion + qty.altas * pr.alta + qty.cambios * pr.cambio,
      };
    });
    exportarExcelProyeccion(rows, condResult.nombreCondicion, comisionTotal, titulo);
  }

  if (!empresa || planes.length === 0) {
    return (
      <div className="flex flex-col h-full">
        <Header title={titulo} />
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center space-y-2">
            <p className="text-gray-600 font-semibold">Sin configuración disponible</p>
            <p className="text-gray-400 text-sm">Cargá y configurá un archivo en la pestaña Liquidación para poder proyectar comisiones.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <Header title={titulo} />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-5xl mx-auto space-y-6">

          {/* Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-bold text-gray-900 text-lg">Calculadora de Proyección</h2>
              <p className="text-xs text-gray-400 mt-0.5">Simulá cuánto comisionarías según tus ventas estimadas — independiente del archivo Excel</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button onClick={handleCopiar} className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                <Copy size={14} />
                {copied ? 'Copiado ✓' : 'Copiar resumen'}
              </button>
              <button onClick={handleExportar} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 transition-colors">
                <FileSpreadsheet size={14} />
                Exportar Excel
              </button>
              <button onClick={() => setQuantities(new Map())} className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-500 hover:bg-gray-50 transition-colors">
                Limpiar
              </button>
            </div>
          </div>

          {/* KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard label="Total ventas" value={String(totalVentas)} borderColor="#003DA5" />
            <KpiCard
              label="Condición activa"
              value={condResult.nombreCondicion}
              sub={totalVentas === 0 ? 'Sin ventas aún' : totalVentas < cond1.minVentas ? 'Bajo mínimo' : `≥ ${condResult.condicionId === 'condicion1' ? cond1.minVentas : cond2.minVentas} ventas`}
              borderColor={condResult.condicionId === 'condicion2' ? accentColor : '#E3000F'}
            />
            <KpiCard label="Comisión proyectada" value={fmtPesos(comisionTotal)} borderColor="#28a745" />
            <KpiCard label="Promedio por venta" value={promedio > 0 ? fmtPesos(promedio) : '—'} borderColor="#6f42c1" />
          </div>

          {/* Progress bar toward cond2 */}
          {nextMin && (
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-semibold text-gray-700">Progreso hacia {cond2.nombre}</span>
                <span className="text-sm text-gray-500">{totalVentas} / {nextMin} ventas ({Math.round(progressPct)}%)</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-3">
                <div
                  className="h-3 rounded-full transition-all duration-300"
                  style={{ width: `${progressPct}%`, backgroundColor: progressPct >= 100 ? '#28a745' : accentColor }}
                />
              </div>
              <p className="text-xs text-gray-400 mt-2">
                {totalVentas >= nextMin
                  ? `Alcanzaste ${cond2.nombre} ✓`
                  : `Faltan ${nextMin - totalVentas} ventas para ${cond2.nombre}`}
              </p>
            </div>
          )}

          {/* Impact card */}
          {gainSiCond2 !== null && gainSiCond2 > 0 && totalVentas > 0 && (
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 flex items-center gap-3">
              <span className="text-2xl">💡</span>
              <div>
                <p className="text-sm font-bold text-purple-800">
                  Si llegás a {cond2.minVentas} ventas, ganarías {fmtPesos(gainSiCond2)} más
                </p>
                <p className="text-xs text-purple-600 mt-0.5">
                  Comisión con {cond2.nombre}: {fmtPesos(comisionTotal + gainSiCond2)} vs. {fmtPesos(comisionTotal)} actual
                </p>
              </div>
            </div>
          )}

          {/* Table */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-800 text-sm uppercase tracking-wide">Ventas por Plan</h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Precios en condición activa: <strong>{condResult.nombreCondicion}</strong>
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Plan</th>
                    <th className="px-3 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Renovaciones</th>
                    <th className="px-3 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Altas</th>
                    <th className="px-3 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Cambios</th>
                    <th className="px-3 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {planes.map(plan => {
                    const qty = quantities.get(plan.id) ?? { renov: 0, altas: 0, cambios: 0 };
                    const pr = plan.precios[condKey];
                    const subtotal = qty.renov * pr.renovacion + qty.altas * pr.alta + qty.cambios * pr.cambio;
                    const totalPlan = qty.renov + qty.altas + qty.cambios;
                    return (
                      <tr key={plan.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-800">{plan.nombre}</td>
                        {(['renov', 'altas', 'cambios'] as const).map(field => (
                          <td key={field} className="px-3 py-2 text-center">
                            <input
                              type="number"
                              min={0}
                              value={qty[field] || ''}
                              placeholder="0"
                              onChange={e => updateQty(plan.id, field, parseInt(e.target.value) || 0)}
                              className="w-16 text-center border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                            />
                          </td>
                        ))}
                        <td className="px-4 py-3 text-right font-semibold text-gray-800">
                          {totalPlan > 0 ? fmtPesos(subtotal) : <span className="text-gray-300">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-300 bg-gray-50 font-bold">
                    <td className="px-4 py-3 text-gray-800 uppercase text-xs tracking-wide">Total</td>
                    <td className="px-3 py-3 text-center text-gray-700">{totalRenov || '—'}</td>
                    <td className="px-3 py-3 text-center text-gray-700">{totalAltas || '—'}</td>
                    <td className="px-3 py-3 text-center text-gray-700">{totalCambios || '—'}</td>
                    <td className="px-4 py-3 text-right text-green-700 text-base">{fmtPesos(comisionTotal)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

// ─── Module orchestrator ──────────────────────────────────────────────────────

function ComisionesModule({ storageKey, titulo, accentColor }: ComisionesModuleProps) {
  const {
    comisionesMovil, setComisionesMovil, clearComisionesMovil,
    comisionesFibra, setComisionesFibra, clearComisionesFibra,
  } = useAnalisisStore();
  const isMovil = storageKey === 'elared_comisiones_movil';
  const storeEntry = isMovil ? comisionesMovil : comisionesFibra;
  const saveToStore = isMovil ? setComisionesMovil : setComisionesFibra;
  const clearStore = isMovil ? clearComisionesMovil : clearComisionesFibra;

  const [mainTab, setMainTab] = useState<'liquidacion' | 'proyeccion'>('liquidacion');
  const [stage, setStage] = useState<Stage>(() => storeEntry ? 'results' : 'upload');
  const [config, setConfig] = useState<ComisionesConfig | null>(() => storeEntry?.config ?? null);
  const [resumen, setResumen] = useState(() => storeEntry?.resumen ?? { vendedores: 0, planes: 0, gestiones: 0, fileName: '' });
  const [ventasRaw, setVentasRaw] = useState<ReturnType<typeof extractVentasRaw>>(() => storeEntry?.ventasRaw ?? []);
  const [error, setError] = useState<string | null>(null);
  const [empresaDetectada, setEmpresaDetectada] = useState<EmpresaDetectada | null>(() => storeEntry?.empresaDetectada ?? null);

  // Faltas and overrides — drive real-time recalculation
  const [faltasPorVendedor, setFaltasPorVendedor] = useState<Map<string, number>>(() => storeEntry?.faltasPorVendedor ?? new Map());
  const [overridesPorVendedor, setOverridesPorVendedor] = useState<Map<string, 'condicion1' | 'condicion2' | null>>(() => storeEntry?.overridesPorVendedor ?? new Map());

  // Derived resultados — recomputed whenever inputs change
  const [resultados, setResultados] = useState<ResultadosComisiones | null>(null);

  // Recompute resultados whenever ventas, config, faltas, or overrides change
  useEffect(() => {
    if (!config || ventasRaw.length === 0) return;
    setResultados(calcularComisiones(ventasRaw, config, faltasPorVendedor, overridesPorVendedor));
  }, [ventasRaw, config, faltasPorVendedor, overridesPorVendedor]);

  // Seed Sarandí on mount
  useEffect(() => { initSarandiConfig(storageKey); }, [storageKey]);

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    try {
      const result = await parseExcel(file, 'ventas');
      const raw = extractVentasRaw(result.rows, result.columnMap);
      if (raw.length === 0) throw new Error('No se detectaron ventas en el archivo. Verificá que tenga columnas de Vendedor, Plan y Motivo.');

      const empresaCounts = new Map<string, number>();
      for (const v of raw) { const eid = detectarEmpresaId(v.empresa); empresaCounts.set(eid, (empresaCounts.get(eid) ?? 0) + 1); }
      const primaryId = [...empresaCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
      const empresa = { id: primaryId, nombre: getNombreEmpresa(primaryId) || primaryId, reconocida: isEmpresaReconocida(primaryId) };
      setEmpresaDetectada(empresa);

      const saved = loadConfig(storageKey);
      const cfg = buildConfigFromVentas(raw, saved);
      const emptyFaltas = new Map<string, number>();
      const emptyOverrides = new Map<string, 'condicion1' | 'condicion2' | null>();
      const res = { vendedores: new Set(raw.map(v => v.vendedor)).size, planes: new Set(raw.map(v => v.plan)).size, gestiones: raw.length, fileName: file.name };

      setVentasRaw(raw);
      setConfig(cfg);
      setFaltasPorVendedor(emptyFaltas);
      setOverridesPorVendedor(emptyOverrides);
      setResumen(res);
      recordActivity(storageKey === 'elared_comisiones_movil' ? 'comisiones_movil' : 'comisiones_fibra', file.name);
      saveToStore({ ventasRaw: raw, config: cfg, resumen: res, empresaDetectada: empresa, faltasPorVendedor: emptyFaltas, overridesPorVendedor: emptyOverrides, nombreArchivo: file.name });
      setStage('configure');
    } catch (e) {
      setError((e as Error).message);
    }
  }, [storageKey, saveToStore]);

  const handleApplyTemplate = useCallback((templateId: string) => {
    if (!config || !empresaDetectada) return;
    const template = templateId === 'sarandi' ? SARANDI_CONFIG : null;
    if (!template) return;
    const empresas = config.empresas.map(e => e.id === empresaDetectada.id ? aplicarTemplateEmpresa(e, template) : e);
    setConfig({ ...config, empresas });
    setEmpresaDetectada({ id: template.id, nombre: template.nombre, reconocida: true });
  }, [config, empresaDetectada]);

  const handleCalcular = useCallback(() => {
    if (!config || ventasRaw.length === 0) return;
    setResultados(calcularComisiones(ventasRaw, config, faltasPorVendedor, overridesPorVendedor));
    saveToStore({ ventasRaw, config, resumen, empresaDetectada: empresaDetectada!, faltasPorVendedor, overridesPorVendedor, nombreArchivo: resumen.fileName });
    setStage('results');
  }, [config, ventasRaw, faltasPorVendedor, overridesPorVendedor, resumen, empresaDetectada, saveToStore]);

  const handleFaltaChange = useCallback((nombre: string, faltas: number) => {
    setFaltasPorVendedor(prev => {
      const next = new Map(prev);
      if (faltas === 0) next.delete(nombre); else next.set(nombre, faltas);
      if (config && ventasRaw.length > 0)
        saveToStore({ ventasRaw, config, resumen, empresaDetectada: empresaDetectada!, faltasPorVendedor: next, overridesPorVendedor, nombreArchivo: resumen.fileName });
      return next;
    });
  }, [ventasRaw, config, resumen, empresaDetectada, overridesPorVendedor, saveToStore]);

  const handleOverrideChange = useCallback((nombre: string, override: 'condicion1' | 'condicion2' | null) => {
    setOverridesPorVendedor(prev => {
      const next = new Map(prev);
      if (override === null) next.delete(nombre); else next.set(nombre, override);
      if (config && ventasRaw.length > 0)
        saveToStore({ ventasRaw, config, resumen, empresaDetectada: empresaDetectada!, faltasPorVendedor, overridesPorVendedor: next, nombreArchivo: resumen.fileName });
      return next;
    });
  }, [ventasRaw, config, resumen, empresaDetectada, faltasPorVendedor, saveToStore]);

  const handleReset = useCallback(() => {
    clearStore();
    setStage('upload');
    setConfig(null);
    setResultados(null);
    setError(null);
    setEmpresaDetectada(null);
    setFaltasPorVendedor(new Map());
    setOverridesPorVendedor(new Map());
  }, [clearStore]);

  // Get condiciones for the results table dropdown
  const condicionesActivas: [Condicion, Condicion] = config?.empresas[0]?.condiciones ?? [
    { id: 'condicion1', nombre: 'Condición 1', minVentas: 60, descripcion: '' },
    { id: 'condicion2', nombre: 'Condición 2', minVentas: 90, descripcion: '' },
  ];

  function renderLiquidacion() {
    if (stage === 'configure' && config) {
      return (
        <ConfigStage
          titulo={titulo}
          storageKey={storageKey}
          config={config}
          onConfigChange={setConfig}
          resumenArchivo={resumen}
          empresaDetectada={empresaDetectada}
          onApplyTemplate={handleApplyTemplate}
          onCalcular={handleCalcular}
          onReset={handleReset}
        />
      );
    }
    if (stage === 'results' && resultados && config) {
      return (
        <ResultsStage
          titulo={titulo}
          accentColor={accentColor}
          resultados={resultados}
          condiciones={condicionesActivas}
          config={config}
          fileName={resumen.fileName}
          onFaltaChange={handleFaltaChange}
          onOverrideChange={handleOverrideChange}
          onVolver={() => setStage('configure')}
          onReset={handleReset}
        />
      );
    }
    return <UploadStage titulo={titulo} accentColor={accentColor} onFile={handleFile} />;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Sub-navigation tabs */}
      <div className="bg-white border-b border-gray-200 px-6 flex items-center gap-1 h-11 flex-shrink-0">
        {(['liquidacion', 'proyeccion'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setMainTab(tab)}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
              mainTab === tab
                ? 'bg-blue-50 text-blue-700'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            {tab === 'liquidacion' ? '📊 Liquidación' : '🧮 Proyección'}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-hidden min-h-0">
        {mainTab === 'proyeccion'
          ? <ProyeccionView storageKey={storageKey} titulo={titulo} accentColor={accentColor} />
          : renderLiquidacion()
        }
      </div>
      {error && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-red-600 text-white text-sm font-medium px-5 py-2.5 rounded-xl shadow-lg">
          {error}
        </div>
      )}
    </div>
  );
}

// ─── Exports ──────────────────────────────────────────────────────────────────

export { ComisionesModule };

export default function ComisionesMovilModule() {
  return <ComisionesModule storageKey="elared_comisiones_movil" titulo="Comisiones Móvil" accentColor="#6f42c1" />;
}
