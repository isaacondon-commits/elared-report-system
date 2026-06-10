import { useState, useRef, useEffect } from 'react';
import { ChevronDown, ChevronRight, Pencil, RotateCcw, AlertTriangle } from 'lucide-react';
import type { ResultadoVendedor, Condicion } from './ComisionesConfig';
import { fmtPesos, TIPO_LABELS, TIPO_COLORS } from './ComisionesConfig';

interface Props {
  vendedores: ResultadoVendedor[];
  condiciones: [Condicion, Condicion];
  onFaltaChange: (nombre: string, faltas: number) => void;
  onOverrideChange: (nombre: string, override: 'condicion1' | 'condicion2' | null) => void;
}

// ─── Condition badge ──────────────────────────────────────────────────────────

function CondBadge({ v }: { v: ResultadoVendedor }) {
  if (v.noLlegoAlMinimo) {
    return (
      <span
        title="No llegó al mínimo — comisiona por condición base"
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700 cursor-help"
      >
        Bajo mínimo ({v.totalVentas})
      </span>
    );
  }
  if (v.bajoPorFalta) {
    return (
      <span
        title={`Tenía ${v.condicionOriginal === 'condicion2' ? 'condición alta' : 'condición alta'} pero bajó por ${v.faltas} falta${v.faltas > 1 ? 's' : ''}`}
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-700 cursor-help"
      >
        <AlertTriangle size={10} className="shrink-0" />
        {v.nombreCondicion}
      </span>
    );
  }
  const isTop = v.condicionAplicada === 'condicion2';
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold
        ${v.esOverride ? 'border-2 border-dashed' : ''}
        ${isTop ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'}`}
      style={v.esOverride ? { borderColor: isTop ? '#92400E' : '#1D4ED8' } : undefined}
      title={v.esOverride ? 'Condición ajustada manualmente' : undefined}
    >
      {isTop ? '⭐ ' : '✓ '}{v.nombreCondicion}
    </span>
  );
}

// ─── Override dropdown ────────────────────────────────────────────────────────

function OverrideButton({
  v,
  condiciones,
  onOverrideChange,
}: {
  v: ResultadoVendedor;
  condiciones: [Condicion, Condicion];
  onOverrideChange: (nombre: string, override: 'condicion1' | 'condicion2' | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  if (v.esOverride) {
    return (
      <button
        title="Restaurar cálculo automático"
        onClick={e => { e.stopPropagation(); onOverrideChange(v.nombre, null); }}
        className="ml-1 p-0.5 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
      >
        <RotateCcw size={11} />
      </button>
    );
  }

  return (
    <div ref={ref} className="relative inline-block ml-1">
      <button
        title="Cambiar condición manualmente"
        onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
        className="p-0.5 rounded text-gray-300 hover:text-blue-500 hover:bg-blue-50 transition-colors opacity-0 group-hover/row:opacity-100"
      >
        <Pencil size={11} />
      </button>
      {open && (
        <div className="absolute z-50 top-6 left-0 bg-white border border-gray-200 rounded-xl shadow-lg w-52 py-1 text-xs"
          onClick={e => e.stopPropagation()}>
          <div className="px-3 py-1.5 text-gray-400 font-semibold uppercase tracking-wide text-[10px]">
            Forzar condición
          </div>
          <button
            onClick={() => { onOverrideChange(v.nombre, null); setOpen(false); }}
            className="w-full text-left px-3 py-1.5 hover:bg-gray-50 font-medium text-gray-700"
          >
            ↺ Automático (por ventas y faltas)
          </button>
          {condiciones.map(c => (
            <button
              key={c.id}
              onClick={() => { onOverrideChange(v.nombre, c.id); setOpen(false); }}
              className={`w-full text-left px-3 py-1.5 hover:bg-gray-50 font-medium
                ${c.id === 'condicion1' ? 'text-blue-700' : 'text-amber-700'}
                ${v.condicionAplicada === c.id && !v.esOverride ? 'bg-gray-50' : ''}`}
            >
              Forzar {c.nombre} (≥{c.minVentas})
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Falta input ──────────────────────────────────────────────────────────────

function FaltaInput({
  nombre,
  faltas,
  condicionNatural,
  onFaltaChange,
}: {
  nombre: string;
  faltas: number;
  condicionNatural: 'condicion1' | 'condicion2';
  onFaltaChange: (nombre: string, faltas: number) => void;
}) {
  const [focused, setFocused] = useState(false);
  const hayFaltaConCond2 = faltas > 0 && condicionNatural === 'condicion2';

  return (
    <div
      className={`flex items-center justify-center rounded px-1 transition-colors
        ${hayFaltaConCond2 ? 'bg-orange-50' : ''}`}
      onClick={e => e.stopPropagation()}
    >
      <div className={`flex items-center gap-1 rounded transition-all
        ${focused ? 'ring-1 ring-[#003DA5] bg-[#F0F5FF]' : ''}`}>
        {faltas > 0 && !focused && <AlertTriangle size={10} className="text-red-500 shrink-0" />}
        <input
          type="number"
          min={0}
          max={30}
          value={faltas === 0 && !focused ? '' : faltas}
          placeholder="0"
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChange={e => {
            const v = Math.max(0, Math.min(30, parseInt(e.target.value) || 0));
            onFaltaChange(nombre, v);
          }}
          className={`w-12 text-center text-xs py-1 bg-transparent outline-none rounded
            ${faltas > 0 ? 'font-bold text-red-600' : 'text-gray-400'}`}
        />
      </div>
    </div>
  );
}

// ─── Expanded row ─────────────────────────────────────────────────────────────

function ExpandedRow({ v }: { v: ResultadoVendedor }) {
  if (v.desglosePorPlan.length === 0) {
    return (
      <tr>
        <td colSpan={10} className="px-10 py-3 text-xs text-gray-400 italic bg-gray-50">
          Sin ventas comisionables en este período.
        </td>
      </tr>
    );
  }
  return (
    <tr>
      <td colSpan={10} className="px-6 py-3 bg-gray-50 border-b border-gray-200">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-200">
              {['Plan', 'Tipo', 'Cantidad', 'Precio unit.', 'Subtotal'].map(h => (
                <th key={h} className="text-left py-1 px-2 text-gray-500 font-semibold uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {v.desglosePorPlan.map((d, i) => (
              <tr key={i} className="border-b border-gray-100">
                <td className="py-1.5 px-2 text-gray-700 font-medium max-w-[220px] truncate">{d.plan}</td>
                <td className="py-1.5 px-2">
                  <span className="px-1.5 py-0.5 rounded-full text-white text-[10px] font-semibold" style={{ background: TIPO_COLORS[d.tipo] }}>
                    {TIPO_LABELS[d.tipo]}
                  </span>
                </td>
                <td className="py-1.5 px-2 text-gray-600">{d.cantidad}</td>
                <td className="py-1.5 px-2 text-gray-600">{fmtPesos(d.precioUnitario)}</td>
                <td className="py-1.5 px-2 font-semibold text-gray-800">{fmtPesos(d.comisionTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </td>
    </tr>
  );
}

// ─── Main table ───────────────────────────────────────────────────────────────

export default function ResultadosTable({ vendedores, condiciones, onFaltaChange, onOverrideChange }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggle(nombre: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(nombre)) next.delete(nombre);
      else next.add(nombre);
      return next;
    });
  }

  // For falta penalty tracking: what's the natural condition (before falta penalty)?
  function naturalCondId(v: ResultadoVendedor): 'condicion1' | 'condicion2' {
    if (v.bajoPorFalta) return v.condicionOriginal ?? 'condicion2';
    return v.condicionAplicada;
  }

  const hayOverrides = vendedores.some(v => v.esOverride);
  const overrideList = vendedores.filter(v => v.esOverride).map(v => v.nombre);

  const hayNoLlegoAlMinimo = vendedores.some(v => v.noLlegoAlMinimo);
  const hayBajoPorFalta    = vendedores.some(v => v.bajoPorFalta);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b-2 border-gray-200 bg-gray-50">
            <th className="w-8 py-3 px-2" />
            <th className="py-3 px-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">#</th>
            <th className="py-3 px-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Vendedor</th>
            <th className="py-3 px-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Total ventas</th>
            <th className="py-3 px-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Faltas</th>
            <th className="py-3 px-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Condición</th>
            <th className="py-3 px-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Renovac.</th>
            <th className="py-3 px-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Altas</th>
            <th className="py-3 px-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Cambios</th>
            <th className="py-3 px-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Comisión total</th>
          </tr>
        </thead>
        <tbody>
          {vendedores.map((v, idx) => {
            const isOpen = expanded.has(v.nombre);
            const rowBg =
              v.noLlegoAlMinimo  ? 'bg-red-50/40' :
              v.bajoPorFalta     ? 'bg-orange-50/30' : '';

            return (
              <>
                <tr
                  key={v.nombre}
                  className={`group/row border-b border-gray-100 hover:bg-blue-50/20 cursor-pointer transition-colors ${rowBg}`}
                  onClick={() => toggle(v.nombre)}
                >
                  <td className="py-2.5 px-2 text-gray-400">
                    {isOpen
                      ? <ChevronDown size={14} className="text-blue-500" />
                      : <ChevronRight size={14} />
                    }
                  </td>
                  <td className="py-2.5 px-2 text-gray-400 text-xs">{idx + 1}</td>
                  <td className="py-2.5 px-3 font-semibold text-gray-900">{v.nombre}</td>
                  <td className="py-2.5 px-3 text-center text-gray-700 font-medium">{v.totalVentas}</td>

                  {/* FALTAS — input editable */}
                  <td className="py-1.5 px-2 text-center">
                    <FaltaInput
                      nombre={v.nombre}
                      faltas={v.faltas}
                      condicionNatural={naturalCondId(v)}
                      onFaltaChange={onFaltaChange}
                    />
                  </td>

                  {/* CONDICIÓN — badge + override button */}
                  <td className="py-2.5 px-3 text-center">
                    <div className="flex items-center justify-center gap-0.5">
                      <CondBadge v={v} />
                      <OverrideButton v={v} condiciones={condiciones} onOverrideChange={onOverrideChange} />
                    </div>
                    {v.esOverride && (
                      <div className="text-[10px] text-gray-400 mt-0.5">Ajustado manualmente</div>
                    )}
                  </td>

                  <td className="py-2.5 px-3 text-center text-gray-600">{v.desglose.renovaciones.cantidad}</td>
                  <td className="py-2.5 px-3 text-center text-gray-600">{v.desglose.altas.cantidad}</td>
                  <td className="py-2.5 px-3 text-center text-gray-600">{v.desglose.cambios.cantidad}</td>

                  {/* COMISIÓN */}
                  <td className="py-2.5 px-3 text-right">
                    {v.noLlegoAlMinimo
                      ? <span className="font-bold text-red-600">{fmtPesos(v.comisionTotal)} *</span>
                      : <span className="font-bold text-green-700">{fmtPesos(v.comisionTotal)}</span>
                    }
                  </td>
                </tr>
                {isOpen && <ExpandedRow key={`${v.nombre}-exp`} v={v} />}
              </>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-gray-300 bg-gray-50">
            <td colSpan={3} className="py-3 px-3 font-bold text-gray-800">TOTALES</td>
            <td className="py-3 px-3 text-center font-bold text-gray-800">
              {vendedores.reduce((s, v) => s + v.totalVentas, 0)}
            </td>
            <td className="py-3 px-3 text-center font-bold text-red-600">
              {vendedores.reduce((s, v) => s + v.faltas, 0) || '—'}
            </td>
            <td />
            <td className="py-3 px-3 text-center font-bold text-gray-800">
              {vendedores.reduce((s, v) => s + v.desglose.renovaciones.cantidad, 0)}
            </td>
            <td className="py-3 px-3 text-center font-bold text-gray-800">
              {vendedores.reduce((s, v) => s + v.desglose.altas.cantidad, 0)}
            </td>
            <td className="py-3 px-3 text-center font-bold text-gray-800">
              {vendedores.reduce((s, v) => s + v.desglose.cambios.cantidad, 0)}
            </td>
            <td className="py-3 px-3 text-right font-bold text-green-700">
              {fmtPesos(vendedores.reduce((s, v) => s + v.comisionTotal, 0))}
            </td>
          </tr>
        </tfoot>
      </table>

      {/* Leyenda */}
      {(hayNoLlegoAlMinimo || hayBajoPorFalta) && (
        <div className="px-4 py-2.5 border-t border-gray-100 space-y-1">
          {hayNoLlegoAlMinimo && (
            <p className="text-xs text-red-600">* Comisión calculada con condición base por no alcanzar el mínimo de ventas</p>
          )}
          {hayBajoPorFalta && (
            <p className="text-xs text-orange-600">⚠ Condición reducida por falta — el vendedor tenía una condición superior</p>
          )}
        </div>
      )}

      {/* Override summary */}
      {hayOverrides && (
        <div className="mx-4 my-3 bg-orange-50 border border-orange-200 rounded-xl px-4 py-3">
          <div className="flex items-center gap-2 mb-1.5">
            <AlertTriangle size={14} className="text-orange-500" />
            <span className="text-xs font-semibold text-orange-700">
              {overrideList.length} vendedor{overrideList.length > 1 ? 'es' : ''} con condición ajustada manualmente
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {overrideList.map(n => (
              <span key={n} className="px-2 py-0.5 bg-white border border-orange-200 rounded-full text-xs text-orange-700">
                {n}
              </span>
            ))}
          </div>
          <button
            onClick={e => {
              e.stopPropagation();
              overrideList.forEach(n => onOverrideChange(n, null));
            }}
            className="text-xs text-orange-700 border border-orange-300 px-2.5 py-1 rounded-lg hover:bg-orange-100 transition-colors"
          >
            Resetear todos los ajustes manuales
          </button>
        </div>
      )}
    </div>
  );
}
