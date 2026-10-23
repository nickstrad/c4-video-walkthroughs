// The code panel: one pinned excerpt from the bundle with its real file line
// numbers, a provenance header, a selection that follows focusOf(), and a
// morph (Code's token diff) when the excerpt or the panel's place changes.
// Salvaged from the option-2 POC (Code + LezerHighlighter + a gutter Code),
// with option 1's focus band and scroll-to-step for excerpts taller than the
// panel, and option 1's step rail.
import {Code, LezerHighlighter, Node, Rect, Txt, lines} from '@motion-canvas/2d';
import {all, createSignal, easeInOutCubic, type SimpleSignal, type ThreadGenerator} from '@motion-canvas/core';
import {parser} from '@lezer/go';
import {citation, fileLines, presentText, type Box, type Excerpt, type Range} from '../../core/src/index.ts';
import {C, MONO, MONO_ADVANCE, SANS} from './theme.ts';

// Go is the only language litefleet's excerpts use; the highlighter is the
// seam for others (pick by the excerpt path's extension).
Code.defaultHighlighter = new LezerHighlighter(parser);

const PAD = 14;
const HEADER_H = 44;
const GUTTER_GAP = 2; // characters between the line number and the code
const MAX_FONT = 16;
const FIT_ALL_MIN = 12.5; // below this, scroll instead of shrinking
const SCROLL_FONT = 15;

/** Text metrics for one excerpt in one panel box. */
export type Fit = {font: number; lh: number; gutterChars: number; viewH: number; lines: number};

export function fitExcerpt(x: Excerpt, box: Box): Fit {
  const text = presentText(x).split('\n');
  const gutterChars = String(x.lines[1]).length;
  const widest = Math.max(...text.map((l) => l.length)) + gutterChars + GUTTER_GAP;
  const viewH = box.h - 2 * PAD - HEADER_H;
  const byWidth = (box.w - 2 * PAD) / (widest * MONO_ADVANCE);
  const allOnScreen = viewH / text.length / 1.25; // the font at which every line fits
  let font: number, lh: number;
  if (allOnScreen >= FIT_ALL_MIN) {
    font = Math.min(MAX_FONT, byWidth, allOnScreen);
    lh = Math.max(font * 1.25, Math.min(font * 1.5, viewH / text.length));
  } else {
    // Too tall to show whole at a readable size: read at SCROLL_FONT and
    // scroll each selection into view (focus()).
    font = Math.min(SCROLL_FONT, byWidth);
    lh = font * 1.45;
  }
  return {font: Math.round(font * 10) / 10, lh: Math.round(lh * 10) / 10, gutterChars, viewH, lines: text.length};
}

const numbers = (x: Excerpt, width: number) => fileLines(x).map((n) => String(n).padStart(width, ' ')).join('\n');

export class CodePanel {
  readonly root: Rect;
  private readonly code: Code;
  private readonly gutter: Code;
  private readonly title: Txt;
  private readonly source: Txt;
  private readonly bands: Node;
  private readonly bx: SimpleSignal<number>;
  private readonly by: SimpleSignal<number>;
  private readonly bw: SimpleSignal<number>;
  private readonly bh: SimpleSignal<number>;
  private readonly font = createSignal(14);
  private readonly lh = createSignal(19);
  private readonly gutterW = createSignal(5);
  private readonly scroll = createSignal(0);
  private current: {x: Excerpt; box: Box; fit: Fit} | null = null;

  constructor(
    private readonly screen: {width: number; height: number},
    /** Display name of the element (or relationship) an excerpt implements. */
    private readonly ownerOf: (x: Excerpt) => string | undefined,
  ) {
    this.bx = createSignal(0);
    this.by = createSignal(0);
    this.bw = createSignal(800);
    this.bh = createSignal(400);
    const left = () => -this.bw() / 2 + PAD;
    const top = () => -this.bh() / 2 + PAD;
    const codeTop = () => top() + HEADER_H;
    const viewH = () => this.bh() - 2 * PAD - HEADER_H + PAD / 2;
    const charW = () => this.font() * MONO_ADVANCE;

    this.title = (<Txt fontFamily={SANS} fontSize={16} fontWeight={700} fill={C.glow} offset={[-1, -1]} x={left} y={top} text="" />) as Txt;
    this.source = (<Txt fontFamily={MONO} fontSize={12.5} fill={C.muted} offset={[-1, -1]} x={left} y={() => top() + 23} text="" />) as Txt;
    this.gutter = (
      <Code offset={[-1, -1]} x={0} y={0} fontFamily={MONO} fontSize={this.font} lineHeight={this.lh} fill={C.faint} highlighter={null} code="" />
    ) as Code;
    this.code = (
      <Code offset={[-1, -1]} x={() => this.gutterW() * charW()} y={0} fontFamily={MONO} fontSize={this.font} lineHeight={this.lh} code="" />
    ) as Code;
    this.bands = (<Node />) as Node;
    this.root = (
      <Rect
        opacity={0}
        position={() => [this.bx() + this.bw() / 2 - screen.width / 2, this.by() + this.bh() / 2 - screen.height / 2]}
        size={() => [this.bw(), this.bh()]}
        radius={10}
        fill={C.codeBg}
        stroke={C.border}
        lineWidth={1.5}
      >
        {this.title}
        {this.source}
        {/* the code viewport: clips and scrolls the gutter, bands and code */}
        <Rect clip position={() => [0, codeTop() + viewH() / 2]} size={() => [this.bw() - 4, viewH()]}>
          <Node position={() => [left(), -viewH() / 2 - this.scroll()]}>
            {this.bands}
            {this.gutter}
            {this.code}
          </Node>
        </Rect>
      </Rect>
    ) as Rect;
  }

  private headerOf(x: Excerpt) {
    const owner = this.ownerOf(x);
    return {
      title: `${owner ? `${owner}  →  ` : ''}${x.symbol}`,
      source: citation(x, {symbol: false}),
    };
  }

  /** Show an excerpt in a panel box. First call cuts; later calls morph. */
  *show(x: Excerpt, box: Box, duration = 0.8): ThreadGenerator {
    const fit = fitExcerpt(x, box);
    const head = this.headerOf(x);
    const prev = this.current;
    this.current = {x, box, fit};
    if (!prev || duration <= 0) {
      this.bx(box.x), this.by(box.y), this.bw(box.w), this.bh(box.h);
      this.font(fit.font), this.lh(fit.lh), this.gutterW(fit.gutterChars + GUTTER_GAP), this.scroll(0);
      this.title.text(head.title), this.source.text(head.source);
      this.gutter.code(numbers(x, fit.gutterChars));
      this.code.code(presentText(x));
      this.code.selection(lines(0, Infinity)), this.gutter.selection(lines(0, Infinity));
      this.bands.removeChildren();
      return;
    }
    const e = easeInOutCubic;
    yield* all(
      this.clearFocus(0.3),
      this.bx(box.x, duration, e),
      this.by(box.y, duration, e),
      this.bw(box.w, duration, e),
      this.bh(box.h, duration, e),
      this.font(fit.font, duration, e),
      this.lh(fit.lh, duration, e),
      this.gutterW(fit.gutterChars + GUTTER_GAP, duration, e),
      this.scroll(0, duration, e),
      ...(prev.x.id === x.id
        ? []
        : [
            this.retitle(head, duration),
            this.gutter.code(numbers(x, fit.gutterChars), duration),
            this.code.code(presentText(x), duration),
          ]),
    );
  }

  /** Crossfade the header (a character tween reads as noise between symbols). */
  private *retitle(head: {title: string; source: string}, duration: number): ThreadGenerator {
    const h = duration / 2;
    yield* all(this.title.opacity(0, h), this.source.opacity(0, h));
    this.title.text(head.title), this.source.text(head.source);
    yield* all(this.title.opacity(1, h), this.source.opacity(1, h));
  }

  /** Select file-line ranges: others dim, a band marks each range, the view scrolls to them. */
  *focus(ranges: Range[], duration = 0.5): ThreadGenerator {
    const cur = this.current;
    if (!cur) return;
    const first = cur.x.lines[0];
    const sel = ranges.map(([a, b]) => lines(a - first, b - first));
    const lo = Math.min(...ranges.map((r) => r[0])) - first;
    const hi = Math.max(...ranges.map((r) => r[1])) - first;
    const lh = cur.fit.lh;
    const mid = ((lo + hi + 1) / 2) * lh;
    const max = Math.max(0, cur.fit.lines * lh - cur.fit.viewH + 4);
    const scroll = Math.max(0, Math.min(max, mid - cur.fit.viewH / 2));

    const old = [...this.bands.children()];
    const fresh = ranges.map(([a, b]) => {
      const y = (a - first) * lh, h = (b - a + 1) * lh;
      const band = (
        <Node opacity={0}>
          <Rect offset={[-1, -1]} x={-6} y={y} width={() => this.bw() - 2 * PAD + 6} height={h} radius={4} fill={C.band} />
          <Rect offset={[-1, -1]} x={-6} y={y} width={3} height={h} fill={C.glow} />
        </Node>
      ) as Node;
      this.bands.add(band);
      return band;
    });
    yield* all(
      this.code.selection(sel, duration),
      this.gutter.selection(sel, duration),
      this.scroll(scroll, duration + 0.2, easeInOutCubic),
      ...old.map((n) => (n as Node).opacity(0, duration * 0.6)),
      ...fresh.map((n) => n.opacity(1, duration)),
    );
    old.forEach((n) => n.remove());
  }

  *clearFocus(duration = 0.4): ThreadGenerator {
    const old = [...this.bands.children()];
    yield* all(
      this.code.selection(lines(0, Infinity), duration),
      this.gutter.selection(lines(0, Infinity), duration),
      ...old.map((n) => (n as Node).opacity(0, duration)),
    );
    old.forEach((n) => n.remove());
  }
}

/** The stepped walk's rail: a title and one row per step; the current one lit. */
export class StepRail {
  readonly root: Node;
  private rows: {box: Rect; range: Txt; label: Txt}[] = [];
  private readonly list: Node;
  private readonly heading: Txt;

  constructor(private readonly screen: {width: number; height: number}, private readonly box: Box) {
    const x0 = box.x - screen.width / 2, y0 = box.y - screen.height / 2;
    this.heading = (
      <Txt x={x0} y={y0 + 4} offset={[-1, -1]} fontFamily={SANS} fontWeight={700} fontSize={12} letterSpacing={1} fill={C.muted} text="" />
    ) as Txt;
    this.list = (<Node />) as Node;
    this.root = (
      <Node opacity={0}>
        {this.heading}
        {this.list}
      </Node>
    ) as Node;
  }

  /** Build the rows for a scene's steps (labels and line ranges from the storyboard). */
  set(title: string, steps: {label: string; lines: Range}[]) {
    this.heading.text(title.toUpperCase());
    this.list.removeChildren();
    const x0 = this.box.x - this.screen.width / 2, y0 = this.box.y - this.screen.height / 2 + 30;
    const rowH = 42, gap = 8;
    this.rows = steps.map((s, i) => {
      const range = (<Txt fontFamily={MONO} fontSize={12.5} fill={C.faint} width={78} text={`L${s.lines[0]}–${s.lines[1]}`} />) as Txt;
      const label = (<Txt fontFamily={SANS} fontSize={15} fill={C.faint} text={s.label} />) as Txt;
      const box = (
        <Rect
          x={x0}
          y={y0 + i * (rowH + gap)}
          offset={[-1, -1]}
          width={this.box.w}
          height={rowH}
          radius={6}
          stroke={C.border}
          lineWidth={1}
          fill={'rgba(56,139,253,0)'}
          layout
          alignItems="center"
          gap={10}
          padding={[0, 12]}
        >
          {range}
          {label}
        </Rect>
      ) as Rect;
      this.list.add(box);
      return {box, range, label};
    });
  }

  /** Light step i; earlier steps read as done, later ones as pending. */
  *activate(i: number, duration = 0.35): ThreadGenerator {
    yield* all(
      ...this.rows.flatMap((r, j) => {
        const on = j === i, done = j < i;
        return [
          r.box.stroke(on ? C.glow : C.border, duration),
          r.box.fill(on ? 'rgba(56,139,253,0.18)' : 'rgba(56,139,253,0)', duration),
          r.label.fill(on ? C.text : done ? C.muted : C.faint, duration),
          r.range.fill(on ? C.muted : C.faint, duration),
        ];
      }),
    );
    this.rows.forEach((r, j) => r.label.fontWeight(j === i ? 700 : 400));
  }
}
