import { useState } from 'react';
import type { EmpresaComision, PlanComision, TipoGestion } from './ComisionesConfig';

interface Props {
  empresa: EmpresaComision;
  onChange: (empresa: EmpresaComision) => void;
}

function PriceInput({
  value,
  disabled,
  onChange,
}: {
  value: number;
  disabled: boolean;
  onChange: (v: number) => void;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div className={`flex items-center rounded border transition-all
      ${disabled ? 'bg-gray-100 border-gray-200' : focused ? 'border-blue-500 bg-[#F0F5FF]' : 'border-transparent bg-gray-50 hover:border-gray-300'}`}
    >
      <span className={`pl-1.5 text-xs font-medium ${disabled ? 'text-gray-300' : 'text-gray-400'}`}>$</span>
      <input
        type="number"
        min={0}
        step={1}
        value={value === 0 ? '' : value}
        disabled={disabled}
        placeholder="0"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={e => onChange(parseFloat(e.target.value) || 0)}
        className="w-16 py-1 px-1 text-xs bg-transparent outline-none disabled:cursor-not-allowed"
      />
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex w-8 h-4 rounded-full transition-colors focus:outline-none
        ${checked ? 'bg-blue-600' : 'bg-gray-300'}`}
    >
      <span className={`inline-block w-3 h-3 mt-0.5 rounded-full bg-white shadow transition-transform
        ${checked ? 'translate-x-4' : 'translate-x-0.5'}`}
      />
    </button>
  );
}

export default function PlanesTable({ empresa, onChange }: Props) {
  const [c1, c2] = empresa.condiciones;

  function updatePlan(planId: string, updated: PlanComision) {
    const planes = empresa.planes.map(p => p.id === planId ? updated : p);
    onChange({ ...empresa, planes });
  }

  function setPrecio(
    planId: string,
    condKey: 'condicion1' | 'condicion2',
    tipo: TipoGestion,
    val: number
  ) {
    const plan = empresa.planes.find(p => p.id === planId);
    if (!plan) return;
    updatePlan(planId, {
      ...plan,
      precios: {
        ...plan.precios,
        [condKey]: { ...plan.precios[condKey], [tipo]: val },
      },
    });
  }

  function handleAgregarPrecio(planId: string) {
    const plan = empresa.planes.find(p => p.id === planId);
    if (!plan) return;
    updatePlan(planId, { ...plan, noConfig: false });
  }

  const regularPlanes  = empresa.planes.filter(p => !p.noConfig);
  const noConfigPlanes = empresa.planes.filter(p =>  p.noConfig);

  function renderPlanRow(plan: PlanComision) {
    const off = !plan.activo;
    return (
      <tr key={plan.id} className={`border-b border-gray-100 ${off ? 'opacity-50' : 'hover:bg-gray-50/60'}`}>
        <td className="px-3 py-2 font-medium text-gray-800 border border-gray-200 leading-tight">
          {plan.nombre}
        </td>
        <td className="px-2 py-2 text-center border border-gray-200">
          <Toggle checked={plan.activo} onChange={v => updatePlan(plan.id, { ...plan, activo: v })} />
        </td>
        {(['condicion1', 'condicion2'] as const).map(condKey =>
          (['renovacion', 'alta', 'cambio'] as TipoGestion[]).map(tipo => (
            <td key={`${condKey}-${tipo}`} className="px-1.5 py-1 border border-gray-200">
              <PriceInput
                value={plan.precios[condKey][tipo]}
                disabled={off}
                onChange={v => setPrecio(plan.id, condKey, tipo, v)}
              />
            </td>
          ))
        )}
      </tr>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr>
            <th className="px-3 py-2 text-left font-semibold text-gray-600 bg-gray-50 border border-gray-200 min-w-[160px]">PLAN</th>
            <th className="px-2 py-2 text-center font-semibold text-gray-600 bg-gray-50 border border-gray-200 w-12">ACT.</th>
            <th colSpan={3} className="px-2 py-2 text-center font-semibold text-white bg-[#003DA5] border border-gray-200">
              {c1.nombre} (≥{c1.minVentas} ventas)
            </th>
            <th colSpan={3} className="px-2 py-2 text-center font-semibold text-white bg-[#6f42c1] border border-gray-200">
              {c2.nombre} (≥{c2.minVentas} ventas)
            </th>
          </tr>
          <tr>
            <th className="px-3 py-1.5 bg-gray-50 border border-gray-200" />
            <th className="px-2 py-1.5 bg-gray-50 border border-gray-200" />
            {(['Renov.', 'Alta', 'Cambio', 'Renov.', 'Alta', 'Cambio'] as const).map((label, i) => (
              <th
                key={i}
                className={`px-2 py-1.5 text-center font-medium border border-gray-200 ${i < 3 ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'}`}
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {regularPlanes.map(renderPlanRow)}

          {noConfigPlanes.length > 0 && (
            <>
              <tr>
                <td colSpan={8} className="px-3 py-1.5 bg-orange-50 border border-orange-100 text-xs font-semibold text-orange-700 uppercase tracking-wide">
                  Planes sin configuración detectados en el archivo
                </td>
              </tr>
              {noConfigPlanes.map(plan => (
                <tr key={plan.id} className="border-b border-orange-100 bg-orange-50/60">
                  <td className="px-3 py-2 border border-orange-200">
                    <div className="font-medium text-gray-700 text-xs">{plan.nombre}</div>
                    <div className="text-orange-600 text-[10px] mt-0.5">Plan no configurado — sin comisión</div>
                  </td>
                  <td className="px-2 py-2 text-center border border-orange-200">
                    <Toggle checked={plan.activo} onChange={v => updatePlan(plan.id, { ...plan, activo: v })} />
                  </td>
                  <td colSpan={6} className="px-3 py-2 border border-orange-200">
                    <button
                      onClick={() => handleAgregarPrecio(plan.id)}
                      className="text-xs font-medium text-orange-700 border border-orange-300 bg-white px-3 py-1 rounded-lg hover:bg-orange-50 transition-colors"
                    >
                      + Agregar precio
                    </button>
                  </td>
                </tr>
              ))}
            </>
          )}
        </tbody>
      </table>
    </div>
  );
}
