/**
 * Builds documents for the scene's unit tests through the kernel's own edits (applyDocEdit:
 * valid and synced documents, derived layers included), and evaluates them over FloatField.
 * The scene may not import the language (SPEC §2), so these tests build documents with the
 * kernel; the laws on parsed documents live in apps/web/test (which may import lang).
 */
import type { Document, Style } from '@geomira/kernel/document';
import { emptyDocument, findObjectByName } from '@geomira/kernel/document';
import { applyDocEdit, type DocEdit } from '@geomira/kernel/doc-edit';
import { evalContextFor } from '@geomira/kernel/context';
import { evaluate } from '@geomira/kernel/evaluate';
import { call, lit, ref, type Expr } from '@geomira/kernel/expr';
import { createRegistry } from '@geomira/kernel/registry';
import type { Value } from '@geomira/kernel/value';
import { FloatField } from '@geomira/num/float-field';
import { fromNumber } from '@geomira/num/rational';
import { buildScene } from '../../src/build';
import type { Scene } from '../../src/types';

export const registry = createRegistry();

/** An argument: a number literal, or the name of an existing object. */
export type Arg = number | string | Expr;

export class Doc {
  doc: Document = emptyDocument();

  private edit(e: DocEdit): void {
    const r = applyDocEdit(this.doc, registry, e);
    if (!r.ok) throw new Error(`${e.kind}: ${r.error}`);
    this.doc = r.doc;
  }

  id(name: string): number {
    const o = findObjectByName(this.doc, name);
    if (o === undefined) throw new Error(`no object ${name}`);
    return o.id;
  }

  layerId(name: string): string {
    const l = this.doc.layers.find((x) => x.name === name);
    if (l === undefined) throw new Error(`no layer ${name}`);
    return l.id;
  }

  expr(a: Arg): Expr {
    if (typeof a === 'number') return lit(fromNumber(a));
    if (typeof a === 'string') return ref(this.id(a));
    return a;
  }

  call(tool: string, ...args: Arg[]): Expr {
    return call(
      tool,
      args.map((a) => this.expr(a)),
    );
  }

  add(name: string, def: Expr, opts: { style?: Style; layers?: string[] } = {}): this {
    const layers = opts.layers?.map((l) => (l === 'main' ? 'main' : this.layerId(l)));
    this.edit({
      kind: 'add',
      object: {
        name,
        def,
        ...(opts.style === undefined ? {} : { style: opts.style }),
        ...(layers === undefined ? {} : { layers }),
      },
    });
    return this;
  }

  point(name: string, x: number, y: number, opts: { style?: Style; layers?: string[] } = {}) {
    return this.add(name, this.call('point', x, y), opts);
  }

  layer(name: string, options: { visible?: boolean; opacity?: number } = {}): this {
    this.edit({ kind: 'addLayer', name, options });
    return this;
  }

  derived(name: string, transform: string, source = 'main', exclude: string[] = []): this {
    this.edit({
      kind: 'addDerivedLayer',
      spec: {
        name,
        transform: this.id(transform),
        source: source === 'main' ? 'main' : this.layerId(source),
        exclude: exclude.map((x) => this.id(x)),
      },
    });
    return this;
  }

  style(name: string, style: Style): this {
    this.edit({ kind: 'style', id: this.id(name), style });
    return this;
  }

  visible(layer: string, visible: boolean): this {
    const id = layer === 'main' ? 'main' : this.layerId(layer);
    this.edit({ kind: 'updateLayer', id, patch: { visible } });
    return this;
  }

  values(): ReadonlyMap<number, Value<number>> {
    return valuesOf(this.doc);
  }

  scene(): Scene {
    return buildScene(this.doc, this.values());
  }
}

/** The float values of a document (every object Undefined when it has no context). */
export function valuesOf(doc: Document): ReadonlyMap<number, Value<number>> {
  const c = evalContextFor(doc);
  return evaluate(doc, registry, FloatField, c.ok ? c.ctx : { scale: 1 }).values;
}

/** The names of a scene's primitives, in draw order. */
export function drawn(scene: Scene): string[] {
  return scene.primitives.map((p) => p.name);
}
