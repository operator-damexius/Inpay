// Runtime validation coverage for: safe POS sales CSV export.
import { describe, expect, it } from 'vitest';
import { csvCell } from './pos-sales-csv';

describe('csvCell', () => {
  it('escapes embedded quotes and commas', () => {
    expect(csvCell('Item, "special"')).toBe('"Item, ""special"""');
  });

  it('neutralizes spreadsheet formulas in text cells', () => {
    expect(csvCell('=HYPERLINK("https://example.invalid")'))
      .toBe('"\'=HYPERLINK(""https://example.invalid"")"');
  });
});
