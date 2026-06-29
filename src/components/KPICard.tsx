import type { LucideIcon } from 'lucide-react';

interface KPICardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon?: LucideIcon;
  color?: 'blue' | 'red' | 'green' | 'amber' | 'gray';
  size?: 'normal' | 'small';
}

const COLOR_MAP = {
  blue:  { accent: '#003DA5', iconBg: 'bg-blue-50',  iconFg: 'text-[#003DA5]', valueFg: '#003DA5' },
  red:   { accent: '#E3000F', iconBg: 'bg-red-50',   iconFg: 'text-[#E3000F]', valueFg: '#E3000F' },
  green: { accent: '#16a34a', iconBg: 'bg-green-50', iconFg: 'text-green-700', valueFg: '#16a34a' },
  amber: { accent: '#d97706', iconBg: 'bg-amber-50', iconFg: 'text-amber-700', valueFg: '#d97706' },
  gray:  { accent: '#64748b', iconBg: 'bg-gray-100', iconFg: 'text-gray-600',  valueFg: '#334155' },
};

export default function KPICard({ label, value, sub, icon: Icon, color = 'blue', size = 'normal' }: KPICardProps) {
  const c = COLOR_MAP[color];
  const isSmall = size === 'small';

  return (
    <div
      className="bg-white rounded-lg border border-gray-200 p-4 flex items-start gap-3 shadow-sm"
      style={{ borderTop: `4px solid ${c.accent}` }}
    >
      {Icon && (
        <div className={`${c.iconBg} p-2 rounded-lg flex-shrink-0 mt-0.5`}>
          <Icon size={isSmall ? 16 : 22} className={c.iconFg} />
        </div>
      )}
      <div className="min-w-0">
        <div
          className="font-semibold uppercase tracking-wider text-gray-500"
          style={{ fontSize: isSmall ? 10 : 11, letterSpacing: '0.06em' }}
        >
          {label}
        </div>
        <div
          className="font-bold leading-none mt-1 truncate"
          style={{ fontSize: isSmall ? 22 : 32, color: c.valueFg }}
        >
          {value}
        </div>
        {sub && (
          <div className="text-xs text-gray-400 mt-1 truncate">{sub}</div>
        )}
      </div>
    </div>
  );
}
