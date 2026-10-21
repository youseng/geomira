/**
 * CSS colours (a Style's `color` is a CSS colour as written, ADR-0010) → RGB, so every
 * format writes the colour the canvas draws: TikZ and Asymptote as six-digit hexadecimal
 * (SPEC §14) with the alpha as an opacity, SVG as `#rrggbb`. Read: the named colours,
 * `transparent`, `#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`, `rgb()`/`rgba()` and
 * `hsl()`/`hsla()` (comma or space syntax, `/ alpha`, percentages, `deg`). Anything else
 * (an invalid colour, or a newer form such as `hwb()` or `lab()`) is undefined: the
 * exporters then use the default ink, as the canvas does for an invalid colour, and report it.
 */
import { CSS_NAMED } from './css-names';

export interface Rgba {
  /** 0–255, whole numbers. */
  readonly r: number;
  readonly g: number;
  readonly b: number;
  /** 0–1. */
  readonly a: number;
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

function fromHex(h: string): Rgba | undefined {
  if (!/^[0-9a-f]+$/u.test(h)) return undefined;
  const short = h.length === 3 || h.length === 4;
  if (!short && h.length !== 6 && h.length !== 8) return undefined;
  const parts = short ? Array.from(h, (c) => c + c) : (h.match(/../gu) ?? []);
  const [r, g, b, a] = parts.map((p) => parseInt(p, 16));
  if (r === undefined || g === undefined || b === undefined) return undefined;
  return { r, g, b, a: a === undefined ? 1 : a / 255 };
}

/** A number or percentage of a functional colour; `full` is the value of 100%. */
function component(s: string, full: number): number | undefined {
  const m = /^([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)(%?)$/u.exec(s);
  if (m === null) return undefined;
  const x = Number(m[1]);
  if (!Number.isFinite(x)) return undefined;
  return m[2] === '%' ? (x / 100) * full : x;
}

/** The arguments of `name(…)`: three values and an optional alpha. */
function args(body: string): { xs: string[]; alpha: string | undefined } | undefined {
  const commas = body.includes(',');
  const [main, alpha, extra] = commas ? [body, undefined, undefined] : body.split('/');
  if (extra !== undefined) return undefined;
  const xs = main
    .split(commas ? ',' : /\s+/u)
    .map((x) => x.trim())
    .filter((x) => x !== '');
  if (commas && xs.length === 4) return { xs: xs.slice(0, 3), alpha: xs[3] };
  return xs.length === 3 ? { xs, alpha: alpha?.trim() } : undefined;
}

function alphaOf(s: string | undefined): number | undefined {
  if (s === undefined) return 1;
  const a = component(s, 1);
  return a === undefined ? undefined : clamp(a, 0, 1);
}

function rgbFunction(body: string): Rgba | undefined {
  const p = args(body);
  if (p === undefined) return undefined;
  const v = p.xs.map((x) => component(x, 255));
  const a = alphaOf(p.alpha);
  const [r, g, b] = v;
  if (r === undefined || g === undefined || b === undefined || a === undefined) return undefined;
  const c = (x: number) => Math.round(clamp(x, 0, 255));
  return { r: c(r), g: c(g), b: c(b), a };
}

function hue(s: string): number | undefined {
  const m = /^(.*?)(deg)?$/u.exec(s);
  const h = component(m?.[1] ?? '', 0);
  return h === undefined || s.endsWith('%') ? undefined : h;
}

function hslFunction(body: string): Rgba | undefined {
  const p = args(body);
  if (p === undefined) return undefined;
  const [hs, ss, ls] = p.xs;
  const h = hue(hs ?? '');
  const sat = ss?.endsWith('%') === true ? component(ss, 1) : undefined;
  const light = ls?.endsWith('%') === true ? component(ls, 1) : undefined;
  const a = alphaOf(p.alpha);
  if (h === undefined || sat === undefined || light === undefined || a === undefined)
    return undefined;
  const [s, l] = [clamp(sat, 0, 1), clamp(light, 0, 1)];
  // CSS Color 4, §7.1 hslToRgb.
  const f = (n: number) => {
    const k = (((n + h / 30) % 12) + 12) % 12;
    const t = s * Math.min(l, 1 - l);
    return Math.round(255 * (l - t * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
  };
  return { r: f(0), g: f(8), b: f(4), a };
}

/** The colour `s` as RGB and alpha, or undefined (see the module comment). */
export function parseCssColor(s: string): Rgba | undefined {
  const c = s.trim().toLowerCase();
  if (c === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };
  const named = Object.hasOwn(CSS_NAMED, c) ? CSS_NAMED[c] : undefined;
  if (named !== undefined) return fromHex(named);
  if (c.startsWith('#')) return fromHex(c.slice(1));
  const m = /^(rgba?|hsla?)\((.*)\)$/u.exec(c);
  if (m === null) return undefined;
  return m[1]?.startsWith('rgb') === true ? rgbFunction(m[2] ?? '') : hslFunction(m[2] ?? '');
}

/** Six upper-case hexadecimal digits of the colour (alpha left out). */
export function hex6(c: Rgba): string {
  return [c.r, c.g, c.b]
    .map((x) => x.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}
