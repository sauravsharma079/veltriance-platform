// Line-level diff (longest common subsequence) for showing what changed between
// two contract versions. Kept dependency-free and client-safe.

export type DiffLine = { type: "same" | "add" | "del"; text: string };

const MAX_CELLS = 4_000_000; // beyond this the O(n·m) table gets too heavy for the browser

export function diffLines(before: string, after: string): DiffLine[] | null {
  const a = before.split("\n"), b = after.split("\n");
  if (a.length * b.length > MAX_CELLS) return null;
  const n = a.length, m = b.length;
  const lcs: Uint32Array[] = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
  const out: DiffLine[] = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { out.push({ type: "same", text: a[i] }); i++; j++; }
    else if (lcs[i + 1][j] >= lcs[i][j + 1]) out.push({ type: "del", text: a[i++] });
    else out.push({ type: "add", text: b[j++] });
  }
  while (i < n) out.push({ type: "del", text: a[i++] });
  while (j < m) out.push({ type: "add", text: b[j++] });
  return out;
}
