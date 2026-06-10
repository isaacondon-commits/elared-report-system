const STORAGE_KEY = 'elared_activity';

export interface ModuleActivity {
  date: string;
  fileName?: string;
}

export type ActivityMap = Record<string, ModuleActivity>;

export function recordActivity(moduleKey: string, fileName?: string): void {
  try {
    const current = getAllActivity();
    current[moduleKey] = { date: new Date().toISOString(), fileName };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {}
}

export function getAllActivity(): ActivityMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ActivityMap) : {};
  } catch {
    return {};
  }
}

export function formatActivityDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const mins = Math.floor(diffMs / 60_000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (mins < 2) return 'hace un momento';
  if (mins < 60) return `hace ${mins} min`;
  if (hours < 24) return `hace ${hours}h`;
  if (days === 1) return 'ayer';
  if (days < 7) return `hace ${days} días`;
  return date.toLocaleDateString('es-UY', { day: 'numeric', month: 'short' });
}
