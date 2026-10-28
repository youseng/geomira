/**
 * The visible objects an export cannot draw, one export warning each (shown by the dialog,
 * written as `Warning` comments in TikZ and Asymptote): those undefined in the figure (the
 * scene's `unavailable`, ADR-0026), points at infinity (ADR-0040: listed with their direction,
 * never given coordinates) and those not drawable at the view's zoom (the display
 * list's `undrawable`, ADR-0023, ADR-0028). An export never invents a position for them, and
 * never drops them silently.
 */
import type { DisplayList } from '@geomira/scene/display';
import type { Scene } from '@geomira/scene/types';
import type { ExportWarning } from './paint';

export function undefinedWarnings(scene: Scene): ExportWarning[] {
  return scene.unavailable.map((u): ExportWarning =>
    u.atInfinity === true
      ? { kind: 'infinite', object: u.name, reason: u.reason }
      : { kind: 'undefined', object: u.name, reason: u.reason },
  );
}

/** The warnings of every object the frame's figure has but its drawing leaves out. */
export function missingWarnings(f: {
  readonly scene: Scene;
  readonly display: DisplayList;
}): ExportWarning[] {
  return [
    ...undefinedWarnings(f.scene),
    ...f.display.undrawable.map((u): ExportWarning => ({ kind: 'undrawable', object: u.name })),
  ];
}
