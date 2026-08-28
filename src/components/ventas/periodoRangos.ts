// Rangos de fechas del filtro de período de Ventas. Vive aparte de
// FiltroPeriodo.tsx para que ese archivo solo exporte componentes (Fast Refresh)
// y para poder reusar la lógica desde VentasModule al cambiar de mes.

export const OPCION_TODOS_MESES = '__todos__';

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function calcularRangos(mes: string) {
  const [year, monthStr] = mes.split('-');
  const y = Number(year);
  const m = Number(monthStr);
  const lastDay = new Date(y, m, 0).getDate();
  const d = (day: number) => `${year}-${monthStr}-${pad2(day)}`;
  return {
    semana1:   { desde: d(1),  hasta: d(7) },
    semana2:   { desde: d(8),  hasta: d(14) },
    semana3:   { desde: d(15), hasta: d(21) },
    semana4:   { desde: d(22), hasta: d(lastDay) },
    quincena1: { desde: d(1),  hasta: d(15) },
    quincena2: { desde: d(16), hasta: d(lastDay) },
    esteMes:   { desde: d(1),  hasta: d(lastDay) },
  };
}

// Rango que corresponde a una pill, para un mes dado. Se usa también desde
// VentasModule al cambiar de mes: re-mapea la pill activa al mes nuevo.
// 'Todo' / 'Este mes' → mes completo. Devuelve null para pills no re-mapeables
// (ej. 'Esta semana', que es absoluta).
export function rangoParaLabel(mes: string, label: string): { desde: string; hasta: string } | null {
  const r = calcularRangos(mes);
  switch (label) {
    case 'Semana 1':     return r.semana1;
    case 'Semana 2':     return r.semana2;
    case 'Semana 3':     return r.semana3;
    case 'Semana 4':     return r.semana4;
    case '1ra quincena': return r.quincena1;
    case '2da quincena': return r.quincena2;
    case 'Este mes':
    case 'Todo':         return r.esteMes;
    default:             return null;
  }
}
