import { useState } from 'react';
import { claimToolKinds, stepsOf } from '@geomira/editor/machine';
import { toolPrompt } from '@geomira/editor/prompt';
import type { EditorState } from '@geomira/editor/state';
import { keyCap, TOOL_GROUPS } from '@geomira/editor/tool-groups';
import { toolUI, type ToolUI } from '@geomira/editor/tools';
import { SrOnly, ToolIcon } from './icons';
import type { EditorStore } from './store';

export interface ToolBarProps {
  readonly store: EditorStore;
  readonly state: EditorState;
}

/**
 * The tool palette (Geomdraw's left column; on a phone a strip along the bottom): the editor's
 * tools in their labelled groups (packages/editor tool-groups), each an icon with its
 * shortcut letter and a tooltip from the tool table; its accessible name is the tool's label.
 */
export function Palette({ store, state }: ToolBarProps) {
  return (
    <nav className="palette" aria-label="Tool palette">
      <div role="toolbar" aria-label="Tools" aria-orientation="vertical">
        {TOOL_GROUPS.map((g) => (
          <div key={g.id} className="pgroup" role="group" aria-label={g.label}>
            <h4 aria-hidden="true">{g.label}</h4>
            <div className="pgrid">
              {g.tools.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className="tool"
                  aria-pressed={state.tool === t.id}
                  title={`${t.label}: ${t.help} (key ${keyCap(t.key)})`}
                  onClick={() => {
                    store.apply({ kind: 'tool', tool: t.id });
                  }}
                >
                  <ToolIcon tool={t.id} />
                  <span className="k" aria-hidden="true">
                    {keyCap(t.key)}
                  </span>
                  <SrOnly>{t.label}</SrOnly>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </nav>
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
  if (tool.value === undefined) return null;
  return (
    <label className="tool-value">
      {tool.value.label}
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
 * The active tool's controls on the canvas (top left, Geomdraw's hint box): the claim tool's
 * kind, the text tool's string, the tool's number, Finish and Cancel; shown only when the tool
 * has one.
 */
export function ToolHint({ store, state }: ToolBarProps) {
  const tool = toolUI(state.tool);
  const ts = state.toolState;
  const hasRest = tool !== undefined && stepsOf(tool, ts).rest !== undefined;
  const text = tool?.build.kind === 'text' && ts.picks.length > 0;
  const value = tool?.value !== undefined;
  const cancel = ts.picks.length > 0;
  if (state.tool !== 'claim' && !text && !hasRest && !cancel && !value) return null;
  return (
    <div className="tool-hint">
      {state.tool === 'claim' && <ClaimKind store={store} state={state} />}
      {text && <TextInput store={store} />}
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
      <span role="status">{toolPrompt(state)}</span>
    </div>
  );
}
