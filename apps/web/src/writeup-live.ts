import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { EditorState, Transaction } from '@codemirror/state';
import {
  EditorView,
  keymap,
  highlightActiveLine,
  placeholder,
  type ViewUpdate,
} from '@codemirror/view';
import type { EditorStore } from './store';
import {
  editAdjacent,
  formatted,
  liveMode,
  presentation,
  writingFocus,
} from './writeup-decorations';
import { createWriteUpFormatter } from './writeup-layout';

const mathKeys = [
  { key: 'ArrowLeft', run: (view: EditorView) => editAdjacent(view, false) },
  { key: 'ArrowRight', run: (view: EditorView) => editAdjacent(view, true) },
  { key: 'Backspace', run: (view: EditorView) => editAdjacent(view, false) },
  { key: 'Delete', run: (view: EditorView) => editAdjacent(view, true) },
];

/** One editor state for both modes. The document store owns the source and the
 * browser editor owns selection, Undo, clipboard, composition and text navigation. */
export class WriteUpLive {
  private readonly view: EditorView;
  private readonly format = createWriteUpFormatter();
  private visible = false;
  private queued = false;
  private destroyed = false;

  constructor(
    parent: HTMLElement,
    private store: EditorStore,
    private report: (message: string) => void,
  ) {
    this.view = new EditorView({
      parent,
      state: EditorState.create({
        doc: store.getSnapshot().writeUp,
        extensions: [
          EditorState.lineSeparator.of('\n'),
          history(),
          highlightActiveLine(),
          EditorView.lineWrapping,
          presentation,
          keymap.of([...mathKeys, ...historyKeymap, ...defaultKeymap]),
          placeholder('Write your solution…'),
          EditorView.updateListener.of((update) => {
            this.changed(update);
          }),
          EditorView.domEventObservers({
            compositionstart: () => {
              store.writeUpComposing = true;
            },
            compositionend: () => {
              store.writeUpComposing = false;
              this.schedule();
            },
          }),
        ],
      }),
    });
  }

  private changed(update: ViewUpdate) {
    if (update.docChanged) this.store.setWriteUp(update.state.sliceDoc());
    if (update.docChanged || update.focusChanged) this.schedule();
  }

  private schedule() {
    if (this.queued || this.destroyed || !this.visible) return;
    this.queued = true;
    queueMicrotask(() => {
      this.queued = false;
      if (this.destroyed || !this.visible || this.store.writeUpComposing) return;
      const { state, hasFocus } = this.view;
      const current = state.field(presentation);
      if (!current.live) return;
      const effects = [];
      if (current.focused !== hasFocus) effects.push(writingFocus.of(hasFocus));
      if (current.doc !== state.doc) {
        try {
          effects.push(formatted.of(this.format(state.sliceDoc())));
          this.report('');
        } catch (error) {
          effects.push(formatted.of(null));
          this.report(error instanceof Error ? error.message : 'Live formatting is unavailable.');
        }
      }
      if (effects.length) this.view.dispatch({ effects });
    });
  }

  update(visible: boolean, live: boolean) {
    if (visible && !this.visible) this.view.requestMeasure();
    this.visible = visible;
    const source = this.store.getSnapshot().writeUp;
    const state = this.view.state;
    const modeChanged = live !== state.field(presentation).live;
    if (source !== state.sliceDoc()) {
      this.view.dispatch({
        changes: { from: 0, to: state.doc.length, insert: source },
        effects: liveMode.of(live),
        annotations: Transaction.addToHistory.of(false),
      });
    } else if (modeChanged) this.view.dispatch({ effects: liveMode.of(live) });
    this.schedule();
  }

  focus() {
    this.view.focus();
  }
  destroy() {
    this.destroyed = true;
    this.store.writeUpComposing = false;
    this.view.destroy();
  }
}
