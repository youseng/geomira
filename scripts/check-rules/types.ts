/** Identifiers of the rules enforced by `pnpm rules` (CLAUDE.md, Run 0 item 3). */
export type RuleId =
  'tolerance' | 'file-length' | 'test-count' | 'disabled-tests' | 'add-only' | 'forbidden-words';

export interface Violation {
  readonly rule: RuleId;
  /** Repository-relative POSIX path, or '.' for repository-wide findings. */
  readonly file: string;
  /** 1-based line, or 0 when the finding is about the whole file or repository. */
  readonly line: number;
  readonly message: string;
}

/** A file of the checked tree, read as UTF-8 text. */
export interface SourceFile {
  readonly path: string;
  readonly text: string;
}

/** Result of running an external command. */
export interface CommandResult {
  readonly ok: boolean;
  readonly stdout: string;
  readonly stderr: string;
}

/** Runs `git <args>` in a working directory. Injected so tests can use throwaway repos. */
export type Git = (cwd: string, args: readonly string[]) => CommandResult;

export function violation(rule: RuleId, file: string, line: number, message: string): Violation {
  return { rule, file, line, message };
}

/** 1-based line number of a character offset. */
export function lineOf(text: string, offset: number): number {
  let line = 1;
  for (let i = 0; i < offset && i < text.length; i++) {
    if (text.charCodeAt(i) === 10) line++;
  }
  return line;
}
