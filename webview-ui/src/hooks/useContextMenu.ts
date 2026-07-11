/**
 * Right-click context menu state management
 * - open(x, y) opens
 * - close() closes
 * - Auto-close on outside click / ESC
 */
import { useCallback, useEffect, useState } from 'react';

export interface MenuPos {
  x: number;
  y: number;
}

export interface ContextMenuAPI {
  pos: MenuPos | null;
  open: (x: number, y: number) => void;
  close: () => void;
}

export function useContextMenu(): ContextMenuAPI {
  const [pos, setPos] = useState<MenuPos | null>(null);

  const open = useCallback((x: number, y: number) => setPos({ x, y }), []);
  const close = useCallback(() => setPos(null), []);

  useEffect(() => {
    if (!pos) return;
    const onDocClick = () => close();
    const onEsc = (e: KeyboardEvent) => e.key === 'Escape' && close();
    const onContextMenu = (e: MouseEvent) => {
      // Other right-clicks → close current menu so a new one can open
      close();
    };
    // setTimeout avoids the menu being closed by the same click that opened it
    const t = setTimeout(() => {
      window.addEventListener('click', onDocClick);
      window.addEventListener('contextmenu', onContextMenu);
      window.addEventListener('keydown', onEsc);
    }, 0);
    return () => {
      clearTimeout(t);
      window.removeEventListener('click', onDocClick);
      window.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('keydown', onEsc);
    };
  }, [pos, close]);

  return { pos, open, close };
}
