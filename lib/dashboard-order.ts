export function normalizeDashboardOrder(savedOrder: unknown, defaultIds: string[]): string[] {
  if (!Array.isArray(savedOrder)) return [...defaultIds];
  const uniqueValidIds = savedOrder.filter(
    (id, index): id is string => typeof id === "string" && defaultIds.includes(id) && savedOrder.indexOf(id) === index,
  );
  return [...uniqueValidIds, ...defaultIds.filter((id) => !uniqueValidIds.includes(id))];
}

export function moveVisibleDashboardItem(
  currentOrder: string[],
  visibleIds: string[],
  itemId: string,
  direction: -1 | 1,
): string[] {
  const currentVisibleIndex = visibleIds.indexOf(itemId);
  const targetVisibleIndex = currentVisibleIndex + direction;
  if (currentVisibleIndex < 0 || targetVisibleIndex < 0 || targetVisibleIndex >= visibleIds.length) return currentOrder;

  const targetId = visibleIds[targetVisibleIndex];
  const currentIndex = currentOrder.indexOf(itemId);
  const targetIndex = currentOrder.indexOf(targetId);
  if (currentIndex < 0 || targetIndex < 0) return currentOrder;

  const nextOrder = [...currentOrder];
  [nextOrder[currentIndex], nextOrder[targetIndex]] = [nextOrder[targetIndex], nextOrder[currentIndex]];
  return nextOrder;
}

/** Move one visible item directly before another while preserving hidden items. */
export function moveVisibleDashboardItemToTarget(
  currentOrder: string[],
  visibleIds: string[],
  draggedId: string,
  targetId: string,
): string[] {
  if (!draggedId || !targetId || draggedId === targetId) return currentOrder;
  const draggedVisibleIndex = visibleIds.indexOf(draggedId);
  const targetVisibleIndex = visibleIds.indexOf(targetId);
  if (draggedVisibleIndex < 0 || targetVisibleIndex < 0) return currentOrder;

  const nextVisible = [...visibleIds];
  nextVisible.splice(draggedVisibleIndex, 1);
  const adjustedTargetIndex = nextVisible.indexOf(targetId);
  nextVisible.splice(adjustedTargetIndex, 0, draggedId);

  const visibleSet = new Set(visibleIds);
  let visibleIndex = 0;
  return currentOrder.map((id) => (visibleSet.has(id) ? nextVisible[visibleIndex++] : id));
}
