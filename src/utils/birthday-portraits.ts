export function getUnpublishedBirthdayIds(eligibleIds: Iterable<string>, publishedIds: ReadonlySet<string>): string[] {
  return [...new Set(eligibleIds)]
    .filter((id) => !publishedIds.has(id))
    .sort((left, right) => Number(left) - Number(right));
}
