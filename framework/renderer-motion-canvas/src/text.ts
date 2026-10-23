// Deterministic text fitting: wrap and truncate before Motion Canvas lays the
// text out, so a box never overflows whatever the dataset says. Glyph widths
// are estimates for DejaVu Sans (regular ≈ 0.56 em, bold ≈ 0.63 em).

export const SANS_ADVANCE = 0.56;
export const SANS_BOLD_ADVANCE = 0.63;

/** Greedy word wrap at an estimated advance; at most `maxLines` (ellipsis on cut). */
export function wrapText(text: string, width: number, font: number, advance = SANS_ADVANCE, maxLines = Infinity): string[] {
  const fits = (s: string) => s.length * font * advance <= width;
  const lines: string[] = [];
  let cur = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = cur ? `${cur} ${word}` : word;
    if (fits(next) || !cur) cur = next;
    else {
      lines.push(cur);
      cur = word;
    }
  }
  if (cur) lines.push(cur);
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  let last = kept[maxLines - 1];
  while (last.length > 1 && !fits(`${last}…`)) last = last.slice(0, -1);
  kept[maxLines - 1] = `${last.replace(/[\s,;:.]+$/, '')}…`;
  return kept;
}
