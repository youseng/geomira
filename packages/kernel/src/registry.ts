/**
 * The tool registry (SPEC §2, §6.1): a VALUE from createRegistry(), passed as a parameter,
 * never a singleton. Overloads are resolved by capability (SPEC §4); a call no signature
 * accepts gets a message listing the available signatures.
 */
import { formatSignature, type Signature, type ToolSpec } from './tool';
import { BUILTIN_TOOLS } from './tools/index';
import { hasCapability } from './value';

export type Resolution =
  | { readonly ok: true; readonly tool: ToolSpec; readonly signature: Signature }
  | { readonly ok: false; readonly reason: string };

export interface Registry {
  /** Every tool, in order: the only enumeration of tools. */
  readonly tools: readonly ToolSpec[];
  get(name: string): ToolSpec | undefined;
  /** The first signature of `name` whose capabilities accept the argument kinds. */
  resolve(name: string, args: readonly { readonly kind: string }[]): Resolution;
}

function accepts(s: Signature, args: readonly { readonly kind: string }[]): boolean {
  if (args.length < s.params.length) return false;
  if (args.length > s.params.length && s.rest === undefined) return false;
  return args.every((a, i) => {
    const cap = s.params[i] ?? s.rest;
    return cap !== undefined && hasCapability(a, cap);
  });
}

/** "midpoint does not accept (point, line); signatures: midpoint(point, point)". */
export function rejection(tool: ToolSpec, args: readonly { readonly kind: string }[]): string {
  const got = args.map((a) => a.kind).join(', ');
  const sigs = tool.signatures.map((s) => formatSignature(tool.name, s)).join(' · ');
  return `${tool.name} does not accept (${got}); signatures: ${sigs}`;
}

/**
 * The v1 tools plus `extra` (tests build extended registries). Degenerate: two tools
 * with the same name → TypeError (a programming error, at construction).
 */
export function createRegistry(extra: readonly ToolSpec[] = []): Registry {
  const tools = Object.freeze([...BUILTIN_TOOLS, ...extra]);
  const byName = new Map<string, ToolSpec>();
  for (const t of tools) {
    if (byName.has(t.name)) throw new TypeError(`two tools are named ${t.name}`);
    byName.set(t.name, t);
  }
  return Object.freeze({
    tools,
    get: (name: string) => byName.get(name),
    resolve: (name: string, args: readonly { readonly kind: string }[]): Resolution => {
      const tool = byName.get(name);
      if (tool === undefined) return { ok: false, reason: `unknown tool "${name}"` };
      const signature = tool.signatures.find((s) => accepts(s, args));
      return signature === undefined
        ? { ok: false, reason: rejection(tool, args) }
        : { ok: true, tool, signature };
    },
  });
}
