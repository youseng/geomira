import { useState } from 'react';
import { claimToolKinds, stepsOf } from '@geomira/editor/machine';
import type { EditorState } from '@geomira/editor/state';
import { TOOLS, toolUI } from '@geomira/editor/tools';
import type { EditorStore } from './store';

export interface ToolBarProps {
  readonly store: EditorStore;
  readonly state: EditorState;
}

/** What the active tool waits for (from the tool's data). */
function prompt(state: EditorState): string {
  const tool = toolUI(state.tool);
  if (tool === undefined) return '';
  const ts = state.toolState;
  if (ts.choosing !== null) return `${tool.label}: click the one you mean`;
  if (tool.build.kind === 'text' && ts.picks.length > 0) return `${tool.label}: type the text`;
  const { steps, rest } = stepsOf(tool, ts);
  const step = steps[ts.picks.length] ?? rest;
  return step === undefined ? tool.help : `${tool.label}: ${step.prompt}`;
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
      <button type="submit">Place</button>
    </form>
  );
}

function ToolButtons({ store, state }: ToolBarProps) {
  return (
    <div className="tools" role="toolbar" aria-label="Tools">
      {TOOLS.map((t) => (
        <button
          key={t.id}
          type="button"
          aria-pressed={state.tool === t.id}
          title={`${t.help} (key ${t.key})`}
          onClick={() => {
            store.apply({ kind: 'tool', tool: t.id });
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
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
 * The GUI tools (SPEC §12: tools are data, one state machine): one button per entry of the
 * editor's tool table, with its shortcut; the active tool's prompt; Finish and Cancel; the
 * claim tool's kind; the text tool's string.
 */
export function ToolBar({ store, state }: ToolBarProps) {
  const tool = toolUI(state.tool);
  const ts = state.toolState;
  const hasRest = tool !== undefined && stepsOf(tool, ts).rest !== undefined;
  return (
    <div className="toolbar">
      <ToolButtons store={store} state={state} />
      <div className="tool-prompt">
        <span role="status">{prompt(state)}</span>
        {state.tool === 'claim' && <ClaimKind store={store} state={state} />}
        {tool?.build.kind === 'text' && ts.picks.length > 0 && <TextInput store={store} />}
        {hasRest && (
          <button
            type="button"
            onClick={() => {
              store.input({ kind: 'finish' });
            }}
          >
            Finish
          </button>
        )}
        {(ts.picks.length > 0 || ts.choosing !== null) && (
          <button
            type="button"
            onClick={() => {
              store.input({ kind: 'cancel' });
            }}
          >
            Cancel picks
          </button>
        )}
      </div>
    </div>
  );
}
