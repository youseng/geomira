/**
 * The editor's side of discovery (ADR-0035, ADR-0036): turning a job's result into ONE edit.
 * "Add as claim" is one `addClaim` (in the text, undoable), a class's links one batch; applying a branch fix is one batch of
 * `redefine` edits (one history entry); the GUI selector choice (choice.ts, SPEC §7) is what the
 * branch-fix job writes selectors with, handed to it as its `choose` (the worker passes it:
 * packages/discovery cannot import the editor, SPEC §2).
 */
import type { Fix } from '@geomira/discovery/branch-fix';
import { claimArgsOf, type Chooser, type Fact } from '@geomira/discovery/types';
import { chooseSelectors } from './choice';
import type { Edit } from './edit';

type FactData = Pick<Fact, 'kind' | 'args'>;

/**
 * The edit that adds a reported fact as a claim; a class (AB = CD = EF, ADR-0039) adds the
 * claims of its links, as one batch (one history entry).
 */
export function factEdit(fact: FactData & { readonly chain?: readonly FactData[] }): Edit {
  const add = (f: FactData): Extract<Edit, { kind: 'addClaim' }> => ({
    kind: 'addClaim',
    claim: { kind: f.kind, args: claimArgsOf(f) },
  });
  if (fact.chain === undefined) return add(fact);
  return { kind: 'batch', label: 'add claims', edits: fact.chain.map(add) };
}

/** The edit that applies a branch fix: its redefinitions, as one batch. */
export function branchFixEdit(fix: Pick<Fix, 'edits'>): Edit {
  return {
    kind: 'batch',
    label: 'apply branch fix',
    edits: fix.edits.map((e) => ({ kind: 'redefine', id: e.id, def: e.def })),
  };
}

/** The GUI selector choice as the branch-fix job's chooser. */
export const branchChooser: Chooser = (doc, values, registry, tool, argIds, click) =>
  chooseSelectors(doc, values, registry, tool, argIds, click);
