import { helpersFrozenAt, isFrozenTestFile } from './files';
import { violation, type Git, type Violation } from './types';

/** Inputs of rule (e). `adrExists('0007')` tells whether docs/adr/0007-*.md exists. */
export interface AddOnlyInput {
  readonly git: Git;
  readonly root: string;
  readonly adrExists: (id: string) => boolean;
}

/** A line present at the tag and gone (deleted or modified) now; `line` is at the tag. */
export interface RemovedLine {
  readonly line: number;
  readonly text: string;
}

/** Removed lines of a unified diff (`-` lines inside hunks), numbered on the old side. */
export function removedLines(diff: string): RemovedLine[] {
  const removed: RemovedLine[] = [];
  let oldLine = 0;
  let inHunk = false;
  for (const raw of diff.split('\n')) {
    const hunk = /^@@ -(\d+)(?:,\d+)? \+\d+(?:,\d+)? @@/.exec(raw);
    if (hunk !== null) {
      oldLine = Number(hunk[1]);
      inHunk = true;
    } else if (!inHunk || raw.startsWith('\\')) {
      continue;
    } else if (raw.startsWith('-')) {
      removed.push({ line: oldLine, text: raw.slice(1) });
      oldLine++;
    } else if (raw.startsWith(' ')) {
      oldLine++;
    } else if (!raw.startsWith('+')) {
      inHunk = false;
    }
  }
  return removed;
}

/** ADR ids (`NNNN`) referenced as `ADR-NNNN` in a commit message. */
export function adrReferences(message: string): string[] {
  return [...message.matchAll(/\bADR-(\d{4})\b/g)].map((m) => m[1] ?? '');
}

/** The most recent `run-*` tag by version order (run-10 after run-9), if any. */
export function latestRunTag(git: Git, root: string): string | undefined {
  const tags = git(root, ['tag', '--list', 'run-*', '--sort=-version:refname']);
  const first = tags.stdout.split('\n').find((t) => t.trim().length > 0);
  return tags.ok && first !== undefined ? first.trim() : undefined;
}

function gitOrThrow(git: Git, root: string, args: readonly string[]): string {
  const result = git(root, ['-c', 'core.quotePath=false', ...args]);
  if (!result.ok) throw new Error(`git ${args.join(' ')} failed: ${result.stderr.trim()}`);
  return result.stdout;
}

interface CommitTouch {
  readonly hash: string;
  readonly message: string;
  readonly deletes: boolean;
}

/** Non-merge commits after `tag` touching `file`, with whether each deletes lines in it. */
function commitsTouching(input: AddOnlyInput, tag: string, file: string): CommitTouch[] {
  const log = gitOrThrow(input.git, input.root, [
    'log',
    '--no-merges',
    '--numstat',
    '--format=%x1e%H%x00%B%x00',
    `${tag}..HEAD`,
    '--',
    file,
  ]);
  return log
    .split('\x1e')
    .filter((record) => record.trim().length > 0)
    .map((record) => {
      const [hash = '', message = '', stats = ''] = record.split('\0');
      const deletes = stats
        .split('\n')
        .map((l) => l.split('\t'))
        .some((cols) => cols.length >= 3 && cols[1] !== '0');
      return { hash, message, deletes };
    });
}

/** Why the removal of lines from `file` is not justified, or undefined if it is. */
function unjustified(input: AddOnlyInput, tag: string, file: string): string | undefined {
  const uncommitted = gitOrThrow(input.git, input.root, ['diff', '-U0', 'HEAD', '--', file]);
  if (removedLines(uncommitted).length > 0) {
    return 'uncommitted changes delete or modify lines; commit them with a message citing ADR-NNNN';
  }
  const deleting = commitsTouching(input, tag, file).filter((c) => c.deletes);
  if (deleting.length === 0) {
    return 'lines were removed without a commit of their own (for example in a merge)';
  }
  for (const commit of deleting) {
    const refs = adrReferences(commit.message);
    if (!refs.some((id) => input.adrExists(id))) {
      const cited =
        refs.length === 0 ? 'cites no ADR' : `cites ADR-${refs.join(', ADR-')} (missing)`;
      return `commit ${commit.hash.slice(0, 10)} deletes or modifies lines and ${cited}`;
    }
  }
  return undefined;
}

/**
 * Rule (e), the ADD-ONLY GUARD: every frozen test file present at the latest `run-*` tag
 * may only gain lines (from run-10 every file under test/ and e2e/ except snapshots,
 * ADR-0021; before it `*.test.ts(x)` and `*.spec.ts(x)` only). A deleted file or any deleted or modified line fails, unless each
 * commit that removed lines cites `ADR-NNNN` for an ADR that exists in docs/adr/.
 * A shallow clone cannot be checked and fails (the guard never switches off silently).
 */
export function checkAddOnly(input: AddOnlyInput): Violation[] {
  const shallow = input.git(input.root, ['rev-parse', '--is-shallow-repository']);
  if (!shallow.ok) {
    return [violation('add-only', '.', 0, `not a git work tree: ${shallow.stderr.trim()}`)];
  }
  if (shallow.stdout.trim() !== 'false') {
    return [violation('add-only', '.', 0, 'shallow clone: fetch full history and tags')];
  }
  const tag = latestRunTag(input.git, input.root);
  if (tag === undefined) return [];
  const helpers = helpersFrozenAt(tag);
  const frozen = gitOrThrow(input.git, input.root, ['ls-tree', '-r', '-z', '--name-only', tag])
    .split('\0')
    .filter((p) => p.length > 0 && isFrozenTestFile(p, helpers));
  const found: Violation[] = [];
  for (const file of frozen) {
    const removed = removedLines(
      gitOrThrow(input.git, input.root, ['diff', '-U0', tag, '--', file]),
    );
    const first = removed[0];
    if (first === undefined) continue;
    const reason = unjustified(input, tag, file);
    if (reason !== undefined) {
      const what = `${String(removed.length)} line(s) of a test frozen at ${tag} deleted or modified`;
      found.push(violation('add-only', file, first.line, `${what}: ${reason}`));
    }
  }
  return found;
}
