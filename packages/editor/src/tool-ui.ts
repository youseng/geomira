/**
 * The shape of a GUI tool's data (tools.ts holds the table, tools-centers.ts the triangle
 * centers and circles) and the helpers that write table entries.
 */
import type { ToolId } from './tool-state';
import type { NamePreference } from './conventional-names';
import type { NameKind } from './names';

export type PickKind = 'point' | 'line' | 'circle' | 'curve' | 'figure' | 'mirror' | 'transform';

export interface ToolStep {
  readonly pick: PickKind;
  readonly prompt: string;
}

/** What a tool builds when its picks are complete. */
export type Build =
  /** Nothing more: picking (or creating) the point is the tool's whole work. */
  | { readonly kind: 'none' }
  /** name = tool(picks…) */
  | {
      readonly kind: 'call';
      readonly tool: string;
      readonly name: NameKind;
      /** The conventional name, used when free (conventional-names.ts). */
      readonly prefer?: NamePreference;
    }
  /** intersect(a, b, selectors): the clicked candidate, by the GUI selector choice. */
  | { readonly kind: 'intersection' }
  /** tangent(P, c) when P is on c, else tangent_from(P, c, selectors) by the GUI choice. */
  | { readonly kind: 'tangent' }
  /** text(P, "…"): the string comes as a `text` input after the anchor. */
  | { readonly kind: 'text' }
  /** claim <kind>(picks…) (the claim tool's kind is in the tool state). */
  | { readonly kind: 'claim' }
  /** A derived layer of the active layer under the picked transform. */
  | { readonly kind: 'derivedLayer' };

export interface ToolUI {
  readonly id: ToolId;
  readonly label: string;
  /** Keyboard shortcut (one key). */
  readonly key: string;
  readonly help: string;
  readonly steps: readonly ToolStep[];
  /** Further picks of one kind, ended by a `finish` input (or, for points, the first pick again). */
  readonly rest?: ToolStep;
  readonly build: Build;
}

export const P = (prompt: string): ToolStep => ({ pick: 'point', prompt });
export const L = (prompt: string): ToolStep => ({ pick: 'line', prompt });

/** A tool that builds `name = tool(picks…)`. */
export function call(
  id: ToolId,
  label: string,
  key: string,
  tool: string,
  name: NameKind,
  steps: readonly ToolStep[],
  help: string,
  prefer?: NamePreference,
): ToolUI {
  const build: Build =
    prefer === undefined ? { kind: 'call', tool, name } : { kind: 'call', tool, name, prefer };
  return { id, label, key, help, steps, build };
}
