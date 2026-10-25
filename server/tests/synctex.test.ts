import { describe, it, expect } from 'bun:test';
import { SyncTexService } from '../services/synctexParser';

// 1 bp in sp (65536 * 72.27 / 72)
const BP = 65781.76;
const sample = `SyncTeX Version:1
Input:1:/proj/main.tex
Input:2:/proj/sections/intro.tex
Content:
{1
[1,1:0,0:100,100,0
x1,10:${Math.round(72 * BP)},${Math.round(100 * BP)}
x2,5:${Math.round(72 * BP)},${Math.round(300 * BP)}
}1
{2
x1,40:${Math.round(72 * BP)},${Math.round(200 * BP)}
}2
`;

describe('SyncTeX', () => {
  const s = new SyncTexService();
  s.load(sample);

  it('forward sync finds nearest record for a relative path', () => {
    expect(s.forward('sections/intro.tex', 5)).toMatchObject({ page: 1 });
    expect(s.forward('main.tex', 39)?.page).toBe(2);
    expect(Math.round(s.forward('main.tex', 10)!.y)).toBe(100);
    expect(s.forward('missing.tex', 1)).toBeNull();
  });

  it('reverse sync picks the closest record on the clicked page', () => {
    expect(s.reverse(1, 80, 290)).toEqual({ file: '/proj/sections/intro.tex', line: 5 });
    expect(s.reverse(2, 80, 10)).toEqual({ file: '/proj/main.tex', line: 40 });
    expect(s.reverse(9, 0, 0)).toBeNull();
  });
});
