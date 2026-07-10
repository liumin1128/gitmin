/**
 * 展示格式化纯函数：时间、hash 等
 */

/** 短 hash：取前 7 位 */
export function shortHash(hash: string): string {
  return hash.slice(0, 7);
}

/**
 * 相对时间：如 "3 minutes ago" / "2 days ago"
 * 无国际化，MVP 阶段简单实现
 */
export function relativeTime(iso: string, now: Date = new Date()): string {
  const then = new Date(iso).getTime();
  const diffSec = Math.floor((now.getTime() - then) / 1000);
  if (Number.isNaN(diffSec)) return iso;

  if (diffSec < 60) return `${diffSec}s ago`;
  const min = Math.floor(diffSec / 60);
  if (min < 60) return `${min}m ago`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour}h ago`;
  const day = Math.floor(hour / 24);
  if (day < 30) return `${day}d ago`;
  const month = Math.floor(day / 30);
  if (month < 12) return `${month}mo ago`;
  const year = Math.floor(day / 365);
  return `${year}y ago`;
}

/** commit message 只取第一行 */
export function firstLine(msg: string): string {
  const idx = msg.indexOf('\n');
  return idx >= 0 ? msg.slice(0, idx) : msg;
}
