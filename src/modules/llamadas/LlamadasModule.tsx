import { useState, useCallback, useMemo, useRef } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Upload, FileText, AlertCircle, Download, Phone, PhoneIncoming, PhoneOff,
  PhoneCall, DollarSign, Users, Hash, ChevronUp, ChevronDown,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell, PieChart, Pie, LabelList,
} from 'recharts';
import type { LlamadasData } from './llamadasParser';
import { parseLlamadas, ddmmyyyy } from './llamadasParser';
import type { LlamadasResult } from './llamadasAnalysis';
import { computeLlamadas } from './llamadasAnalysis';
import {
  exportOperadores, exportStatus, exportMatriz, exportHora,
  exportDesenlace, exportHoraEstado, exportDuplicados, exportTodo,
} from './LlamadasExport';
import Header from '../../components/Header';
import { recordActivity } from '../../utils/activityTracker';
import { useAnalisisStore, formatFechaCarga } from '../../store/analisisStore';

// ─── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (n: number) => new Intl.NumberFormat('es-UY').format(n);
const pct = (a: number, b: number) => (b ? (a / b) * 100 : 0);
const pf = (a: number, b: number, d = 1) => `${pct(a, b).toFixed(d)}%`;

const ANTEL_PALETTE = [
  '#003DA5', '#E3000F', '#28a745', '#fd7e14', '#6f42c1',
  '#20c997', '#0052CC', '#ffc107', '#6c757d', '#4D94FF',
];

// ─── KPI card ─────────────────────────────────────────────────────────────────

function KpiCard({ icon: Icon, label, value, sub, accent, badge }: {
  icon: LucideIcon; label: string; value: string; sub?: string; accent: string;
  badge?: { text: string; tone: 'green' | 'red' };
}) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm" style={{ borderTop: `4px solid ${accent}` }}>
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg flex-shrink-0 mt-0.5" style={{ background: `${accent}1A` }}>
          <Icon size={20} style={{ color: accent }} />
        </div>
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">{label}</div>
          <div className="text-2xl font-bold leading-none mt-1 truncate" style={{ color: accent }}>{value}</div>
          {sub && (
            <div className="text-xs text-gray-400 mt-1 flex items-center gap-1.5">
              {badge && (
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                  badge.tone === 'green' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                }`}>{badge.text}</span>
              )}
              <span>{sub}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Section wrapper + export button ───────────────────────────────────────────

function ExportButton({ onClick, label = 'Exportar Excel' }: { onClick: () => void; label?: string }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 text-xs font-medium text-white rounded-lg px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 transition-colors"
    >
      <Download size={13} /> {label}
    </button>
  );
}

function SectionCard({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <h2 className="text-base font-semibold text-slate-800">{title}</h2>
        {action}
      </div>
      {children}
    </div>
  );
}

// ─── Upload screen — multi-archivo ─────────────────────────────────────────────

function UploadScreen({ onFiles }: { onFiles: (files: File[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length) onFiles(files);
  }

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="max-w-md w-full space-y-4">
        <div className="text-center mb-2">
          <PhoneCall size={40} className="text-blue-400 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-slate-800">Tiempo de Llamadas</h2>
          <p className="text-sm text-slate-500 mt-1">
            Cargá uno o más archivos de llamadas. El sistema los combina automáticamente.
          </p>
        </div>
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-colors
            ${dragging ? 'border-[#003DA5] bg-blue-50' : 'border-slate-300 hover:border-blue-300 hover:bg-slate-50'}`}
        >
          <Upload size={32} className="mx-auto mb-3 text-slate-400" />
          <p className="text-sm font-medium text-slate-700">Arrastrá los archivos aquí</p>
          <p className="text-xs text-slate-400 mt-1">o hacé clic para seleccionar (podés elegir varios)</p>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            multiple
            className="hidden"
            onChange={e => { const files = Array.from(e.target.files ?? []); if (files.length) onFiles(files); }}
          />
        </div>
        <p className="text-xs text-slate-400 text-center">
          El archivo se procesa localmente. No se envía a ningún servidor.
        </p>
      </div>
    </div>
  );
}

// ─── Sección 1: Atendidas por operador ─────────────────────────────────────────

type OpSortKey = 'user' | 'total' | 'aten' | 'pctAtend' | 'ventas';

function OperadorTh({ label, k, sortKey, asc, onToggle }: {
  label: string; k: OpSortKey; sortKey: OpSortKey; asc: boolean; onToggle: (k: OpSortKey) => void;
}) {
  return (
    <th
      onClick={() => onToggle(k)}
      className="px-3 py-2.5 text-left text-xs font-semibold text-slate-600 whitespace-nowrap cursor-pointer select-none hover:text-slate-900"
    >
      {label}
      <span className="ml-0.5 inline-flex align-middle">
        {sortKey === k
          ? (asc ? <ChevronUp size={11} className="text-blue-600" /> : <ChevronDown size={11} className="text-blue-600" />)
          : <ChevronDown size={11} className="text-slate-300" />}
      </span>
    </th>
  );
}

function OperadoresSection({ data, R, onExport }: { data: LlamadasData; R: LlamadasResult; onExport: () => void }) {
  void data;
  const [sortKey, setSortKey] = useState<OpSortKey>('aten');
  const [asc, setAsc] = useState(false);

  const rows = useMemo(() => Object.keys(R.perUser).map(u => {
    const p = R.perUser[u]!;
    return { user: u, total: p.total, aten: p.aten, pctAtend: pct(p.aten, p.total), ventas: p.ventas };
  }), [R]);

  const sorted = useMemo(() => [...rows].sort((a, b) => {
    let va: string | number, vb: string | number;
    switch (sortKey) {
      case 'user':     va = a.user;     vb = b.user;     break;
      case 'total':    va = a.total;    vb = b.total;    break;
      case 'aten':     va = a.aten;     vb = b.aten;     break;
      case 'pctAtend': va = a.pctAtend; vb = b.pctAtend; break;
      default:         va = a.ventas;   vb = b.ventas;   break;
    }
    if (typeof va === 'string' && typeof vb === 'string') return asc ? va.localeCompare(vb) : vb.localeCompare(va);
    return asc ? (va as number) - (vb as number) : (vb as number) - (va as number);
  }), [rows, sortKey, asc]);

  function toggleSort(key: OpSortKey) {
    if (sortKey === key) setAsc(a => !a);
    else { setSortKey(key); setAsc(false); }
  }

  const maxPct = Math.max(1, ...rows.map(r => r.pctAtend));
  const top15 = useMemo(() => [...rows]
    .filter(r => r.user !== 'VDAD')
    .sort((a, b) => b.aten - a.aten)
    .slice(0, 15)
    .map(r => ({ name: r.user, aten: r.aten })), [rows]);

  return (
    <SectionCard title="1. Atendidas por operador" action={<ExportButton onClick={onExport} />}>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="overflow-x-auto rounded-xl border border-slate-200 max-h-[420px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
              <tr>
                <OperadorTh label="Operador" k="user" sortKey={sortKey} asc={asc} onToggle={toggleSort} />
                <OperadorTh label="Llamadas" k="total" sortKey={sortKey} asc={asc} onToggle={toggleSort} />
                <OperadorTh label="Atendidas" k="aten" sortKey={sortKey} asc={asc} onToggle={toggleSort} />
                <OperadorTh label="% Atend." k="pctAtend" sortKey={sortKey} asc={asc} onToggle={toggleSort} />
                <OperadorTh label="Ventas" k="ventas" sortKey={sortKey} asc={asc} onToggle={toggleSort} />
              </tr>
            </thead>
            <tbody>
              {sorted.map((r, i) => (
                <tr key={r.user} className={`border-b border-slate-100 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50'} hover:bg-blue-50`}>
                  <td className="px-3 py-2 font-medium text-slate-800">{r.user}</td>
                  <td className="px-3 py-2 text-right text-slate-600">{fmt(r.total)}</td>
                  <td className="px-3 py-2 text-right text-slate-600">{fmt(r.aten)}</td>
                  <td className="px-3 py-2 text-right relative">
                    <div className="absolute inset-y-0 left-0 bg-blue-50" style={{ width: `${(r.pctAtend / maxPct) * 100}%` }} />
                    <span className="relative text-slate-700">{r.pctAtend.toFixed(1)}%</span>
                  </td>
                  <td className="px-3 py-2 text-right text-slate-600">{fmt(r.ventas)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ResponsiveContainer width="100%" height={Math.max(260, top15.length * 28)}>
          <BarChart data={top15} layout="vertical" margin={{ top: 4, right: 40, left: 4, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 10 }} />
            <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 10 }} />
            <Tooltip />
            <Bar dataKey="aten" name="Atendidas" fill="#003DA5" radius={[0, 3, 3, 0]}>
              <LabelList dataKey="aten" position="right" style={{ fontSize: 10 }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </SectionCard>
  );
}

// ─── Sección 2: Distribución por status ────────────────────────────────────────

function StatusSection({ data, R, onExport }: { data: LlamadasData; R: LlamadasResult; onExport: () => void }) {
  const so = useMemo(() => data.stats.map((s, i) => [s, i] as const)
    .sort((a, b) => R.statusC[b[1]]! - R.statusC[a[1]]!), [data, R]);
  const maxCant = Math.max(1, ...so.map(([, i]) => R.statusC[i]!));
  const top10 = so.slice(0, 10).map(([s, i]) => ({ name: s, value: R.statusC[i]! }));

  return (
    <SectionCard title="2. Distribución por status" action={<ExportButton onClick={onExport} />}>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="overflow-x-auto rounded-xl border border-slate-200 max-h-[420px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
              <tr>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-600">Status</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-600">Descripción</th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold text-slate-600">Cantidad</th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold text-slate-600">%</th>
              </tr>
            </thead>
            <tbody>
              {so.map(([s, i], idx) => (
                <tr key={s} className={`border-b border-slate-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
                  <td className="px-3 py-2 font-medium text-slate-800">{s}</td>
                  <td className="px-3 py-2 text-slate-500">{data.status_name[s] ?? ''}</td>
                  <td className="px-3 py-2 text-right relative">
                    <div className="absolute inset-y-0 left-0 bg-blue-50" style={{ width: `${(R.statusC[i]! / maxCant) * 100}%` }} />
                    <span className="relative text-slate-700">{fmt(R.statusC[i]!)}</span>
                  </td>
                  <td className="px-3 py-2 text-right text-slate-600">{pf(R.statusC[i]!, R.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ResponsiveContainer width="100%" height={320}>
          <PieChart>
            <Pie data={top10} dataKey="value" nameKey="name" cx="38%" cy="50%" innerRadius={55} outerRadius={95} paddingAngle={2}>
              {top10.map((_, i) => <Cell key={i} fill={ANTEL_PALETTE[i % ANTEL_PALETTE.length]} />)}
            </Pie>
            <Tooltip />
            <Legend layout="vertical" align="right" verticalAlign="middle" iconType="circle" iconSize={9} wrapperStyle={{ fontSize: 11 }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </SectionCard>
  );
}

// ─── Sección 3: Matriz operador × status ───────────────────────────────────────

function MatrixSection({ data, R, onExport }: { data: LlamadasData; R: LlamadasResult; onExport: () => void }) {
  const users = useMemo(() => Object.keys(R.perUser).sort((a, b) => R.perUser[b]!.total - R.perUser[a]!.total), [R]);
  const so = useMemo(() => data.stats.map((s, i) => [s, i] as const)
    .sort((a, b) => R.statusC[b[1]]! - R.statusC[a[1]]!), [data, R]);

  return (
    <SectionCard title="3. Matriz operador × status" action={<ExportButton onClick={onExport} />}>
      <div className="overflow-auto rounded-xl border border-slate-200 max-h-[480px]">
        <table className="text-sm border-collapse">
          <thead className="sticky top-0 z-10">
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-600 sticky left-0 bg-slate-50 z-20">Operador</th>
              <th className="px-3 py-2.5 text-right text-xs font-semibold text-slate-600">Total</th>
              {so.map(([s]) => (
                <th key={s} className="px-3 py-2.5 text-right text-xs font-semibold text-slate-600 whitespace-nowrap">{s}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map((u, idx) => {
              const p = R.perUser[u]!;
              const bg = idx % 2 === 0 ? 'bg-white' : 'bg-slate-50';
              return (
                <tr key={u} className={`border-b border-slate-100 ${bg} hover:bg-blue-50`}>
                  <td className={`px-3 py-2 font-medium text-slate-800 whitespace-nowrap sticky left-0 ${bg}`}>{u}</td>
                  <td className="px-3 py-2 text-right text-slate-600">{fmt(p.total)}</td>
                  {so.map(([, i]) => {
                    const v = p.statusC[i] ?? 0;
                    return (
                      <td key={i} className="px-3 py-2 text-right text-slate-600">
                        {v ? fmt(v) : <span className="text-slate-300">·</span>}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}

// ─── Sección 4: Distribución por hora ──────────────────────────────────────────

function HoraSection({ data, R, onExport }: { data: LlamadasData; R: LlamadasResult; onExport: () => void }) {
  void data;
  const hours = useMemo(() => Object.keys(R.hourTotal).map(Number).sort((a, b) => a - b), [R]);

  let peakHour = hours[0] ?? 0, peakVal = -1;
  hours.forEach(h => { const a = R.hourAten[h] ?? 0; if (a > peakVal) { peakVal = a; peakHour = h; } });

  const rows = hours.map(h => {
    const at = R.hourAten[h] ?? 0, tot = R.hourTotal[h] ?? 0;
    return { h, tot, at, pctAtencion: pct(at, R.aten), pctVolumen: pct(tot, R.total), tasa: pct(at, tot) };
  });

  const chartData = rows.map(r => ({
    hora: `${r.h}:00`,
    pctAtencion: parseFloat(r.pctAtencion.toFixed(1)),
    pctVolumen: parseFloat(r.pctVolumen.toFixed(1)),
  }));

  return (
    <SectionCard title="4. Distribución por hora" action={<ExportButton onClick={onExport} />}>
      <div className="mb-4 bg-blue-50 border border-blue-100 text-sm text-slate-600 rounded-xl px-4 py-3">
        Franja con más atenciones:{' '}
        <span className="font-semibold text-[#003DA5]">{peakHour}:00–{peakHour + 1}:00</span> con{' '}
        <span className="font-semibold text-[#003DA5]">{fmt(Math.max(0, peakVal))}</span> atendidas ({pf(Math.max(0, peakVal), R.aten)} del total de atendidas).
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="overflow-x-auto rounded-xl border border-slate-200 max-h-[420px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
              <tr>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-600">Hora</th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold text-slate-600">Llamadas</th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold text-slate-600">Atendidas</th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold text-slate-600">% Atención</th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold text-slate-600">% del volumen</th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold text-slate-600">Tasa atend.</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => (
                <tr key={r.h} className={`border-b border-slate-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
                  <td className="px-3 py-2 font-medium text-slate-800">{r.h}:00</td>
                  <td className="px-3 py-2 text-right text-slate-600">{fmt(r.tot)}</td>
                  <td className="px-3 py-2 text-right text-slate-600">{fmt(r.at)}</td>
                  <td className="px-3 py-2 text-right text-slate-600">{r.pctAtencion.toFixed(1)}%</td>
                  <td className="px-3 py-2 text-right text-slate-600">{r.pctVolumen.toFixed(1)}%</td>
                  <td className="px-3 py-2 text-right text-slate-600">{r.tasa.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis dataKey="hora" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} unit="%" />
            <Tooltip formatter={(v) => `${Number(v).toFixed(1)}%`} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="pctAtencion" name="% de atención" fill="#28a745" />
            <Bar dataKey="pctVolumen" name="% del volumen" fill="#003DA5" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </SectionCard>
  );
}

// ─── Sección 5: Desenlace de atendidas ─────────────────────────────────────────

function DesenlaceSection({ data, R, onExport }: { data: LlamadasData; R: LlamadasResult; onExport: () => void }) {
  const atenNo = R.aten - R.atenVenta;
  const so = useMemo(() => data.stats.map((s, i) => [s, i] as const)
    .filter(([, i]) => (R.atenStatus[i] ?? 0) > 0)
    .sort((a, b) => R.atenStatus[b[1]]! - R.atenStatus[a[1]]!), [data, R]);
  const chartData = so.map(([s, i]) => ({ status: s, value: R.atenStatus[i]! }));

  return (
    <SectionCard title="5. Desenlace de atendidas" action={<ExportButton onClick={onExport} />}>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
        <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
          <div className="text-xs text-slate-500 font-semibold uppercase">Atendidas</div>
          <div className="text-2xl font-bold text-slate-800 mt-1">{fmt(R.aten)}</div>
        </div>
        <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-4">
          <div className="text-xs text-emerald-700 font-semibold uppercase">Fueron venta</div>
          <div className="text-2xl font-bold text-emerald-700 mt-1">
            {fmt(R.atenVenta)} <span className="text-sm font-medium">({pf(R.atenVenta, R.aten)})</span>
          </div>
        </div>
        <div className="bg-red-50 rounded-xl border border-red-200 p-4">
          <div className="text-xs text-red-700 font-semibold uppercase">No fueron venta</div>
          <div className="text-2xl font-bold text-red-700 mt-1">
            {fmt(atenNo)} <span className="text-sm font-medium">({pf(atenNo, R.aten)})</span>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="overflow-x-auto rounded-xl border border-slate-200 max-h-[380px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
              <tr>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-600">Status</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-600">Descripción</th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold text-slate-600">Atendidas</th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold text-slate-600">%</th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold text-slate-600">¿Venta?</th>
              </tr>
            </thead>
            <tbody>
              {so.map(([s, i], idx) => (
                <tr key={s} className={`border-b border-slate-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
                  <td className="px-3 py-2 font-medium text-slate-800">{s}</td>
                  <td className="px-3 py-2 text-slate-500">{data.status_name[s] ?? ''}</td>
                  <td className="px-3 py-2 text-right text-slate-600">{fmt(R.atenStatus[i]!)}</td>
                  <td className="px-3 py-2 text-right text-slate-600">{pf(R.atenStatus[i]!, R.aten)}</td>
                  <td className="px-3 py-2 text-right">
                    {s === 'VENTA'
                      ? <span className="text-emerald-600 font-medium">✓ venta</span>
                      : <span className="text-slate-300">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 55 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis dataKey="status" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" interval={0} height={70} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip />
            <Bar dataKey="value" name="Atendidas" radius={[3, 3, 0, 0]}>
              {chartData.map((d, i) => <Cell key={i} fill={d.status === 'VENTA' ? '#28a745' : '#E3000F'} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </SectionCard>
  );
}

// ─── Sección 6: Llamadas por hora y estado (top 8) ─────────────────────────────

function HoraEstadoSection({ data, R, onExport }: { data: LlamadasData; R: LlamadasResult; onExport: () => void }) {
  const so = useMemo(() => data.stats.map((s, i) => [s, i] as const)
    .sort((a, b) => R.statusC[b[1]]! - R.statusC[a[1]]!), [data, R]);
  const top8 = so.slice(0, 8);
  const hours = useMemo(() => Object.keys(R.hourTotal).map(Number).sort((a, b) => a - b), [R]);

  const chartData = hours.map(h => {
    const row: Record<string, string | number> = { hora: `${h}:00` };
    top8.forEach(([s, i]) => { row[s] = (R.hourStatus[h]?.[i]) ?? 0; });
    return row;
  });

  return (
    <SectionCard title="6. Llamadas por hora y estado" action={<ExportButton onClick={onExport} />}>
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
          <XAxis dataKey="hora" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} />
          <Tooltip />
          <Legend wrapperStyle={{ fontSize: 10 }} />
          {top8.map(([s], i) => (
            <Bar key={s} dataKey={s} stackId="a" name={s} fill={ANTEL_PALETTE[i % ANTEL_PALETTE.length]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
      <div className="overflow-auto rounded-xl border border-slate-200 max-h-[380px] mt-4">
        <table className="text-sm border-collapse">
          <thead className="sticky top-0 z-10">
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-600 sticky left-0 bg-slate-50 z-20">Hora</th>
              <th className="px-3 py-2.5 text-right text-xs font-semibold text-slate-600">Total</th>
              {top8.map(([s]) => (
                <th key={s} className="px-3 py-2.5 text-right text-xs font-semibold text-slate-600 whitespace-nowrap">{s}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {hours.map((h, idx) => {
              const bg = idx % 2 === 0 ? 'bg-white' : 'bg-slate-50';
              return (
                <tr key={h} className={`border-b border-slate-100 ${bg}`}>
                  <td className={`px-3 py-2 font-medium text-slate-800 sticky left-0 ${bg}`}>{h}:00</td>
                  <td className="px-3 py-2 text-right text-slate-600">{fmt(R.hourTotal[h] ?? 0)}</td>
                  {top8.map(([, i]) => {
                    const v = (R.hourStatus[h]?.[i]) ?? 0;
                    return (
                      <td key={i} className="px-3 py-2 text-right text-slate-600">
                        {v ? fmt(v) : <span className="text-slate-300">·</span>}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}

// ─── Sección 7: Repetición de números ──────────────────────────────────────────

function DuplicadosSection({ data, onExport }: { data: LlamadasData; onExport: () => void }) {
  const bk = useMemo(() => Object.keys(data.dup.bucket).map(Number).sort((a, b) => a - b), [data]);
  const bucketChartData = bk.map(k => ({ label: `${k}x`, value: data.dup.bucket[k] ?? 0 }));

  return (
    <SectionCard title="7. Repetición de números" action={<ExportButton onClick={onExport} label="Exportar duplicados" />}>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
        <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
          <div className="text-xs text-slate-500 font-semibold uppercase">Números únicos</div>
          <div className="text-2xl font-bold text-slate-800 mt-1">{fmt(data.dup.unique)}</div>
        </div>
        <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
          <div className="text-xs text-slate-500 font-semibold uppercase">Marcados +1 vez</div>
          <div className="text-2xl font-bold text-slate-800 mt-1">
            {fmt(data.dup.multi)} <span className="text-sm font-medium text-slate-500">({pf(data.dup.multi, data.dup.unique)})</span>
          </div>
        </div>
        <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
          <div className="text-xs text-slate-500 font-semibold uppercase">Máx. repeticiones</div>
          <div className="text-2xl font-bold text-slate-800 mt-1">{fmt(data.dup.maxrepeat)} veces</div>
        </div>
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
        <div className="overflow-x-auto rounded-xl border border-slate-200 max-h-[300px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
              <tr>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-600">Veces marcado</th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold text-slate-600">Nº de números</th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold text-slate-600">%</th>
              </tr>
            </thead>
            <tbody>
              {bk.map((k, idx) => (
                <tr key={k} className={`border-b border-slate-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
                  <td className="px-3 py-2 font-medium text-slate-800">{k}{k === 1 ? ' vez' : ' veces'}</td>
                  <td className="px-3 py-2 text-right text-slate-600">{fmt(data.dup.bucket[k] ?? 0)}</td>
                  <td className="px-3 py-2 text-right text-slate-600">{pf(data.dup.bucket[k] ?? 0, data.dup.unique)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={bucketChartData} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip />
            <Bar dataKey="value" name="Números" fill="#6f42c1" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <h3 className="text-sm font-semibold text-slate-700 mb-2">Top números más marcados</h3>
      <div className="overflow-x-auto rounded-xl border border-slate-200 max-h-[320px] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
            <tr>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-600">#</th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-600">Número</th>
              <th className="px-3 py-2.5 text-right text-xs font-semibold text-slate-600">Veces marcado</th>
            </tr>
          </thead>
          <tbody>
            {data.dup.top.map(([num, veces], i) => (
              <tr key={num} className={`border-b border-slate-100 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
                <td className="px-3 py-2 text-slate-500">{i + 1}</td>
                <td className="px-3 py-2 font-medium text-slate-800">{num}</td>
                <td className="px-3 py-2 text-right text-slate-600">{fmt(veces)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}

// ─── Extra: Distribución de duración ────────────────────────────────────────────

function DuracionSection({ R }: { R: LlamadasResult }) {
  const labels = ['0 seg', '1–10', '11–30', '31–60', '61–120', '121–300', '+300'];
  const chartData = labels.map((l, i) => ({ label: l, value: R.durBuckets[i] ?? 0 }));

  return (
    <SectionCard title="Extra · Distribución de duración">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-600">Duración</th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold text-slate-600">Llamadas</th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold text-slate-600">%</th>
              </tr>
            </thead>
            <tbody>
              {labels.map((l, i) => (
                <tr key={l} className={`border-b border-slate-100 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
                  <td className="px-3 py-2 font-medium text-slate-800">{l}</td>
                  <td className="px-3 py-2 text-right text-slate-600">{fmt(R.durBuckets[i] ?? 0)}</td>
                  <td className="px-3 py-2 text-right text-slate-600">{pf(R.durBuckets[i] ?? 0, R.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip />
            <Bar dataKey="value" name="Llamadas" radius={[3, 3, 0, 0]}>
              {chartData.map((_, i) => <Cell key={i} fill={i >= 5 ? '#28a745' : '#003DA5'} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="text-xs text-slate-400 mt-3">
        Sirve para validar el umbral: las conversaciones reales son la cola larga de segundos.
      </p>
    </SectionCard>
  );
}

// ─── Main module ──────────────────────────────────────────────────────────────

type Stage = 'upload' | 'loading' | 'analysis';

export default function LlamadasModule() {
  const { llamadas: storeEntry, setLlamadas: saveToStore, clearLlamadas } = useAnalisisStore();

  const [stage, setStage] = useState<Stage>(() => (storeEntry ? 'analysis' : 'upload'));
  const [data, setData] = useState<LlamadasData | null>(() => storeEntry?.data ?? null);
  const [error, setError] = useState<string | null>(null);
  const [umbralInput, setUmbralInput] = useState('120');
  const [umbral, setUmbral] = useState(120);
  const [excluirVDAD, setExcluirVDAD] = useState(false);
  const [exportingAll, setExportingAll] = useState(false);

  const handleFiles = useCallback(async (files: File[]) => {
    setStage('loading');
    setError(null);
    try {
      const result = await parseLlamadas(files);
      setData(result);
      const nombreArchivo = files.map(f => f.name).join(', ');
      recordActivity('tiempo_llamadas', nombreArchivo);
      saveToStore({ data: result, nombreArchivo });
      setStage('analysis');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido al procesar el archivo.');
      setStage('upload');
    }
  }, [saveToStore]);

  const R = useMemo(() => (data ? computeLlamadas(data, umbral, excluirVDAD) : null), [data, umbral, excluirVDAD]);

  function handleRecalcular() {
    setUmbral(Math.max(0, Number(umbralInput) || 0));
  }

  function reset() {
    clearLlamadas();
    setStage('upload');
    setData(null);
    setError(null);
  }

  const handleExportAll = useCallback(() => {
    if (!data || !R) return;
    setExportingAll(true);
    try { exportTodo(data, R); } finally { setExportingAll(false); }
  }, [data, R]);

  if (stage === 'loading') {
    return (
      <div className="flex flex-col h-full">
        <Header title="Tiempo de Llamadas" />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3">
            <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin mx-auto" />
            <p className="text-sm text-slate-600 font-medium">Procesando archivo(s)...</p>
          </div>
        </div>
      </div>
    );
  }

  if (stage === 'upload' || !data || !R) {
    return (
      <div className="flex flex-col h-full">
        <Header title="Tiempo de Llamadas" />
        <div className="flex-1 overflow-y-auto">
          {error && (
            <div className="mx-6 mt-4 flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
          <UploadScreen onFiles={handleFiles} />
        </div>
      </div>
    );
  }

  const subtitle = [...data.fnames, `${ddmmyyyy(data.date_min)} → ${ddmmyyyy(data.date_max)}`].join(' · ')
    + (storeEntry ? ` · ${formatFechaCarga(storeEntry.fechaCarga)}` : '');

  const atenNoVenta = R.aten - R.atenVenta;
  const operadoresCount = Object.keys(R.perUser).filter(u => u !== 'VDAD' && u !== '(sin user)').length;

  const headerActions = (
    <div className="flex items-center gap-2 flex-wrap">
      <button
        onClick={reset}
        className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg px-3 py-1.5 hover:bg-slate-50 transition-colors"
      >
        <FileText size={13} /> Cargar otro archivo
      </button>
      <button
        onClick={handleExportAll}
        disabled={exportingAll}
        className="flex items-center gap-1.5 text-xs font-medium bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg px-3 py-1.5 transition-colors"
      >
        <Download size={13} /> {exportingAll ? 'Exportando...' : 'Exportar todo (Excel)'}
      </button>
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      <Header title="Tiempo de Llamadas" subtitle={subtitle} actions={headerActions} />
      <div className="flex-1 overflow-y-auto p-6">
        <div id="llamadas-content" className="max-w-7xl mx-auto space-y-6">

          <div className="sticky top-0 z-10 -mx-6 px-6 py-3 bg-[#F5F7FA] border-b border-gray-200 flex flex-wrap items-center gap-3">
            <span className="text-sm font-semibold text-slate-700">Umbral atendida:</span>
            <input
              type="number" min={0} step={5} value={umbralInput}
              onChange={e => setUmbralInput(e.target.value)}
              className="w-24 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#003DA5]"
            />
            <span className="text-sm text-slate-500">segundos</span>
            <button
              onClick={handleRecalcular}
              className="px-3 py-1.5 text-sm font-medium text-white rounded-lg bg-[#003DA5] hover:opacity-90 transition-colors"
            >
              Recalcular
            </button>
            <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer ml-2">
              <input
                type="checkbox" checked={excluirVDAD}
                onChange={e => setExcluirVDAD(e.target.checked)}
                className="rounded border-gray-300"
              />
              Excluir VDAD (marcador automático) de tablas por operador
            </label>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <KpiCard icon={Phone} label="Llamadas totales" value={fmt(R.total)} accent="#003DA5" />
            <KpiCard icon={PhoneIncoming} label={`Atendidas (>${R.thr}s)`} value={fmt(R.aten)}
              sub="del total" badge={{ text: pf(R.aten, R.total), tone: 'green' }} accent="#28a745" />
            <KpiCard icon={DollarSign} label="Ventas" value={fmt(R.ventas)}
              sub="de atendidas" badge={{ text: pf(R.ventas, R.aten), tone: 'green' }} accent="#28a745" />
            <KpiCard icon={PhoneOff} label="Atendidas sin venta" value={fmt(atenNoVenta)}
              sub="de atendidas" badge={{ text: pf(atenNoVenta, R.aten), tone: 'red' }} accent="#E3000F" />
            <KpiCard icon={Users} label="Operadores" value={fmt(operadoresCount)} sub="agentes" accent="#6f42c1" />
            <KpiCard icon={Hash} label="Números únicos" value={fmt(data.dup.unique)} sub={`${fmt(data.dup.multi)} repetidos`} accent="#fd7e14" />
          </div>

          <OperadoresSection data={data} R={R} onExport={() => exportOperadores(data, R)} />
          <StatusSection data={data} R={R} onExport={() => exportStatus(data, R)} />
          <MatrixSection data={data} R={R} onExport={() => exportMatriz(data, R)} />
          <HoraSection data={data} R={R} onExport={() => exportHora(data, R)} />
          <DesenlaceSection data={data} R={R} onExport={() => exportDesenlace(data, R)} />
          <HoraEstadoSection data={data} R={R} onExport={() => exportHoraEstado(data, R)} />
          <DuplicadosSection data={data} onExport={() => exportDuplicados(data)} />
          <DuracionSection R={R} />

        </div>
      </div>
    </div>
  );
}
