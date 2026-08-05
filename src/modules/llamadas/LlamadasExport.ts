import * as XLSX from 'xlsx';
import { autoWidth, styledExcelSheet } from '../../utils/exportHelpers';
import type { LlamadasData } from './llamadasParser';
import type { LlamadasResult } from './llamadasAnalysis';

const pct = (a: number, b: number): number => (b ? (a / b) * 100 : 0);
const p1 = (a: number, b: number): number => parseFloat(pct(a, b).toFixed(1));

function fname(base: string, data: LlamadasData): string {
  const rango = data.date_min !== '—' ? data.date_min.slice(0, 10) : 'reporte';
  return `${base}_${rango}.xlsx`;
}

// ─── Sección 1: Atendidas por operador ─────────────────────────────────────────

function operadoresRows(R: LlamadasResult): (string | number)[][] {
  const users = Object.keys(R.perUser).sort((a, b) => R.perUser[b]!.aten - R.perUser[a]!.aten);
  return users.map(u => {
    const p = R.perUser[u]!;
    return [u, p.total, p.aten, p1(p.aten, p.total), p.ventas];
  });
}

export function exportOperadores(data: LlamadasData, R: LlamadasResult): void {
  const wb = XLSX.utils.book_new();
  styledExcelSheet(wb, 'Atendidas por operador',
    ['Operador', 'Llamadas', 'Atendidas', '% Atend.', 'Ventas'],
    operadoresRows(R));
  XLSX.writeFile(wb, fname('Atendidas_por_operador', data));
}

// ─── Sección 2: Distribución por status ────────────────────────────────────────

function statusRows(data: LlamadasData, R: LlamadasResult): (string | number)[][] {
  const so = data.stats.map((s, i) => [s, i] as const).sort((a, b) => R.statusC[b[1]]! - R.statusC[a[1]]!);
  return so.map(([s, i]) => [s, data.status_name[s] ?? '', R.statusC[i]!, p1(R.statusC[i]!, R.total)]);
}

export function exportStatus(data: LlamadasData, R: LlamadasResult): void {
  const wb = XLSX.utils.book_new();
  styledExcelSheet(wb, 'Status',
    ['Status', 'Descripción', 'Cantidad', '%'],
    statusRows(data, R));
  XLSX.writeFile(wb, fname('Status', data));
}

// ─── Sección 3: Matriz operador × status ───────────────────────────────────────

function matrizHeadersAndRows(data: LlamadasData, R: LlamadasResult): { headers: string[]; rows: (string | number)[][] } {
  const users = Object.keys(R.perUser).sort((a, b) => R.perUser[b]!.total - R.perUser[a]!.total);
  const so = data.stats.map((s, i) => [s, i] as const).sort((a, b) => R.statusC[b[1]]! - R.statusC[a[1]]!);
  const headers = ['Operador', 'Total', ...so.map(([s]) => s)];
  const rows = users.map(u => {
    const p = R.perUser[u]!;
    return [u, p.total, ...so.map(([, i]) => p.statusC[i] ?? 0)];
  });
  return { headers, rows };
}

export function exportMatriz(data: LlamadasData, R: LlamadasResult): void {
  const { headers, rows } = matrizHeadersAndRows(data, R);
  const wb = XLSX.utils.book_new();
  styledExcelSheet(wb, 'Matriz usuario-status', headers, rows);
  XLSX.writeFile(wb, fname('Matriz_usuario_status', data));
}

// ─── Sección 4: Distribución por hora ──────────────────────────────────────────

function horaRows(R: LlamadasResult): (string | number)[][] {
  const hours = Object.keys(R.hourTotal).map(Number).sort((a, b) => a - b);
  return hours.map(h => {
    const at = R.hourAten[h] ?? 0, tot = R.hourTotal[h] ?? 0;
    return [`${h}:00`, tot, at, p1(at, R.aten), p1(tot, R.total), p1(at, tot)];
  });
}

export function exportHora(data: LlamadasData, R: LlamadasResult): void {
  const wb = XLSX.utils.book_new();
  styledExcelSheet(wb, 'Hora_atencion',
    ['Hora', 'Llamadas', 'Atendidas', '% de atención', '% del volumen', 'Tasa atend.'],
    horaRows(R));
  XLSX.writeFile(wb, fname('Hora_atencion', data));
}

// ─── Sección 5: Desenlace de atendidas ─────────────────────────────────────────

function desenlaceRows(data: LlamadasData, R: LlamadasResult): (string | number)[][] {
  const so = data.stats
    .map((s, i) => [s, i] as const)
    .filter(([, i]) => (R.atenStatus[i] ?? 0) > 0)
    .sort((a, b) => R.atenStatus[b[1]]! - R.atenStatus[a[1]]!);
  return so.map(([s, i]) => [s, data.status_name[s] ?? '', R.atenStatus[i]!, p1(R.atenStatus[i]!, R.aten), s === 'VENTA' ? '✓ venta' : '—']);
}

export function exportDesenlace(data: LlamadasData, R: LlamadasResult): void {
  const wb = XLSX.utils.book_new();
  styledExcelSheet(wb, 'Atendidas_no_venta',
    ['Status', 'Descripción', 'Atendidas', '%', '¿Venta?'],
    desenlaceRows(data, R));
  XLSX.writeFile(wb, fname('Atendidas_no_venta', data));
}

// ─── Sección 6: Llamadas por hora y estado (top 8) ─────────────────────────────

function horaEstadoHeadersAndRows(data: LlamadasData, R: LlamadasResult): { headers: string[]; rows: (string | number)[][] } {
  const so = data.stats.map((s, i) => [s, i] as const).sort((a, b) => R.statusC[b[1]]! - R.statusC[a[1]]!);
  const top8 = so.slice(0, 8);
  const hours = Object.keys(R.hourTotal).map(Number).sort((a, b) => a - b);
  const headers = ['Hora', 'Total', ...top8.map(([s]) => s)];
  const rows = hours.map(h => [
    `${h}:00`, R.hourTotal[h] ?? 0,
    ...top8.map(([, i]) => (R.hourStatus[h]?.[i]) ?? 0),
  ]);
  return { headers, rows };
}

export function exportHoraEstado(data: LlamadasData, R: LlamadasResult): void {
  const { headers, rows } = horaEstadoHeadersAndRows(data, R);
  const wb = XLSX.utils.book_new();
  styledExcelSheet(wb, 'Llamadas_por_hora_estado', headers, rows);
  XLSX.writeFile(wb, fname('Llamadas_por_hora_estado', data));
}

// ─── Sección 7: Repetición de números ──────────────────────────────────────────

function bucketRows(data: LlamadasData): (string | number)[][] {
  const bk = Object.keys(data.dup.bucket).map(Number).sort((a, b) => a - b);
  return bk.map(k => [`${k}${k === 1 ? ' vez' : ' veces'}`, data.dup.bucket[k] ?? 0, p1(data.dup.bucket[k] ?? 0, data.dup.unique)]);
}

function topDupRows(data: LlamadasData): (string | number)[][] {
  return data.dup.top.map(([num, veces], i) => [i + 1, num, veces]);
}

export function exportDuplicados(data: LlamadasData): void {
  const wb = XLSX.utils.book_new();
  styledExcelSheet(wb, 'Frecuencia_marcado', ['Veces marcado', 'Nº de números', '%'], bucketRows(data));
  styledExcelSheet(wb, 'Top_numeros', ['#', 'Número', 'Veces marcado'], topDupRows(data));
  XLSX.writeFile(wb, fname('Duplicados', data));
}

// ─── Exportar todo ──────────────────────────────────────────────────────────────

export function exportTodo(data: LlamadasData, R: LlamadasResult): void {
  const wb = XLSX.utils.book_new();

  const atenNoVenta = R.aten - R.atenVenta;
  const resumen: (string | number)[][] = [
    ['Reporte de Llamadas'],
    ['Archivos', data.fnames.join(' | ')],
    ['Rango', `${data.date_min} a ${data.date_max}`],
    ['Llamadas totales', data.total],
    ['Umbral atendida (seg)', R.thr],
    ['Atendidas', R.aten],
    ['Ventas', R.ventas],
    ['Atendidas sin venta', atenNoVenta],
  ];
  const wsResumen = XLSX.utils.aoa_to_sheet(resumen);
  wsResumen['!cols'] = autoWidth(resumen);
  XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen');

  styledExcelSheet(wb, 'Atendidas por operador', ['Operador', 'Llamadas', 'Atendidas', '% Atend.', 'Ventas'], operadoresRows(R));
  styledExcelSheet(wb, 'Por status', ['Status', 'Descripción', 'Cantidad', '%'], statusRows(data, R));

  const matriz = matrizHeadersAndRows(data, R);
  styledExcelSheet(wb, 'Matriz usuario-status', matriz.headers, matriz.rows);

  styledExcelSheet(wb, 'Por hora', ['Hora', 'Llamadas', 'Atendidas', '% de atención', '% del volumen', 'Tasa atend.'], horaRows(R));
  styledExcelSheet(wb, 'Desenlace atendidas', ['Status', 'Descripción', 'Atendidas', '%', '¿Venta?'], desenlaceRows(data, R));

  const horaEstado = horaEstadoHeadersAndRows(data, R);
  styledExcelSheet(wb, 'Por hora y estado', horaEstado.headers, horaEstado.rows);

  styledExcelSheet(wb, 'Duplicados', ['Veces marcado', 'Nº de números', '%'], bucketRows(data));

  XLSX.writeFile(wb, fname('Reporte_de_llamadas', data));
}
