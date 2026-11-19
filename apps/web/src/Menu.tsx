import { useEffect, useRef, useState, type ReactNode } from 'react';
import { HeaderIcon, type HeaderIconName } from './HeaderIcon';

export interface MenuProps {
  /** The button's accessible name, shown beside the glyph where the bar has room. */
  readonly label: string;
  readonly glyph: HeaderIconName;
  readonly title: string;
  /** Display only the icon while keeping the label accessible. */
  readonly iconOnly?: boolean;
  /** Entries close the disclosure before invoking their action. */
  readonly children: (close: () => void) => ReactNode;
}

/**
 * A toolbar disclosure has a button
 * with aria-expanded and a popover of ordinary buttons and checkboxes, so every entry keeps
 * its role and accessible name. Escape, a click outside or an entry's action closes it.
 */
export function Menu({ label, glyph, title, iconOnly = false, children }: MenuProps) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return undefined;
    const outside = (e: PointerEvent) => {
      if (!(e.target instanceof Node) || box.current?.contains(e.target) !== true) setOpen(false);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        trigger.current?.focus({ preventScroll: true });
      }
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
    // Menu items disappear. Make the disclosure the invoker before an action opens a modal.
    trigger.current?.focus({ preventScroll: true });
  };
  return (
    <div
      className={`menu-wrap menu-${glyph}`}
      ref={box}
      onBlur={(e) => {
        if (e.relatedTarget && !e.currentTarget.contains(e.relatedTarget)) setOpen(false);
      }}
    >
      <button
        ref={trigger}
        type="button"
        className={iconOnly ? 'tb icon' : 'tb'}
        title={title}
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => {
          setOpen((o) => !o);
        }}
      >
        <HeaderIcon name={glyph} />
        <span className={iconOnly ? 'sr-only' : 'hide-narrow'}>{label}</span>
        {!iconOnly && <HeaderIcon name="down" />}
      </button>
      {open && (
        <div className="menu" role="group" aria-label={`${label} menu`}>
          {children(close)}
        </div>
      )}
    </div>
  );
}

/** Restore focus to the disclosure before invoking the selected action. */
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
        p.close();
        p.onClick();
      }}
    >
      {p.children}
      {p.kbd !== undefined && <span className="kbd">{p.kbd}</span>}
    </button>
  );
}
