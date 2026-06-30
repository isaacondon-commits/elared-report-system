export type PuntoVenta = {
  id: string;
  nombre: string;
  departamento: string;
  barrio: string;
  estado: string;
  eliminado: boolean;
  distribuidor: string;
  asignacionDistribuidor: string | null;
  visitadoPorDistribuidor: string | null;
  estadoUltimaVisita: string;
  fechaUltimoCambioVisita: string | null;
  fechaVencimientoChipMasViejo: string | null;
  creadoPor: string;
  creado: string;
};

export type PdvData = {
  total: number;
  rows: PuntoVenta[];
  distribuidores: string[];
  departamentos: string[];
  fechaCarga: string;
};

function fixEncoding(str: string): string {
  return str
    .replace(/Ã¡/g, 'á').replace(/Ã©/g, 'é').replace(/Ã­/g, 'í')
    .replace(/Ã³/g, 'ó').replace(/Ãº/g, 'ú').replace(/Ã±/g, 'ñ')
    .replace(/Ã\x81/g, 'Á').replace(/Ã\x89/g, 'É').replace(/Ã\x8d/g, 'Í')
    .replace(/Ã\x93/g, 'Ó').replace(/Ã\x9a/g, 'Ú').replace(/Ã\x91/g, 'Ñ')
    .replace(/Ã¼/g, 'ü').replace(/Ã\x9c/g, 'Ü');
}

function parseDate(s: string): string {
  if (!s || !s.trim()) return '';
  const parts = s.trim().split('/');
  if (parts.length === 3) {
    const [d, m, y] = parts;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return s.trim();
}

function nullableDate(s: string): string | null {
  const d = parseDate(s);
  return d === '' ? null : d;
}

function clean(s: string): string {
  return fixEncoding((s ?? '').trim());
}

export async function parsePdv(file: File): Promise<PdvData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const raw = e.target!.result as string;
        const lines = raw.split(/\r?\n/);
        if (lines.length < 2) throw new Error('Archivo sin datos');

        const rows: PuntoVenta[] = [];
        const distribSet = new Set<string>();
        const deptSet = new Set<string>();

        for (let i = 1; i < lines.length; i++) {
          const line = lines[i];
          if (!line.trim()) continue;
          const parts = line.split(';');
          if (parts.length < 9) continue;

          const distribuidor = clean(parts[6] ?? '');
          const departamento = clean(parts[2] ?? '');

          if (distribuidor) distribSet.add(distribuidor);
          if (departamento) deptSet.add(departamento);

          rows.push({
            id: clean(parts[0] ?? ''),
            nombre: clean(parts[1] ?? ''),
            departamento,
            barrio: clean(parts[3] ?? ''),
            estado: clean(parts[4] ?? ''),
            eliminado: /^(s[ií]|yes|1|true)$/i.test((parts[5] ?? '').trim()),
            distribuidor,
            asignacionDistribuidor: nullableDate(parts[7] ?? ''),
            visitadoPorDistribuidor: nullableDate(parts[8] ?? ''),
            estadoUltimaVisita: clean(parts[9] ?? ''),
            fechaUltimoCambioVisita: nullableDate(parts[10] ?? ''),
            fechaVencimientoChipMasViejo: nullableDate(parts[11] ?? ''),
            creadoPor: clean(parts[12] ?? ''),
            creado: parseDate(parts[13] ?? ''),
          });
        }

        resolve({
          total: rows.length,
          rows,
          distribuidores: Array.from(distribSet).sort(),
          departamentos: Array.from(deptSet).sort(),
          fechaCarga: new Date().toISOString(),
        });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Error al leer el archivo'));
    reader.readAsText(file, 'windows-1252');
  });
}
