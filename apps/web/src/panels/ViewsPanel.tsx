import { useState } from 'react';
import type { EditorState } from '@geomira/editor/state';
import {
  currentView,
  deleteView,
  renameView,
  saveView,
  suggestedViewName,
  switchView,
} from '@geomira/editor/views';
import type { View } from '@geomira/kernel/document';
import { SrOnly } from '../icons';
import type { EditorStore } from '../store';

export interface ViewsPanelProps {
  readonly store: EditorStore;
  readonly state: EditorState;
}

/** A view's name being edited in place: Enter renames (one edit), Escape keeps the name. */
function RenameField({ store, view, done }: { store: EditorStore; view: View; done: () => void }) {
  const [name, setName] = useState(view.name);
  return (
    <input
      className="view-rename"
      aria-label={`New name of view ${view.name}`}
      value={name}
      // The field appears on the user's own click on Rename: it takes the focus.
      autoFocus
      onChange={(e) => {
        setName(e.target.value);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          if (store.run((s, env) => renameView(s, view.name, name, env)).ok) done();
        } else if (e.key === 'Escape') done();
      }}
      onBlur={done}
    />
  );
}

function ViewRow({ store, view, shown }: { store: EditorStore; view: View; shown: boolean }) {
  const [renaming, setRenaming] = useState(false);
  return (
    <li className="view-row">
      {renaming ? (
        <RenameField
          store={store}
          view={view}
          done={() => {
            setRenaming(false);
          }}
        />
      ) : (
        <button
          type="button"
          className={shown ? 'view-name shown' : 'view-name'}
          aria-pressed={shown}
          title={shown ? 'The figure shows this view' : 'Show this view'}
          onClick={() => {
            store.run((s, env) => switchView(s, view.name, env));
          }}
        >
          <SrOnly>Show view </SrOnly>
          {view.name}
        </button>
      )}
      <button
        type="button"
        className="small"
        title="Rename"
        onClick={() => {
          setRenaming(true);
        }}
      >
        <span aria-hidden="true">✎</span>
        <SrOnly>Rename view {view.name}</SrOnly>
      </button>
      <button
        type="button"
        className="small"
        title="Delete"
        onClick={() => {
          store.run((s, env) => deleteView(s, view.name, env));
        }}
      >
        <span aria-hidden="true">×</span>
        <SrOnly>Delete view {view.name}</SrOnly>
      </button>
    </li>
  );
}

/**
 * Views (SPEC §8.3, v1.1): named layer visibilities and viewports. Saving, showing, renaming
 * and deleting a view are each one document edit (@geomira/editor/views): in the text,
 * undoable. ] and [ switch to the next and previous view.
 */
export function ViewsPanel({ store, state }: ViewsPanelProps) {
  const [name, setName] = useState('');
  const shown = currentView(state.doc);
  const suggested = suggestedViewName(state.doc);
  const save = () => {
    const r = store.run((s, env) => saveView(s, name.trim() === '' ? suggested : name, env));
    if (r.ok) setName('');
  };
  return (
    <fieldset className="layers views">
      <legend>Views</legend>
      {state.doc.views.length === 0 ? (
        <p className="muted layer-note">
          No views yet. A view keeps which layers are shown and where the canvas looks.
        </p>
      ) : (
        <ul className="view-list">
          {state.doc.views.map((v) => (
            <ViewRow key={v.name} store={store} view={v} shown={v.name === shown} />
          ))}
        </ul>
      )}
      <div className="view-save">
        <input
          aria-label="New view name"
          placeholder={suggested}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') save();
          }}
        />
        <button type="button" className="small" onClick={save}>
          Save view
        </button>
      </div>
      <p className="muted layer-note">] and [ switch to the next and previous view.</p>
    </fieldset>
  );
}
