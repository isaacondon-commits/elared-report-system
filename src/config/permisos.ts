import type { RolSistema } from '../types';

// ─── Module permission table ───────────────────────────────────────────────────
// To add a new role: add it to RolSistema in types.ts, add entries here, add NOMBRES_ROLES entry.
// No other files need changing.

export const PERMISOS_MODULOS = {
  inicio:           ['admin', 'rrhh', 'supervisor_movil', 'supervisor_fibra', 'supervisor_atencion'],
  ventas:           ['admin', 'supervisor_movil', 'supervisor_fibra'],
  comisiones_movil: ['admin', 'supervisor_movil'],
  comisiones_fibra: ['admin', 'supervisor_fibra'],
  reloj:            ['admin', 'rrhh'],
  sanciones:        ['admin', 'rrhh'],
  personal:         ['admin', 'rrhh'],
  certificaciones:  ['admin', 'rrhh'],
  pausas_vicidial:  ['admin', 'supervisor_movil', 'supervisor_fibra'],
  atencion_cliente: ['admin', 'supervisor_atencion'],
  back_office:      ['admin', 'supervisor_atencion'],
  chips:            ['admin', 'supervisor_movil', 'supervisor_fibra'],
  plano_call_center: ['admin', 'supervisor_movil', 'supervisor_fibra', 'supervisor_atencion', 'rrhh'],
  configuracion:    ['admin'],
  usuarios:         ['admin'],
} as const satisfies Record<string, readonly RolSistema[]>;

export type ModuloSistema = keyof typeof PERMISOS_MODULOS;

export function tieneAcceso(rolesUsuario: RolSistema[], modulo: ModuloSistema): boolean {
  return rolesUsuario.some(rol =>
    (PERMISOS_MODULOS[modulo] as ReadonlyArray<RolSistema>).includes(rol)
  );
}

export const NOMBRES_ROLES: Record<RolSistema, string> = {
  admin:                'Administrador',
  rrhh:                 'RRHH',
  supervisor_movil:     'Supervisor Móvil',
  supervisor_fibra:     'Supervisor Fibra',
  supervisor_atencion:  'Supervisor Atención',
};

export const MODULO_LABELS: Record<ModuloSistema, string> = {
  inicio:           'Inicio',
  ventas:           'Ventas',
  comisiones_movil: 'Comisiones Móvil',
  comisiones_fibra: 'Comisiones Fibra',
  reloj:            'Reloj',
  sanciones:        'Sanciones',
  personal:         'Personal',
  certificaciones:  'Certificaciones',
  pausas_vicidial:  'Pausas Vicidial',
  atencion_cliente: 'Atención al Cliente',
  back_office:      'Back Office',
  chips:            'Chips',
  plano_call_center: 'Plano Call Center',
  configuracion:    'Configuración',
  usuarios:         'Usuarios',
};

export const ROL_COLORS: Record<RolSistema, string> = {
  admin:                '#003DA5',
  rrhh:                 '#28a745',
  supervisor_movil:     '#6f42c1',
  supervisor_fibra:     '#fd7e14',
  supervisor_atencion:  '#20c997',
};
