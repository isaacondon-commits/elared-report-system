export type RolSistema =
  | 'admin'
  | 'rrhh'
  | 'supervisor_movil'
  | 'supervisor_fibra'
  | 'supervisor_atencion';

export interface AppConfig {
  horaEntrada: string;
  horaSalida: string;
  toleranciaMinutos: number;
  maxAlmuerzoMinutos: number;
  nombreEmpresa: string;
  logoUrl: string;
}

export const DEFAULT_CONFIG: AppConfig = {
  horaEntrada: '09:00',
  horaSalida: '18:00',
  toleranciaMinutos: 10,
  maxAlmuerzoMinutos: 90,
  nombreEmpresa: 'Elared S.A.',
  logoUrl: '',
};

export interface ParsedFile {
  headers: string[];
  rows: Record<string, unknown>[];
  confidence: number;
  columnMap: Record<string, string>;
  fileName: string;
  rowCount: number;
}

export interface ColumnMapping {
  [fieldKey: string]: string;
}
