import { AlertTriangle, AlertCircle, Info } from 'lucide-react';
import type { AtencionData } from './atencionParser';
import { fmtSecs } from './atencionParser';

// ─── Types ────────────────────────────────────────────────────────────────────

type Nivel = 'critico' | 'advertencia' | 'info';

export interface AlertaAtencion {
  nivel: Nivel;
  grupo: string;
  mensaje: string;
}

// ─── Generator ───────────────────────────────────────────────────────────────

export function generarAlertas(data: AtencionData): AlertaAtencion[] {
  const alertas: AlertaAtencion[] = [];
  const { grupos, totales } = data;

  // Global totals
  if (totales.tasaAbandono > 20) {
    alertas.push({ nivel: 'critico', grupo: 'Global', mensaje: `Tasa de abandono crítica: ${totales.tasaAbandono.toFixed(1)}% (>20%)` });
  } else if (totales.tasaAbandono > 10) {
    alertas.push({ nivel: 'advertencia', grupo: 'Global', mensaje: `Tasa de abandono elevada: ${totales.tasaAbandono.toFixed(1)}% (>10%)` });
  }

  if (totales.tasaRespuesta < 60) {
    alertas.push({ nivel: 'critico', grupo: 'Global', mensaje: `Tasa de respuesta crítica: ${totales.tasaRespuesta.toFixed(1)}% (<60%)` });
  } else if (totales.tasaRespuesta < 80) {
    alertas.push({ nivel: 'advertencia', grupo: 'Global', mensaje: `Tasa de respuesta baja: ${totales.tasaRespuesta.toFixed(1)}% (<80%)` });
  }

  if (totales.tiempoMedioCola > 120) {
    alertas.push({ nivel: 'critico', grupo: 'Global', mensaje: `Tiempo medio de cola crítico: ${fmtSecs(totales.tiempoMedioCola)} (>2 min)` });
  } else if (totales.tiempoMedioCola > 60) {
    alertas.push({ nivel: 'advertencia', grupo: 'Global', mensaje: `Tiempo medio de cola elevado: ${fmtSecs(totales.tiempoMedioCola)} (>1 min)` });
  }

  // Per-group analysis
  for (const grupo of grupos) {
    const nombre = grupo.nombreLegible;

    if (grupo.tasaAbandono > 25) {
      alertas.push({ nivel: 'critico', grupo: nombre, mensaje: `Abandono crítico: ${grupo.tasaAbandono.toFixed(1)}% de las llamadas` });
    } else if (grupo.tasaAbandono > 15) {
      alertas.push({ nivel: 'advertencia', grupo: nombre, mensaje: `Abandono elevado: ${grupo.tasaAbandono.toFixed(1)}%` });
    }

    if (grupo.tiempoMedioCola > 180) {
      alertas.push({ nivel: 'critico', grupo: nombre, mensaje: `Tiempo en cola crítico: ${fmtSecs(grupo.tiempoMedioCola)} (>3 min)` });
    }

    if (grupo.tasaRespuesta < 70) {
      alertas.push({ nivel: 'advertencia', grupo: nombre, mensaje: `Tasa de respuesta baja: ${grupo.tasaRespuesta.toFixed(1)}%` });
    }

    // Hourly analysis
    const horasCriticas = grupo.horasDesglose.filter(h => h.alertaAbandono && h.llamadas >= 5);
    if (horasCriticas.length >= 3) {
      const hrs = horasCriticas.map(h => `${h.hora}h`).join(', ');
      alertas.push({ nivel: 'advertencia', grupo: nombre, mensaje: `Abandono >15% en múltiples franjas: ${hrs}` });
    }

    const horaPico = grupo.horasDesglose.find(h => h.esHoraPico);
    if (horaPico && horaPico.tasaAbandono > 20) {
      alertas.push({ nivel: 'critico', grupo: nombre, mensaje: `Hora pico (${horaPico.hora}h) con abandono alto: ${horaPico.tasaAbandono.toFixed(1)}%` });
    }

    if (grupo.llamadas === 0) {
      alertas.push({ nivel: 'info', grupo: nombre, mensaje: 'Sin llamadas registradas en el período' });
    }
  }

  // Info notices
  if (totales.tasaRespuesta >= 90 && totales.tasaAbandono <= 5) {
    alertas.push({ nivel: 'info', grupo: 'Global', mensaje: `Excelente desempeño: ${totales.tasaRespuesta.toFixed(1)}% respuesta, ${totales.tasaAbandono.toFixed(1)}% abandono` });
  }

  const sortOrder: Record<Nivel, number> = { critico: 0, advertencia: 1, info: 2 };
  return alertas.sort((a, b) => sortOrder[a.nivel] - sortOrder[b.nivel]);
}

// ─── Component ───────────────────────────────────────────────────────────────

const NIVEL_CONFIG: Record<Nivel, { label: string; icon: typeof AlertTriangle; bg: string; border: string; text: string; dot: string }> = {
  critico:     { label: 'Crítico',     icon: AlertTriangle, bg: 'bg-red-50',    border: 'border-red-200',    text: 'text-red-700',    dot: 'bg-red-500'    },
  advertencia: { label: 'Advertencia', icon: AlertCircle,   bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-700', dot: 'bg-yellow-500' },
  info:        { label: 'Info',        icon: Info,          bg: 'bg-blue-50',   border: 'border-blue-200',   text: 'text-blue-700',   dot: 'bg-blue-400'   },
};

export function AtencionAlertas({ data }: { data: AtencionData }) {
  const alertas = generarAlertas(data);

  if (alertas.length === 0) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
        <Info size={24} className="text-green-600 mx-auto mb-2" />
        <p className="text-green-700 font-semibold">Sin alertas</p>
        <p className="text-green-600 text-sm mt-1">El desempeño del día está dentro de los parámetros normales.</p>
      </div>
    );
  }

  const criticos   = alertas.filter(a => a.nivel === 'critico');
  const advertencias = alertas.filter(a => a.nivel === 'advertencia');
  const infos      = alertas.filter(a => a.nivel === 'info');

  return (
    <div className="space-y-4">
      {/* Summary chips */}
      <div className="flex flex-wrap gap-2">
        {criticos.length > 0 && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
            {criticos.length} crítico{criticos.length > 1 ? 's' : ''}
          </span>
        )}
        {advertencias.length > 0 && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 inline-block" />
            {advertencias.length} advertencia{advertencias.length > 1 ? 's' : ''}
          </span>
        )}
        {infos.length > 0 && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block" />
            {infos.length} informativa{infos.length > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Alert list */}
      <div className="space-y-2">
        {alertas.map((alerta, idx) => {
          const cfg = NIVEL_CONFIG[alerta.nivel];
          const Icon = cfg.icon;
          return (
            <div key={idx} className={`${cfg.bg} ${cfg.border} border rounded-lg px-4 py-3 flex items-start gap-3`}>
              <Icon size={15} className={`${cfg.text} flex-shrink-0 mt-0.5`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs font-bold uppercase tracking-wide ${cfg.text}`}>{cfg.label}</span>
                  <span className="text-xs bg-white/60 px-2 py-0.5 rounded-full text-gray-600 font-medium">{alerta.grupo}</span>
                </div>
                <p className={`text-sm mt-0.5 ${cfg.text}`}>{alerta.mensaje}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
