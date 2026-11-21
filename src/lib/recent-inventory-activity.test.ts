import { describe, expect, it } from 'vitest';
import { getRecentInventoryActivity, type RecentInventoryActivity } from './recent-inventory-activity';

const activity = (
  id: string,
  kind: RecentInventoryActivity['kind'],
  createdAt: string,
): RecentInventoryActivity => ({
  id,
  kind,
  title: id,
  description: '',
  quantityLabel: '',
  createdAt,
});

describe('getRecentInventoryActivity', () => {
  it('merges movement types by time and limits the dashboard list', () => {
    const result = getRecentInventoryActivity([
      activity('adjustment', 'adjustment', '2026-01-01T10:00:00.000Z'),
      activity('purchase', 'purchase', '2026-01-03T10:00:00.000Z'),
      activity('transfer', 'transfer', '2026-01-02T10:00:00.000Z'),
      activity('sale', 'sale', '2026-01-04T10:00:00.000Z'),
      activity('older-sale', 'sale', '2025-12-01T10:00:00.000Z'),
      activity('newer-adjustment', 'adjustment', '2026-01-05T10:00:00.000Z'),
    ]);

    expect(result.map(({ id }) => id)).toEqual([
      'newer-adjustment',
      'sale',
      'purchase',
      'transfer',
      'adjustment',
    ]);
  });

  it('does not mutate the supplied activity list', () => {
    const activities = [
      activity('older', 'adjustment', '2026-01-01T10:00:00.000Z'),
      activity('newer', 'sale', '2026-01-02T10:00:00.000Z'),
    ];

    getRecentInventoryActivity(activities);

    expect(activities.map(({ id }) => id)).toEqual(['older', 'newer']);
  });
});
