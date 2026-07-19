export interface Pagination {
  limit: number;
  offset: number;
}

const DEFAULT_LIMIT = 100;
const DEFAULT_OFFSET = 0;
const MAX_LIMIT = 100;

function parsePositiveInt(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) return undefined;
  return n;
}

export function parsePagination(
  limit: string | undefined,
  offset: string | undefined,
): Pagination {
  const parsedLimit = parsePositiveInt(limit);
  const parsedOffset = parsePositiveInt(offset);
  return {
    limit: parsedLimit === undefined ? DEFAULT_LIMIT : Math.min(parsedLimit, MAX_LIMIT),
    offset: parsedOffset === undefined ? DEFAULT_OFFSET : parsedOffset,
  };
}