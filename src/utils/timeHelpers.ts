export function parseTimeValue(val: unknown): string {
  if (!val && val !== 0) return '';

  if (typeof val === 'string') {
    const m = val.match(/(\d{1,2})[:\.\-](\d{2})/);
    if (m) return `${m[1].padStart(2, '0')}:${m[2]}`;
    return val;
  }

  if (typeof val === 'number') {
    // Excel stores times as decimal fractions of a day
    const totalMins = Math.round(val * 24 * 60);
    const h = Math.floor(totalMins / 60) % 24;
    const m = totalMins % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  if (val instanceof Date) {
    return `${String(val.getHours()).padStart(2, '0')}:${String(val.getMinutes()).padStart(2, '0')}`;
  }

  return String(val);
}

export function minutesToHHMM(minutes: number): string {
  const h = Math.floor(Math.abs(minutes) / 60);
  const m = Math.abs(minutes) % 60;
  return `${h}h ${m}m`;
}
