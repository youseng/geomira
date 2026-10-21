import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Glyph } from './icons';

export interface MenuProps {
  /** The button's accessible name, shown beside the glyph where the bar has room. */
  readonly label: string;
  readonly glyph: string;
  readonly title: string;
  /** An icon-only button (Settings, Help): the label is never shown. */
  readonly iconOnly?: boolean;
  /** The menu's entries; `close` closes the menu (entries call it after acting). */
  readonly children: (close: () => void) => ReactNode;
}

/**
 * A top-bar menu as a disclosure (Geomdraw's View, Export, Settings and Help menus): a button
 * with aria-expanded and a popover of ordinary buttons and checkboxes, so every entry keeps
 * its role and accessible name. Escape, a click outside or an entry's action closes it.
 */
export function Menu({ label, glyph, title, iconOnly = false, children }: MenuProps) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return undefined;
    const outside = (e: PointerEvent) => {
      if (!(e.target instanceof Node) || box.current?.contains(e.target) !== true) setOpen(false);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    addEventListener('pointerdown', outside);
    addEventListener('keydown', escape);
    return () => {
      removeEventListener('pointerdown', outside);
      removeEventListener('keydown', escape);
    };
  }, [open]);
  const close = () => {
    setOpen(false);
  };
  return (
    <div className="menu-wrap" ref={box}>
      <button
        type="button"
        className={iconOnly ? 'tb icon' : 'tb'}
        title={title}
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => {
          setOpen((o) => !o);
        }}
      >
        <Glyph>{glyph}</Glyph>
        <span className={iconOnly ? 'sr-only' : 'hide-narrow'}>{label}</span>
        {!iconOnly && <Glyph>{'▾'}</Glyph>}
      </button>
      {open && (
        <div className="menu" role="group" aria-label={`${label} menu`}>
          {children(close)}
        </div>
      )}
    </div>
  );
}

/** A menu entry: a button that acts, then closes the menu. */
export function MenuItem(p: {
  readonly onClick: () => void;
  readonly close: () => void;
  readonly children: ReactNode;
  readonly disabled?: boolean;
  readonly title?: string;
  readonly kbd?: string;
}) {
  return (
    <button
      type="button"
      disabled={p.disabled}
      title={p.title}
      onClick={() => {
        p.onClick();
        p.close();
      }}
    >
      {p.children}
      {p.kbd !== undefined && <span className="kbd">{p.kbd}</span>}
    </button>
  );
}
