import { describe, expect, it } from 'vitest';
import { hex6, parseCssColor } from '../src/color';
import { CSS_NAMED } from '../src/css-names';

describe('parseCssColor', () => {
  it('knows the 148 CSS named colours, case-insensitively', () => {
    expect(Object.keys(CSS_NAMED)).toHaveLength(148);
    expect(parseCssColor('red')).toEqual({ r: 255, g: 0, b: 0, a: 1 });
    expect(parseCssColor(' Blue ')).toEqual({ r: 0, g: 0, b: 255, a: 1 });
    expect(parseCssColor('gray')).toEqual({ r: 128, g: 128, b: 128, a: 1 });
    expect(parseCssColor('rebeccapurple')).toEqual({ r: 0x66, g: 0x33, b: 0x99, a: 1 });
    expect(parseCssColor('transparent')).toEqual({ r: 0, g: 0, b: 0, a: 0 });
    for (const [name, hex] of Object.entries(CSS_NAMED))
      expect(hex6(parseCssColor(name) ?? { r: -1, g: 0, b: 0, a: 0 }).toLowerCase(), name).toBe(
        hex,
      );
  });

  it('reads hexadecimal forms', () => {
    expect(parseCssColor('#f00')).toEqual({ r: 255, g: 0, b: 0, a: 1 });
    expect(parseCssColor('#f008')).toEqual({ r: 255, g: 0, b: 0, a: 0x88 / 255 });
    expect(parseCssColor('#1B1F24')).toEqual({ r: 0x1b, g: 0x1f, b: 0x24, a: 1 });
    expect(parseCssColor('#11223380')).toEqual({ r: 0x11, g: 0x22, b: 0x33, a: 0x80 / 255 });
    for (const bad of ['#', '#12', '#12345', '#ggg', '#1234567', '#123456789'])
      expect(parseCssColor(bad), bad).toBeUndefined();
  });

  it('reads rgb() and rgba() in comma and space syntax', () => {
    expect(parseCssColor('rgb(255, 0, 0)')).toEqual({ r: 255, g: 0, b: 0, a: 1 });
    expect(parseCssColor('rgba(0,128,255,0.5)')).toEqual({ r: 0, g: 128, b: 255, a: 0.5 });
    expect(parseCssColor('rgb(0 128 255 / 50%)')).toEqual({ r: 0, g: 128, b: 255, a: 0.5 });
    expect(parseCssColor('rgb(100%, 50%, 0%)')).toEqual({ r: 255, g: 128, b: 0, a: 1 });
    expect(parseCssColor('rgb(300, -5, 12.4)')).toEqual({ r: 255, g: 0, b: 12, a: 1 });
    for (const bad of ['rgb(1, 2)', 'rgb(a, b, c)', 'rgb(1 2 3 / 4 / 5)', 'rgb(1, 2, 3, 4, 5)'])
      expect(parseCssColor(bad), bad).toBeUndefined();
  });

  it('reads hsl() and hsla()', () => {
    expect(parseCssColor('hsl(0, 100%, 50%)')).toEqual({ r: 255, g: 0, b: 0, a: 1 });
    expect(parseCssColor('hsl(120deg 100% 25%)')).toEqual({ r: 0, g: 128, b: 0, a: 1 });
    expect(parseCssColor('hsla(240, 100%, 50%, 0.25)')).toEqual({ r: 0, g: 0, b: 255, a: 0.25 });
    expect(parseCssColor('hsl(-120, 100%, 50%)')).toEqual({ r: 0, g: 0, b: 255, a: 1 });
    for (const bad of ['hsl(0, 100, 50)', 'hsl(0%, 1%, 1%)', 'hsl(x, 1%, 1%)'])
      expect(parseCssColor(bad), bad).toBeUndefined();
  });

  it('anything else is not read (the exporters fall back to the default ink)', () => {
    for (const bad of [
      '',
      'notacolour',
      'hwb(0 0% 0%)',
      'lab(50% 0 0)',
      'currentcolor',
      'rgb(1,2,3',
    ])
      expect(parseCssColor(bad), bad).toBeUndefined();
  });

  it('hex6 writes six upper-case digits', () => {
    expect(hex6({ r: 0, g: 10, b: 255, a: 0.3 })).toBe('000AFF');
  });
});
