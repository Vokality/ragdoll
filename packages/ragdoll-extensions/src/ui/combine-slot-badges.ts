/** Merge per-slot badges into one folder badge. */
export function combineSlotBadges(
  badges: readonly (number | string | null | undefined)[],
): number | string | null {
  let total = 0;
  let sawNumber = false;
  let label: string | null = null;
  for (const badge of badges) {
    if (badge == null || badge === 0 || badge === "") continue;
    if (typeof badge === "number") {
      sawNumber = true;
      total += badge;
    } else if (label == null) {
      label = badge;
    }
  }
  if (sawNumber) return total;
  return label;
}
