import { NavLink } from 'react-router-dom';
import {
  BarChart2, Clock, AlertTriangle, Settings, Home, Users, FileCheck,
  Smartphone, Wifi, Headphones, Briefcase, Cpu, LogOut, PauseCircle, Menu,
} from 'lucide-react';
import { useAuthContext } from '../contexts/AuthContext';
import { tieneAcceso, NOMBRES_ROLES, ROL_COLORS, type ModuloSistema } from '../config/permisos';
import type { RolSistema } from '../types';

interface NavItem {
  to: string;
  icon: typeof Home;
  label: string;
  modulo: ModuloSistema;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'ANÁLISIS',
    items: [
      { to: '/',                icon: Home,         label: 'Inicio',          modulo: 'inicio' },
      { to: '/ventas',          icon: BarChart2,    label: 'Ventas',          modulo: 'ventas' },
      { to: '/pausas-vicidial', icon: PauseCircle,  label: 'Pausas Vicidial', modulo: 'pausas_vicidial' },
    ],
  },
  {
    label: 'COMISIONES',
    items: [
      { to: '/comisiones-movil', icon: Smartphone, label: 'Comisiones Móvil', modulo: 'comisiones_movil' },
      { to: '/comisiones-fibra', icon: Wifi,        label: 'Comisiones Fibra', modulo: 'comisiones_fibra' },
    ],
  },
  {
    label: 'REPORTES ESPECIALES',
    items: [
      { to: '/atencion-cliente', icon: Headphones, label: 'Atención al Cliente', modulo: 'atencion_cliente' },
      { to: '/back-office',      icon: Briefcase,  label: 'Back Office',          modulo: 'back_office'      },
      { to: '/chips',            icon: Cpu,        label: 'Chips',                modulo: 'chips'            },
    ],
  },
  {
    label: 'RRHH',
    items: [
      { to: '/reloj',     icon: Clock,         label: 'Reloj',     modulo: 'reloj'     },
      { to: '/sanciones', icon: AlertTriangle, label: 'Sanciones', modulo: 'sanciones' },
      { to: '/personal',        icon: Users,      label: 'Personal',        modulo: 'personal'        },
      { to: '/certificaciones', icon: FileCheck,  label: 'Certificaciones', modulo: 'certificaciones' },
    ],
  },
  {
    label: 'SISTEMA',
    items: [
      { to: '/config',         icon: Settings, label: 'Configuración', modulo: 'configuracion' },
      { to: '/admin/usuarios', icon: Users,    label: 'Usuarios',      modulo: 'usuarios'      },
    ],
  },
];

function getInitials(nombre: string): string {
  return nombre.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('');
}

export interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const { userDoc, userRoles, logout } = useAuthContext();

  const visibleGroups = NAV_GROUPS
    .map(g => ({
      ...g,
      items: g.items.filter(item => tieneAcceso(userRoles, item.modulo)),
    }))
    .filter(g => g.items.length > 0);

  const roleLabels = userRoles.slice(0, 2).map(r => NOMBRES_ROLES[r as RolSistema] ?? r);

  return (
    <aside
      className={`fixed left-0 top-0 h-screen bg-[#003DA5] flex flex-col z-40 shadow-xl transition-all duration-200 overflow-hidden ${
        collapsed ? 'w-16' : 'w-60'
      }`}
    >
      {/* Logo / hamburger */}
      <div className="flex-shrink-0 border-b border-white/10">
        {collapsed ? (
          <div className="flex items-center justify-center py-[18px]">
            <button
              onClick={onToggle}
              title="Expandir menú"
              className="text-blue-200 hover:text-white p-1.5 rounded-md hover:bg-white/10 transition-colors"
            >
              <Menu size={18} />
            </button>
          </div>
        ) : (
          <div className="px-5 py-[18px] flex items-center justify-between">
            <div>
              <div className="text-white font-bold text-[17px] tracking-widest leading-tight">EFICIENCIA</div>
              <div className="text-blue-200/70 text-[9px] font-semibold tracking-[0.22em] mt-0.5 uppercase">
                Sistema de Reportes
              </div>
            </div>
            <button
              onClick={onToggle}
              title="Contraer menú"
              className="text-blue-200 hover:text-white p-1.5 rounded-md hover:bg-white/10 transition-colors flex-shrink-0"
            >
              <Menu size={16} />
            </button>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-2 overflow-y-auto overflow-x-hidden">
        {visibleGroups.map((group, gi) => (
          <div key={group.label} className={gi > 0 ? 'mt-1' : ''}>
            {!collapsed ? (
              <div className="px-5 pt-3 pb-1 text-[9px] font-bold tracking-[0.18em] text-blue-300/50 uppercase select-none">
                {group.label}
              </div>
            ) : gi > 0 ? (
              <div className="mx-3 my-1.5 border-t border-white/10" />
            ) : null}

            {group.items.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                title={collapsed ? label : undefined}
                className={({ isActive }) =>
                  `flex items-center mx-2 px-3 py-2 rounded-lg text-[13px] font-medium transition-all ${
                    collapsed ? 'justify-center' : 'gap-2.5'
                  } ${
                    isActive
                      ? `bg-white/15 text-white${!collapsed ? ' border-l-[3px] border-[#E3000F] pl-[9px]' : ''}`
                      : 'text-blue-200 hover:bg-white/10 hover:text-white'
                  }`
                }
              >
                <Icon size={15} className="flex-shrink-0" />
                {!collapsed && <span className="truncate">{label}</span>}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {/* User footer */}
      <div className="border-t border-white/10 flex-shrink-0">
        {userDoc && (
          collapsed ? (
            <div className="flex flex-col items-center gap-2 py-3">
              <div
                className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-white text-[11px] font-bold select-none"
                title={userDoc.nombre}
              >
                {getInitials(userDoc.nombre)}
              </div>
              <button
                onClick={() => logout()}
                title="Cerrar sesión"
                className="text-blue-300 hover:text-white transition-colors p-1 rounded-md hover:bg-white/10"
              >
                <LogOut size={14} />
              </button>
            </div>
          ) : (
            <div className="px-4 py-3.5 flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0 select-none">
                {getInitials(userDoc.nombre)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-white text-[12px] font-medium truncate leading-tight">{userDoc.nombre}</div>
                <div
                  className="text-[10px] truncate"
                  style={{ color: ROL_COLORS[userRoles[0] as RolSistema] ?? '#93C5FD' }}
                >
                  {roleLabels.join(' · ')}
                </div>
              </div>
              <button
                onClick={() => logout()}
                title="Cerrar sesión"
                className="text-blue-300 hover:text-white transition-colors p-1 rounded-md hover:bg-white/10"
              >
                <LogOut size={14} />
              </button>
            </div>
          )
        )}
      </div>
    </aside>
  );
}
