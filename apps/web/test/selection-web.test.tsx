/**
 * ADR-0060 in the web app: a click with Shift or Ctrl held reaches the Move tool as an
 * extended click (the object joins or leaves the selection; a press on a point still drags
 * it); the selection bar is there exactly while objects are selected and offers what would
 * change something; the Layers panel has "New layer", a name field per layer and "move the
 * selection here"; an object row has its eye.
 */
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { print } from '@geomira/lang/print';
import { buildScene } from '@geomira/scene/build';
import { layout } from '@geomira/scene/display';
import { toScreen } from '@geomira/scene/viewport';
import { Gestures } from '../src/gestures';
import { LayersPanel } from '../src/panels/LayersPanel';
import { ObjectsPanel } from '../src/panels/ObjectsPanel';
import { SelectionBar } from '../src/SelectionBar';
import { EditorStore } from '../src/store';
import { registry } from './helpers';

const SIZE = { width: 800, height: 600 };
const TEXT = '@version 1\nA = (0, 0)\nB = (4, 0)\nC = (1, 3)\nω = circle(A, B, C)\n';

function setup(text = TEXT) {
  const store = new EditorStore({ registry }, () => undefined);
  store.openText(text, 'new');
  const display = () => {
    const s = store.current();
    return layout(buildScene(s.doc, s.values.values), { viewport: s.viewport, size: SIZE });
  };
  const at = (x: number, y: number) =>
    toScreen({ viewport: store.current().viewport, size: SIZE }, { x, y });
  const gestures = new Gestures(store);
  /** A press and release at world (x, y), with Shift or Ctrl held when `extend`. */
  const click = (x: number, y: number, extend = false) => {
    gestures.down(1, at(x, y), display());
    gestures.up(1, at(x, y), display(), extend);
  };
  const selected = () =>
    store
      .current()
      .selection.map((id) => store.current().doc.objects.find((o) => o.id === id)?.name);
  return { store, display, at, gestures, click, selected };
}

describe('a click with Shift or Ctrl held', () => {
  it('adds to the selection and takes from it; a plain click replaces it', () => {
    const { click, selected } = setup();
    click(0, 0);
    click(4, 0, true);
    click(1, 3, true);
    expect(selected()).toEqual(['A', 'B', 'C']);
    click(4, 0, true);
    expect(selected()).toEqual(['A', 'C']);
    click(9, 9, true);
    expect(selected()).toEqual(['A', 'C']);
    click(4, 0);
    expect(selected()).toEqual(['B']);
    click(9, 9);
    expect(selected()).toEqual([]);
  });

  it('changes no document and leaves no drag behind', () => {
    const { store, click } = setup();
    const before = print(store.current().doc);
    click(0, 0);
    click(4, 0, true);
    expect(store.current().drag).toBeNull();
    expect(store.current().history.past).toEqual([]);
    expect(print(store.current().doc)).toBe(before);
    expect(store.getSnapshot().notice).toBeNull();
  });

  it('a press that moves is still a drag of the point, Shift held or not', () => {
    const { store, gestures, display, at } = setup();
    const a = at(0, 0);
    gestures.down(1, a, display());
    gestures.move(1, { x: a.x + 40, y: a.y }, display());
    gestures.up(1, { x: a.x + 40, y: a.y }, display(), true);
    expect(print(store.current().doc)).not.toContain('A = (0, 0)');
    expect(store.current().selection).toEqual([]);
  });
});

describe('the selection bar', () => {
  const bar = (store: EditorStore) =>
    renderToString(<SelectionBar store={store} state={store.current()} />);

  it('is absent with nothing selected', () => {
    expect(bar(setup().store)).toBe('');
  });

  it('names the selection and offers what would change something', () => {
    const { store, click } = setup();
    click(0, 0);
    click(4, 0, true);
    const h = bar(store);
    expect(h).toContain('role="toolbar"');
    expect(h).toContain('aria-label="Selection"');
    expect(h).toContain('A, B');
    expect(h).toContain('>Hide<');
    expect(h).not.toContain('>Show<');
    expect(h).toContain('>Label off<');
    expect(h).not.toContain('>Label on<');
    expect(h).toContain('>Delete<');
    expect(h).toContain('aria-label="Clear the selection"');
    // One layer: nowhere to move the selection to.
    expect(h).not.toContain('Move the selection to a layer');
  });

  it('offers Show for a hidden selection, and the layers once there are two', () => {
    const { store } = setup('@version 1\n@layer aux\nA = (0, 0) [hidden]\n');
    const id = store.current().doc.objects[0]?.id ?? -1;
    store.apply({ kind: 'select', ids: [id], mode: 'replace' });
    const h = bar(store);
    expect(h).toContain('>Show<');
    expect(h).not.toContain('>Hide<');
    expect(h).toContain('aria-label="Move the selection to a layer"');
    expect(h).toContain('>aux</option>');
  });
});

describe('the Layers panel', () => {
  const panel = (store: EditorStore) =>
    renderToString(<LayersPanel store={store} state={store.current()} coincident={0} />);

  it('has "New layer" with the offered name, and a name field per layer', () => {
    const { store } = setup();
    const h = panel(store);
    expect(h).toContain('aria-label="New layer name"');
    expect(h).toContain('placeholder="layer1"');
    expect(h).toContain('>New layer</button>');
    expect(h).toContain('aria-label="Name of layer 1"');
    // The visibility box keeps the layer's name as its accessible name.
    expect(h).toContain('aria-label="main"');
    expect(h).toContain('New objects are built in the layer with the dot.');
  });

  it('the main layer has no remove button; a second layer has one', () => {
    const { store } = setup();
    expect(panel(store)).not.toContain('Remove layer');
    store.apply({ kind: 'addLayer', name: 'aux' });
    const h = panel(store);
    expect(h).toContain('aria-label="Remove layer 2"');
    expect(h).not.toContain('aria-label="Remove layer 1"');
    expect(h).toContain('placeholder="layer1"');
  });

  it('offers "move the selection here" only for layers the selection is not all in', () => {
    const { store, click } = setup();
    store.apply({ kind: 'addLayer', name: 'aux' });
    expect(panel(store)).not.toContain('Move the selection to layer');
    click(0, 0);
    const h = panel(store);
    expect(h).toContain('aria-label="Move the selection to layer 2"');
    expect(h).not.toContain('aria-label="Move the selection to layer 1"');
  });
});

describe('an object row’s eye', () => {
  it('says what it would do: hide a shown object, show a hidden one', () => {
    const { store } = setup('@version 1\nA = (0, 0)\nB = (4, 0) [hidden]\n');
    const h = renderToString(
      <ObjectsPanel
        store={store}
        state={store.current()}
        undrawable={[]}
        onStyle={() => undefined}
      />,
    );
    expect(h).toContain('aria-label="Hide A"');
    expect(h).toContain('aria-label="Show B"');
    expect(h).not.toContain('aria-label="Hide B"');
  });
});
