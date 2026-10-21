import type { EditorState } from '@geomira/editor/state';
import type { DocumentEdit } from '@geomira/editor/edit';
import type { Style } from '@geomira/kernel/document';
import type { EditorStore } from '../store';

export interface StylePanelProps {
  readonly store: EditorStore;
  readonly state: EditorState;
}

const COLOURS = ['', 'black', 'gray', 'red', 'blue', 'green', 'orange', 'purple', 'brown', 'teal'];

/** A style patch: a field set to undefined is removed (exactOptionalPropertyTypes). */
type Patch = { readonly [K in keyof Style]?: Style[K] | undefined };

/** The style with the patch applied, absent fields left out. */
function restyle(s: Style, patch: Patch): Style {
  const x: Patch = { ...s, ...patch };
  return {
    ...(x.color === undefined ? {} : { color: x.color }),
    ...(x.width === undefined ? {} : { width: x.width }),
    ...(x.dash === undefined ? {} : { dash: x.dash }),
    ...(x.hidden === undefined ? {} : { hidden: x.hidden }),
    ...(x.noimage === undefined ? {} : { noimage: x.noimage }),
    ...(x.label === undefined ? {} : { label: x.label }),
    ...(x.z === undefined ? {} : { z: x.z }),
    ...(x.labelAngle === undefined ? {} : { labelAngle: x.labelAngle }),
    ...(x.labelDist === undefined ? {} : { labelDist: x.labelDist }),
  };
}

function numberOrUndefined(text: string): number | undefined {
  if (text.trim() === '') return undefined;
  const n = Number(text);
  return Number.isFinite(n) ? n : undefined;
}

type NumberKey = 'width' | 'labelAngle' | 'labelDist' | 'z';

const NUMBERS: readonly {
  readonly key: NumberKey;
  readonly label: string;
  readonly min?: number;
}[] = [
  { key: 'width', label: 'Width (px)', min: 0 },
  { key: 'labelAngle', label: 'Label angle (°, empty = automatic)' },
  { key: 'labelDist', label: 'Label distance (px)', min: 0 },
  { key: 'z', label: 'Drawing order z' },
];

interface FieldsProps {
  readonly s: Style;
  readonly set: (p: Patch) => void;
}

function ChoiceFields({ s, set }: FieldsProps) {
  return (
    <>
      <label>
        Colour
        <select
          value={s.color ?? ''}
          onChange={(e) => {
            set({ color: e.target.value === '' ? undefined : e.target.value });
          }}
        >
          {COLOURS.map((c) => (
            <option key={c} value={c}>
              {c === '' ? 'default' : c}
            </option>
          ))}
          {s.color !== undefined && !COLOURS.includes(s.color) && (
            <option value={s.color}>{s.color}</option>
          )}
        </select>
      </label>
      <label>
        Dash
        <select
          value={s.dash ?? 'solid'}
          onChange={(e) => {
            const d = e.target.value;
            set({ dash: d === 'dashed' || d === 'dotted' ? d : undefined });
          }}
        >
          <option value="solid">solid</option>
          <option value="dashed">dashed</option>
          <option value="dotted">dotted</option>
        </select>
      </label>
    </>
  );
}

function FlagFields({ s, set }: FieldsProps) {
  return (
    <>
      <label>
        <input
          type="checkbox"
          checked={s.hidden === true}
          onChange={(e) => {
            set({ hidden: e.target.checked ? true : undefined });
          }}
        />
        Hidden
      </label>
      <label>
        <input
          type="checkbox"
          checked={s.noimage === true}
          onChange={(e) => {
            set({ noimage: e.target.checked ? true : undefined });
          }}
        />
        No image in derived layers (noimage)
      </label>
      <label>
        Label text
        <input
          type="text"
          value={s.label ?? ''}
          onChange={(e) => {
            set({ label: e.target.value === '' ? undefined : e.target.value });
          }}
        />
      </label>
    </>
  );
}

function NumberFields({ s, set }: FieldsProps) {
  return (
    <>
      {NUMBERS.map((f) => (
        <label key={f.key}>
          {f.label}
          <input
            type="number"
            min={f.min}
            value={s[f.key] ?? ''}
            onChange={(e) => {
              set({ [f.key]: numberOrUndefined(e.target.value) });
            }}
          />
        </label>
      ))}
    </>
  );
}

/**
 * Style of the selected objects (SPEC §15): colour, width, dash, hidden, noimage (left out of
 * derived layers), label text and offset (angle, pixels), z. Each change is one style edit of
 * every selected object (a batch: one history entry), so it is in the text.
 */
export function StylePanel({ store, state }: StylePanelProps) {
  const objects = state.doc.objects.filter((o) => state.selection.includes(o.id));
  const first = objects[0];
  if (first === undefined) return <p className="muted">Select an object to style it.</p>;
  const set = (patch: Patch) => {
    const edits: DocumentEdit[] = objects.map((o) => ({
      kind: 'style',
      id: o.id,
      style: restyle(o.style, patch),
    }));
    store.apply({ kind: 'batch', label: 'style', edits });
  };
  return (
    <div className="style-panel">
      <p>{objects.map((o) => o.name).join(', ')}</p>
      <ChoiceFields s={first.style} set={set} />
      <FlagFields s={first.style} set={set} />
      <NumberFields s={first.style} set={set} />
    </div>
  );
}
