/**
 * The style card (ADR-0029, Geomdraw's right-click properties card): a small floating card
 * next to the object it styles, opened by a right-click (or a long press) on the object on
 * the canvas or on its row in the Objects panel. It edits a DRAFT: the canvas previews the
 * draft (a transient render override, like the live tool preview of ADR-0024: no edit, not in
 * history); "Write to script" applies it as ONE style edit; "Reset" sets the draft back to the
 * default style; closing the card (✕, Escape, a press elsewhere, another object's card)
 * discards an unwritten draft. The Name field at the top (ADR-0046) renames the object in the
 * same write: name and style are ONE edit (style-name.ts, @geomira/editor/style-card).
 */
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useState,
  type RefObject,
} from 'react';
import type { EditorState } from '@geomira/editor/state';
import { objectKinds } from '@geomira/kernel/derived';
import type { Registry } from '@geomira/kernel/registry';
import type { DocObject, Document, Style } from '@geomira/kernel/document';
import type { Value, ValueKind } from '@geomira/kernel/value';
import { assertNever } from '@geomira/num/assert';
import { buildScene } from '@geomira/scene/build';
import type { Scene } from '@geomira/scene/types';
import { placeCard, type Box } from './card-place';
import { useDialog } from './Dialogs';
import { MathText } from './MathText';
import type { EditorStore } from './store';
import {
  canReset,
  cardKindOf,
  fieldsOf,
  inheritedStyle,
  kindName,
  type Field,
} from './style-draft';
import { cardWrite, previewDocument, type CardWrite } from './style-name';
import {
  ColourRow,
  DashField,
  LabelRow,
  NoImageField,
  OffsetFields,
  OpacityRow,
  VisibleRow,
  WidthRow,
  ZField,
  type RowProps,
} from './StyleRows';

/** The open card: its object, where it was opened, the draft, and the typed name. */
export interface OpenCard {
  readonly id: number;
  readonly anchor: Box;
  readonly draft: Style;
  /** The Name field's text; absent while untouched (the field shows the current name). */
  readonly name?: string;
}

/** The card's state: open (on an object, next to an anchor), the draft, the name, close. */
export function useStyleCard(store: EditorStore) {
  const [card, setCard] = useState<OpenCard | null>(null);
  const open = useCallback(
    (id: number, anchor: Box) => {
      const o = store.current().doc.objects.find((x) => x.id === id);
      if (o === undefined) return;
      // The same object's card stays as it is (a touch's contextmenu after its long press).
      setCard((c) => (c !== null && c.id === id ? c : { id, anchor, draft: o.style }));
      store.apply({ kind: 'select', ids: [id], mode: 'replace' });
    },
    [store],
  );
  const close = useCallback(() => {
    setCard(null);
  }, []);
  const setDraft = useCallback((draft: Style) => {
    setCard((c) => (c === null ? c : { ...c, draft }));
  }, []);
  /** The typed name; undefined: untouched again (the field follows the object's name). */
  const setName = useCallback((name: string | undefined) => {
    setCard((c) => {
      if (c === null) return c;
      const rest = { id: c.id, anchor: c.anchor, draft: c.draft };
      return name === undefined ? rest : { ...rest, name };
    });
  }, []);
  return { card, open, close, setDraft, setName };
}

/**
 * The scene the canvas draws: the figure's, or with the card's draft over its object (and
 * its typed name, when it can be written).
 */
export function usePreviewScene(
  scene: Scene,
  doc: Document,
  values: ReadonlyMap<number, Value<number>>,
  card: OpenCard | null,
  registry: Registry,
): Scene {
  return useMemo(() => {
    if (card === null) return scene;
    const preview = previewDocument(doc, registry, card.id, card.draft, card.name);
    return preview === doc ? scene : buildScene(preview, values);
  }, [scene, doc, values, card, registry]);
}

/** A press outside the card closes it (a right-click elsewhere then opens another one). */
function useCloseOutside(ref: RefObject<HTMLDivElement | null>, onClose: () => void): void {
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const el = ref.current;
      if (el !== null && e.target instanceof Node && !el.contains(e.target)) onClose();
    };
    addEventListener('pointerdown', onDown, true);
    return () => {
      removeEventListener('pointerdown', onDown, true);
    };
  }, [ref, onClose]);
}

/** The card's position: measured, then placed by its anchor inside the viewport. */
function usePlacement(ref: RefObject<HTMLDivElement | null>, anchor: Box, more: boolean) {
  const [at, setAt] = useState<{ left: number; top: number } | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (el === null) return;
    const size = { width: el.offsetWidth, height: el.offsetHeight };
    setAt(placeCard(anchor, size, { width: innerWidth, height: innerHeight }));
  }, [ref, anchor, more]);
  return at ?? { left: 0, top: 0, visibility: 'hidden' as const };
}

function MainRow({ field, ...p }: RowProps & { readonly field: Field }) {
  switch (field) {
    case 'color':
      return <ColourRow {...p} />;
    case 'width':
      return <WidthRow {...p} />;
    case 'opacity':
      return <OpacityRow {...p} />;
    case 'label':
      return <LabelRow {...p} />;
    case 'visible':
      return <VisibleRow {...p} />;
    default:
      return assertNever(field, 'card field');
  }
}

/** The settings behind "More"; `generation` renews the typed fields after a Reset. */
function More(
  p: RowProps & { readonly generation: number; readonly onToggle: (o: boolean) => void },
) {
  const more = fieldsOf(p.kind).more;
  return (
    <details
      className="sc-more"
      onToggle={(e) => {
        p.onToggle(e.currentTarget.open);
      }}
    >
      <summary>More</summary>
      {more.includes('dash') && <DashField {...p} />}
      {more.includes('z') && <ZField key={`z${String(p.generation)}`} {...p} />}
      {more.includes('labelOffset') && <OffsetFields key={`o${String(p.generation)}`} {...p} />}
      {more.includes('noimage') && <NoImageField {...p} />}
    </details>
  );
}

export interface StyleCardProps {
  readonly store: EditorStore;
  readonly state: EditorState;
  readonly card: OpenCard;
  readonly onDraft: (s: Style) => void;
  /** The Name field changed (ADR-0046); undefined after a write (untouched again). */
  readonly onName: (name: string | undefined) => void;
  readonly onClose: () => void;
}

/** The card of the open object; nothing when the object is gone (the card then closes). */
export function StyleCard(p: StyleCardProps) {
  const o = p.state.doc.objects.find((x) => x.id === p.card.id);
  const gone = o === undefined;
  const { onClose } = p;
  useEffect(() => {
    if (gone) onClose();
  }, [gone, onClose]);
  return o === undefined ? null : <Card {...p} o={o} />;
}

function Header({ o, kind, onClose }: { o: DocObject; kind: string; onClose: () => void }) {
  return (
    <header>
      <b className="sc-name">
        <MathText text={o.name} />
      </b>
      <span className="sc-kind">{kind}</span>
      <button type="button" className="sc-x" title="Close (Esc)" onClick={onClose}>
        <span aria-hidden="true">{'✕'}</span>
        <span className="sr-only">Close the style card</span>
      </button>
    </header>
  );
}

/**
 * The Name field (ADR-0046): the object's name, editable; under it, why a typed name cannot
 * be written (Write is then disabled), or why a managed image's name is fixed (read-only).
 * Enter writes, as the button does.
 */
function NameRow(p: {
  readonly name: string;
  readonly write: CardWrite;
  readonly onName: (name: string) => void;
  readonly onWrite: () => void;
}) {
  const note = useId();
  const { message, fixed } = p.write;
  return (
    <>
      <div className="sc-row">
        <span className="sc-lab">Name</span>
        <input
          type="text"
          className="sc-text sc-name-input"
          aria-label="Name"
          value={p.name}
          readOnly={fixed}
          spellCheck={false}
          autoComplete="off"
          aria-invalid={message !== undefined && !fixed}
          {...(message === undefined ? {} : { 'aria-describedby': note })}
          onChange={(e) => {
            p.onName(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') p.onWrite();
          }}
        />
      </div>
      {message !== undefined && (
        <p id={note} className={fixed ? 'sc-note' : 'sc-note sc-problem'} role="status">
          {message}
        </p>
      )}
    </>
  );
}

/** Reset (to the default style) and Write to script (name and style: one edit). */
function Footer(p: { draft: Style; write: CardWrite; onReset: () => void; onWrite: () => void }) {
  return (
    <footer>
      <button type="button" disabled={!canReset(p.draft)} onClick={p.onReset}>
        Reset
      </button>
      <button type="button" disabled={p.write.edit === null} onClick={p.onWrite}>
        Write to script
      </button>
    </footer>
  );
}

/** The static kind of an object when it has exactly one (an Undefined value's kind). */
function useFixedKind(store: EditorStore, doc: Document, id: number): ValueKind | null {
  return useMemo(() => {
    const ks = objectKinds(doc, store.env.registry).get(id);
    return ks?.length === 1 ? (ks[0] ?? null) : null;
  }, [doc, store, id]);
}

function Card(p: StyleCardProps & { o: DocObject }) {
  const { store, state, card, onDraft, onName, onClose, o } = p;
  const ref = useDialog(onClose);
  useCloseOutside(ref, onClose);
  const [more, setMore] = useState(false);
  const [generation, setGeneration] = useState(0);
  const at = usePlacement(ref, card.anchor, more);
  const inherited = useMemo(() => inheritedStyle(state.doc, o), [state.doc, o]);
  const fixed = useFixedKind(store, state.doc, o.id);
  const value = state.values.values.get(o.id);
  const kind = cardKindOf(value?.kind ?? 'undefined', fixed);
  const fields = fieldsOf(kind);
  const rows: RowProps = { name: o.name, kind, draft: card.draft, inherited, set: onDraft };
  const write = useMemo(
    () => cardWrite(state.doc, store.env.registry, o, card.name, card.draft),
    [state.doc, store, o, card.name, card.draft],
  );
  const onWrite = () => {
    // After a write the field follows the object's name again (an undo shows the old one).
    if (write.edit !== null && store.apply(write.edit).ok) onName(undefined);
  };
  return (
    <div
      ref={ref}
      className="style-card"
      role="dialog"
      aria-label={`Style of ${o.name}`}
      tabIndex={-1}
      style={at}
    >
      <Header o={o} kind={kindName(value, fixed)} onClose={onClose} />
      <div className="sc-rows">
        <NameRow name={card.name ?? o.name} write={write} onName={onName} onWrite={onWrite} />
        {fields.main.map((f) => (
          // The label's typed text is renewed after a Reset.
          <MainRow key={f === 'label' ? `label${String(generation)}` : f} field={f} {...rows} />
        ))}
        {fields.more.length > 0 && <More {...rows} generation={generation} onToggle={setMore} />}
        {kind === 'none' && <p className="muted">Not drawn: nothing to style.</p>}
      </div>
      <Footer
        draft={card.draft}
        write={write}
        onWrite={onWrite}
        onReset={() => {
          onDraft({});
          setGeneration((g) => g + 1);
        }}
      />
    </div>
  );
}
