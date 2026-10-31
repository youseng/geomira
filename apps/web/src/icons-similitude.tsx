/**
 * Icons of the centres of similitude (ADR-0045), in the style of icons.tsx (24 × 24, strokes in
 * currentColor, the accent dot in the accent colour); icons.tsx spreads them into its Record, so
 * the compiler still requires one per tool. Two circles, two common tangents and the centre where
 * they meet: outside the circles (external tangents) or between them (internal). Decorative.
 */
import type { ReactNode } from 'react';
import type { ToolId } from '@geomira/editor/tool-state';

export const SIMILITUDE_ICONS: Readonly<
  Record<Extract<ToolId, 'exsimilicenter' | 'insimilicenter'>, readonly ReactNode[]>
> = {
  exsimilicenter: [
    <circle key="0" cx="16" cy="12" r="5" />,
    <circle key="1" cx="9" cy="12" r="2.5" />,
    <line key="2" x1="2" y1="12" x2="21.5" y2="4.6" />,
    <line key="3" x1="2" y1="12" x2="21.5" y2="19.4" />,
    <circle key="4" cx="2.6" cy="12" r="2.2" className="icon-accent" stroke="none" />,
  ],
  insimilicenter: [
    <circle key="0" cx="6" cy="12" r="3.5" />,
    <circle key="1" cx="17" cy="12" r="4" />,
    <line key="2" x1="4.6" y1="5.9" x2="17.7" y2="18.1" />,
    <line key="3" x1="4.6" y1="18.1" x2="17.7" y2="5.9" />,
    <circle key="4" cx="11.1" cy="12" r="2.2" className="icon-accent" stroke="none" />,
  ],
};
