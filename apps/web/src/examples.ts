/// <reference types="vite/client" />
/**
 * The figures of the development page: the eight examples/*.geo files (Run 6), bundled as
 * text at build time, and a generated 300-object figure for frame timing (stress.ts).
 */
import { stressText } from './stress';

const files = import.meta.glob<string>('../../../examples/*.geo', {
  query: '?raw',
  import: 'default',
  eager: true,
});

export interface Example {
  /** The file name without `.geo`, or `stress-300`. */
  readonly id: string;
  readonly text: string;
}

/** The examples sorted by name, then the 300-object stress figure. */
export const EXAMPLES: readonly Example[] = [
  ...Object.entries(files)
    .map(([path, text]) => ({ id: path.replace(/^.*\/|\.geo$/gu, ''), text }))
    .sort((a, b) => a.id.localeCompare(b.id)),
  { id: 'stress-300', text: stressText(300) },
];
