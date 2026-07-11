/**
 * Display formatting pure functions: time, hash, etc.
 */

/** Short hash: take first 7 chars */
export function shortHash(hash: string): string {
  return hash.slice(0, 7);
}

/**
 * Relative time: e.g. "3m ago" / "2h ago", shows full date beyond threshold
 * @param iso      ISO time string
 * @param now      Current time (for testability)
 * @param maxDays  Show full date if older than this many days, default 7
 */
export function relativeTime(iso: string, now: Date = new Date(), maxDays = 7): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;

  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const M = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');

  const then = d.getTime();
  const diffSec = Math.floor((now.getTime() - then) / 1000);
  const day = Math.floor(diffSec / 86400);

  if (day >= maxDays) {
    return `${d.getFullYear()}-${M}-${dd} ${hh}:${mm}`;
  }

  if (diffSec < 60) return `${diffSec}s ago (${hh}:${mm})`;
  const min = Math.floor(diffSec / 60);
  if (min < 60) return `${min}m ago (${hh}:${mm})`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour}h ago (${hh}:${mm})`;
  return `${day}d ago (${hh}:${mm})`;
}

/** Commit message: take first line only */
export function firstLine(msg: string): string {
  const idx = msg.indexOf('\n');
  return idx >= 0 ? msg.slice(0, idx) : msg;
}

let _measureCtx: CanvasRenderingContext2D | null = null;
function getMeasureCtx(): CanvasRenderingContext2D {
  if (!_measureCtx) {
    _measureCtx = document.createElement('canvas').getContext('2d')!;
  }
  return _measureCtx;
}

export function measurePx(text: string, font: string): number {
  const ctx = getMeasureCtx();
  ctx.font = font;
  return ctx.measureText(text).width;
}

export function tagListText(refs: string[]): string {
  return refs.join(' ');
}
