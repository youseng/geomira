/**
 * The visible objects that are undefined in the figure (the scene's `unavailable`), one export
 * warning each (shown by the dialog, written as `Warning` comments in TikZ and Asymptote). An
 * undefined object has no position: an export never invents one, and never drops it silently.
 */
import type { Scene } from '@geomira/scene/types';
import type { ExportWarning } from './paint';

export function undefinedWarnings(scene: Scene): ExportWarning[] {
  return scene.unavailable.map((u) => ({ kind: 'undefined', object: u.name, reason: u.reason }));
}
