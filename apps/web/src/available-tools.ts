/** The application's tool/help catalog. The internal editor retains all its tools. */
import { KEYMAP, keyText, type KeyAction, type HelpSection } from '@geomira/editor/keymap';
import { TOOL_GROUPS } from '@geomira/editor/tool-groups';
import type { ToolId } from '@geomira/editor/tool-state';
import type { Completion } from '@geomira/editor/command';
import { CLAIM_TESTING } from './features';

export function toolAvailable(id: ToolId): boolean {
  return CLAIM_TESTING || id !== 'claim';
}
export function actionAvailable(action: KeyAction): boolean {
  return action.kind !== 'tool' || toolAvailable(action.tool);
}
export const AVAILABLE_GROUPS = TOOL_GROUPS.map((g) => ({
  ...g,
  label: !CLAIM_TESTING && g.id === 'measure' ? 'Measure' : g.label,
  tools: g.tools.filter((t) => toolAvailable(t.id)),
})).filter((g) => g.tools.length > 0);

export function availableHelp(): HelpSection[] {
  const titles = ['Tools', 'Editing', 'View'] as const;
  return titles.map((title) => ({
    title,
    rows: KEYMAP.filter((k) => k.section === title && actionAvailable(k.action)).map((k) => ({
      keys: keyText(k),
      help: !CLAIM_TESTING && k.action.kind === 'finish' ? 'Finish a polygon' : k.help,
    })),
  }));
}
export function completionAvailable(c: Completion): boolean {
  return CLAIM_TESTING || !(c.kind === 'gui' && c.insert === 'claim');
}
