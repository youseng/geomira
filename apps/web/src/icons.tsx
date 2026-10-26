/**
 * Icons (Run 9b, ADR-0016): the tool icons of the maintainer's Geomdraw design, as static SVG
 * data on a 24 × 24 grid (strokes in currentColor, the accent dot in the accent colour), one
 * per GUI tool of packages/editor (the Record makes the compiler require every tool), and
 * the top bar's glyphs; the centre tools carry Geomdraw's corner letter. Decorative: every
 * button that shows one has its own accessible name.
 */
import type { ReactNode } from 'react';
import type { ToolId } from '@geomira/editor/tool-state';

const TOOL_PARTS: Readonly<Record<ToolId, readonly ReactNode[]>> = {
  move: [
    <path
      key="0"
      d="M6 3 L18 12 L12.6 13.1 L15.6 19.6 L13.1 20.7 L10.1 14.1 L6 17.6 Z"
      fill="currentColor"
      stroke="none"
    />,
  ],
  point: [
    <circle key="0" cx="12" cy="12" r="1.9" fill="currentColor" stroke="none" />,
    <line key="1" x1="6" y1="18" x2="18" y2="6" />,
  ],
  glider: [
    <circle key="0" cx="12" cy="12" r="7.5" />,
    <circle key="1" cx="17.3" cy="6.7" r="2.4" className="icon-accent" stroke="none" />,
  ],
  intersection: [
    <line key="0" x1="3" y1="18" x2="21" y2="6" />,
    <line key="1" x1="3" y1="7" x2="21" y2="17" />,
    <circle key="2" cx="12" cy="12" r="2.4" className="icon-accent" stroke="none" />,
  ],
  second_intersection: [
    <circle key="0" cx="12" cy="13" r="7" />,
    <line key="1" x1="2" y1="9.5" x2="22" y2="15" />,
    <circle key="2" cx="5.4" cy="11.3" r="1.9" fill="currentColor" stroke="none" />,
    <circle key="3" cx="18.6" cy="14.6" r="2.4" className="icon-accent" stroke="none" />,
  ],
  midpoint: [
    <line key="0" x1="4" y1="18" x2="20" y2="6" />,
    <circle key="1" cx="4" cy="18" r="1.9" fill="currentColor" stroke="none" />,
    <circle key="2" cx="20" cy="6" r="1.9" fill="currentColor" stroke="none" />,
    <circle key="3" cx="12" cy="12" r="2.4" className="icon-accent" stroke="none" />,
  ],
  foot: [
    <line key="0" x1="3" y1="19" x2="21" y2="19" />,
    <line key="1" x1="12" y1="4" x2="12" y2="19" />,
    <path key="2" d="M12 15.5 h3.5 v3.5" strokeWidth="1" />,
    <circle key="3" cx="12" cy="4" r="1.9" fill="currentColor" stroke="none" />,
    <circle key="4" cx="12" cy="19" r="2.4" className="icon-accent" stroke="none" />,
  ],
  line: [
    <line key="0" x1="2" y1="20" x2="22" y2="4" />,
    <circle key="1" cx="8" cy="15.2" r="1.9" fill="currentColor" stroke="none" />,
    <circle key="2" cx="16" cy="8.8" r="1.9" fill="currentColor" stroke="none" />,
  ],
  segment: [
    <line key="0" x1="5" y1="18" x2="19" y2="6" />,
    <circle key="1" cx="5" cy="18" r="1.9" fill="currentColor" stroke="none" />,
    <circle key="2" cx="19" cy="6" r="1.9" fill="currentColor" stroke="none" />,
  ],
  ray: [
    <line key="0" x1="4" y1="18" x2="22" y2="5" />,
    <circle key="1" cx="4" cy="18" r="1.9" fill="currentColor" stroke="none" />,
    <circle key="2" cx="11" cy="13" r="1.9" fill="currentColor" stroke="none" />,
  ],
  parallel: [
    <line key="0" x1="2" y1="15" x2="16" y2="3" />,
    <line key="1" x1="8" y1="21" x2="22" y2="9" />,
  ],
  perpendicular: [
    <line key="0" x1="3" y1="18" x2="21" y2="18" />,
    <line key="1" x1="12" y1="4" x2="12" y2="18" />,
    <path key="2" d="M12 14.5 h3.5 v3.5" strokeWidth="1" />,
  ],
  perp_bisector: [
    <line key="0" x1="4" y1="16" x2="20" y2="16" />,
    <circle key="1" cx="4" cy="16" r="1.9" fill="currentColor" stroke="none" />,
    <circle key="2" cx="20" cy="16" r="1.9" fill="currentColor" stroke="none" />,
    <line key="3" x1="12" y1="4" x2="12" y2="21" />,
    <path key="4" d="M12 12.5 h3.5 v3.5" strokeWidth="1" />,
  ],
  bisector: [
    <line key="0" x1="3" y1="19" x2="21" y2="19" />,
    <line key="1" x1="3" y1="19" x2="15" y2="5" />,
    <line key="2" x1="3" y1="19" x2="21" y2="10" strokeDasharray="2.5 2" />,
  ],
  ext_bisector: [
    <line key="0" x1="8" y1="19" x2="21" y2="19" />,
    <line key="1" x1="8" y1="19" x2="15" y2="6" />,
    <line key="2" x1="2" y1="9" x2="18" y2="21" strokeDasharray="2.5 2" />,
  ],
  tangent: [
    <circle key="0" cx="9" cy="15" r="6" />,
    <circle key="1" cx="21" cy="4" r="1.9" fill="currentColor" stroke="none" />,
    <line key="2" x1="21" y1="4" x2="3.5" y2="11.5" />,
    <line key="3" x1="21" y1="4" x2="13.5" y2="20.5" />,
  ],
  polar: [
    <circle key="0" cx="9" cy="12" r="6" />,
    <line key="1" x1="14.5" y1="3" x2="14.5" y2="21" />,
    <circle key="2" cx="21" cy="12" r="1.9" fill="currentColor" stroke="none" />,
  ],
  radical_axis: [
    <circle key="0" cx="7" cy="12" r="5" />,
    <circle key="1" cx="17" cy="12" r="5" />,
    <line key="2" x1="12" y1="3" x2="12" y2="21" />,
  ],
  polygon: [
    <path key="0" d="M4 19 L20 19 L17 7 L7 5 Z" />,
    <circle key="1" cx="4" cy="19" r="1.9" fill="currentColor" stroke="none" />,
    <circle key="2" cx="20" cy="19" r="1.9" fill="currentColor" stroke="none" />,
    <circle key="3" cx="17" cy="7" r="1.9" fill="currentColor" stroke="none" />,
    <circle key="4" cx="7" cy="5" r="1.9" fill="currentColor" stroke="none" />,
  ],
  circle: [
    <circle key="0" cx="12" cy="12" r="8" />,
    <circle key="1" cx="12" cy="12" r="1.9" fill="currentColor" stroke="none" />,
    <circle key="2" cx="20" cy="12" r="1.9" fill="currentColor" stroke="none" />,
  ],
  circle_radius: [
    <circle key="0" cx="12" cy="12" r="8" />,
    <circle key="1" cx="12" cy="12" r="1.9" fill="currentColor" stroke="none" />,
    <line key="2" x1="12" y1="12" x2="17.7" y2="6.3" />,
  ],
  arc: [
    <path key="0" d="M4 16 A9 9 0 0 1 20 16" />,
    <circle key="1" cx="4" cy="16" r="1.9" fill="currentColor" stroke="none" />,
    <circle key="2" cx="12" cy="7.5" r="1.9" fill="currentColor" stroke="none" />,
    <circle key="3" cx="20" cy="16" r="2.4" className="icon-accent" stroke="none" />,
  ],
  symmedian: [
    <path key="0" d="M12 3 L3 20 L21 20 Z" />,
    <line key="1" x1="12" y1="3" x2="16" y2="20" />,
    <circle key="2" cx="16" cy="20" r="2.4" className="icon-accent" stroke="none" />,
  ],
  isogonal: [
    <path key="0" d="M3 20 L21 20 L10 5 Z" />,
    <circle key="1" cx="9" cy="16" r="1.6" fill="currentColor" stroke="none" />,
    <circle key="2" cx="14" cy="15" r="2.4" className="icon-accent" stroke="none" />,
  ],
  spiral_center: [
    <path key="0" d="M12 12 C14 10 16 13 14 15 C11 18 6 15 7 10 C8 5 15 4 18 7" />,
    <circle key="1" cx="12" cy="12" r="2.4" className="icon-accent" stroke="none" />,
  ],
  pole: [
    <circle key="0" cx="9" cy="12" r="6" />,
    <line key="1" x1="14.5" y1="3" x2="14.5" y2="21" />,
    <circle key="2" cx="21" cy="12" r="2.4" className="icon-accent" stroke="none" />,
  ],
  radical_center: [
    <circle key="0" cx="8" cy="9" r="5" />,
    <circle key="1" cx="16" cy="9" r="5" />,
    <circle key="2" cx="12" cy="16" r="5" />,
    <circle key="3" cx="12" cy="11" r="2.2" className="icon-accent" stroke="none" />,
  ],
  circle3: [
    <circle key="0" cx="12" cy="12" r="8" />,
    <circle key="1" cx="4.4" cy="9.6" r="1.9" fill="currentColor" stroke="none" />,
    <circle key="2" cx="16" cy="5.1" r="1.9" fill="currentColor" stroke="none" />,
    <circle key="3" cx="14.1" cy="19.7" r="1.9" fill="currentColor" stroke="none" />,
  ],
  diameter_circle: [
    <circle key="0" cx="12" cy="12" r="8" />,
    <line key="1" x1="4" y1="12" x2="20" y2="12" />,
    <circle key="2" cx="4" cy="12" r="1.9" fill="currentColor" stroke="none" />,
    <circle key="3" cx="20" cy="12" r="1.9" fill="currentColor" stroke="none" />,
  ],
  circumcircle: [
    <circle key="0" cx="12" cy="12" r="9" />,
    <path key="1" d="M12 3 L4.2 16.5 L19.8 16.5 Z" />,
  ],
  incircle: [
    <path key="0" d="M3 20 L21 20 L10 5 Z" />,
    <circle key="1" cx="10.6" cy="14.9" r="5" />,
  ],
  excircle: [<path key="0" d="M7 10 L17 10 L11 3 Z" />, <circle key="1" cx="12" cy="16" r="5.5" />],
  ninepoint_circle: [
    <path key="0" d="M3 20 L21 20 L10 5 Z" />,
    <circle key="1" cx="12.3" cy="15" r="4.8" strokeDasharray="2.5 2" />,
    <circle key="2" cx="12" cy="20" r="1.9" fill="currentColor" stroke="none" />,
    <circle key="3" cx="15.5" cy="12.5" r="1.9" fill="currentColor" stroke="none" />,
    <circle key="4" cx="6.5" cy="12.5" r="1.9" fill="currentColor" stroke="none" />,
  ],
  centroid: [
    <path key="0" d="M3 20 L21 20 L10 5 Z" />,
    <circle key="1" cx="11.5" cy="14.5" r="2.4" className="icon-accent" stroke="none" />,
  ],
  circumcenter: [
    <path key="0" d="M3 20 L21 20 L10 5 Z" />,
    <circle key="1" cx="11.5" cy="14.5" r="2.4" className="icon-accent" stroke="none" />,
  ],
  incenter: [
    <path key="0" d="M3 20 L21 20 L10 5 Z" />,
    <circle key="1" cx="11.5" cy="14.5" r="2.4" className="icon-accent" stroke="none" />,
  ],
  orthocenter: [
    <path key="0" d="M3 20 L21 20 L10 5 Z" />,
    <circle key="1" cx="11.5" cy="14.5" r="2.4" className="icon-accent" stroke="none" />,
  ],
  ninepoint_center: [
    <path key="0" d="M3 20 L21 20 L10 5 Z" />,
    <circle key="1" cx="11.5" cy="14.5" r="2.4" className="icon-accent" stroke="none" />,
  ],
  excenter: [
    <path key="0" d="M3 20 L21 20 L10 5 Z" />,
    <circle key="1" cx="11.5" cy="14.5" r="2.4" className="icon-accent" stroke="none" />,
  ],
  reflect: [
    <line key="0" x1="12" y1="3" x2="12" y2="21" strokeDasharray="2.5 2" />,
    <circle key="1" cx="6" cy="9" r="1.9" fill="currentColor" stroke="none" />,
    <circle key="2" cx="18" cy="9" r="2.4" className="icon-accent" stroke="none" />,
    <path key="3" d="M7 15 Q12 19 17 15" />,
  ],
  rotate: [
    <circle key="0" cx="12" cy="12" r="1.9" fill="currentColor" stroke="none" />,
    <path key="1" d="M19 12 A7 7 0 1 0 15.5 18.1" />,
    <path key="2" d="M15.5 18.1 L19 18.8 M15.5 18.1 L15.6 14.6" />,
  ],
  translate: [
    <circle key="0" cx="5" cy="17" r="1.9" fill="currentColor" stroke="none" />,
    <circle key="1" cx="18" cy="6" r="2.4" className="icon-accent" stroke="none" />,
    <path key="2" d="M7 15.4 L16 7.6" />,
    <path key="3" d="M16 7.6 L12.4 8 M16 7.6 L15.6 11.2" />,
  ],
  homothety: [
    <circle key="0" cx="3" cy="19" r="1.9" fill="currentColor" stroke="none" />,
    <line key="1" x1="3" y1="19" x2="21" y2="5" />,
    <line key="2" x1="3" y1="19" x2="21" y2="19" />,
    <circle key="3" cx="11" cy="13" r="1.9" fill="currentColor" stroke="none" />,
    <circle key="4" cx="19" cy="6.6" r="2.4" className="icon-accent" stroke="none" />,
    <circle key="5" cx="11" cy="19" r="1.9" fill="currentColor" stroke="none" />,
    <circle key="6" cx="19" cy="19" r="2.4" className="icon-accent" stroke="none" />,
  ],
  spiral: [
    <path key="0" d="M12 12 C14 10 16 13 14 15 C11 18 6 15 7 10 C8 5 15 4 18 7" />,
    <circle key="1" cx="18" cy="7" r="2.4" className="icon-accent" stroke="none" />,
  ],
  apply_map: [
    <path key="0" d="M4 7 h7 M4 7 l3 -3 M4 7 l3 3" />,
    <text key="1" x="5" y="20" fontSize="9" fontStyle="italic" fill="currentColor" stroke="none">
      f
    </text>,
    <path key="2" d="M10 16 L19 16" />,
    <path key="3" d="M16 13 L19 16 L16 19" />,
    <circle key="4" cx="20" cy="7" r="2.4" className="icon-accent" stroke="none" />,
  ],
  derived_layer: [
    <path key="0" d="M3 9 L12 4.5 L21 9 L12 13.5 Z" />,
    <path key="1" d="M3 14 L12 18.5 L21 14" />,
    <circle key="2" cx="12" cy="18.5" r="2.4" className="icon-accent" stroke="none" />,
  ],
  mark_angle: [
    <line key="0" x1="4" y1="19" x2="21" y2="19" />,
    <line key="1" x1="4" y1="19" x2="15" y2="6" />,
    <path key="2" d="M11 19 A7 7 0 0 0 8.6 13.6" />,
    <path key="3" d="M14 19 A10 10 0 0 0 10.5 11.4" />,
  ],
  mark_right: [
    <line key="0" x1="4" y1="19" x2="21" y2="19" />,
    <line key="1" x1="4" y1="19" x2="4" y2="4" />,
    <path key="2" d="M4 13 L10 13 L10 19" />,
  ],
  mark_segment: [
    <line key="0" x1="3" y1="12" x2="21" y2="12" />,
    <line key="1" x1="10" y1="8.5" x2="10" y2="15.5" />,
    <line key="2" x1="14" y1="8.5" x2="14" y2="15.5" />,
  ],
  text: [<path key="0" d="M6 5 L18 5 M12 5 L12 19 M9.5 19 L14.5 19" />],
  measure_distance: [
    <line key="0" x1="4" y1="15" x2="20" y2="15" />,
    <line key="1" x1="4" y1="11" x2="4" y2="19" />,
    <line key="2" x1="20" y1="11" x2="20" y2="19" />,
  ],
  measure_angle: [
    <line key="0" x1="4" y1="19" x2="21" y2="19" />,
    <line key="1" x1="4" y1="19" x2="15" y2="6" />,
    <path key="2" d="M13 19 A9 9 0 0 0 9.8 12.1" />,
  ],
  measure_ratio: [
    <line key="0" x1="3" y1="8" x2="11" y2="8" />,
    <line key="1" x1="13" y1="16" x2="21" y2="16" />,
    <path key="2" d="M15 4 L9 20" />,
  ],
  measure_area: [<path key="0" d="M4 19 L20 19 L10 6 Z" fill="currentColor" fillOpacity=".22" />],
  measure_power: [
    <circle key="0" cx="14" cy="12" r="7" />,
    <circle key="1" cx="2" cy="12" r="1.9" fill="currentColor" stroke="none" />,
    <line key="2" x1="2" y1="12" x2="21" y2="12" />,
    <circle key="3" cx="7" cy="12" r="2.4" className="icon-accent" stroke="none" />,
  ],
  claim: [
    <circle key="0" cx="5" cy="17" r="1.9" fill="currentColor" stroke="none" />,
    <circle key="1" cx="12" cy="12" r="1.9" fill="currentColor" stroke="none" />,
    <circle key="2" cx="19" cy="7" r="1.9" fill="currentColor" stroke="none" />,
    <line key="3" x1="3" y1="18.4" x2="21" y2="5.6" strokeDasharray="2.5 2" />,
    <path key="4" d="M14 19 L16.5 21 L21 15.5" />,
  ],
};

/**
 * The letter in the corner of a centre tool's button (Geomdraw's), naming the centre; the
 * triangle icons are otherwise alike.
 */
const CORNER: Readonly<Partial<Record<ToolId, string>>> = {
  centroid: 'G',
  circumcenter: 'O',
  incenter: 'I',
  orthocenter: 'H',
  ninepoint_center: 'N',
  excenter: 'Iₐ',
};

/** The icon of a GUI tool (with its corner letter, if any). */
export function ToolIcon({ tool }: { tool: ToolId }) {
  const corner = CORNER[tool];
  return (
    <>
      {corner !== undefined && (
        <span className="ct" aria-hidden="true">
          {corner}
        </span>
      )}
      <ToolSvg tool={tool} />
    </>
  );
}

function ToolSvg({ tool }: { tool: ToolId }) {
  return (
    <svg
      className="icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.45"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {TOOL_PARTS[tool]}
    </svg>
  );
}

const ZOOM_PARTS = {
  in: <path d="M12 6 V18 M6 12 H18" />,
  out: <path d="M6 12 H18" />,
  fit: <path d="M6 18 L18 6 M12.5 6 H18 V11.5 M6 12.5 V18 H11.5" />,
} as const;

/**
 * The canvas's zoom and fit icons, drawn as paths (not text): they float on the canvas, and a
 * text glyph would look different with every platform's font.
 */
export function ZoomIcon({ kind }: { kind: keyof typeof ZOOM_PARTS }) {
  return (
    <svg
      className="icon"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {ZOOM_PARTS[kind]}
    </svg>
  );
}

/** A glyph of the top bar or the canvas controls (text, hidden from assistive technology). */
export function Glyph({ children }: { children: string }) {
  return (
    <span className="glyph" aria-hidden="true">
      {children}
    </span>
  );
}

/** Text for assistive technology only: an icon button's accessible name. */
export function SrOnly({ children }: { children: ReactNode }) {
  return <span className="sr-only">{children}</span>;
}
