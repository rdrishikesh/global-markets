export function fmtNum(v: number | null | undefined, decimals?: number): string {
  if (v === null || v === undefined || Number.isNaN(v)) return 'n/a';
  const d = decimals ?? (Math.abs(v) >= 10 ? 2 : 3);
  return v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}

export function fmtPct(v: number | null | undefined, decimals = 2): string {
  if (v === null || v === undefined || Number.isNaN(v)) return 'n/a';
  return `${v > 0 ? '+' : ''}${v.toFixed(decimals)}%`;
}

export function pctClass(v: number | null | undefined): string {
  if (v === null || v === undefined || Math.abs(v) < 0.005) return 'text-neutral-500 dark:text-neutral-400';
  return v > 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400';
}

export function sparkPath(values: number[], width = 90, height = 26): { d: string; up: boolean } {
  if (values.length < 2) return { d: '', up: true };
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pts = values.map((v, i) => `${((i / (values.length - 1)) * width).toFixed(1)},${(height - 2 - ((v - min) / range) * (height - 4)).toFixed(1)}`);
  return { d: `M ${pts.join(' L ')}`, up: values[values.length - 1] >= values[0] };
}

export function ageText(iso: string, now = Date.now()): string {
  const mins = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins} min ago`;
  const h = Math.round(mins / 60);
  return h < 48 ? `${h} h ago` : `${Math.round(h / 24)} days ago`;
}

export const fmtWhen = (iso: string) =>
  new Date(iso).toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
