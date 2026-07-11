/**
 * 展示格式化纯函数：时间、hash 等
 */

/** 短 hash：取前 7 位 */
export function shortHash(hash: string): string {
  return hash.slice(0, 7);
}

/**
 * 相对时间：如 "3m ago" / "2h ago"，超过阈值显示日期
 * @param iso   ISO 时间字符串
 * @param now   当前时间（便于测试）
 * @param maxDays 超过此天数直接显示日期，默认 7 天
 */
export function relativeTime(iso: string, now: Date = new Date(), maxDays = 7): string {
  const then = new Date(iso).getTime();
  const diffSec = Math.floor((now.getTime() - then) / 1000);
  if (Number.isNaN(diffSec)) return iso;

  const day = Math.floor(diffSec / 86400);

  if (day >= maxDays) {
    const d = new Date(iso);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dt = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dt}`;
  }

  if (diffSec < 60) return `${diffSec}s ago`;
  const min = Math.floor(diffSec / 60);
  if (min < 60) return `${min}m ago`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour}h ago`;
  return `${day}d ago`;
}

/** commit message 只取第一行 */
export function firstLine(msg: string): string {
  const idx = msg.indexOf('\n');
  return idx >= 0 ? msg.slice(0, idx) : msg;
}
