import { describe, expect, it } from 'vitest';
import { print } from '@geomira/lang/print';
import { applyEdit } from '../src/edit';
import { runCommand } from '../src/command';
import { editorOf, env } from './helpers/editor';

describe('singleton directives in atomic command batches', () => {
  it('replaces a title and appends a construction as one undoable edit', () => {
    const before = editorOf('@title "old"\nA=(0,0)');
    const result = runCommand(before, '@title "new"; D=(5,5)', env);
    expect(result.kind).toBe('edit');
    if (result.kind !== 'edit') throw new Error(result.reason);
    expect(result.result.state.doc.meta.title).toBe('new');
    expect(result.result.state.doc.objects.map((o) => o.name)).toEqual(['A', 'D']);
    expect(result.result.state.history.past).toHaveLength(1);
    const undone = applyEdit(result.result.state, { kind: 'undo' }, env);
    expect(undone.ok).toBe(true);
    expect(print(undone.state.doc)).toBe(print(before.doc));
  });

  it('matches sequential title, author and viewport replacements, including repeats', () => {
    const before = editorOf('@title "old"\n@author "old"\n@viewport 0 0 1');
    const pieces = ['@title "first"', '@author "author"', '@viewport 2 3 4', '@title "last"'];
    let sequential = before;
    for (const piece of pieces) {
      const result = runCommand(sequential, piece, env);
      if (result.kind !== 'edit') throw new Error(result.reason);
      sequential = result.result.state;
    }
    const result = runCommand(before, pieces.join('; '), env);
    expect(result.kind).toBe('edit');
    if (result.kind !== 'edit') throw new Error(result.reason);
    expect(print(result.result.state.doc)).toBe(print(sequential.doc));
    expect(result.result.state.history.past).toHaveLength(1);
  });

  it('rolls back the whole batch and maps the bad statement to the original span', () => {
    const before = editorOf('@title "old"\nA=(0,0)');
    const line = '  @title "new"; D=midpoint(A,Missing)';
    const result = runCommand(before, line, env);
    expect(result.kind).toBe('error');
    if (result.kind !== 'error') throw new Error('expected error');
    const diagnostic = result.diagnostics.find((d) => d.message.includes('Missing'));
    expect(diagnostic?.line).toBe(1);
    expect(diagnostic?.column).toBe(line.indexOf('Missing') + 1);
    expect(before.doc.meta.title).toBe('old');
    expect(before.history.past).toHaveLength(0);
  });

  it('does not erase an earlier invalid directive by replacing it later', () => {
    const before = editorOf('@title "old"');
    const result = runCommand(before, '@title 123; @title "valid"', env);
    expect(result.kind).toBe('error');
    if (result.kind === 'error') expect(result.diagnostics[0]?.column).toBeLessThan(12);
  });
});

it('applies a large plain batch with its exact geometry and one undo entry', () => {
  const statements = Array.from(
    { length: 120 },
    (_, i) => `p_${String(i)}=(${String(i)},${String(i * i + 1)})`,
  );
  const before = editorOf('@title "batch"');
  const result = runCommand(before, statements.join('; '), env);
  if (result.kind !== 'edit') throw new Error(result.reason);
  expect(result.result.state.doc.objects).toHaveLength(120);
  expect(print(result.result.state.doc)).toBe(
    print(editorOf(`@title "batch"\n${statements.join('\n')}`).doc),
  );
  expect(result.result.state.history.past).toHaveLength(1);
  const undone = applyEdit(result.result.state, { kind: 'undo' }, env);
  expect(undone.ok).toBe(true);
  expect(print(undone.state.doc)).toBe(print(before.doc));
});
