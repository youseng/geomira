import { AVAILABLE_GROUPS } from './available-tools';
import { chooseTool } from '@geomira/editor/selection-tool';
import { useState, type KeyboardEvent } from 'react';
import type { ToolId } from '@geomira/editor/tool-state';
import { useViewport } from './workspace';
import { claimToolKinds, stepsOf } from '@geomira/editor/machine';
import { toolValue } from '@geomira/editor/claim-tool';
import { toolPrompt } from '@geomira/editor/prompt';
import type { EditorState } from '@geomira/editor/state';
import { keyCap } from '@geomira/editor/tool-groups';
import { toolUI, type ToolUI } from '@geomira/editor/tools';
import { SrOnly, ToolIcon } from './icons';
import type { EditorStore } from './store';

export interface ToolBarProps {
  readonly store: EditorStore;
  readonly state: EditorState;
  readonly onChoose?: (id: ToolId) => void;
}

/**
 * The tool palette (Geomdraw's left column; on a phone a strip along the bottom): the editor's
 * tools in their labelled groups (packages/editor tool-groups), each an icon with its
 * shortcut letter and a tooltip from the tool table; its accessible name is the tool's label.
 */
export function Palette({ store, state, onChoose }: ToolBarProps) {
  const [focus, setFocus] = useState<ToolId>('move');
  const horizontal = useViewport().width <= 760;
  const navigate = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!(e.target instanceof HTMLButtonElement)) return;
    const buttons = [...e.currentTarget.querySelectorAll<HTMLButtonElement>('button[data-tool]')];
    const index = buttons.indexOf(e.target);
    const forward = horizontal ? 'ArrowRight' : 'ArrowDown';
    const backward = horizontal ? 'ArrowLeft' : 'ArrowUp';
    const next =
      e.key === 'Home'
        ? 0
        : e.key === 'End'
          ? buttons.length - 1
          : e.key === forward
            ? (index + 1) % buttons.length
            : e.key === backward
              ? (index + buttons.length - 1) % buttons.length
              : undefined;
    if (next !== undefined) {
      e.preventDefault();
      buttons[next]?.focus();
    }
  };
  return (
    <nav className="palette" aria-label="Tool palette">
      <div
        role="toolbar"
        aria-label="Tools"
        aria-orientation={horizontal ? 'horizontal' : 'vertical'}
        onKeyDown={navigate}
      >
        {AVAILABLE_GROUPS.map((g) => (
          <div key={g.id} className="pgroup" role="group" aria-label={g.label}>
            <h4 aria-hidden="true">{g.label}</h4>
            <div className="pgrid">
              {g.tools.map((t) => (
                <PaletteTool
                  key={t.id}
                  tool={t}
                  state={state}
                  focused={focus === t.id}
                  onFocus={() => {
                    setFocus(t.id);
                  }}
                  onChoose={() => {
                    if (onChoose !== undefined) onChoose(t.id);
                    else store.run((s, env) => chooseTool(s, t.id, env));
                  }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </nav>
  );
}

function PaletteTool({
  tool: t,
  state,
  focused,
  onFocus,
  onChoose,
}: {
  readonly tool: ToolUI;
  readonly state: EditorState;
  readonly focused: boolean;
  readonly onFocus: () => void;
  readonly onChoose: () => void;
}) {
  return (
    <button
      type="button"
      className="tool"
      data-tool={t.id}
      tabIndex={focused ? 0 : -1}
      aria-pressed={state.tool === t.id}
      onFocus={onFocus}
      title={`${t.label}: ${t.help} (key ${keyCap(t.key)})`}
      onClick={onChoose}
    >
      <ToolIcon tool={t.id} />
      <span className="k" aria-hidden="true">
        {keyCap(t.key)}
      </span>
      <SrOnly>{t.label}</SrOnly>
    </button>
  );
}

function TextInput({ store }: { store: EditorStore }) {
  const [value, setValue] = useState('');
  return (
    <form
      className="tool-text"
      onSubmit={(e) => {
        e.preventDefault();
        if (store.input({ kind: 'text', value }).ok) setValue('');
      }}
    >
      <input
        type="text"
        aria-label="Text to place"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
        }}
      />
      <button type="submit" className="tb small-tb">
        Place
      </button>
    </form>
  );
}

function ClaimKind({ store, state }: ToolBarProps) {
  return (
    <select
      aria-label="Claim kind"
      value={state.toolState.claimKind}
      onChange={(e) => {
        store.apply({ kind: 'tool', tool: 'claim', claimKind: e.target.value });
      }}
    >
      {claimToolKinds().map((k) => (
        <option key={k} value={k}>
          {k}
        </option>
      ))}
    </select>
  );
}

/**
 * The number a tool asks for (rotate's angle, homothety's ratio, a radius), Geomdraw's prompt
 * as a field: it can be typed before or between the picks; the editor reads it at the last.
 */
function ToolValueField({ store, state, tool }: ToolBarProps & { tool: ToolUI }) {
  const value = toolValue(tool, state.toolState);
  if (value === undefined) return null;
  return (
    <label className="tool-value">
      {value.label}
      <input
        type="text"
        inputMode="decimal"
        size={6}
        value={state.toolState.value}
        onChange={(e) => {
          store.apply({ kind: 'toolValue', value: e.target.value });
        }}
      />
    </label>
  );
}

/**
 * A map tool's switch (Run 13, ADR-0031): build the transformation itself (`f = reflect(l)`),
 * to apply it later or to make a layer from it, instead of one object's image.
 */
function MapOnlyField({ store, state, tool }: ToolBarProps & { tool: ToolUI }) {
  if (tool.map !== true) return null;
  return (
    <label className="tool-value">
      <input
        type="checkbox"
        checked={state.toolState.mapOnly === true}
        onChange={(e) => {
          store.apply({ kind: 'toolMapOnly', on: e.target.checked });
        }}
      />
      Transformation only
    </label>
  );
}

/**
 * The active tool's controls in the stage footer include the claim tool's
 * kind, the text tool's string, a map tool's "Transformation only", the tool's number, Finish
 * and Cancel; shown only when the tool has one.
 */
export function ToolHint({ store, state }: ToolBarProps) {
  const tool = toolUI(state.tool);
  const ts = state.toolState;
  const hasRest = tool !== undefined && stepsOf(tool, ts).rest !== undefined;
  const text = tool?.build.kind === 'text' && ts.picks.length > 0;
  const value = (tool !== undefined && toolValue(tool, ts) !== undefined) || tool?.map === true;
  const cancel = ts.picks.length > 0;
  if (state.tool !== 'claim' && !text && !hasRest && !cancel && !value) return null;
  return (
    <div className="tool-hint">
      {state.tool === 'claim' && <ClaimKind store={store} state={state} />}
      {text && <TextInput store={store} />}
      {tool !== undefined && <MapOnlyField store={store} state={state} tool={tool} />}
      {tool !== undefined && <ToolValueField store={store} state={state} tool={tool} />}
      {hasRest && (
        <button
          type="button"
          className="tb small-tb"
          onClick={() => {
            store.input({ kind: 'finish' });
          }}
        >
          Finish
        </button>
      )}
      {cancel && (
        <button
          type="button"
          className="tb small-tb"
          onClick={() => {
            store.input({ kind: 'cancel' });
          }}
        >
          Cancel picks
        </button>
      )}
    </div>
  );
}

/** The status line (bottom left of the canvas): the active tool's prompt. */
export function StatusLine({ state }: { state: EditorState }) {
  return (
    <div className="statusbar">
      <span role="status" aria-label="Current tool">
        {toolPrompt(state)}
        {state.toolState.picks.length === 0
          ? ''
          : ` · Picked: ${state.toolState.picks.map((id) => state.doc.objects.find((o) => o.id === id)?.name ?? '?').join(', ')}`}
      </span>
    </div>
  );
}
