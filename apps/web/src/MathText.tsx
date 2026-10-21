import { Fragment } from 'react';
import { parseLabel, type LabelRun } from '@geomira/scene/label-text';

/**
 * Point names of the language (SPEC §11.2: an uppercase letter, digits or `_` + a group,
 * primes, an image's stars) and Greek names with their primes and stars (ω*), inside a printed
 * statement; presentation only: each is drawn with the canvas's label grammar (scene's
 * parseLabel), so M_a reads M with a subscript a and A* a raised star.
 */
const POINT_NAME =
  /(?:[A-Z](?:\d+|_(?:\d+|[A-Za-z]|\{[A-Za-z0-9]+\}))?|[\u03B1-\u03C9\u0391-\u03A9])'*\**/gu;

function Runs({ runs }: { runs: readonly LabelRun[] }) {
  return (
    <>
      {runs.map((r, i) =>
        r.pos === 'sub' ? (
          <sub key={i}>{r.text}</sub>
        ) : r.pos === 'sup' ? (
          <sup key={i}>{r.text}</sup>
        ) : (
          <Fragment key={i}>{r.text}</Fragment>
        ),
      )}
    </>
  );
}

/** A statement in italic math, its point names with real sub- and superscripts. */
export function MathText({ text }: { text: string }) {
  const parts: { text: string; name: boolean }[] = [];
  let at = 0;
  for (const m of text.matchAll(POINT_NAME)) {
    if (m.index > at) parts.push({ text: text.slice(at, m.index), name: false });
    parts.push({ text: m[0], name: true });
    at = m.index + m[0].length;
  }
  if (at < text.length) parts.push({ text: text.slice(at), name: false });
  return (
    <span className="math">
      {parts.map((p, i) =>
        p.name ? <Runs key={i} runs={parseLabel(p.text)} /> : <Fragment key={i}>{p.text}</Fragment>,
      )}
    </span>
  );
}
