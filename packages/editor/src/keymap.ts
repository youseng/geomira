/**
 * Keyboard shortcuts as DATA (SPEC §15: "shortcuts and help generated from data", E10): one
 * entry per GUI tool, taken from the tool table (tools.ts: its key, label and help), and
 * the editing and view commands. The web app maps a key event to an action with keyAction
 * and generates its help panel from helpSections; nothing else lists shortcuts.
 */
import type { ToolId } from './tool-state';
import { TOOLS } from './tools';

export type KeyAction =
  | { readonly kind: 'tool'; readonly tool: ToolId }
  | { readonly kind: 'undo' }
  | { readonly kind: 'redo' }
  | { readonly kind: 'cancel' }
  | { readonly kind: 'finish' }
  | { readonly kind: 'delete' }
  | { readonly kind: 'command' }
  | { readonly kind: 'help' }
  | { readonly kind: 'fit' }
  /** The next (1) or previous (−1) view of the document (views.ts cycleView). */
  | { readonly kind: 'view'; readonly step: 1 | -1 };

export interface KeyBinding {
  /** KeyboardEvent.key (letters lowercase unless shift is part of the binding). */
  readonly key: string;
  /** Other key values for the same binding (Backspace: the delete key of a Mac). */
  readonly also?: readonly string[];
  readonly ctrl?: boolean;
  readonly shift?: boolean;
  readonly action: KeyAction;
  readonly help: string;
  readonly section: 'Tools' | 'Editing' | 'View';
}

export interface KeyEventLike {
  readonly key: string;
  /** Ctrl or Cmd. */
  readonly ctrl: boolean;
  readonly shift: boolean;
  readonly alt: boolean;
}

const COMMANDS: readonly KeyBinding[] = [
  { key: 'z', ctrl: true, action: { kind: 'undo' }, help: 'Undo', section: 'Editing' },
  { key: 'Z', ctrl: true, shift: true, action: { kind: 'redo' }, help: 'Redo', section: 'Editing' },
  { key: 'y', ctrl: true, action: { kind: 'redo' }, help: 'Redo', section: 'Editing' },
  {
    key: 'Escape',
    action: { kind: 'cancel' },
    help: 'Cancel the tool’s picks (or a drag)',
    section: 'Editing',
  },
  {
    key: 'Enter',
    action: { kind: 'finish' },
    help: 'Finish a polygon or a claim with several picks',
    section: 'Editing',
  },
  {
    key: 'Delete',
    also: ['Backspace'],
    action: { kind: 'delete' },
    help: 'Remove the selected objects (and what is built from them)',
    section: 'Editing',
  },
  { key: '/', action: { kind: 'command' }, help: 'Go to the command bar', section: 'Editing' },
  { key: '?', action: { kind: 'help' }, help: 'Show or hide this help', section: 'View' },
  { key: '0', action: { kind: 'fit' }, help: 'Fit the figure to the canvas', section: 'View' },
  {
    key: ']',
    action: { kind: 'view', step: 1 },
    help: 'Switch to the next saved view (Layers panel)',
    section: 'View',
  },
  {
    key: '[',
    action: { kind: 'view', step: -1 },
    help: 'Switch to the previous saved view',
    section: 'View',
  },
];

export const KEYMAP: readonly KeyBinding[] = Object.freeze([
  ...TOOLS.map((t): KeyBinding => ({
    key: t.key,
    action: { kind: 'tool', tool: t.id },
    help: `${t.label}: ${t.help}`,
    section: 'Tools',
  })),
  ...COMMANDS,
]);

function matches(k: KeyBinding, e: KeyEventLike): boolean {
  if ((k.ctrl === true) !== e.ctrl) return false;
  // Without Ctrl the key value already says whether Shift was down ("c", "C", "?").
  if (k.ctrl !== true) return k.key === e.key || (k.also ?? []).includes(e.key);
  return k.key.toLowerCase() === e.key.toLowerCase() && (k.shift === true) === e.shift;
}

/** The action of a key event, or undefined. Alt combinations are left to the browser. */
export function keyAction(e: KeyEventLike): KeyAction | undefined {
  if (e.alt) return undefined;
  return KEYMAP.find((k) => matches(k, e))?.action;
}

/** How a binding is written in the help ("Ctrl+Shift+Z", "c", "Delete or Backspace"). */
export function keyText(b: KeyBinding): string {
  const keys = [b.key, ...(b.also ?? [])].join(' or ');
  return `${b.ctrl === true ? 'Ctrl+' : ''}${b.shift === true ? 'Shift+' : ''}${keys}`;
}

export interface HelpSection {
  readonly title: KeyBinding['section'];
  readonly rows: readonly { readonly keys: string; readonly help: string }[];
}

/** The help panel's content, generated from KEYMAP. */
export function helpSections(): HelpSection[] {
  const titles: KeyBinding['section'][] = ['Tools', 'Editing', 'View'];
  return titles.map((title) => ({
    title,
    rows: KEYMAP.filter((k) => k.section === title).map((k) => ({
      keys: keyText(k),
      help: k.help,
    })),
  }));
}
