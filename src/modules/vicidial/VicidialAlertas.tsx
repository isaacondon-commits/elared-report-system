import { AlertTriangle, XCircle, Info } from 'lucide-react';
import type { VicidialData } from './vicidialParser';
import { getNombreLegible, fmtMins, findAlmuerzoKey, findBaoKey, findManualKey, findVtamovKey, findLaggedKey } from './vicidialParser';

type Nivel = 'critico' | 'advertencia' | 'info';

interface Alerta {
  nivel: Nivel;
  agente: string;
  mensaje: string;
}

export function generarAlertas(data: VicidialData): Alerta[] {
  const alertas: Alerta[] = [];
  const { agentes, tiposPausa } = data;

  const almKey   = findAlmuerzoKey(tiposPausa);
  const baoKey   = findBaoKey(tiposPausa);
  const manKey   = findManualKey(tiposPausa);
  const vtKey    = findVtamovKey(tiposPausa);
  const lagKey   = findLaggedKey(tiposPausa);

  for (const a of agentes) {
    // ─── CRÍTICO ──────────────────────────────────────────────────
    if (a.pausaOciosa > 90) {
      alertas.push({
        nivel: 'critico', agente: a.usuario,
        mensaje: `Pausa ociosa de ${fmtMins(a.pausaOciosa)} (supera 90 min)`,
      });
    }
    if (a.eficiencia < 40) {
      alertas.push({
        nivel: 'critico', agente: a.usuario,
        mensaje: `Eficiencia muy baja: ${a.eficiencia.toFixed(1)}% (hablando + categorizando < 40%)`,
      });
    }
    const almuerzoMins = almKey ? (a.pausas[almKey] ?? 0) : 0;
    if (almuerzoMins > 45) {
      alertas.push({
        nivel: 'critico', agente: a.usuario,
        mensaje: `${getNombreLegible(almKey ?? '')} excedido: ${fmtMins(almuerzoMins)} (límite 30 min)`,
      });
    }

    // ─── ADVERTENCIA ─────────────────────────────────────────────
    if (manKey) {
      const manMins = a.pausas[manKey] ?? 0;
      if (manMins > 15) {
        alertas.push({
          nivel: 'advertencia', agente: a.usuario,
          mensaje: `${getNombreLegible(manKey)} elevado: ${fmtMins(manMins)}`,
        });
      }
    }
    if (almuerzoMins > 30 && almuerzoMins <= 45) {
      alertas.push({
        nivel: 'advertencia', agente: a.usuario,
        mensaje: `${getNombreLegible(almKey ?? '')} excedido: ${fmtMins(almuerzoMins)} (entre 30 y 45 min)`,
      });
    }
    if (baoKey && (a.pausas[baoKey] ?? 0) > 10) {
      alertas.push({
        nivel: 'advertencia', agente: a.usuario,
        mensaje: `${getNombreLegible(baoKey)} excedido: ${fmtMins(a.pausas[baoKey] ?? 0)} (límite 10 min)`,
      });
    }

    // ─── INFO ─────────────────────────────────────────────────────
    if (vtKey && (a.pausas[vtKey] ?? 0) > 30) {
      alertas.push({
        nivel: 'info', agente: a.usuario,
        mensaje: `${getNombreLegible(vtKey)} destacado: ${fmtMins(a.pausas[vtKey] ?? 0)}`,
      });
    }
    if (almKey && almuerzoMins === 0) {
      alertas.push({
        nivel: 'info', agente: a.usuario,
        mensaje: `Sin registro de ${getNombreLegible(almKey)}`,
      });
    }
    if (lagKey && (a.pausas[lagKey] ?? 0) > 0) {
      alertas.push({
        nivel: 'info', agente: a.usuario,
        mensaje: `${getNombreLegible(lagKey)} registrado: ${fmtMins(a.pausas[lagKey] ?? 0)}`,
      });
    }
  }

  // Sort: crítico → advertencia → info
  const order: Record<Nivel, number> = { critico: 0, advertencia: 1, info: 2 };
  alertas.sort((a, b) => order[a.nivel] - order[b.nivel]);
  return alertas;
}

// ─── Component ────────────────────────────────────────────────────────────────

const NIVEL_STYLES: Record<Nivel, { bg: string; border: string; text: string; dot: string }> = {
  critico:     { bg: 'bg-red-50',    border: 'border-red-200',    text: 'text-red-700',    dot: 'bg-red-500'    },
  advertencia: { bg: 'bg-amber-50',  border: 'border-amber-200',  text: 'text-amber-700',  dot: 'bg-amber-500'  },
  info:        { bg: 'bg-blue-50',   border: 'border-blue-200',   text: 'text-blue-700',   dot: 'bg-blue-400'   },
};

const NIVEL_ICON: Record<Nivel, React.ReactNode> = {
  critico:     <XCircle size={15} className="text-red-500 shrink-0" />,
  advertencia: <AlertTriangle size={15} className="text-amber-500 shrink-0" />,
  info:        <Info size={15} className="text-blue-400 shrink-0" />,
};

export function VicidialAlertas({ data }: { data: VicidialData }) {
  const alertas = generarAlertas(data);

  if (alertas.length === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
        <Info size={15} />
        Sin alertas — todos los agentes dentro de parámetros normales.
      </div>
    );
  }

  const criticos     = alertas.filter(a => a.nivel === 'critico').length;
  const advertencias = alertas.filter(a => a.nivel === 'advertencia').length;
  const infos        = alertas.filter(a => a.nivel === 'info').length;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4 text-xs text-slate-500">
        {criticos     > 0 && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" />{criticos} crítico{criticos > 1 ? 's' : ''}</span>}
        {advertencias > 0 && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />{advertencias} advertencia{advertencias > 1 ? 's' : ''}</span>}
        {infos        > 0 && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />{infos} info</span>}
      </div>

      <div className="space-y-2">
        {alertas.map((alerta, i) => {
          const s = NIVEL_STYLES[alerta.nivel];
          return (
            <div key={i} className={`flex items-start gap-2 ${s.bg} ${s.border} border rounded-lg px-3 py-2`}>
              {NIVEL_ICON[alerta.nivel]}
              <div className="min-w-0">
                <span className={`font-semibold text-xs ${s.text}`}>{alerta.agente}</span>
                <span className={`text-xs ${s.text} ml-1`}>— {alerta.mensaje}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
