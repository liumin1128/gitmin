export function findModelById<T extends { readonly id: string }>(
  models: readonly T[],
  modelId: string
): T | undefined {
  const normalizedId = modelId.trim();
  if (!normalizedId) return undefined;
  return models.find((model) => model.id === normalizedId);
}
