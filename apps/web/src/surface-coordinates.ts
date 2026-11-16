/** CSS layout may have fractional bounds while the display uses whole logical pixels.
 * Pointer coordinates, overlays and the raster must all cross the same boundary (ADR-0074).
 */
import type { Size } from '@geomira/scene/viewport';
import type { Vec2 } from '@geomira/scene/viewport';

export interface SurfaceRect extends Size {
  readonly left: number;
  readonly top: number;
}

/** Convert a delivered browser point to the display's logical coordinate system. */
export function logicalPoint(client: Vec2, box: SurfaceRect, logical: Size): Vec2 | null {
  if (!(box.width > 0 && box.height > 0)) return null;
  return {
    x: ((client.x - box.left) * logical.width) / box.width,
    y: ((client.y - box.top) * logical.height) / box.height,
  };
}

/** The inverse projection for floating anchors. Logical dimensions are positive (useSurface). */
export function clientPoint(point: Vec2, box: SurfaceRect, logical: Size): Vec2 {
  return {
    x: box.left + (point.x * box.width) / logical.width,
    y: box.top + (point.y * box.height) / logical.height,
  };
}
