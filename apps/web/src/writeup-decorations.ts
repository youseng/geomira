import {
  StateEffect,
  StateField,
  type EditorState,
  type Range,
  type Text,
} from '@codemirror/state';
import { Decoration, EditorView, WidgetType, type DecorationSet } from '@codemirror/view';
import type { WriteUpFormula, WriteUpLayout } from './writeup-layout';
export const formatted = StateEffect.define<WriteUpLayout | null>();
export const liveMode = StateEffect.define<boolean>();
export const writingFocus = StateEffect.define<boolean>();

class Equation extends WidgetType {
  constructor(
    readonly formula: WriteUpFormula,
    readonly raw: string,
  ) {
    super();
  }
  override eq(other: Equation) {
    return (
      this.raw === other.raw &&
      this.formula.from === other.formula.from &&
      this.formula.html === other.formula.html &&
      this.formula.error === other.formula.error
    );
  }
  toDOM(view: EditorView) {
    const f = this.formula;
    const el: HTMLElement = view.dom.ownerDocument.createElement(f.error ? 'button' : 'span');
    el.className = f.error ? 'writeup-error' : 'writeup-math';
    if (f.error) {
      el.textContent = this.raw;
      el.title = f.error;
      el.setAttribute('type', 'button');
      el.setAttribute('aria-label', 'Edit invalid formula. ' + f.error);
    } else {
      // Only KaTeX MathML with trust:false reaches this element.
      el.innerHTML = f.html;
    }
    const edit = () => {
      if (view.state.sliceDoc(f.from, f.to) !== this.raw) return;
      const selection = f.error
        ? { anchor: f.from, head: f.to }
        : { anchor: f.from + (f.display ? 2 : 1) };
      view.dispatch({ selection, effects: writingFocus.of(true), scrollIntoView: true });
      view.focus();
    };
    el.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      edit();
    });
    if (f.error) el.addEventListener('click', edit);
    return el;
  }
}

class Bullet extends WidgetType {
  toDOM(view: EditorView) {
    const span = view.dom.ownerDocument.createElement('span');
    span.textContent = '•';
    return span;
  }
}
const bullet = new Bullet();

export function decorations(
  state: EditorState,
  layout: WriteUpLayout,
  focused: boolean,
): DecorationSet {
  const result: Range<Decoration>[] = [];
  const selection = state.selection.main;
  const start = focused ? state.doc.lineAt(selection.from).from : -1;
  const end = focused ? state.doc.lineAt(selection.to).to : -1;
  for (const line of layout.lines) {
    if (state.doc.lineAt(line.from).from !== line.from) continue;
    const attributes =
      line.level === undefined
        ? { class: 'wu-' + line.kind }
        : {
            class: 'wu-heading wu-h' + String(line.level),
            role: 'heading',
            'aria-level': String(line.level),
          };
    result.push(Decoration.line({ attributes }).range(line.from));
  }
  for (const m of layout.marks) {
    if (m.to <= m.from) continue;
    const visible = m.kind !== 'syntax' || (focused && m.to >= start && m.from <= end);
    const deco = visible
      ? Decoration.mark({ class: 'wu-' + m.kind })
      : Decoration.replace(m.bullet ? { widget: bullet } : {});
    result.push(deco.range(m.from, m.to));
  }
  for (const f of layout.formulas) {
    if (focused && selection.to > f.from && selection.from < f.to) continue;
    const widget = new Equation(f, state.sliceDoc(f.from, f.to));
    result.push(Decoration.replace({ widget }).range(f.from, f.to));
  }
  return Decoration.set(result, true);
}

interface Presentation {
  readonly layout: WriteUpLayout | null;
  readonly doc: Text | null;
  readonly live: boolean;
  readonly focused: boolean;
  readonly ranges: DecorationSet;
}

/** Decoration ranges live in the same coordinate system as Undo and the selection.
 * Map the existing presentation across typing, including IME edits, until reformatting. */
export const presentation = StateField.define<Presentation>({
  create: () => ({ layout: null, doc: null, live: true, focused: false, ranges: Decoration.none }),
  update(previous, tr) {
    let { layout, doc, live, focused } = previous;
    if (tr.docChanged) {
      layout = null;
      doc = null;
    }
    for (const effect of tr.effects) {
      if (effect.is(formatted)) {
        layout = effect.value;
        doc = tr.newDoc;
      }
      if (effect.is(liveMode)) live = effect.value;
      if (effect.is(writingFocus)) focused = effect.value;
    }
    if (
      !tr.selection &&
      doc === previous.doc &&
      live === previous.live &&
      focused === previous.focused &&
      layout === previous.layout &&
      !tr.docChanged
    )
      return previous;
    let ranges = Decoration.none;
    if (live && layout) ranges = decorations(tr.state, layout, focused);
    else if (live && !doc && previous.live) ranges = previous.ranges.map(tr.changes);
    return { layout, doc, live, focused, ranges };
  },
  provide: (field) => [
    EditorView.decorations.from(field, (v) => v.ranges),
    EditorView.contentAttributes.from(field, (v) => ({
      'aria-label': v.live ? 'Write-up editor' : 'Write-up source',
      'aria-multiline': 'true',
      spellcheck: 'false',
      autocapitalize: 'off',
    })),
    EditorView.editorAttributes.from(field, (v) => ({
      'data-writing-mode': v.live ? 'live' : 'source',
    })),
  ],
});

export function editAdjacent(view: EditorView, forward: boolean): boolean {
  const { layout, live } = view.state.field(presentation);
  const sel = view.state.selection.main;
  if (!live || !sel.empty) return false;
  const f = layout?.formulas.find((item) => (forward ? item.from : item.to) === sel.head);
  if (!f) return false;
  view.dispatch({ selection: { anchor: sel.head + (forward ? 1 : -1) }, scrollIntoView: true });
  return true;
}
