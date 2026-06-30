import React, { useState, useMemo, useCallback } from 'react';
import { parsePdv, type PdvData } from './pdvParser';
import {
  getDistribucionChiperos, getEstadosPdv,
  getAlertaInactividad, getAlertaVencimiento,
  getRendimientoChiperos, getNuevosPuntos,
  type PdvInactivo, type PdvVencimiento, type RendimientoRow,
} from './pdvAnalysis';
import { exportPdvExcel, exportPdvPDF, type PdvExportData } from './PdvExport';

type Stage = 'upload' | 'loading' | 'analysis';
type PeriodKey = 'todo' | 'u30' | 'u60' | 'estemes' | 'mesant' | 'custom';

function getRange(key: PeriodKey, desde: string, hasta: string): { desde?: Date; hasta?: Date } {
  const hoy = new Date();
  if (key === 'todo') return {};
  if (key === 'u30') { const d = new Date(hoy); d.setDate(d.getDate() - 30); return { desde: d, hasta: hoy }; }
  if (key === 'u60') { const d = new Date(hoy); d.setDate(d.getDate() - 60); return { desde: d, hasta: hoy }; }
  if (key === 'estemes') {
    return { desde: new Date(hoy.getFullYear(), hoy.getMonth(), 1), hasta: hoy };
  }
  if (key === 'mesant') {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
    const h = new Date(hoy.getFullYear(), hoy.getMonth(), 0);
    return { desde: d, hasta: h };
  }
  if (key === 'custom') {
    return {
      desde: desde ? new Date(desde) : undefined,
      hasta: hasta ? new Date(hasta) : undefined,
    };
  }
  return {};
}

const ESTADO_COLORS: Record<string, string> = {
  'Visitado': '#28a745',
  'Visita permanente': '#003DA5',
  'Visita de autor': '#17a2b8',
  'Pendiente': '#fd7e14',
  'Actualizar datos': '#E3000F',
  'Visita de autor suprimida': '#6c757d',
};

function estadoBadge(estado: string) {
  const color = ESTADO_COLORS[estado] ?? '#6c757d';
  return (
    <span style={{ background: color, color: '#fff', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>
      {estado}
    </span>
  );
}

function inacBadge(dias: number) {
  if (dias >= 180) return <span style={{ background: '#7b0000', color: '#fff', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700 }}>Crítico</span>;
  if (dias >= 90) return <span style={{ background: '#E3000F', color: '#fff', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700 }}>{dias}d</span>;
  return <span style={{ background: '#fd7e14', color: '#fff', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700 }}>{dias}d</span>;
}

function vencBadge(dias: number) {
  if (dias <= 7) return <span style={{ background: '#E3000F', color: '#fff', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700 }}>Urgente</span>;
  if (dias <= 15) return <span style={{ background: '#fd7e14', color: '#fff', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700 }}>Pronto</span>;
  return <span style={{ background: '#ffc107', color: '#212529', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700 }}>Atención</span>;
}

function rendBadge(prom: number) {
  if (prom >= 10) return <span style={{ background: '#28a745', color: '#fff', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700 }}>Alto</span>;
  if (prom >= 6) return <span style={{ background: '#003DA5', color: '#fff', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700 }}>Normal</span>;
  return <span style={{ background: '#fd7e14', color: '#fff', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700 }}>Bajo</span>;
}

function KpiCard({ label, value, color, sub }: { label: string; value: number | string; color: string; sub?: string }) {
  return (
    <div style={{ background: '#fff', borderRadius: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.10)', padding: '18px 22px', borderTop: `4px solid ${color}`, width: '100%', minWidth: 0, boxSizing: 'border-box' }}>
      <div style={{ fontSize: 12, color: '#6c757d', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color }}>{typeof value === 'number' ? value.toLocaleString() : value}</div>
      {sub && <div style={{ fontSize: 11, color: '#aaa', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', borderRadius: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', padding: '20px 24px' }}>
      <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700, color: '#003DA5', borderLeft: '4px solid #E3000F', paddingLeft: 10 }}>{title}</h3>
      {children}
    </div>
  );
}

function Pagination({ page, total, perPage, onChange }: { page: number; total: number; perPage: number; onChange: (p: number) => void }) {
  const pages = Math.ceil(total / perPage);
  if (pages <= 1) return null;
  return (
    <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end', marginTop: 10, alignItems: 'center', fontSize: 13 }}>
      <button onClick={() => onChange(Math.max(1, page - 1))} disabled={page === 1} style={{ padding: '3px 10px', border: '1px solid #dee2e6', borderRadius: 4, cursor: 'pointer', background: page === 1 ? '#f8f9fa' : '#fff' }}>‹</button>
      <span style={{ padding: '3px 8px', color: '#6c757d' }}>{page} / {pages}</span>
      <button onClick={() => onChange(Math.min(pages, page + 1))} disabled={page === pages} style={{ padding: '3px 10px', border: '1px solid #dee2e6', borderRadius: 4, cursor: 'pointer', background: page === pages ? '#f8f9fa' : '#fff' }}>›</button>
    </div>
  );
}

const TH: React.CSSProperties = { padding: '8px 10px', background: '#003DA5', color: '#fff', fontSize: 12, fontWeight: 700, textAlign: 'left', whiteSpace: 'nowrap' };
const TD: React.CSSProperties = { padding: '7px 10px', fontSize: 13, borderBottom: '1px solid #f0f0f0' };

export default function PdvModule() {
  const [stage, setStage] = useState<Stage>('upload');
  const [data, setData] = useState<PdvData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [periodKey, setPeriodKey] = useState<PeriodKey>('todo');
  const [desdeStr, setDesdeStr] = useState('');
  const [hastaStr, setHastaStr] = useState('');

  const [inacSearch, setInacSearch] = useState('');
  const [inacDist, setInacDist] = useState('Todos');
  const [inacPage, setInacPage] = useState(1);

  const [vencTab, setVencTab] = useState<'porVencer' | 'yaVencidos'>('porVencer');
  const [vencPage, setVencPage] = useState(1);

  const [expandedRend, setExpandedRend] = useState<Set<string>>(new Set());

  const PER_PAGE = 20;

  const hoy = useMemo(() => (data ? new Date() : new Date()), [data]);

  const range = useMemo(() => getRange(periodKey, desdeStr, hastaStr), [periodKey, desdeStr, hastaStr]);

  const distribucion = useMemo(() => data ? getDistribucionChiperos(data.rows) : [], [data]);
  const estados = useMemo(() => data ? getEstadosPdv(data.rows) : [], [data]);
  const inactividad = useMemo(() => data ? getAlertaInactividad(data.rows, hoy) : null, [data, hoy]);
  const vencimiento = useMemo(() => data ? getAlertaVencimiento(data.rows, hoy) : null, [data, hoy]);
  const rendimiento = useMemo(() => data ? getRendimientoChiperos(data.rows) : [], [data]);
  const nuevosPuntos = useMemo(() => data ? getNuevosPuntos(data.rows, range.desde, range.hasta) : null, [data, range]);

  const nuevosEsteMes = useMemo(() => {
    if (!data) return 0;
    const hoyDate = new Date();
    const mesKey = `${hoyDate.getFullYear()}-${String(hoyDate.getMonth() + 1).padStart(2, '0')}`;
    const np = getNuevosPuntos(data.rows);
    return np.porMes.find(m => m.mes === mesKey)?.cantidad ?? 0;
  }, [data]);

  const inacFiltered = useMemo(() => {
    if (!inactividad) return [];
    return inactividad.puntos.filter(p => {
      const matchSearch = !inacSearch || p.nombre.toLowerCase().includes(inacSearch.toLowerCase()) || p.distribuidor.toLowerCase().includes(inacSearch.toLowerCase());
      const matchDist = inacDist === 'Todos' || p.distribuidor === inacDist;
      return matchSearch && matchDist;
    });
  }, [inactividad, inacSearch, inacDist]);

  const inacPaged = useMemo(() => inacFiltered.slice((inacPage - 1) * PER_PAGE, inacPage * PER_PAGE), [inacFiltered, inacPage]);
  const vencList = useMemo(() => vencimiento ? (vencTab === 'porVencer' ? vencimiento.porVencer.puntos : vencimiento.yaVencidos.puntos) : [], [vencimiento, vencTab]);
  const vencPaged = useMemo(() => vencList.slice((vencPage - 1) * PER_PAGE, vencPage * PER_PAGE), [vencList, vencPage]);

  const inacTop10 = useMemo(() => inactividad?.porDistribuidor.slice(0, 10) ?? [], [inactividad]);
  const inacTop10Max = inacTop10[0]?.cantidad ?? 1;

  const npMax = useMemo(() => Math.max(1, ...(nuevosPuntos?.porMes.map(m => m.cantidad) ?? [0])), [nuevosPuntos]);
  const npMeses = useMemo(() => nuevosPuntos?.porMes ?? [], [nuevosPuntos]);

  const exportData = useMemo((): PdvExportData | null => {
    if (!distribucion || !estados || !inactividad || !vencimiento || !rendimiento || !nuevosPuntos) return null;
    return { distribucion, estados, inactividad, vencimiento, rendimiento, nuevosPuntos };
  }, [distribucion, estados, inactividad, vencimiento, rendimiento, nuevosPuntos]);

  const handleFile = useCallback(async (file: File) => {
    setStage('loading');
    setError(null);
    try {
      const parsed = await parsePdv(file);
      setData(parsed);
      setStage('analysis');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al procesar el archivo');
      setStage('upload');
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleReset = () => {
    setData(null);
    setStage('upload');
    setError(null);
    setInacSearch('');
    setInacDist('Todos');
    setInacPage(1);
    setVencPage(1);
    setExpandedRend(new Set());
    setPeriodKey('todo');
  };

  if (stage === 'upload') {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <div
          onDrop={handleDrop}
          onDragOver={e => e.preventDefault()}
          style={{ border: '2px dashed #003DA5', borderRadius: 12, padding: '48px 32px', background: '#f0f4ff', cursor: 'pointer', maxWidth: 480, margin: '0 auto' }}
          onClick={() => document.getElementById('pdv-file-input')?.click()}
        >
          <div style={{ fontSize: 42, marginBottom: 12 }}>📋</div>
          <div style={{ fontWeight: 700, fontSize: 16, color: '#003DA5', marginBottom: 6 }}>Cargar CSV de Puntos de Venta</div>
          <div style={{ fontSize: 13, color: '#6c757d' }}>Arrastrá el archivo aquí o hacé clic para seleccionar</div>
          <div style={{ fontSize: 11, color: '#aaa', marginTop: 8 }}>CSV separado por `;`, codificación latin1/windows-1252</div>
        </div>
        <input id="pdv-file-input" type="file" accept=".csv" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
        {error && <div style={{ marginTop: 16, color: '#E3000F', fontWeight: 600 }}>{error}</div>}
      </div>
    );
  }

  if (stage === 'loading') {
    return (
      <div style={{ padding: 60, textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
        <div style={{ fontWeight: 600, color: '#003DA5' }}>Procesando archivo...</div>
      </div>
    );
  }

  if (!data || !inactividad || !vencimiento || !nuevosPuntos || !exportData) return null;

  return (
    <div className="flex-1 overflow-y-auto p-6">
    <div className="space-y-6">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#003DA5' }}>Punto de Venta</div>
          <div style={{ fontSize: 12, color: '#6c757d' }}>{data.total.toLocaleString()} puntos cargados · {new Date(data.fechaCarga).toLocaleDateString('es-UY')}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => exportPdvExcel(data, exportData)} style={{ padding: '7px 14px', background: '#1a7a4a', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>Excel</button>
          <button onClick={() => exportPdvPDF(data, exportData)} style={{ padding: '7px 14px', background: '#E3000F', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>PDF</button>
          <button onClick={handleReset} style={{ padding: '7px 14px', background: '#f8f9fa', color: '#495057', border: '1px solid #dee2e6', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>Cambiar archivo</button>
        </div>
      </div>

      {/* Period filter bar */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', background: '#fff', padding: '12px 16px', borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#6c757d', marginRight: 6 }}>PERÍODO:</span>
        {(['todo', 'u30', 'u60', 'estemes', 'mesant', 'custom'] as PeriodKey[]).map(k => {
          const labels: Record<PeriodKey, string> = { todo: 'Todo', u30: 'Últimos 30d', u60: 'Últimos 60d', estemes: 'Este mes', mesant: 'Mes anterior', custom: 'Personalizado' };
          const active = periodKey === k;
          return (
            <button key={k} onClick={() => { setPeriodKey(k); setInacPage(1); setVencPage(1); }}
              style={{ padding: '5px 12px', borderRadius: 5, border: active ? 'none' : '1px solid #dee2e6', background: active ? '#003DA5' : '#fff', color: active ? '#fff' : '#495057', fontWeight: active ? 700 : 400, fontSize: 13, cursor: 'pointer' }}>
              {labels[k]}
            </button>
          );
        })}
        {periodKey === 'custom' && (
          <>
            <input type="date" value={desdeStr} onChange={e => setDesdeStr(e.target.value)} style={{ padding: '4px 8px', border: '1px solid #dee2e6', borderRadius: 5, fontSize: 13 }} />
            <span style={{ fontSize: 13, color: '#6c757d' }}>—</span>
            <input type="date" value={hastaStr} onChange={e => setHastaStr(e.target.value)} style={{ padding: '4px 8px', border: '1px solid #dee2e6', borderRadius: 5, fontSize: 13 }} />
          </>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total PdV" value={data.total} color="#003DA5" sub={`${data.distribuidores.length} distribuidores`} />
        <KpiCard label="Inactivos +60d" value={inactividad.total} color="#E3000F" sub="Sin visita reciente" />
        <KpiCard label="Chips por vencer 30d" value={vencimiento.porVencer.total} color="#fd7e14" sub={`Ya vencidos: ${vencimiento.yaVencidos.total}`} />
        <KpiCard label="Nuevos este mes" value={nuevosEsteMes} color="#28a745" sub={`${nuevosPuntos.totalEnRango} en rango seleccionado`} />
      </div>

      {/* Section 1: Distribución por chipero */}
      <SectionCard title="Distribución por Chipero">
        <div style={{ width: '100%', overflowX: 'auto', borderRadius: 6 }}>
          <table style={{ width: '100%', minWidth: 420, borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={TH}>Distribuidor</th>
                <th style={{ ...TH, width: 100 }}>Puntos</th>
                <th style={{ ...TH, width: 70 }}>%</th>
                <th style={TH}></th>
              </tr>
            </thead>
            <tbody>
              {distribucion.map((d, i) => (
                <tr key={i} style={{ background: i % 2 === 0 ? '#fafafa' : '#fff' }}>
                  <td style={TD}>{d.distribuidor}</td>
                  <td style={{ ...TD, fontWeight: 700 }}>{d.cantidad.toLocaleString()}</td>
                  <td style={TD}>{d.porcentaje.toFixed(1)}%</td>
                  <td style={{ ...TD, width: 200 }}>
                    <div style={{ background: '#e9ecef', borderRadius: 4, height: 10 }}>
                      <div style={{ background: '#003DA5', width: `${d.porcentaje}%`, height: 10, borderRadius: 4 }} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* Section 2: Estados de visita */}
      <SectionCard title="Estados de Visita">
        <div style={{ width: '100%', overflowX: 'auto', borderRadius: 6 }}>
          <table style={{ width: '100%', minWidth: 320, borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={TH}>Estado</th>
                <th style={{ ...TH, width: 100 }}>Cantidad</th>
                <th style={{ ...TH, width: 70 }}>%</th>
              </tr>
            </thead>
            <tbody>
              {estados.map((e, i) => (
                <tr key={i} style={{ background: i % 2 === 0 ? '#fafafa' : '#fff' }}>
                  <td style={TD}>{estadoBadge(e.estado)}</td>
                  <td style={{ ...TD, fontWeight: 700 }}>{e.cantidad.toLocaleString()}</td>
                  <td style={TD}>{e.porcentaje.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* Section 3: Alerta inactividad */}
      <SectionCard title={`Alerta Inactividad — ${inactividad.total.toLocaleString()} puntos sin visita +60 días`}>
        {/* Filters */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="Buscar punto de venta o distribuidor..."
            value={inacSearch}
            onChange={e => { setInacSearch(e.target.value); setInacPage(1); }}
            style={{ flex: 1, minWidth: 200, padding: '6px 10px', border: '1px solid #dee2e6', borderRadius: 5, fontSize: 13 }}
          />
          <select value={inacDist} onChange={e => { setInacDist(e.target.value); setInacPage(1); }}
            style={{ padding: '6px 10px', border: '1px solid #dee2e6', borderRadius: 5, fontSize: 13 }}>
            <option>Todos</option>
            {data.distribuidores.map(d => <option key={d}>{d}</option>)}
          </select>
        </div>

        {/* Table */}
        <div style={{ width: '100%', overflowX: 'auto', borderRadius: 6, marginBottom: 12 }}>
          <table style={{ width: '100%', minWidth: 540, borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={TH}>Punto de Venta</th>
                <th style={TH}>Distribuidor</th>
                <th style={TH}>Departamento</th>
                <th style={TH}>Última Visita</th>
                <th style={{ ...TH, width: 90 }}>Inactividad</th>
              </tr>
            </thead>
            <tbody>
              {inacPaged.map((p: PdvInactivo, i: number) => (
                <tr key={i} style={{ background: i % 2 === 0 ? '#fafafa' : '#fff' }}>
                  <td style={TD}>{p.nombre}</td>
                  <td style={TD}>{p.distribuidor}</td>
                  <td style={TD}>{p.departamento}</td>
                  <td style={TD}>{p.visitadoPorDistribuidor ?? 'Nunca'}</td>
                  <td style={TD}>{inacBadge(p.diasInactivo)}</td>
                </tr>
              ))}
              {inacPaged.length === 0 && (
                <tr><td colSpan={5} style={{ ...TD, textAlign: 'center', color: '#6c757d' }}>Sin resultados</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={inacPage} total={inacFiltered.length} perPage={PER_PAGE} onChange={p => setInacPage(p)} />

        {/* Bar chart: top 10 distributors */}
        {inacTop10.length > 0 && (
          <div style={{ marginTop: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#003DA5', marginBottom: 10 }}>Top 10 distribuidores con más inactivos</div>
            {inacTop10.map((d, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <div style={{ width: 160, fontSize: 12, color: '#495057', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.distribuidor}</div>
                <div style={{ flex: 1, background: '#e9ecef', borderRadius: 4, height: 14 }}>
                  <div style={{ background: '#E3000F', width: `${(d.cantidad / inacTop10Max) * 100}%`, height: 14, borderRadius: 4 }} />
                </div>
                <div style={{ width: 32, fontSize: 12, fontWeight: 700, color: '#E3000F', textAlign: 'right' }}>{d.cantidad}</div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* Section 4: Alerta vencimiento */}
      <SectionCard title="Alerta Vencimiento de Chips">
        {/* Inner tabs */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 14, borderBottom: '2px solid #dee2e6' }}>
          {(['porVencer', 'yaVencidos'] as const).map(t => {
            const labels = { porVencer: `Por vencer (${vencimiento.porVencer.total})`, yaVencidos: `Ya vencidos (${vencimiento.yaVencidos.total})` };
            const active = vencTab === t;
            return (
              <button key={t} onClick={() => { setVencTab(t); setVencPage(1); }}
                style={{ padding: '8px 16px', border: 'none', borderBottom: active ? '3px solid #003DA5' : '3px solid transparent', background: 'none', fontWeight: active ? 700 : 400, color: active ? '#003DA5' : '#6c757d', cursor: 'pointer', fontSize: 13 }}>
                {labels[t]}
              </button>
            );
          })}
        </div>
        <div style={{ width: '100%', overflowX: 'auto', borderRadius: 6, marginBottom: 12 }}>
          <table style={{ width: '100%', minWidth: 540, borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={TH}>Punto de Venta</th>
                <th style={TH}>Distribuidor</th>
                <th style={TH}>Departamento</th>
                <th style={TH}>Fecha Vencimiento</th>
                <th style={{ ...TH, width: 90 }}>Urgencia</th>
              </tr>
            </thead>
            <tbody>
              {vencPaged.map((p: PdvVencimiento, i: number) => (
                <tr key={i} style={{ background: i % 2 === 0 ? '#fafafa' : '#fff' }}>
                  <td style={TD}>{p.nombre}</td>
                  <td style={TD}>{p.distribuidor}</td>
                  <td style={TD}>{p.departamento}</td>
                  <td style={TD}>{p.fechaVencimientoChipMasViejo ?? '—'}</td>
                  <td style={TD}>
                    {vencTab === 'porVencer'
                      ? vencBadge(p.diasParaVencer)
                      : <span style={{ background: '#7b0000', color: '#fff', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700 }}>Vencido {Math.abs(p.diasParaVencer)}d</span>
                    }
                  </td>
                </tr>
              ))}
              {vencPaged.length === 0 && (
                <tr><td colSpan={5} style={{ ...TD, textAlign: 'center', color: '#6c757d' }}>Sin registros</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={vencPage} total={vencList.length} perPage={PER_PAGE} onChange={p => setVencPage(p)} />
      </SectionCard>

      {/* Section 5: Rendimiento chiperos */}
      <SectionCard title="Rendimiento por Chipero">
        <div style={{ width: '100%', overflowX: 'auto', borderRadius: 6 }}>
        <table style={{ width: '100%', minWidth: 500, borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...TH, width: 32 }}></th>
              <th style={TH}>Distribuidor</th>
              <th style={{ ...TH, width: 100 }}>Días Activos</th>
              <th style={{ ...TH, width: 110 }}>Total Visitas</th>
              <th style={{ ...TH, width: 130 }}>Prom. Visitas/Día</th>
              <th style={{ ...TH, width: 100 }}>Rendimiento</th>
            </tr>
          </thead>
          <tbody>
            {rendimiento.map((r: RendimientoRow, i: number) => {
              const expanded = expandedRend.has(r.nombre);
              return (
                <React.Fragment key={i}>
                  <tr
                    style={{ background: i % 2 === 0 ? '#fafafa' : '#fff', cursor: 'pointer' }}
                    onClick={() => {
                      setExpandedRend(prev => {
                        const next = new Set(prev);
                        if (next.has(r.nombre)) next.delete(r.nombre); else next.add(r.nombre);
                        return next;
                      });
                    }}
                  >
                    <td style={{ ...TD, textAlign: 'center', color: '#003DA5' }}>{expanded ? '▼' : '▶'}</td>
                    <td style={{ ...TD, fontWeight: 600 }}>{r.nombre}</td>
                    <td style={TD}>{r.diasActivos}</td>
                    <td style={TD}>{r.totalVisitas.toLocaleString()}</td>
                    <td style={TD}>{r.promedioVisitasDia.toFixed(1)}</td>
                    <td style={TD}>{rendBadge(r.promedioVisitasDia)}</td>
                  </tr>
                  {expanded && (
                    <tr>
                      <td colSpan={6} style={{ padding: '0 0 0 40px', background: '#f0f4ff' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                          <thead>
                            <tr>
                              <th style={{ ...TH, background: '#c8d8f5', color: '#003DA5', fontSize: 11 }}>Fecha</th>
                              <th style={{ ...TH, background: '#c8d8f5', color: '#003DA5', fontSize: 11, width: 100 }}>Visitas</th>
                            </tr>
                          </thead>
                          <tbody>
                            {r.detalleDias.map((d, j) => (
                              <tr key={j}>
                                <td style={{ ...TD, fontSize: 12 }}>{d.fecha}</td>
                                <td style={{ ...TD, fontSize: 12 }}>{d.visitas}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
            {rendimiento.length === 0 && (
              <tr><td colSpan={6} style={{ ...TD, textAlign: 'center', color: '#6c757d' }}>Sin datos de visitas</td></tr>
            )}
          </tbody>
        </table>
        </div>
      </SectionCard>

      {/* Section 6: Nuevos puntos */}
      <SectionCard title="Nuevos Puntos de Venta">
        {nuevosPuntos.porMes.length === 0 ? (
          <div style={{ color: '#6c757d', textAlign: 'center', padding: 20 }}>Sin datos en el rango seleccionado</div>
        ) : (
          <>
            {/* Vertical bar chart */}
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 120, marginBottom: 20, overflowX: 'auto', padding: '4px 0 0' }}>
              {npMeses.map((m, i) => {
                const pct = (m.cantidad / npMax) * 100;
                const label = m.mes.slice(0, 7);
                return (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 44 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#003DA5' }}>{m.cantidad}</div>
                    <div style={{ width: 36, height: `${pct}%`, minHeight: 4, background: '#003DA5', borderRadius: '3px 3px 0 0' }} />
                    <div style={{ fontSize: 9, color: '#6c757d', transform: 'rotate(-40deg)', whiteSpace: 'nowrap', marginTop: 4 }}>{label}</div>
                  </div>
                );
              })}
            </div>

            {/* Table */}
            <div style={{ width: '100%', overflowX: 'auto', borderRadius: 6 }}>
              <table style={{ width: '100%', minWidth: 320, borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={TH}>Mes</th>
                    <th style={{ ...TH, width: 120 }}>Nuevos PdV</th>
                    <th style={{ ...TH, width: 130 }}>VS Mes Anterior</th>
                  </tr>
                </thead>
                <tbody>
                  {npMeses.map((m, i) => {
                    const prev = i > 0 ? npMeses[i - 1].cantidad : null;
                    const cambio = prev !== null && prev > 0 ? ((m.cantidad - prev) / prev * 100) : null;
                    const cambioStr = cambio !== null ? `${cambio >= 0 ? '+' : ''}${cambio.toFixed(1)}%` : '—';
                    const cambioColor = cambio === null ? '#6c757d' : cambio >= 0 ? '#28a745' : '#E3000F';
                    return (
                      <tr key={i} style={{ background: i % 2 === 0 ? '#fafafa' : '#fff' }}>
                        <td style={TD}>{m.mes}</td>
                        <td style={{ ...TD, fontWeight: 700 }}>{m.cantidad}</td>
                        <td style={{ ...TD, fontWeight: 700, color: cambioColor }}>{cambioStr}</td>
                      </tr>
                    );
                  })}
                  <tr style={{ background: '#e8f0fe', fontWeight: 700 }}>
                    <td style={{ ...TD, fontWeight: 700 }}>Total en rango</td>
                    <td style={{ ...TD, fontWeight: 700 }}>{nuevosPuntos.totalEnRango.toLocaleString()}</td>
                    <td style={{ ...TD, color: '#6c757d', fontSize: 12 }}>Prom. mensual: {nuevosPuntos.promedioMensual}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </>
        )}
      </SectionCard>
    </div>
    </div>
  );
}
