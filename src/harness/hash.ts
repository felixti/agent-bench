export function hashRowId(rowId: string): number {
  let hash = 2166136261;

  for (const char of rowId) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}
