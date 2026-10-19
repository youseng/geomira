/**
 * Document invariants (SPEC §5), checked after EVERY edit in tests and dev builds:
 * I1 names unique and grammatical, managed names reserved; I2 every Ref points to an
 * EARLIER object; I3 every object has ≥ 1 existing layer ("main" exists); I4 each managed
 * object sits after its source and its rule's transform and matches its rule exactly;
 * I5 claims and assumptions reference existing objects; I6 ids unique, never reused
 * (all below nextId); I7 views reference existing layers; I8 version current.
 */
import {
  DOCUMENT_VERSION,
  MAIN_LAYER_ID,
  type DocObject,
  type Document,
  type Layer,
} from './document';
import { exprEquals, call, ref, refsOf } from './expr';
import { isImageSuffix, isUserName } from './names';

export type InvariantCode = 'I1' | 'I2' | 'I3' | 'I4' | 'I5' | 'I6' | 'I7' | 'I8';

export interface InvariantViolation {
  readonly code: InvariantCode;
  readonly message: string;
}

/** Every violated invariant, in order I1…I8 (empty for a valid document). */
export function checkInvariants(doc: Document): InvariantViolation[] {
  const out: InvariantViolation[] = [];
  const push = (code: InvariantCode, message: string): void => {
    out.push({ code, message });
  };
  checkNames(doc, push);
  checkOrder(doc, push);
  checkLayers(doc, push);
  checkManaged(doc, push);
  checkClaims(doc, push);
  checkIds(doc, push);
  checkViews(doc, push);
  if (doc.version !== DOCUMENT_VERSION) {
    push('I8', `version ${String(doc.version)} is not the current ${String(DOCUMENT_VERSION)}`);
  }
  return out;
}

/** Throws an Error listing every violation; returns the document when it is valid. */
export function assertInvariants(doc: Document): Document {
  const v = checkInvariants(doc);
  if (v.length > 0) {
    throw new Error(
      `document invariants violated:\n${v.map((x) => `${x.code}: ${x.message}`).join('\n')}`,
    );
  }
  return doc;
}

type Push = (code: InvariantCode, message: string) => void;

function checkNames(doc: Document, push: Push): void {
  const seen = new Set<string>();
  const names = [
    ...doc.objects.map((o) => ({ name: o.name, managed: o.managedBy !== undefined })),
    ...doc.claims.flatMap((c) => (c.name === undefined ? [] : [{ name: c.name, managed: false }])),
  ];
  for (const { name, managed } of names) {
    if (seen.has(name)) push('I1', `name "${name}" is used twice`);
    seen.add(name);
    if (!managed && !isUserName(name)) push('I1', `"${name}" is not a valid name`);
  }
  const layerNames = new Set<string>();
  for (const l of doc.layers) {
    if (layerNames.has(l.name)) push('I1', `layer name "${l.name}" is used twice`);
    layerNames.add(l.name);
    if (!isUserName(l.name)) push('I1', `"${l.name}" is not a valid layer name`);
  }
}

function checkOrder(doc: Document, push: Push): void {
  const earlier = new Set<number>();
  for (const o of doc.objects) {
    for (const id of refsOf(o.def)) {
      if (!earlier.has(id))
        push('I2', `${o.name} refers to #${String(id)}, which is not an earlier object`);
    }
    earlier.add(o.id);
  }
}

function checkLayers(doc: Document, push: Push): void {
  const ids = new Set<string>();
  for (const l of doc.layers) {
    if (ids.has(l.id)) push('I3', `layer id "${l.id}" is used twice`);
    ids.add(l.id);
    if (!(l.opacity >= 0 && l.opacity <= 1))
      push('I3', `layer "${l.name}" has opacity outside [0, 1]`);
  }
  if (!ids.has(MAIN_LAYER_ID)) push('I3', 'the "main" layer is missing');
  for (const o of doc.objects) {
    if (o.layers.length === 0) push('I3', `${o.name} has no layer`);
    if (new Set(o.layers).size !== o.layers.length) push('I3', `${o.name} lists a layer twice`);
    for (const l of o.layers) {
      if (!ids.has(l)) push('I3', `${o.name} is in the missing layer "${l}"`);
    }
  }
}

function checkManaged(doc: Document, push: Push): void {
  const index = new Map(doc.objects.map((o, i) => [o.id, i]));
  for (const l of doc.layers) checkRule(doc, l, index, push);
  const images = new Set<string>();
  for (const [i, o] of doc.objects.entries()) {
    if (o.managedBy === undefined) continue;
    const problem = managedProblem(doc, o, i, index);
    if (problem !== undefined) push('I4', `${o.name}: ${problem}`);
    const source = o.def.kind === 'call' ? o.def.args[1] : undefined;
    const key = `${o.managedBy}/${source?.kind === 'ref' ? String(source.id) : o.name}`;
    if (images.has(key)) push('I4', `${o.name} duplicates another image of the same object`);
    images.add(key);
  }
}

function checkRule(doc: Document, l: Layer, index: Map<number, number>, push: Push): void {
  const r = l.rule;
  if (r === undefined) return;
  if (!doc.layers.some((s) => s.id === r.source) || r.source === l.id) {
    push('I4', `layer "${l.name}" has an invalid source layer "${r.source}"`);
  }
  if (!index.has(r.transform.id)) push('I4', `layer "${l.name}" has a missing transform`);
  if (!isImageSuffix(r.suffix)) push('I4', `layer "${l.name}" has an invalid suffix "${r.suffix}"`);
  for (const id of r.exclude) {
    if (!index.has(id)) push('I4', `layer "${l.name}" excludes the missing object #${String(id)}`);
  }
  const visited = new Set<string>([l.id]);
  for (let s = doc.layers.find((x) => x.id === r.source); s?.rule !== undefined;) {
    if (visited.has(s.id)) {
      push('I4', `layer "${l.name}" is part of a cycle of derived layers`);
      return;
    }
    visited.add(s.id);
    const next = s.rule.source;
    s = doc.layers.find((x) => x.id === next);
  }
}

/** Why a managed object does not match its rule, or undefined when it does. */
function managedProblem(
  doc: Document,
  o: DocObject,
  i: number,
  index: Map<number, number>,
): string | undefined {
  const layer = doc.layers.find((l) => l.id === o.managedBy);
  const rule = layer?.rule;
  if (layer === undefined || rule === undefined) return 'its layer has no rule';
  if (o.layers.length !== 1 || o.layers[0] !== layer.id)
    return `it must live only in "${layer.name}"`;
  const [, xRef] = o.def.kind === 'call' ? o.def.args : [];
  const source = xRef?.kind === 'ref' ? doc.objects.find((x) => x.id === xRef.id) : undefined;
  if (source === undefined) return 'its definition is not apply(T, X) for an object X';
  if (!exprEquals(o.def, call('apply', [ref(rule.transform.id), ref(source.id)]))) {
    return `its definition is not apply(T, ${source.name}) for the rule's transform`;
  }
  const t = index.get(rule.transform.id);
  const x = index.get(source.id);
  if (t === undefined || x === undefined || t >= i || x >= i) {
    return 'it must come after its source and the transform';
  }
  if (!source.layers.includes(rule.source)) return `${source.name} is not in the source layer`;
  if (rule.exclude.includes(source.id)) return `${source.name} is excluded`;
  if (source.style.noimage === true) return `${source.name} is styled [noimage]`;
  if (o.name !== source.name + rule.suffix) return `its name must be ${source.name}${rule.suffix}`;
  return undefined;
}

function checkClaims(doc: Document, push: Push): void {
  const ids = new Set(doc.objects.map((o) => o.id));
  const items = [
    ...doc.claims.map((c) => ({ what: `claim #${String(c.id)}`, args: c.args })),
    ...doc.assumptions.map((a) => ({ what: `assumption #${String(a.id)}`, args: a.args })),
  ];
  for (const { what, args } of items) {
    for (const id of args.flatMap(refsOf)) {
      if (!ids.has(id)) push('I5', `${what} refers to the missing object #${String(id)}`);
    }
  }
}

function checkIds(doc: Document, push: Push): void {
  if (!Number.isSafeInteger(doc.nextId) || doc.nextId < 1) {
    push('I6', `nextId ${String(doc.nextId)} is not a positive integer`);
  }
  const seen = new Set<number>();
  const ids = [...doc.objects, ...doc.claims, ...doc.assumptions].map((x) => x.id);
  for (const id of ids) {
    if (seen.has(id)) push('I6', `id #${String(id)} is used twice`);
    seen.add(id);
    if (!Number.isSafeInteger(id) || id < 1 || id >= doc.nextId) {
      push('I6', `id #${String(id)} was not issued by nextId`);
    }
  }
  for (const l of doc.layers) {
    if (l.id === MAIN_LAYER_ID) continue;
    const n = /^L(\d+)$/u.exec(l.id)?.[1];
    if (n === undefined || Number(n) < 1 || Number(n) >= doc.nextId) {
      push('I6', `layer id "${l.id}" was not issued by nextId`);
    } else if (seen.has(Number(n))) {
      push('I6', `id #${n} is used twice`);
    } else {
      seen.add(Number(n));
    }
  }
}

function checkViews(doc: Document, push: Push): void {
  const ids = new Set(doc.layers.map((l) => l.id));
  const names = new Set<string>();
  for (const v of doc.views) {
    if (names.has(v.name)) push('I7', `view name "${v.name}" is used twice`);
    names.add(v.name);
    for (const id of Object.keys(v.layerVisibility)) {
      if (!ids.has(id)) push('I7', `view "${v.name}" refers to the missing layer "${id}"`);
    }
  }
}
