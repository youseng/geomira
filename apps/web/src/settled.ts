/**
 * The editor state the panels show (note F of Run 9a, SPEC §17 "drag frame ≤ 8 ms"): during a
 * drag, the state from before it, so a drag frame does not print, parse and lay out the whole
 * text, object list and claim rows again; at drag end (or cancel) the panels show the new state.
 * The canvas always draws the current state.
 */
import { useRef } from 'react';
import type { EditorState } from '@geomira/editor/state';

/** The last state without a drag in progress (the current one when no drag is in progress). */
export function useSettled(state: EditorState): EditorState {
  const settled = useRef(state);
  if (state.drag === null) settled.current = state;
  return settled.current;
}
