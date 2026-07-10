/**
 * 通用 debounce hook：返回延迟 delay ms 后稳定下来的 value
 * value 高频变化时只在最后一次变更后 delay ms 更新
 */
import { useEffect, useState } from 'react';

export function useDebounce<T>(value: T, delay: number = 250): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
