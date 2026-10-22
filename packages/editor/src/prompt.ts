/**
 * The status line's text (SPEC §15, Geomdraw's hint line): what the active tool waits for,
 * from the tool's data. An order-free tool (ADR-0024) names every step still open, joined
 * by "and", with "in either order" while more than one is.
 */
import type { EditorState } from './state';
import { openSteps } from './tool-steps';
import { toolUI } from './tools';

export function toolPrompt(state: EditorState): string {
  const tool = toolUI(state.tool);
  if (tool === undefined) return '';
  const ts = state.toolState;
  if (tool.build.kind === 'text' && ts.picks.length > 0) return `${tool.label}: type the text`;
  const open = openSteps(tool, ts);
  const [first] = open;
  if (first === undefined) return `${tool.label}: ${tool.help}`;
  if (open.length === 1) return `${tool.label}: ${first.step.prompt}`;
  const steps = open.map((o) => o.step.prompt).join(' and ');
  return `${tool.label}: ${steps}, in either order`;
}
