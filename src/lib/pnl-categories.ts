export const PNL_CATEGORIES = [
  { value: 'sales_income', label: 'Sales income', kind: 'income' },
  { value: 'other_income', label: 'Other income', kind: 'income' },
  { value: 'payroll', label: 'Payroll expense', kind: 'expense' },
  { value: 'inventory_purchase', label: 'Inventory purchase', kind: 'expense' },
  { value: 'cost_of_goods_sold', label: 'Cost of goods sold', kind: 'expense' },
  { value: 'inventory_asset', label: 'Inventory acquisition (non-P&L)', kind: 'nonPnl' },
  { value: 'operating_expense', label: 'Operating expense', kind: 'expense' },
  { value: 'transfer', label: 'Transfer (non-P&L)', kind: 'nonPnl' },
  { value: 'adjustment', label: 'Adjustment (non-P&L)', kind: 'nonPnl' },
] as const;

export type PnlCategory = (typeof PNL_CATEGORIES)[number]['value'] | 'unclassified';
export type PnlCategoryKind = 'income' | 'expense' | 'nonPnl' | 'unclassified';

export function isPnlCategory(value: unknown): value is PnlCategory {
  return value === 'unclassified' || PNL_CATEGORIES.some((category) => category.value === value);
}

export function getPnlCategoryKind(value: PnlCategory): PnlCategoryKind {
  return PNL_CATEGORIES.find((category) => category.value === value)?.kind ?? 'unclassified';
}

export function getPnlCategoryLabel(value: PnlCategory) {
  return PNL_CATEGORIES.find((category) => category.value === value)?.label ?? 'Unclassified';
}
