/**
 * The shape of a GUI tool's data (tools.ts holds the table, tools-centers.ts the triangle
 * centers and circles, tools-more.ts the tools after Geomdraw's palette) and the helpers that
 * write table entries.
 */
import type { ToolId } from './tool-state';
import type { NamePreference } from './conventional-names';
import type { NameKind } from './names';

export type PickKind =
  | 'point'
  | 'line'
  | 'circle'
  /** A circle or a conic (ADR-0042: the Tangent tool). */
  | 'oval'
  | 'curve'
  | 'figure'
  | 'mirror'
  | 'transform';

export interface ToolStep {
  readonly pick: PickKind;
  readonly prompt: string;
}

/** What a tool builds when its picks are complete. */
export type Build =
  /** Nothing more: picking (or creating) the point is the tool's whole work. */
  | { readonly kind: 'none' }
  /** name = tool(picks…[, value]) (the value when the tool asks for one, ToolUI.value) */
  | {
      readonly kind: 'call';
      readonly tool: string;
      readonly name: NameKind;
      /** The conventional name, used when free (conventional-names.ts). */
      readonly prefer?: NamePreference;
    }
  /** intersect(a, b, …): every intersection not yet a point, each with the GUI selector choice. */
  | { readonly kind: 'intersection' }
  /** tangent(P, c) when P is on c, else BOTH tangent_from(P, c, …), each with the GUI choice. */
  | { readonly kind: 'tangent' }
  /** text(P, "…"): the string comes as a `text` input after the anchor. */
  | { readonly kind: 'text' }
  /** claim <kind>(picks…) (the claim tool's kind is in the tool state). */
  | { readonly kind: 'claim' }
  /** A derived layer of the active layer under the picked transform. */
  | { readonly kind: 'derivedLayer' };

/** A number a tool asks for: typed in the tool's field, an exact literal (2, -1/2, 0.5). */
export interface ToolValue {
  /** What the number is, shown beside its field ("Angle (degrees)"). */
  readonly label: string;
  /** The field's text when the tool is chosen. */
  readonly initial: string;
}

export interface ToolUI {
  readonly id: ToolId;
  readonly label: string;
  /** Keyboard shortcut (one key; a capital letter is Shift and the letter). */
  readonly key: string;
  readonly help: string;
  readonly steps: readonly ToolStep[];
  /** Further picks of one kind, ended by a `finish` input (or, for points, the first pick again). */
  readonly rest?: ToolStep;
  /**
   * The picks may come in any order (Geomdraw's order-free tools, ADR-0024): a click fills the
   * first open step that takes what it hits, so the line of a perpendicular can be picked
   * before its point. Only for steps of different kinds, so the order of the call is clear.
   */
  readonly anyOrder?: boolean;
  /** A pick may name an object picked before (the ratio AB / AC picks A twice). */
  readonly repeats?: boolean;
  /** The number the tool asks for, written as the call's last argument. */
  readonly value?: ToolValue;
  /**
   * An image tool whose first step is the object to map (reflect(X, l), rotate(X, O, θ), …):
   * with ToolState.mapOnly it leaves that step out and builds the map alone (reflect(l)).
   */
  readonly map?: true;
  readonly build: Build;
}

export const P = (prompt: string): ToolStep => ({ pick: 'point', prompt });
export const L = (prompt: string): ToolStep => ({ pick: 'line', prompt });
export const C = (prompt: string): ToolStep => ({ pick: 'circle', prompt });
export const OVAL = (prompt: string): ToolStep => ({ pick: 'oval', prompt });

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

/** `call` whose picks may come in any order (ADR-0024). */
export function anyOrder(t: ToolUI): ToolUI {
  return { ...t, anyOrder: true };
}

/** A map tool (ToolUI.map): its first step is the object to map. */
export function mapTool(t: ToolUI): ToolUI {
  return { ...t, map: true };
}

/** `call` with a number typed in the tool's field, written last (rotate(X, O, 60)). */
export function withValue(t: ToolUI, label: string, initial: string): ToolUI {
  return { ...t, value: { label, initial } };
}
