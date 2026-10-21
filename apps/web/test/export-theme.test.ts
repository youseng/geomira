import { describe, expect, it } from 'vitest';
import { EXPORT_THEME } from '@geomira/export/paint';
import { LABEL_FONT_PX } from '@geomira/scene/label-box';
import { LIGHT_THEME } from '../src/render';

describe('the exports draw with the canvas theme (ADR-0014 decision 3)', () => {
  it('ink, paper, fill alpha, label font', () => {
    expect(EXPORT_THEME).toEqual({
      ink: LIGHT_THEME.foreground,
      paper: LIGHT_THEME.background,
      fillAlpha: LIGHT_THEME.fillAlpha,
      fontPx: LIGHT_THEME.fontSize,
      fontFamily: LIGHT_THEME.fontFamily,
    });
    expect(LABEL_FONT_PX).toBe(LIGHT_THEME.fontSize);
  });
});
