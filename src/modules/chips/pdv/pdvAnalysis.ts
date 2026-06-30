import type { PuntoVenta } from './pdvParser';

export type PdvInactivo = PuntoVenta & { diasInactivo: number };
export type PdvVencimiento = PuntoVenta & { diasParaVencer: number };

export type DistribucionRow = {
  distribuidor: string;
  cantidad: number;
  porcentaje: number;
};

export type EstadoRow = {
  estado: string;
  cantidad: number;
  porcentaje: number;
};

export type AlertaInactividad = {
  total: number;
  puntos: PdvInactivo[];
  porDistribuidor: { distribuidor: string; cantidad: number }[];
};

export type AlertaVencimiento = {
  porVencer: { total: number; puntos: PdvVencimiento[] };
  yaVencidos: { total: number; puntos: PdvVencimiento[] };
};

export type DiaRendimiento = {
  fecha: string;
  visitas: number;
};

export type RendimientoRow = {
  nombre: string;
  diasActivos: number;
  totalVisitas: number;
  promedioVisitasDia: number;
  detalleDias: DiaRendimiento[];
};

export type MesNuevos = {
  mes: string;
  cantidad: number;
};

export type NuevosPuntos = {
  totalEnRango: number;
  porMes: MesNuevos[];
  promedioMensual: number;
};

function daysDiff(a: Date, b: Date): number {
  return Math.floor((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
}

export function getDistribucionChiperos(rows: PuntoVenta[]): DistribucionRow[] {
  const map = new Map<string, number>();
  for (const r of rows) {
    const d = r.distribuidor || 'Sin distribuidor';
    map.set(d, (map.get(d) ?? 0) + 1);
  }
  const total = rows.length;
  return Array.from(map.entries())
    .map(([distribuidor, cantidad]) => ({
      distribuidor,
      cantidad,
      porcentaje: total > 0 ? (cantidad / total) * 100 : 0,
    }))
    .sort((a, b) => b.cantidad - a.cantidad);
}

export function getEstadosPdv(rows: PuntoVenta[]): EstadoRow[] {
  const map = new Map<string, number>();
  for (const r of rows) {
    const e = r.estadoUltimaVisita || 'Sin estado';
    map.set(e, (map.get(e) ?? 0) + 1);
  }
  const total = rows.length;
  return Array.from(map.entries())
    .map(([estado, cantidad]) => ({
      estado,
      cantidad,
      porcentaje: total > 0 ? (cantidad / total) * 100 : 0,
    }))
    .sort((a, b) => b.cantidad - a.cantidad);
}

export function getAlertaInactividad(rows: PuntoVenta[], fechaRef: Date = new Date()): AlertaInactividad {
  const inactivos: PdvInactivo[] = [];

  for (const r of rows) {
    let diasInactivo: number;
    if (r.visitadoPorDistribuidor) {
      diasInactivo = daysDiff(fechaRef, new Date(r.visitadoPorDistribuidor));
    } else if (r.creado) {
      // Never visited — count from creation date
      diasInactivo = daysDiff(fechaRef, new Date(r.creado));
    } else {
      continue;
    }
    if (diasInactivo > 60) inactivos.push({ ...r, diasInactivo });
  }

  inactivos.sort((a, b) => b.diasInactivo - a.diasInactivo);

  const distribMap = new Map<string, number>();
  for (const p of inactivos) {
    const d = p.distribuidor || 'Sin distribuidor';
    distribMap.set(d, (distribMap.get(d) ?? 0) + 1);
  }
  const porDistribuidor = Array.from(distribMap.entries())
    .map(([distribuidor, cantidad]) => ({ distribuidor, cantidad }))
    .sort((a, b) => b.cantidad - a.cantidad);

  return { total: inactivos.length, puntos: inactivos, porDistribuidor };
}

export function getAlertaVencimiento(rows: PuntoVenta[], fechaRef: Date = new Date()): AlertaVencimiento {
  const porVencer: PdvVencimiento[] = [];
  const yaVencidos: PdvVencimiento[] = [];

  for (const r of rows) {
    if (!r.fechaVencimientoChipMasViejo) continue;
    const fechaVenc = new Date(r.fechaVencimientoChipMasViejo);
    const diasParaVencer = daysDiff(fechaVenc, fechaRef);
    if (diasParaVencer < 0) {
      yaVencidos.push({ ...r, diasParaVencer });
    } else if (diasParaVencer <= 30) {
      porVencer.push({ ...r, diasParaVencer });
    }
  }

  // porVencer: asc (0 days first = most urgent)
  porVencer.sort((a, b) => a.diasParaVencer - b.diasParaVencer);
  // yaVencidos: asc (most negative = most overdue = first)
  yaVencidos.sort((a, b) => a.diasParaVencer - b.diasParaVencer);

  return {
    porVencer: { total: porVencer.length, puntos: porVencer },
    yaVencidos: { total: yaVencidos.length, puntos: yaVencidos },
  };
}

export function getRendimientoChiperos(rows: PuntoVenta[]): RendimientoRow[] {
  const dayMap = new Map<string, number>();

  for (const r of rows) {
    if (!r.distribuidor || !r.visitadoPorDistribuidor) continue;
    const key = `${r.distribuidor}|||${r.visitadoPorDistribuidor}`;
    dayMap.set(key, (dayMap.get(key) ?? 0) + 1);
  }

  const distribMap = new Map<string, DiaRendimiento[]>();
  for (const [key, visitas] of dayMap.entries()) {
    const sep = key.indexOf('|||');
    const nombre = key.slice(0, sep);
    const fecha = key.slice(sep + 3);
    if (!distribMap.has(nombre)) distribMap.set(nombre, []);
    distribMap.get(nombre)!.push({ fecha, visitas });
  }

  return Array.from(distribMap.entries())
    .map(([nombre, dias]) => {
      dias.sort((a, b) => b.fecha.localeCompare(a.fecha));
      const diasActivos = dias.length;
      const totalVisitas = dias.reduce((s, d) => s + d.visitas, 0);
      const promedioVisitasDia = diasActivos > 0 ? totalVisitas / diasActivos : 0;
      return { nombre, diasActivos, totalVisitas, promedioVisitasDia, detalleDias: dias };
    })
    .sort((a, b) => b.totalVisitas - a.totalVisitas);
}

export function getNuevosPuntos(rows: PuntoVenta[], desde?: Date, hasta?: Date): NuevosPuntos {
  const filtered = rows.filter(r => {
    if (!r.creado) return false;
    const fecha = new Date(r.creado);
    if (desde && fecha < desde) return false;
    if (hasta) {
      const hastaEnd = new Date(hasta);
      hastaEnd.setHours(23, 59, 59);
      if (fecha > hastaEnd) return false;
    }
    return true;
  });

  const monthMap = new Map<string, number>();
  for (const r of filtered) {
    const mes = r.creado.slice(0, 7);
    if (mes) monthMap.set(mes, (monthMap.get(mes) ?? 0) + 1);
  }

  const porMes = Array.from(monthMap.entries())
    .map(([mes, cantidad]) => ({ mes, cantidad }))
    .sort((a, b) => a.mes.localeCompare(b.mes));

  const totalEnRango = filtered.length;
  const promedioMensual = porMes.length > 0 ? Math.round(totalEnRango / porMes.length) : 0;

  return { totalEnRango, porMes, promedioMensual };
}
