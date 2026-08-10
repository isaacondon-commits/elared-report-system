import * as XLSX from 'xlsx';
import { autoWidth, styledExcelSheet } from '../../utils/exportHelpers';
import type { GestionesStats } from './GestionesModule';
import type { Gestion } from './gestionesParser';

function formatFecha(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export function exportGestionesExcel(stats: GestionesStats, rows: Gestion[]): void {
  const wb = XLSX.utils.book_new();

  // ── Hoja 1: Resumen ──
  const resumenHeaders = ['Indicador', 'Valor'];
  const resumenRows: (string | number)[][] = [
    ['Total gestiones', stats.total],
    ['Consultas', stats.consultas],
    ['Reclamos', stats.reclamos],
    ['Solicitudes', stats.solicitudes],
    ['Solucionados', stats.solucionados],
    ['En supervisión', stats.supervision],
    ['Operadores activos', stats.operadoresActivos],
    ['Período', stats.fechaMin ? `${formatFecha(stats.fechaMin)} – ${formatFecha(stats.fechaMax)}` : '—'],
  ];
  styledExcelSheet(wb, 'Resumen', resumenHeaders, resumenRows);

  // ── Hoja 2: Por operador ──
  const opHeaders = ['Operador', 'Rol', 'Total', 'Consultas', 'Reclamos', 'Solicitudes', 'Solucionados', '% Solucionados'];
  const opRows: (string | number)[][] = stats.byOperador.map(o => [
    o.operador, o.rol, o.total, o.consultas, o.reclamos, o.solicitudes, o.solucionados, `${o.pctSolucionados.toFixed(1)}%`,
  ]);
  styledExcelSheet(wb, 'Por operador', opHeaders, opRows);

  // ── Hoja 3: Por motivo ──
  const motivoHeaders = ['Motivo', 'Consultas', 'Reclamos', 'Solicitudes', 'Total', '%'];
  const motivoRows: (string | number)[][] = stats.byMotivo.map(m => [
    m.motivo, m.consultas, m.reclamos, m.solicitudes, m.total, `${m.pct.toFixed(1)}%`,
  ]);
  styledExcelSheet(wb, 'Por motivo', motivoHeaders, motivoRows);

  // ── Hoja 4: Por estado ──
  const estadoHeaders = ['Estado', 'Cantidad', '%'];
  const estadoRows: (string | number)[][] = stats.byEstado.map(e => [e.estado, e.count, `${e.pct.toFixed(1)}%`]);
  styledExcelSheet(wb, 'Por estado', estadoHeaders, estadoRows);

  // ── Hoja 5: Por día ──
  const diaHeaders = ['Fecha', 'Consultas', 'Reclamos', 'Solicitudes', 'Total'];
  const diaRows: (string | number)[][] = stats.byDia.map(d => [formatFecha(d.fecha), d.consultas, d.reclamos, d.solicitudes, d.total]);
  styledExcelSheet(wb, 'Por dia', diaHeaders, diaRows);

  // ── Hoja 6: Tiempo de resolución (por operador y por tipo de contacto) ──
  const resHeaders = ['Tipo', 'Nombre', 'Promedio días', 'Casos'];
  const resRows: (string | number)[][] = [
    ...stats.tiempoResolucionOperador.map(o => ['Operador', o.nombre, Number(o.promedioDias.toFixed(1)), o.n]),
    ...stats.tiempoResolucionMotivo.map(m => ['Tipo de contacto', m.nombre, Number(m.promedioDias.toFixed(1)), m.n]),
  ] as (string | number)[][];
  styledExcelSheet(wb, 'Tiempo resolucion', resHeaders, resRows);

  // ── Hoja 7: Datos completos ──
  const datosHeaders = [
    'Área', 'Empresa', 'N° Trámite', 'Fecha Creación', 'Fecha Cierre', 'Concepto', 'Tipo Producto',
    'Lugar Contacto', 'Router', 'Plan', 'Operador', 'Rol', 'Usuario', 'Estado', 'Observaciones',
  ];
  const datosRows: (string | number)[][] = rows.map(r => [
    r.area, r.empresa, r.numeroTramite, formatFecha(r.fechaCreacion), formatFecha(r.fechaCierre), r.concepto, r.tipoProducto,
    r.lugarContacto, r.equipo, r.plan, r.operador, r.rol, r.usuario, r.estado, r.observaciones,
  ]);
  const ws7 = XLSX.utils.aoa_to_sheet([datosHeaders, ...datosRows]);
  ws7['!cols'] = autoWidth([datosHeaders, ...datosRows]);
  XLSX.utils.book_append_sheet(wb, ws7, 'Datos completos');

  XLSX.writeFile(wb, `Gestiones_${new Date().toLocaleDateString('es-UY').replace(/\//g, '-')}.xlsx`);
}
