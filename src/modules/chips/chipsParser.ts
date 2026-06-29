export type ChipRow = {
  mid: string;
  empresa: string;
  chip: string;
  fechaActivacion: string;
  fechaImportacion: string;
  estadoActivacion: string;
  lote: string;
  subLote: string;
  idDistribuidor: string | null;
  nombreDistribuidor: string | null;
  fechaAsignacionDistribuidor: string | null;
  idPuntoVenta: string | null;
  puntoVenta: string | null;
  fechaAsignacionPuntoVenta: string | null;
  fechaLiquidacion: string | null;
};

export type ChipsData = {
  totalOK: number;
  rows: ChipRow[];
  empresas: string[];
  distribuidores: string[];
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

function cleanMid(s: string): string {
  return s.replace(/"/g, '').trim();
}

function cleanChip(s: string): string {
  return s.replace(/^="/, '').replace(/"$/, '').trim();
}

function nullable(s: string): string | null {
  const t = fixEncoding(s.trim());
  return t === '' ? null : t;
}

function nullableDate(s: string): string | null {
  const d = parseDate(s);
  return d === '' ? null : d;
}

export async function parseChips(file: File): Promise<ChipsData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const raw = e.target!.result as string;
        const lines = raw.split(/\r?\n/);
        if (lines.length < 2) throw new Error('Archivo sin datos');

        const rows: ChipRow[] = [];
        const empresaSet = new Set<string>();
        const distribSet = new Set<string>();

        for (let i = 1; i < lines.length; i++) {
          const line = lines[i];
          if (!line.trim()) continue;
          const parts = line.split(';');
          if (parts.length < 10) continue;

          const estadoActivacion = fixEncoding((parts[5] ?? '').trim());
          if (estadoActivacion !== 'OK') continue;

          const empresa = fixEncoding((parts[1] ?? '').trim());
          const idDistribuidor = nullable(parts[9] ?? '');
          const nombreDistribuidor = nullable(fixEncoding(parts[10] ?? ''));
          const idPuntoVenta = nullable(parts[12] ?? '');
          const puntoVenta = nullable(fixEncoding(parts[13] ?? ''));

          if (empresa) empresaSet.add(empresa);
          if (nombreDistribuidor) distribSet.add(nombreDistribuidor);

          rows.push({
            mid: cleanMid(parts[0] ?? ''),
            empresa,
            chip: cleanChip(parts[2] ?? ''),
            fechaActivacion: parseDate(parts[3] ?? ''),
            fechaImportacion: parseDate(parts[4] ?? ''),
            estadoActivacion,
            lote: fixEncoding((parts[7] ?? '').trim()),
            subLote: fixEncoding((parts[8] ?? '').trim()),
            idDistribuidor,
            nombreDistribuidor,
            fechaAsignacionDistribuidor: nullableDate(parts[11] ?? ''),
            idPuntoVenta,
            puntoVenta,
            fechaAsignacionPuntoVenta: nullableDate(parts[14] ?? ''),
            fechaLiquidacion: nullable(parseDate(parts[15] ?? '')),
          });
        }

        resolve({
          totalOK: rows.length,
          rows,
          empresas: Array.from(empresaSet).sort(),
          distribuidores: Array.from(distribSet).sort(),
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
