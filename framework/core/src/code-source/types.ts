// Browser-safe excerpt types and presentation helpers (no node imports).

export type Excerpt = {
  id: string; repo: string; commit: string; tag: string;
  path: string; displayPath: string; blob: string;
  symbol: string; declaredAt: number;
  lines: [number, number]; firstLine: number;
  /** The exact bytes of the lines at the commit (UTF-8, LF, tabs kept). */
  text: string;
  sha256: string;
  selector: { id: string; notes: string; url: string; line: number | null } | null;
  url: string;
};

/** Display form for engines without tab stops (Motion Canvas): tabs → spaces. */
export const presentText = (x: Excerpt, tabWidth = 4) => x.text.replace(/\t/g, " ".repeat(tabWidth));

/** File line numbers for each excerpt line. */
export const fileLines = (x: Excerpt) =>
  Array.from({ length: x.lines[1] - x.lines[0] + 1 }, (_, i) => x.lines[0] + i);
