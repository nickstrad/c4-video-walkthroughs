// Browser-safe excerpt types and presentation helpers (no node imports).

export type Excerpt = {
  id: string; repo: string; commit: string; tag: string;
  kind: "code" | "evidence";
  path: string; displayPath: string; blob: string;
  /** Code: the declaration, found at line declaredAt. Evidence: a description, declaredAt null. */
  symbol: string; declaredAt: number | null;
  lines: [number, number]; firstLine: number;
  /** The exact bytes of the lines at the commit (UTF-8, LF, tabs kept). */
  text: string;
  sha256: string;
  selector: { id: string; notes: string; url: string; line: number | null } | null;
  url: string;
};

/** Display form for engines without tab stops (Motion Canvas): tabs → spaces. */
export const presentText = (x: Excerpt, tabWidth = 4) => x.text.replace(/\t/g, " ".repeat(tabWidth));

/**
 * On-screen provenance, generated so it is never typed by hand:
 * `tag · sha7 · path:start–end · symbol`. Pass symbol: false when the
 * symbol is already shown elsewhere.
 */
export const citation = (x: Excerpt, o: { symbol?: boolean } = {}) =>
  [x.tag, x.commit.slice(0, 7), `${x.displayPath}:${x.lines[0]}–${x.lines[1]}`, ...(o.symbol === false ? [] : [x.symbol])].join(" · ");

/** File line numbers for each excerpt line. */
export const fileLines = (x: Excerpt) =>
  Array.from({ length: x.lines[1] - x.lines[0] + 1 }, (_, i) => x.lines[0] + i);
