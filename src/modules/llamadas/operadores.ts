// ─── Mapeo usuario (código Vicidial/CSV) → nombre real del operador ───────────
// Se aplica automáticamente al parsear: donde el archivo trae "fibraph37",
// el reporte muestra "Abril Luna Seoane Castellaro". Códigos no listados
// aquí se muestran tal cual vienen en el archivo.

export const OPERADOR_NOMBRES: Record<string, string> = {
  fibraph37: 'Abril Luna Seoane Castellaro',
  fibraph30: 'SOFIA VILLARROYA FERREIRA',
  fibraph3:  'Ailén Romina Maya Piriz',
  fibraph19: 'Stephenie Mikaela Marquez Menda',
  fibraph25: 'Avril Abreu',
  fibraph29: 'Nataly Noelia Soria Pirez',
  fibraph10: 'Valentina Homar Paredes',
  fibraph22: 'Mara Alejandra Fernández Vale',
  fibraph15: 'Florencia Torres Castro',
  fibraph31: 'Itan Román Maneiro Teperino',
  fibraph13: 'Facundo Waldemar Santos Santos',
  fibraph7:  'Maria Victoria Da Silva',
  fibraph14: 'Paulina Chaparro Rodriguez',
  fibraph20: 'Ana Belen Costa Chirulo',
  fibraph27: 'Felipe Fabian Delgado Fernandez',
  fibraph33: 'Ivana Garcia',
  fibraph34: 'Agustina Carreño',
  fibraph42: 'Franklin José Ramírez Alaniz',
  fibraph8:  'Nicaela Ximena Menéndez Centu',
  fibraph16: 'Agustina Rey Rodriguez',
  fibraph11: 'Victoria Barrios Zabala',
  fibraph18: 'Nadia Belen Frodella Vallcorba',
  fibraph24: 'Santiago Laundre',
  fibraph51: 'Imanol Alejandro Gonzalez Pérez',
  fibraph12: 'Camila Santos Anchen',
  fibraph23: 'Veronica Antonella Santos Alvarez',
};

export function resolveOperador(codigo: string): string {
  const nombre = OPERADOR_NOMBRES[codigo.trim().toLowerCase()];
  return nombre ?? codigo;
}
