/**
 * Helpers of the web app's tests: parsed figures (SPEC §2 lets apps/web use the language,
 * so the scene laws on PARSED documents live here, note B of Run 7), and a recording 2D
 * context that stores every call and property assignment of the renderer.
 */
import fc from 'fast-check';
import type { Document } from '@geomira/kernel/document';
import { createRegistry } from '@geomira/kernel/registry';
import { parse } from '@geomira/lang/parse';
import { print } from '@geomira/lang/print';
import { docArb } from '../../../packages/lang/test/helpers/gen-doc';
import type { DisplayList } from '@geomira/scene/display';
import { tracePath, type Canvas2D } from '../src/render';
import { figureOf, type Figure } from '../src/figure';

export const registry = createRegistry();

/** Law iteration counts: NIGHTLY=1 runs ten times as many. */
export function runs(n: number): number {
  return process.env.NIGHTLY === '1' ? n * 10 : n;
}

export const LAW_TIMEOUT = 300_000;

/** Documents of the language's generator, printed and parsed back (scenes come from text). */
export function parsedDocArb(): fc.Arbitrary<Document> {
  return docArb(registry).map((doc) => parse(print(doc), registry).doc);
}

export function figureOfDoc(doc: Document): Figure {
  return figureOf(doc, registry);
}

export type Call = readonly [string, ...unknown[]];

/** A Canvas2D that records calls and assignments (TextMetrics: 7 px per character). */
export class Recorder implements Canvas2D {
  readonly calls: Call[] = [];
  private readonly props = new Map<string, unknown>();

  private rec(name: string, args: unknown[]): void {
    this.calls.push([name, ...args]);
  }
  private get<T>(k: string, d: T): T {
    return (this.props.get(k) as T | undefined) ?? d;
  }
  private set(k: string, v: unknown): void {
    this.props.set(k, v);
    this.calls.push(['set', k, v]);
  }

  setTransform(...a: unknown[]) {
    this.rec('setTransform', a);
  }
  fillRect(...a: number[]) {
    this.rec('fillRect', a);
  }
  beginPath() {
    this.rec('beginPath', []);
  }
  moveTo(...a: number[]) {
    this.rec('moveTo', a);
  }
  lineTo(...a: number[]) {
    this.rec('lineTo', a);
  }
  arc(...a: unknown[]) {
    this.rec('arc', a);
  }
  closePath() {
    this.rec('closePath', []);
  }
  stroke() {
    this.rec('stroke', []);
  }
  fill() {
    this.rec('fill', []);
  }
  fillText(...a: unknown[]) {
    this.rec('fillText', a);
  }
  measureText(text: string): TextMetrics {
    return { width: 7 * text.length } as TextMetrics;
  }
  setLineDash(segments: number[]) {
    this.rec('setLineDash', [segments]);
  }
  get globalAlpha() {
    return this.get('globalAlpha', 1);
  }
  set globalAlpha(v: number) {
    this.set('globalAlpha', v);
  }
  get lineWidth() {
    return this.get('lineWidth', 1);
  }
  set lineWidth(v: number) {
    this.set('lineWidth', v);
  }
  get strokeStyle() {
    return this.get<string>('strokeStyle', '#000');
  }
  set strokeStyle(v: string | CanvasGradient | CanvasPattern) {
    this.set('strokeStyle', v);
  }
  get fillStyle() {
    return this.get<string>('fillStyle', '#000');
  }
  set fillStyle(v: string | CanvasGradient | CanvasPattern) {
    this.set('fillStyle', v);
  }
  get font() {
    return this.get('font', '');
  }
  set font(v: string) {
    this.set('font', v);
  }
  get textAlign() {
    return this.get<CanvasTextAlign>('textAlign', 'start');
  }
  set textAlign(v: CanvasTextAlign) {
    this.set('textAlign', v);
  }
  get textBaseline() {
    return this.get<CanvasTextBaseline>('textBaseline', 'alphabetic');
  }
  set textBaseline(v: CanvasTextBaseline) {
    this.set('textBaseline', v);
  }
  get lineCap() {
    return this.get<CanvasLineCap>('lineCap', 'butt');
  }
  set lineCap(v: CanvasLineCap) {
    this.set('lineCap', v);
  }
  get lineJoin() {
    return this.get<CanvasLineJoin>('lineJoin', 'miter');
  }
  set lineJoin(v: CanvasLineJoin) {
    this.set('lineJoin', v);
  }

  /** The geometry calls only (moveTo, lineTo, arc, closePath), in order. */
  geometry(): Call[] {
    return this.calls.filter((c) => ['moveTo', 'lineTo', 'arc', 'closePath'].includes(c[0]));
  }
}

/** The geometry calls the renderer must make for a display list, item by item. */
export function expectedGeometry(d: DisplayList): Recorder {
  const r = new Recorder();
  for (const item of d.items) {
    if (item.fill !== null) tracePath(r, { kind: 'poly', pts: item.fill, closed: true });
    for (const p of item.paths) tracePath(r, p);
  }
  return r;
}
