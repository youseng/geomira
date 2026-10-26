/**
 * Icons of Run 14's GUI tools (ADR-0032 decision 16, ADR-0034) and of the symmedian point
 * (ADR-0033), in the style of icons.tsx (24 × 24, strokes in currentColor, the accent dot in
 * the accent colour); icons.tsx spreads them into its Record, so the compiler still requires
 * one per tool. Decorative.
 */
import type { ReactNode } from 'react';
import type { ToolId } from '@geomira/editor/tool-state';

export const INVERSION_ICONS: Readonly<
  Record<
    Extract<
      ToolId,
      | 'inversion'
      | 'sqrt_bc'
      | 'sqrt_bc2'
      | 'feet_inversion'
      | 'inversion_fixing'
      | 'symmedian_point'
    >,
    readonly ReactNode[]
  >
> = {
  // The symmedian point (ADR-0033): the triangle, two symmedians and their meeting point.
  symmedian_point: [
    <path key="0" d="M12 3 L3 20 L21 20 Z" />,
    <line key="1" x1="12" y1="3" x2="15" y2="20" />,
    <line key="2" x1="3" y1="20" x2="16.5" y2="11.5" />,
    <circle key="3" cx="13.6" cy="12.6" r="2.4" className="icon-accent" stroke="none" />,
  ],
  inversion: [
    <circle key="0" cx="12" cy="12" r="7.5" strokeDasharray="2.5 2" />,
    <circle key="1" cx="12" cy="12" r="1.9" fill="currentColor" stroke="none" />,
    <line key="2" x1="12" y1="12" x2="21" y2="6" />,
    <circle key="3" cx="15.8" cy="9.5" r="1.6" fill="currentColor" stroke="none" />,
    <circle key="4" cx="20.2" cy="6.5" r="2.4" className="icon-accent" stroke="none" />,
  ],
  sqrt_bc: [
    <path key="0" d="M4 20 L12 4 L20 20" />,
    <path key="1" d="M7.5 13 Q12 21 16.5 13" strokeDasharray="2.5 2" />,
    <circle key="2" cx="12" cy="4" r="1.9" fill="currentColor" stroke="none" />,
    <circle key="3" cx="7.5" cy="13" r="2.4" className="icon-accent" stroke="none" />,
    <circle key="4" cx="16.5" cy="13" r="2.4" className="icon-accent" stroke="none" />,
  ],
  // ADR-0034: the √(bc/2) map sends B and C to the midpoints of the sides at A.
  sqrt_bc2: [
    <path key="0" d="M4 20 L12 4 L20 20" />,
    <path key="1" d="M8 12 Q12 17 16 12" strokeDasharray="2.5 2" />,
    <circle key="2" cx="12" cy="4" r="1.9" fill="currentColor" stroke="none" />,
    <circle key="3" cx="8" cy="12" r="2.4" className="icon-accent" stroke="none" />,
    <circle key="4" cx="16" cy="12" r="2.4" className="icon-accent" stroke="none" />,
  ],
  // ADR-0034: the feet inversion sends B and C to the feet of the altitudes from C and B.
  feet_inversion: [
    <path key="0" d="M12 4 L4 20 L20 20 Z" />,
    <path key="1" d="M4 20 L16.8 13.6 M20 20 L7.2 13.6" strokeDasharray="2 1.6" />,
    <circle key="2" cx="12" cy="4" r="1.9" fill="currentColor" stroke="none" />,
    <circle key="3" cx="16.8" cy="13.6" r="2.2" className="icon-accent" stroke="none" />,
    <circle key="4" cx="7.2" cy="13.6" r="2.2" className="icon-accent" stroke="none" />,
  ],
  inversion_fixing: [
    <circle key="0" cx="10" cy="13" r="7" />,
    <circle key="1" cx="20" cy="5" r="1.9" fill="currentColor" stroke="none" />,
    <path key="2" d="M20 5 L15 8.5" strokeDasharray="2 1.6" />,
    <circle key="3" cx="15" cy="8.5" r="2.4" className="icon-accent" stroke="none" />,
  ],
};
