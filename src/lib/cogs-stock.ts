export function getCogsEligibleQuantityRemoved(
  totalQuantity: number,
  cogsEligibleQuantity: number,
  quantityToRemove: number
) {
  if (
    !Number.isFinite(totalQuantity) ||
    !Number.isFinite(cogsEligibleQuantity) ||
    !Number.isFinite(quantityToRemove) ||
    totalQuantity < 0 ||
    cogsEligibleQuantity < 0 ||
    cogsEligibleQuantity > totalQuantity ||
    quantityToRemove <= 0 ||
    quantityToRemove > totalQuantity
  ) {
    throw new RangeError('Stock quantities are invalid.');
  }

  const legacyQuantity = totalQuantity - cogsEligibleQuantity;
  return Math.max(0, quantityToRemove - legacyQuantity);
}
