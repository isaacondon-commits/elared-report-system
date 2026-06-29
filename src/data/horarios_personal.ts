// ─── Types ─────────────────────────────────────────────────────────────────────

export interface HorarioDia {
  ingreso: string;
  salida: string;
  trabaja: boolean;
}

export interface HorarioPersona {
  nombre: string;
  lunesAMiercoles: HorarioDia;
  jueveYViernes: HorarioDia;
  sabado: HorarioDia;
  domingo: HorarioDia;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

export function getHorarioDia(persona: HorarioPersona, diaSemana: number): HorarioDia {
  switch (diaSemana) {
    case 0: return persona.domingo;
    case 1:
    case 2:
    case 3: return persona.lunesAMiercoles;
    case 4:
    case 5: return persona.jueveYViernes;
    case 6: return persona.sabado;
    default: return { ingreso: '', salida: '', trabaja: false };
  }
}

function normNombre(n: string): string {
  return n
    .trim()
    .toLowerCase()
    .replace(/,/g, ' ')
    .replace(/[áàä]/g, 'a')
    .replace(/[éèë]/g, 'e')
    .replace(/[íìï]/g, 'i')
    .replace(/[óòö]/g, 'o')
    .replace(/[úùü]/g, 'u')
    .replace(/ñ/g, 'n')
    .replace(/\s+/g, ' ')
    .trim();
}

export type BusquedaHorarioResult = {
  persona: HorarioPersona;
  fuente: 'horario_oficial' | 'horario_custom';
};

function matchEnLista(lista: HorarioPersona[], norm: string, tokensReloj: string[]): HorarioPersona | null {
  for (const p of lista) {
    if (normNombre(p.nombre) === norm) return p;
  }
  if (tokensReloj.length === 0) return null;
  let best: HorarioPersona | null = null;
  let bestScore = 0;
  for (const p of lista) {
    const tokensConfig = normNombre(p.nombre).split(' ').filter(t => t.length > 1);
    const common = tokensReloj.filter(t => tokensConfig.includes(t)).length;
    const score = common / Math.max(tokensReloj.length, tokensConfig.length);
    if (score > bestScore && score >= 0.5) { bestScore = score; best = p; }
  }
  return best;
}

export function buscarHorarioPersona(nombreReloj: string): BusquedaHorarioResult | null {
  const norm = normNombre(nombreReloj);
  const tokensReloj = norm.split(' ').filter(t => t.length > 1);

  // 1. Buscar en horarios guardados manualmente (localStorage)
  try {
    const raw = localStorage.getItem('elared_horarios_custom');
    if (raw) {
      const custom: HorarioPersona[] = JSON.parse(raw);
      const found = matchEnLista(custom, norm, tokensReloj);
      if (found) return { persona: found, fuente: 'horario_custom' };
    }
  } catch {}

  // 2. Buscar en HORARIOS_PERSONAL (archivo base)
  const found = matchEnLista(HORARIOS_PERSONAL, norm, tokensReloj);
  if (found) return { persona: found, fuente: 'horario_oficial' };

  return null;
}

export function guardarHorarioCustom(horario: HorarioPersona): void {
  try {
    const raw = localStorage.getItem('elared_horarios_custom');
    const custom: HorarioPersona[] = raw ? JSON.parse(raw) : [];
    const norm = normNombre(horario.nombre);
    const idx = custom.findIndex(h => normNombre(h.nombre) === norm);
    if (idx >= 0) custom[idx] = horario;
    else custom.push(horario);
    localStorage.setItem('elared_horarios_custom', JSON.stringify(custom));
  } catch {}
}

// ─── Datos de horarios (80 personas) ──────────────────────────────────────────

const NO: HorarioDia = { ingreso: '', salida: '', trabaja: false };
const SAB_10_14: HorarioDia = { ingreso: '10:00', salida: '14:00', trabaja: true };

export const HORARIOS_PERSONAL: HorarioPersona[] = [

  // ── TURNO 09:00–16:30 (Lun-Vie), sin fines de semana ────────────────────────
  { nombre: 'Sofia Barrios',     lunesAMiercoles: { ingreso: '09:00', salida: '16:30', trabaja: true }, jueveYViernes: { ingreso: '09:00', salida: '16:30', trabaja: true }, sabado: NO, domingo: NO },
  { nombre: 'micaela pizano',    lunesAMiercoles: { ingreso: '09:00', salida: '16:30', trabaja: true }, jueveYViernes: { ingreso: '09:00', salida: '16:30', trabaja: true }, sabado: NO, domingo: NO },
  { nombre: 'Victoria Garro',    lunesAMiercoles: { ingreso: '09:00', salida: '16:30', trabaja: true }, jueveYViernes: { ingreso: '09:00', salida: '16:30', trabaja: true }, sabado: NO, domingo: NO },
  { nombre: 'melisa loureiro',   lunesAMiercoles: { ingreso: '09:00', salida: '16:30', trabaja: true }, jueveYViernes: { ingreso: '09:00', salida: '16:30', trabaja: true }, sabado: NO, domingo: NO },
  { nombre: 'Daniela Vallari',   lunesAMiercoles: { ingreso: '09:00', salida: '16:30', trabaja: true }, jueveYViernes: { ingreso: '09:00', salida: '16:30', trabaja: true }, sabado: NO, domingo: NO },
  { nombre: 'Marcia San Martín', lunesAMiercoles: { ingreso: '09:00', salida: '16:30', trabaja: true }, jueveYViernes: { ingreso: '09:00', salida: '16:30', trabaja: true }, sabado: NO, domingo: NO },

  // ── TURNO 09:30–16:00 (Lun-Jue 09:30, Jue-Vie 09:00) + Sáb 10:00–14:00 ────
  { nombre: 'Yomara Abreu',                  lunesAMiercoles: { ingreso: '09:30', salida: '16:00', trabaja: true }, jueveYViernes: { ingreso: '09:00', salida: '16:00', trabaja: true }, sabado: SAB_10_14, domingo: NO },
  { nombre: 'Agustina De Leon',              lunesAMiercoles: { ingreso: '09:30', salida: '16:00', trabaja: true }, jueveYViernes: { ingreso: '09:00', salida: '16:00', trabaja: true }, sabado: SAB_10_14, domingo: NO },
  { nombre: 'romina sauco',                  lunesAMiercoles: { ingreso: '09:30', salida: '16:00', trabaja: true }, jueveYViernes: { ingreso: '09:00', salida: '16:00', trabaja: true }, sabado: SAB_10_14, domingo: NO },
  { nombre: 'Sol Echeverria',                lunesAMiercoles: { ingreso: '09:30', salida: '16:00', trabaja: true }, jueveYViernes: { ingreso: '09:00', salida: '16:00', trabaja: true }, sabado: SAB_10_14, domingo: NO },
  { nombre: 'Aldana Forischi',               lunesAMiercoles: { ingreso: '09:30', salida: '16:00', trabaja: true }, jueveYViernes: { ingreso: '09:00', salida: '16:00', trabaja: true }, sabado: SAB_10_14, domingo: NO },
  { nombre: 'Antonella Gomez',               lunesAMiercoles: { ingreso: '09:30', salida: '16:00', trabaja: true }, jueveYViernes: { ingreso: '09:00', salida: '16:00', trabaja: true }, sabado: SAB_10_14, domingo: NO },
  { nombre: 'Brisa Romero',                  lunesAMiercoles: { ingreso: '09:30', salida: '16:00', trabaja: true }, jueveYViernes: { ingreso: '09:00', salida: '16:00', trabaja: true }, sabado: SAB_10_14, domingo: NO },
  { nombre: 'Luz Divina adan Loronia',       lunesAMiercoles: { ingreso: '09:30', salida: '16:00', trabaja: true }, jueveYViernes: { ingreso: '09:00', salida: '16:00', trabaja: true }, sabado: SAB_10_14, domingo: NO },
  { nombre: 'Natalia Perez Monnet',          lunesAMiercoles: { ingreso: '09:30', salida: '16:00', trabaja: true }, jueveYViernes: { ingreso: '09:00', salida: '16:00', trabaja: true }, sabado: SAB_10_14, domingo: NO },
  { nombre: 'Micaela rodriguez espino',      lunesAMiercoles: { ingreso: '09:30', salida: '16:00', trabaja: true }, jueveYViernes: { ingreso: '09:00', salida: '16:00', trabaja: true }, sabado: SAB_10_14, domingo: NO },
  { nombre: 'Evelin Teresita Aleman Lema',   lunesAMiercoles: { ingreso: '09:30', salida: '16:00', trabaja: true }, jueveYViernes: { ingreso: '09:00', salida: '16:00', trabaja: true }, sabado: SAB_10_14, domingo: NO },
  { nombre: 'Julieta Belen Sosa Da rocha',   lunesAMiercoles: { ingreso: '09:30', salida: '16:00', trabaja: true }, jueveYViernes: { ingreso: '09:00', salida: '16:00', trabaja: true }, sabado: SAB_10_14, domingo: NO },
  { nombre: 'Camila Castro',                 lunesAMiercoles: { ingreso: '09:30', salida: '16:00', trabaja: true }, jueveYViernes: { ingreso: '09:00', salida: '16:00', trabaja: true }, sabado: SAB_10_14, domingo: NO },
  { nombre: 'Maia Alvez',                    lunesAMiercoles: { ingreso: '09:30', salida: '16:00', trabaja: true }, jueveYViernes: { ingreso: '09:00', salida: '16:00', trabaja: true }, sabado: SAB_10_14, domingo: NO },
  { nombre: 'Wanda Bentancor',               lunesAMiercoles: { ingreso: '09:30', salida: '16:00', trabaja: true }, jueveYViernes: { ingreso: '09:00', salida: '16:00', trabaja: true }, sabado: SAB_10_14, domingo: NO },
  { nombre: 'Guadalupe Marchett',            lunesAMiercoles: { ingreso: '09:30', salida: '16:00', trabaja: true }, jueveYViernes: { ingreso: '09:00', salida: '16:00', trabaja: true }, sabado: SAB_10_14, domingo: NO },
  { nombre: 'Yamila Sotelo',                 lunesAMiercoles: { ingreso: '09:30', salida: '16:00', trabaja: true }, jueveYViernes: { ingreso: '09:00', salida: '16:00', trabaja: true }, sabado: SAB_10_14, domingo: NO },
  { nombre: 'Brenda Navarro',                lunesAMiercoles: { ingreso: '09:30', salida: '16:00', trabaja: true }, jueveYViernes: { ingreso: '09:00', salida: '16:00', trabaja: true }, sabado: SAB_10_14, domingo: NO },
  { nombre: 'Lucia Corbo',                   lunesAMiercoles: { ingreso: '09:30', salida: '16:00', trabaja: true }, jueveYViernes: { ingreso: '09:00', salida: '16:00', trabaja: true }, sabado: SAB_10_14, domingo: NO },
  { nombre: 'Emily Regehr',                  lunesAMiercoles: { ingreso: '09:30', salida: '16:00', trabaja: true }, jueveYViernes: { ingreso: '09:00', salida: '16:00', trabaja: true }, sabado: SAB_10_14, domingo: NO },
  { nombre: 'Victoria Pampin',               lunesAMiercoles: { ingreso: '09:30', salida: '16:00', trabaja: true }, jueveYViernes: { ingreso: '09:00', salida: '16:00', trabaja: true }, sabado: SAB_10_14, domingo: NO },

  // ── TURNO 09:30–17:00 (Lun-Vie), sin fines de semana ────────────────────────
  { nombre: 'Lusmila Lanusse',    lunesAMiercoles: { ingreso: '09:30', salida: '17:00', trabaja: true }, jueveYViernes: { ingreso: '09:30', salida: '17:00', trabaja: true }, sabado: NO, domingo: NO },
  { nombre: 'Alison Redon',       lunesAMiercoles: { ingreso: '09:30', salida: '17:00', trabaja: true }, jueveYViernes: { ingreso: '09:30', salida: '17:00', trabaja: true }, sabado: NO, domingo: NO },
  { nombre: 'Camila DLS',         lunesAMiercoles: { ingreso: '09:30', salida: '17:00', trabaja: true }, jueveYViernes: { ingreso: '09:30', salida: '17:00', trabaja: true }, sabado: NO, domingo: NO },
  { nombre: 'Valentina Pintos',   lunesAMiercoles: { ingreso: '09:30', salida: '17:00', trabaja: true }, jueveYViernes: { ingreso: '09:30', salida: '17:00', trabaja: true }, sabado: NO, domingo: NO },
  { nombre: 'Ayelen Rodriguez',   lunesAMiercoles: { ingreso: '09:30', salida: '17:00', trabaja: true }, jueveYViernes: { ingreso: '09:30', salida: '17:00', trabaja: true }, sabado: NO, domingo: NO },
  { nombre: 'Luna Delgado',       lunesAMiercoles: { ingreso: '09:30', salida: '17:00', trabaja: true }, jueveYViernes: { ingreso: '09:30', salida: '17:00', trabaja: true }, sabado: NO, domingo: NO },
  { nombre: 'Nahomi Coronel',     lunesAMiercoles: { ingreso: '09:30', salida: '17:00', trabaja: true }, jueveYViernes: { ingreso: '09:30', salida: '17:00', trabaja: true }, sabado: NO, domingo: NO },
  { nombre: 'Brenda Martinez',    lunesAMiercoles: { ingreso: '09:30', salida: '17:00', trabaja: true }, jueveYViernes: { ingreso: '09:30', salida: '17:00', trabaja: true }, sabado: NO, domingo: NO },
  { nombre: 'Nicol Lima',         lunesAMiercoles: { ingreso: '09:30', salida: '17:00', trabaja: true }, jueveYViernes: { ingreso: '09:30', salida: '17:00', trabaja: true }, sabado: NO, domingo: NO },
  { nombre: 'Agustina dos Reis',  lunesAMiercoles: { ingreso: '09:30', salida: '17:00', trabaja: true }, jueveYViernes: { ingreso: '09:30', salida: '17:00', trabaja: true }, sabado: NO, domingo: NO },
  { nombre: 'Vanessa Ramos',      lunesAMiercoles: { ingreso: '09:30', salida: '17:00', trabaja: true }, jueveYViernes: { ingreso: '09:30', salida: '17:00', trabaja: true }, sabado: NO, domingo: NO },
  { nombre: 'Pamela Lagues',      lunesAMiercoles: { ingreso: '09:30', salida: '17:00', trabaja: true }, jueveYViernes: { ingreso: '09:30', salida: '17:00', trabaja: true }, sabado: NO, domingo: NO },
  { nombre: 'Katherine Nereitter',lunesAMiercoles: { ingreso: '09:30', salida: '17:00', trabaja: true }, jueveYViernes: { ingreso: '09:30', salida: '17:00', trabaja: true }, sabado: NO, domingo: NO },
  { nombre: 'naitsa lopez',       lunesAMiercoles: { ingreso: '09:30', salida: '17:00', trabaja: true }, jueveYViernes: { ingreso: '09:30', salida: '17:00', trabaja: true }, sabado: NO, domingo: NO },
  { nombre: 'camila Alvez',       lunesAMiercoles: { ingreso: '09:30', salida: '17:00', trabaja: true }, jueveYViernes: { ingreso: '09:30', salida: '17:00', trabaja: true }, sabado: NO, domingo: NO },
  { nombre: 'lucia alvarez',      lunesAMiercoles: { ingreso: '09:30', salida: '17:00', trabaja: true }, jueveYViernes: { ingreso: '09:30', salida: '17:00', trabaja: true }, sabado: NO, domingo: NO },
  { nombre: 'lucia lopez',        lunesAMiercoles: { ingreso: '09:30', salida: '17:00', trabaja: true }, jueveYViernes: { ingreso: '09:30', salida: '17:00', trabaja: true }, sabado: NO, domingo: NO },
  { nombre: 'saya da silva',      lunesAMiercoles: { ingreso: '09:30', salida: '17:00', trabaja: true }, jueveYViernes: { ingreso: '09:30', salida: '17:00', trabaja: true }, sabado: NO, domingo: NO },

  // ── TURNO 09:00–18:00 + Sáb 10:00–14:00 ────────────────────────────────────
  { nombre: 'Juan Manuel Martinez', lunesAMiercoles: { ingreso: '09:00', salida: '18:00', trabaja: true }, jueveYViernes: { ingreso: '09:00', salida: '18:00', trabaja: true }, sabado: SAB_10_14, domingo: NO },

  // ── TURNO 10:00–19:00 con variantes de fin de semana ────────────────────────
  { nombre: 'Catalina Carneiro',  lunesAMiercoles: { ingreso: '10:00', salida: '19:00', trabaja: true }, jueveYViernes: { ingreso: '10:00', salida: '19:00', trabaja: true }, sabado: SAB_10_14, domingo: NO },
  { nombre: 'Florencia Sequeira', lunesAMiercoles: { ingreso: '10:00', salida: '19:00', trabaja: true }, jueveYViernes: { ingreso: '10:00', salida: '19:00', trabaja: true }, sabado: NO, domingo: { ingreso: '10:00', salida: '14:00', trabaja: true } },
  { nombre: 'Enrique Dionisio',   lunesAMiercoles: { ingreso: '11:00', salida: '20:00', trabaja: true }, jueveYViernes: { ingreso: '11:00', salida: '20:00', trabaja: true }, sabado: NO, domingo: { ingreso: '10:00', salida: '14:00', trabaja: true } },

  // ── TURNO 11:30–18:00 (Lun-Mié) / 11:00–18:00 (Jue-Vie) + Sáb 10:00–14:00 ─
  { nombre: 'Soe Abigail Bejeres Lacaz',  lunesAMiercoles: { ingreso: '11:30', salida: '18:00', trabaja: true }, jueveYViernes: { ingreso: '11:00', salida: '18:00', trabaja: true }, sabado: SAB_10_14, domingo: NO },
  { nombre: 'Cecilia Albornoz',           lunesAMiercoles: { ingreso: '11:30', salida: '18:00', trabaja: true }, jueveYViernes: { ingreso: '11:00', salida: '18:00', trabaja: true }, sabado: SAB_10_14, domingo: NO },
  { nombre: 'Oriana Silva',               lunesAMiercoles: { ingreso: '11:30', salida: '18:00', trabaja: true }, jueveYViernes: { ingreso: '11:00', salida: '18:00', trabaja: true }, sabado: SAB_10_14, domingo: NO },
  { nombre: 'Eugenia Zapatta',            lunesAMiercoles: { ingreso: '11:30', salida: '18:00', trabaja: true }, jueveYViernes: { ingreso: '11:00', salida: '18:00', trabaja: true }, sabado: SAB_10_14, domingo: NO },
  { nombre: 'Abigail Acosta',             lunesAMiercoles: { ingreso: '11:30', salida: '18:00', trabaja: true }, jueveYViernes: { ingreso: '11:00', salida: '18:00', trabaja: true }, sabado: SAB_10_14, domingo: NO },
  { nombre: 'Alejandra Ferreira',         lunesAMiercoles: { ingreso: '11:30', salida: '18:00', trabaja: true }, jueveYViernes: { ingreso: '11:00', salida: '18:00', trabaja: true }, sabado: SAB_10_14, domingo: NO },
  { nombre: 'Fiorella Romero',            lunesAMiercoles: { ingreso: '11:30', salida: '18:00', trabaja: true }, jueveYViernes: { ingreso: '11:00', salida: '18:00', trabaja: true }, sabado: SAB_10_14, domingo: NO },
  { nombre: 'Noel Alfonso',               lunesAMiercoles: { ingreso: '11:30', salida: '18:00', trabaja: true }, jueveYViernes: { ingreso: '11:00', salida: '18:00', trabaja: true }, sabado: SAB_10_14, domingo: NO },
  { nombre: 'Giuliana Candelaresi',       lunesAMiercoles: { ingreso: '11:30', salida: '18:00', trabaja: true }, jueveYViernes: { ingreso: '11:30', salida: '18:00', trabaja: true }, sabado: SAB_10_14, domingo: NO },
  { nombre: 'Kiara Torrez',               lunesAMiercoles: { ingreso: '11:30', salida: '18:00', trabaja: true }, jueveYViernes: { ingreso: '11:30', salida: '18:00', trabaja: true }, sabado: SAB_10_14, domingo: NO },
  { nombre: 'Chiara Di Paublo',           lunesAMiercoles: { ingreso: '11:30', salida: '18:00', trabaja: true }, jueveYViernes: { ingreso: '11:30', salida: '18:00', trabaja: true }, sabado: SAB_10_14, domingo: NO },
  { nombre: 'RocíoBejeres',               lunesAMiercoles: { ingreso: '11:30', salida: '18:00', trabaja: true }, jueveYViernes: { ingreso: '11:30', salida: '18:00', trabaja: true }, sabado: SAB_10_14, domingo: NO },
  { nombre: 'Lucía Aquino',               lunesAMiercoles: { ingreso: '11:30', salida: '18:00', trabaja: true }, jueveYViernes: { ingreso: '11:30', salida: '18:00', trabaja: true }, sabado: SAB_10_14, domingo: NO },
  { nombre: 'Luciana Mirandetti Gras',    lunesAMiercoles: { ingreso: '11:30', salida: '18:00', trabaja: true }, jueveYViernes: { ingreso: '11:30', salida: '18:00', trabaja: true }, sabado: SAB_10_14, domingo: NO },

  // ── TURNO 09:00–18:00 + Sáb 10:00–14:00 (grupo grande) ─────────────────────
  { nombre: 'Alexandra Diaz',     lunesAMiercoles: { ingreso: '09:00', salida: '18:00', trabaja: true }, jueveYViernes: { ingreso: '09:00', salida: '18:00', trabaja: true }, sabado: SAB_10_14, domingo: NO },
  { nombre: 'Milena Milán',       lunesAMiercoles: { ingreso: '09:00', salida: '18:00', trabaja: true }, jueveYViernes: { ingreso: '09:00', salida: '18:00', trabaja: true }, sabado: SAB_10_14, domingo: NO },
  { nombre: 'Alison Pérez',       lunesAMiercoles: { ingreso: '09:00', salida: '18:00', trabaja: true }, jueveYViernes: { ingreso: '09:00', salida: '18:00', trabaja: true }, sabado: SAB_10_14, domingo: NO },
  { nombre: 'Cristian Hernandez', lunesAMiercoles: { ingreso: '09:00', salida: '18:00', trabaja: true }, jueveYViernes: { ingreso: '09:00', salida: '18:00', trabaja: true }, sabado: SAB_10_14, domingo: NO },
  { nombre: 'Lilisbet Vazquez',   lunesAMiercoles: { ingreso: '09:00', salida: '18:00', trabaja: true }, jueveYViernes: { ingreso: '09:00', salida: '18:00', trabaja: true }, sabado: SAB_10_14, domingo: NO },
  { nombre: 'Mateo Meliton',      lunesAMiercoles: { ingreso: '09:00', salida: '18:00', trabaja: true }, jueveYViernes: { ingreso: '09:00', salida: '18:00', trabaja: true }, sabado: SAB_10_14, domingo: NO },
  { nombre: 'Heidy Perez',        lunesAMiercoles: { ingreso: '09:00', salida: '18:00', trabaja: true }, jueveYViernes: { ingreso: '09:00', salida: '18:00', trabaja: true }, sabado: SAB_10_14, domingo: NO },
  { nombre: 'Valentina Montaña',  lunesAMiercoles: { ingreso: '09:00', salida: '18:00', trabaja: true }, jueveYViernes: { ingreso: '09:00', salida: '18:00', trabaja: true }, sabado: SAB_10_14, domingo: NO },
  { nombre: 'Camila Rossi',       lunesAMiercoles: { ingreso: '09:00', salida: '18:00', trabaja: true }, jueveYViernes: { ingreso: '09:00', salida: '18:00', trabaja: true }, sabado: SAB_10_14, domingo: NO },
  { nombre: 'Florencia Aldacor',  lunesAMiercoles: { ingreso: '09:00', salida: '18:00', trabaja: true }, jueveYViernes: { ingreso: '09:00', salida: '18:00', trabaja: true }, sabado: SAB_10_14, domingo: NO },
  { nombre: 'José Flores',        lunesAMiercoles: { ingreso: '09:00', salida: '18:00', trabaja: true }, jueveYViernes: { ingreso: '09:00', salida: '18:00', trabaja: true }, sabado: SAB_10_14, domingo: NO },
  { nombre: 'Mikaela Rodríguez',  lunesAMiercoles: { ingreso: '09:00', salida: '18:00', trabaja: true }, jueveYViernes: { ingreso: '09:00', salida: '18:00', trabaja: true }, sabado: SAB_10_14, domingo: NO },
  { nombre: 'katherine tabeira',  lunesAMiercoles: { ingreso: '09:00', salida: '18:00', trabaja: true }, jueveYViernes: { ingreso: '09:00', salida: '18:00', trabaja: true }, sabado: SAB_10_14, domingo: NO },
  { nombre: 'Lautaro Lopez',      lunesAMiercoles: { ingreso: '09:00', salida: '18:00', trabaja: true }, jueveYViernes: { ingreso: '09:00', salida: '18:00', trabaja: true }, sabado: SAB_10_14, domingo: NO },
  { nombre: 'Francisco Robles',   lunesAMiercoles: { ingreso: '09:00', salida: '18:00', trabaja: true }, jueveYViernes: { ingreso: '09:00', salida: '18:00', trabaja: true }, sabado: SAB_10_14, domingo: NO },
  { nombre: 'Joselin barrios',    lunesAMiercoles: { ingreso: '09:00', salida: '18:00', trabaja: true }, jueveYViernes: { ingreso: '09:00', salida: '18:00', trabaja: true }, sabado: SAB_10_14, domingo: NO },
  { nombre: 'Leandro Nauar',      lunesAMiercoles: { ingreso: '09:00', salida: '18:00', trabaja: true }, jueveYViernes: { ingreso: '09:00', salida: '18:00', trabaja: true }, sabado: SAB_10_14, domingo: NO },
];
