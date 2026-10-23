/**
 * The style card's rows (ADR-0029), each a control over the draft: colour swatches and a
 * custom colour, the width and opacity sliders with their values, the label's "show" and
 * text, "shown"; behind "More": dash, z, the label's angle and distance, noimage. Each row
 * shows the effective value (`shown`: the inherited style with the draft on top).
 */
import { useState } from 'react';
import type { Style } from '@geomira/kernel/document';
import { NAMED_COLOURS } from '@geomira/scene/palette';
import { LIGHT_THEME } from './render';
import { patchStyle, setField, type CardKind } from './style-draft';
import {
  defaultLabel,
  labelShown,
  LINE_WIDTH,
  OPACITY,
  opacityShown,
  ownLabel,
  POINT_SIZE,
  rangeFor,
  sliderText,
  typedNumber,
  widthShown,
  withLabel,
  withVisible,
  type Range,
} from './style-values';

/** The swatches, Geomdraw's named colours (the scene's palette draws them). */
export const SWATCHES = [
  'black',
  'gray',
  'red',
  'blue',
  'green',
  'orange',
  'purple',
  'brown',
  'teal',
] as const;

export interface RowProps {
  readonly name: string;
  readonly kind: CardKind;
  readonly draft: Style;
  readonly inherited: Style;
  readonly set: (s: Style) => void;
}

function shownOf(p: RowProps): Style {
  return { ...p.inherited, ...p.draft };
}

/** The hex value of a colour for the colour picker (#rrggbb), the ink when it has none. */
function pickerHex(c: string | undefined): string {
  const named = c === undefined ? undefined : NAMED_COLOURS[c.trim().toLowerCase()];
  const hex = named ?? c ?? LIGHT_THEME.foreground;
  return /^#[0-9a-f]{6}$/iu.test(hex) ? hex.toLowerCase() : LIGHT_THEME.foreground;
}

export function ColourRow(p: RowProps) {
  const c = shownOf(p).color;
  const current = c?.trim().toLowerCase() === 'grey' ? 'gray' : c?.trim().toLowerCase();
  const choose = (v: string) => {
    p.set(setField(p.draft, 'color', v, p.inherited.color));
  };
  return (
    <div className="sc-row">
      <span className="sc-lab">Colour</span>
      <span className="swatches" role="group" aria-label="Colour">
        {SWATCHES.map((s) => (
          <button
            key={s}
            type="button"
            className="swatch"
            title={s}
            aria-label={s}
            aria-pressed={current === s}
            style={{ background: NAMED_COLOURS[s] }}
            onClick={() => {
              choose(s);
            }}
          />
        ))}
        <label className="swatch custom" title="Custom colour" style={{ background: pickerHex(c) }}>
          <input
            type="color"
            aria-label="Custom colour"
            value={pickerHex(c)}
            onChange={(e) => {
              choose(e.target.value);
            }}
          />
        </label>
      </span>
    </div>
  );
}

function Slider(props: {
  readonly label: string;
  readonly range: Range;
  readonly value: number;
  readonly onValue: (v: number) => void;
}) {
  const { label, range, value } = props;
  return (
    <div className="sc-row">
      <span className="sc-lab">{label}</span>
      <input
        type="range"
        aria-label={label}
        min={range.min}
        max={range.max}
        step={range.step}
        value={value}
        onChange={(e) => {
          // Two decimals: the steps are 0.1 and 0.05, and the text keeps what is shown.
          props.onValue(Number(Number(e.target.value).toFixed(2)));
        }}
      />
      <output className="sc-val">{sliderText(value)}</output>
    </div>
  );
}

export function WidthRow(p: RowProps) {
  const w = widthShown(shownOf(p), p.kind);
  const point = p.kind === 'point';
  return (
    <Slider
      label={point ? 'Point size' : 'Line width'}
      range={rangeFor(point ? POINT_SIZE : LINE_WIDTH, w)}
      value={w}
      onValue={(v) => {
        p.set(setField(p.draft, 'width', v, widthShown(p.inherited, p.kind)));
      }}
    />
  );
}

export function OpacityRow(p: RowProps) {
  return (
    <Slider
      label="Opacity"
      range={OPACITY}
      value={opacityShown(shownOf(p))}
      onValue={(v) => {
        p.set(setField(p.draft, 'opacity', v, opacityShown(p.inherited)));
      }}
    />
  );
}

/** "show" and the label's text (kept while hidden, so showing again brings it back). */
export function LabelRow(p: RowProps) {
  const [text, setText] = useState(() => ownLabel(p.draft));
  const on = labelShown(shownOf(p), p.kind);
  return (
    <div className="sc-row">
      <span className="sc-lab">Label</span>
      <label className="sc-check">
        <input
          type="checkbox"
          aria-label="Show the label"
          checked={on}
          onChange={(e) => {
            p.set(withLabel(p.draft, p.inherited, p.kind, p.name, { on: e.target.checked, text }));
          }}
        />
        show
      </label>
      <input
        type="text"
        className="sc-text"
        aria-label="Label text"
        placeholder={defaultLabel(p.inherited, p.name)}
        value={text}
        disabled={!on}
        onChange={(e) => {
          setText(e.target.value);
          p.set(
            withLabel(p.draft, p.inherited, p.kind, p.name, { on: true, text: e.target.value }),
          );
        }}
      />
    </div>
  );
}

export function VisibleRow(p: RowProps) {
  return (
    <div className="sc-row">
      <span className="sc-lab">Visible</span>
      <label className="sc-check">
        <input
          type="checkbox"
          aria-label="Shown"
          checked={shownOf(p).hidden !== true}
          onChange={(e) => {
            p.set(withVisible(p.draft, p.inherited, e.target.checked));
          }}
        />
        shown
      </label>
    </div>
  );
}

/** A number typed as text (an intermediate "-" or "1." is kept); empty removes the field. */
export function NumberField(props: {
  readonly label: string;
  readonly value: number | undefined;
  readonly min: number;
  readonly onValue: (v: number | undefined) => void;
}) {
  const [text, setText] = useState(props.value === undefined ? '' : String(props.value));
  return (
    <label className="sc-number">
      {props.label}
      <input
        type="text"
        inputMode="decimal"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          const n = typedNumber(e.target.value, props.min);
          if (n !== null) props.onValue(n);
        }}
      />
    </label>
  );
}

/** "More": the dash of a curve (solid is the default). */
export function DashField(p: RowProps) {
  const base = p.inherited.dash ?? 'solid';
  return (
    <label className="sc-number">
      Dash
      <select
        value={shownOf(p).dash ?? 'solid'}
        onChange={(e) => {
          const d = e.target.value;
          const dash = d === 'dashed' || d === 'dotted' ? d : 'solid';
          p.set(setField(p.draft, 'dash', dash, base));
        }}
      >
        <option value="solid">solid</option>
        <option value="dashed">dashed</option>
        <option value="dotted">dotted</option>
      </select>
    </label>
  );
}

/** "More": the drawing order z (empty: the default, 0). */
export function ZField(p: RowProps) {
  return (
    <NumberField
      label="Drawing order z"
      value={p.draft.z}
      min={Number.NEGATIVE_INFINITY}
      onValue={(v) => {
        p.set(patchStyle(p.draft, { z: v }));
      }}
    />
  );
}

/** "More": the label's angle (empty: automatic) and distance (empty: the kind's default). */
export function OffsetFields(p: RowProps) {
  return (
    <>
      <NumberField
        label="Label angle (°, empty = automatic)"
        value={p.draft.labelAngle}
        min={Number.NEGATIVE_INFINITY}
        onValue={(v) => {
          p.set(patchStyle(p.draft, { labelAngle: v }));
        }}
      />
      <NumberField
        label="Label distance (px)"
        value={p.draft.labelDist}
        min={0}
        onValue={(v) => {
          p.set(patchStyle(p.draft, { labelDist: v }));
        }}
      />
    </>
  );
}

/** "More": noimage, the object's own flag (derived layers read it from the object itself). */
export function NoImageField(p: RowProps) {
  return (
    <label className="sc-check">
      <input
        type="checkbox"
        checked={p.draft.noimage === true}
        onChange={(e) => {
          p.set(patchStyle(p.draft, { noimage: e.target.checked ? true : undefined }));
        }}
      />
      No image in derived layers (noimage)
    </label>
  );
}
