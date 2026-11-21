export type InventoryActivityKind = 'adjustment' | 'purchase' | 'transfer' | 'sale';

export type RecentInventoryActivity = {
  id: string;
  kind: InventoryActivityKind;
  title: string;
  description: string;
  quantityLabel: string;
  createdAt: string;
};

export function getRecentInventoryActivity(
  activities: RecentInventoryActivity[],
  limit = 5,
): RecentInventoryActivity[] {
  return [...activities]
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
    .slice(0, limit);
}
