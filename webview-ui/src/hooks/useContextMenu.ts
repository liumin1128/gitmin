/**
 * 右键菜单状态管理
 * - open(x, y) 打开
 * - close() 关闭
 * - 点击外部/按 ESC 自动关闭
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
      // 其他地方右键 → 关闭当前菜单，让新菜单可以打开
      close();
    };
    // 用 setTimeout 避免刚打开时被同一次点击关闭
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
