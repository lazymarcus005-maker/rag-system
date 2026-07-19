import { parsePagination } from './pagination';

describe('parsePagination', () => {
  it('defaults to 100/0 when no args', () => {
    expect(parsePagination(undefined, undefined)).toEqual({ limit: 100, offset: 0 });
  });

  it('honors valid limit and offset', () => {
    expect(parsePagination('20', '40')).toEqual({ limit: 20, offset: 40 });
  });

  it('caps limit at 100', () => {
    expect(parsePagination('5000', '0')).toEqual({ limit: 100, offset: 0 });
  });

  it('floors offset at 0', () => {
    expect(parsePagination('10', '-5')).toEqual({ limit: 10, offset: 0 });
  });

  it('falls back to defaults on non-numeric limit', () => {
    expect(parsePagination('abc', '10')).toEqual({ limit: 100, offset: 10 });
  });

  it('falls back to defaults on non-numeric offset', () => {
    expect(parsePagination('10', 'abc')).toEqual({ limit: 10, offset: 0 });
  });

  it('falls back to defaults on empty strings', () => {
    expect(parsePagination('', '')).toEqual({ limit: 100, offset: 0 });
  });

  it('rejects fractional values', () => {
    expect(parsePagination('1.5', '2.5')).toEqual({ limit: 100, offset: 0 });
  });
});