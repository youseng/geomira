import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { App } from '../src/App';

describe('App shell', () => {
  it('renders the title Geomira', () => {
    expect(renderToString(<App />)).toContain('<h1>Geomira</h1>');
  });

  it('renders exactly one canvas', () => {
    expect(renderToString(<App />).match(/<canvas/g)).toHaveLength(1);
  });
});
