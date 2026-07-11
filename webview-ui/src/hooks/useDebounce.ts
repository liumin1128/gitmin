/**
 * Generic debounce hook: returns value stabilized after delay ms
 * Rapid value changes only trigger update after the last change + delay ms
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
