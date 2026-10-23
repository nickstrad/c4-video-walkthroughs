// Any C4 View + its ELK Layout from the bundle, drawn as a board filmed by a
// camera. Replaces the POC's hand-placed POS table: boxes, routes, labels and
// the boundary all come from bundle.views[id]. Overlays (packet, badges, the
// skip note) are drawn in screen space on top of the camera so they stay
// legible at any zoom; they follow the camera through toLocal().
import {Layout as Flex, Line, Node, Rect, Txt} from '@motion-canvas/2d';
import {
  all,
  chain,
  createSignal,
  delay,
  easeInOutCubic,
  type SimpleSignal,
  type ThreadGenerator,
  Vector2,
  waitFor,
} from '@motion-canvas/core';
import {
  BOX,
  along,
  centre,
  fit,
  hopPath,
  type Box,
  type Layout as ViewLayout,
  type Point,
  type TimedHop,
  type View,
  type ViewElement,
} from '../../core/src/index.ts';
import {C, MONO, SANS, TONE} from './theme.ts';
import {SANS_ADVANCE, SANS_BOLD_ADVANCE, wrapText} from './text.ts';

const KIND: Record<string, string> = {
  person: 'Person',
  softwareSystem: 'Software system',
  container: 'Container',
  component: 'Component',
};
export const kindName = (k: string) => KIND[k] ?? k;
export const viewKindName = (k: string) => `C4 · ${k} view`.toUpperCase();

/** Core sized ELK's label boxes for a 10-unit font with 13-unit lines. */
const LABEL_FONT = 10;
const LABEL_LH = 13;

export type CameraTarget = {region: Box; margin?: number} | {focus: string; fill: number};

export const union = (bs: Box[]): Box => {
  const x0 = Math.min(...bs.map((b) => b.x)), y0 = Math.min(...bs.map((b) => b.y));
  const x1 = Math.max(...bs.map((b) => b.x + b.w)), y1 = Math.max(...bs.map((b) => b.y + b.h));
  return {x: x0, y: y0, w: x1 - x0, h: y1 - y0};
};
const pad = (b: Box, p: number): Box => ({x: b.x - p, y: b.y - p, w: b.w + 2 * p, h: b.h + 2 * p});
/** Scale moves interpolate in log space so a zoom reads as an even push. */
const logLerp = (a: number, b: number, t: number) => Math.exp(Math.log(a) + (Math.log(b) - Math.log(a)) * t);

export class DiagramView {
  readonly root: Rect;
  private readonly camera: Node;
  private readonly overlay: Node;
  private readonly s: SimpleSignal<number>;
  private readonly cx: SimpleSignal<number>;
  private readonly cy: SimpleSignal<number>;
  /** Screen viewport (top-left origin) the camera films into; the root clips to it. */
  private readonly vp: {x: SimpleSignal<number>; y: SimpleSignal<number>; w: SimpleSignal<number>; h: SimpleSignal<number>};
  private readonly boxes: Record<string, Rect> = {};
  private readonly edges: Record<string, {line: Line; group: Node}> = {};
  private readonly badges: Record<string, Rect> = {};
  private readonly notes: Txt[] = [];
  readonly notesShown = createSignal(1);
  private readonly pktPts = createSignal<Point[] | null>(null);
  private readonly pktU = createSignal(0);
  private readonly pktShown = createSignal(0);
  private readonly lit = new Set<string>();

  constructor(
    readonly view: View,
    readonly layout: ViewLayout,
    private readonly screen: {width: number; height: number},
    /** Scale at which the text is designed to read (the view's main full-screen fit). */
    readonly designScale: number,
    packetLabel: () => string | undefined,
  ) {
    this.s = createSignal(designScale);
    this.cx = createSignal(layout.width / 2);
    this.cy = createSignal(layout.height / 2);
    this.vp = {x: createSignal(0), y: createSignal(0), w: createSignal(screen.width), h: createSignal(screen.height)};
    const u = 1 / designScale; // layout units per screen pixel at the design scale

    this.camera = (<Node position={() => [-this.s() * this.cx(), -this.s() * this.cy()]} scale={() => this.s()} />) as Node;
    this.overlay = (<Node />) as Node;
    this.root = (
      <Rect
        opacity={0}
        clip
        position={() => [this.vp.x() + this.vp.w() / 2 - screen.width / 2, this.vp.y() + this.vp.h() / 2 - screen.height / 2]}
        size={() => [this.vp.w(), this.vp.h()]}
      >
        {this.camera}
        {this.overlay}
      </Rect>
    ) as Rect;

    // Boundary: the view's scope (a system or container), when laid out.
    const scopeBox = view.scope && layout.boxes[view.scope.id];
    if (view.scope && scopeBox) {
      const p = 8 * u;
      this.camera.add(
        <Rect
          position={[scopeBox.x + scopeBox.w / 2, scopeBox.y + scopeBox.h / 2]}
          size={[scopeBox.w, scopeBox.h]}
          radius={6 * u}
          fill={C.boundary}
          stroke={C.line}
          lineWidth={1.2 * u}
          lineDash={[6 * u, 4 * u]}
        >
          <Txt
            x={-scopeBox.w / 2 + p}
            y={-scopeBox.h / 2 + p}
            offset={[-1, -1]}
            fontFamily={SANS}
            fontWeight={700}
            fontSize={11 * u}
            fill={C.text}
            text={view.scope.name}
          />
          <Txt
            x={-scopeBox.w / 2 + p}
            y={-scopeBox.h / 2 + p + 14 * u}
            offset={[-1, -1]}
            fontFamily={SANS}
            fontSize={8 * u}
            fill={C.muted}
            text={`${kindName(view.scope.kind)} boundary${view.scope.technology ? ` · ${view.scope.technology}` : ''}`}
          />
        </Rect>,
      );
    }

    // Edges: ELK's orthogonal routes, with the numbered labels where ELK put
    // them. Labels grow past ELK's 10-unit font (to ~8 px at the design
    // scale) only as far as ELK's spacing to the boxes allows; they stay
    // centred on ELK's label box.
    const want = Math.min(1.35, Math.max(1, 8 / (LABEL_FONT * designScale)));
    for (const e of view.edges) {
      const r = layout.routes[e.id];
      if (!r) continue;
      const line = (
        <Line points={r.points.map((p) => [p.x, p.y])} stroke={C.line} lineWidth={1.4 * u} endArrow arrowSize={6 * u} />
      ) as Line;
      const group = (<Node>{line}</Node>) as Node;
      if (r.label) {
        const l = r.label;
        const widest = Math.max(...l.lines.map((t) => t.length)) * LABEL_FONT * SANS_ADVANCE;
        const k = Math.max(1, Math.min(want, (l.w + 36) / widest));
        const lh = LABEL_LH * k, top = l.y + l.h / 2 - (l.lines.length * lh) / 2;
        l.lines.forEach((text, i) =>
          group.add(
            <Txt
              x={l.x + l.w / 2}
              y={top + lh / 2 + i * lh}
              fontFamily={SANS}
              fontSize={LABEL_FONT * k}
              lineHeight={lh}
              fill={C.muted}
              text={text}
            />,
          ),
        );
      }
      this.edges[e.id] = {line, group};
      this.camera.add(group);
    }

    // Elements: kind · technology, name, description (dropped or cut to fit).
    for (const n of view.nodes) {
      const b = layout.boxes[n.id];
      if (!b) continue;
      this.boxes[n.id] = this.element(n, b, u);
      this.camera.add(this.boxes[n.id]);
    }

    // The request packet rides hopPath in screen space, just above the route.
    this.overlay.add(
      <Rect
        position={() => {
          const pts = this.pktPts();
          // Ride on the boxes' top edge so the pill never covers an element's name.
          return pts ? this.toLocal(along(pts, this.pktU())).add([0, -(BOX.h / 2) * this.s() - 4]) : Vector2.zero;
        }}
        opacity={() => (this.pktPts() && packetLabel() ? this.pktShown() : 0)}
        radius={12}
        padding={[4, 11]}
        fill={C.packet}
        shadowColor={'rgba(0,0,0,0.6)'}
        shadowBlur={8}
        layout
      >
        <Txt fontFamily={MONO} fontSize={13} fontWeight={700} fill={C.bg} text={() => packetLabel() ?? ''} />
      </Rect>,
    );
  }

  private element(n: ViewElement, b: Box, u: number) {
    const pad = 7 * u, gap = 3 * u;
    const innerW = b.w - 2 * pad, innerH = b.h - 2 * pad;
    const kf = 7 * u, nf = 11.5 * u, df = 8.5 * u;
    const kind = wrapText([kindName(n.kind), n.technology].filter(Boolean).join(' · ').toUpperCase(), innerW, kf, SANS_BOLD_ADVANCE + 0.06, 1);
    const name = wrapText(n.name, innerW, nf, SANS_BOLD_ADVANCE, 2);
    const room = innerH - kind.length * kf * 1.25 - name.length * nf * 1.2 - 2 * gap;
    const descLines = Math.floor(room / (df * 1.3));
    const desc = descLines >= 2 ? wrapText(n.description, innerW, df, SANS_ADVANCE, descLines) : [];
    return (
      <Rect
        position={[b.x + b.w / 2, b.y + b.h / 2]}
        size={[b.w, b.h]}
        radius={6 * u}
        fill={n.external ? C.external : C.panel}
        stroke={C.border}
        lineWidth={1.6 * u}
        shadowColor={C.glow}
        shadowBlur={0}
        layout
        direction="column"
        alignItems="center"
        justifyContent="center"
        padding={pad}
        gap={gap}
      >
        <Flex layout direction="column" alignItems="center">
          {kind.map((t) => (
            <Txt fontFamily={SANS} fontWeight={700} fontSize={kf} lineHeight={kf * 1.25} letterSpacing={0.4 * u} fill={C.muted} text={t} />
          ))}
        </Flex>
        <Flex layout direction="column" alignItems="center">
          {name.map((t) => (
            <Txt fontFamily={SANS} fontWeight={700} fontSize={nf} lineHeight={nf * 1.2} fill={C.text} text={t} />
          ))}
        </Flex>
        {desc.length ? (
          <Flex layout direction="column" alignItems="center">
            {desc.map((t) => (
              <Txt fontFamily={SANS} fontSize={df} lineHeight={df * 1.3} fill={C.muted} text={t} />
            ))}
          </Flex>
        ) : null}
      </Rect>
    ) as Rect;
  }

  /** Layout point → position inside root (screen pixels from the viewport centre). */
  toLocal(p: Point) {
    return new Vector2((p.x - this.cx()) * this.s(), (p.y - this.cy()) * this.s());
  }

  has(id: string) {
    return !!this.layout.boxes[id];
  }

  // ---- camera -------------------------------------------------------------

  whole(): Box {
    return {x: 0, y: 0, w: this.layout.width, h: this.layout.height};
  }
  /** The element plus every element it shares an edge with. */
  around(id: string, padBy = 14): Box {
    const ids = new Set([id]);
    for (const e of this.view.edges) if (e.from === id || e.to === id) ids.add(e.from === id ? e.to : e.from);
    return pad(union([...ids].map((x) => this.layout.boxes[x]).filter(Boolean)), padBy);
  }
  box(id: string): Box {
    return this.layout.boxes[id];
  }
  /** Screen box the whole view would occupy if fitted into vp. */
  fitted(vp: Box, margin = 20): Box {
    const f = fit(this.whole(), vp, margin);
    const w = this.layout.width * f.scale, h = this.layout.height * f.scale;
    return {x: vp.x + vp.w / 2 - w / 2, y: vp.y + vp.h / 2 - h / 2, w, h};
  }
  private solve(target: CameraTarget, vp: Box) {
    if ('region' in target) {
      const f = fit(target.region, vp, target.margin ?? 20);
      return {s: f.scale, cx: f.cx, cy: f.cy};
    }
    const b = this.layout.boxes[target.focus];
    const s = Math.min((vp.w * target.fill) / b.w, (vp.h * 0.65) / b.h);
    const c = centre(b);
    return {s, cx: c.x, cy: c.y};
  }
  /** Move the camera (and its viewport) to a target; duration 0 cuts. */
  *shoot(target: CameraTarget, vp: Box, duration = 0): ThreadGenerator {
    const cam = this.solve(target, vp);
    if (duration <= 0) {
      this.s(cam.s), this.cx(cam.cx), this.cy(cam.cy);
      this.vp.x(vp.x), this.vp.y(vp.y), this.vp.w(vp.w), this.vp.h(vp.h);
      return;
    }
    yield* all(
      this.s(cam.s, duration, easeInOutCubic, logLerp),
      this.cx(cam.cx, duration, easeInOutCubic),
      this.cy(cam.cy, duration, easeInOutCubic),
      this.vp.x(vp.x, duration, easeInOutCubic),
      this.vp.y(vp.y, duration, easeInOutCubic),
      this.vp.w(vp.w, duration, easeInOutCubic),
      this.vp.h(vp.h, duration, easeInOutCubic),
    );
  }

  // ---- beats --------------------------------------------------------------

  *light(id: string): ThreadGenerator {
    if (this.lit.has(id) || !this.boxes[id]) return;
    this.lit.add(id);
    yield* this.boxes[id].stroke(C.accent, 0.3);
  }

  /** Put the packet at the start of a hop (if it is not on the board yet) and show it. */
  *place(h: {from: string; to: string}): ThreadGenerator {
    if (!this.pktPts()) {
      this.pktPts(hopPath(this.view, this.layout, h.from, h.to));
      this.pktU(0);
    }
    yield* all(this.pktShown(1, 0.3), this.light(h.from));
  }

  /** The packet rides the routed edge from → to; lights the edge and the destination. */
  *hop(h: TimedHop): ThreadGenerator {
    const path = hopPath(this.view, this.layout, h.from, h.to);
    const cur = this.pktPts() ? along(this.pktPts()!, this.pktU()) : null;
    // Continue from wherever the packet is, so it never jumps across a box.
    const pts = cur && Math.hypot(cur.x - path[0].x, cur.y - path[0].y) > 1 ? [cur, ...path] : path;
    this.pktPts(pts);
    this.pktU(0);
    const edge = h.edge ? this.edges[h.edge] : undefined;
    const w = edge?.line.lineWidth() ?? 0;
    yield* all(
      this.pktShown(1, 0.2),
      this.light(h.from),
      this.pktU(1, h.duration, easeInOutCubic),
      edge
        ? chain(
            all(edge.line.stroke(C.packet, 0.2), edge.line.lineWidth(w * 1.8, 0.2)),
            waitFor(Math.max(0, h.duration - 0.4)),
            all(edge.line.stroke(C.accent, 0.2), edge.line.lineWidth(w * 1.4, 0.2)),
          )
        : waitFor(0),
      delay(h.duration * 0.6, this.light(h.to)),
    );
  }

  /** A pill under the element, in the tone's colour. */
  *badge(elementId: string, text: string, tone: string): ThreadGenerator {
    const b = this.layout.boxes[elementId];
    const anchor = {x: b.x + b.w / 2, y: b.y + b.h};
    this.badges[elementId]?.remove();
    const pill = (
      <Rect
        position={() => this.toLocal(anchor).add([0, 15])}
        opacity={0}
        scale={0.8}
        radius={6}
        padding={[4, 10]}
        fill={TONE[tone] ?? C.accent}
        layout
      >
        <Txt fontFamily={SANS} fontSize={14} fontWeight={700} fill={C.bg} text={text} />
      </Rect>
    ) as Rect;
    this.badges[elementId] = pill;
    this.overlay.add(pill);
    yield* all(pill.opacity(1, 0.35), pill.scale(1, 0.35));
  }

  /** Dim skipped elements and edges, with a note above them. */
  *skip(elements: string[], edges: string[], note?: string): ThreadGenerator {
    const fades = [
      ...elements.filter((id) => this.boxes[id]).map((id) => this.boxes[id].opacity(0.3, 0.5)),
      ...edges.filter((id) => this.edges[id]).map((id) => this.edges[id].group.opacity(0.3, 0.5)),
    ];
    if (note && elements.length) {
      const u = union(elements.map((id) => this.layout.boxes[id]).filter(Boolean));
      const anchor = {x: u.x + u.w / 2, y: u.y};
      const shown = createSignal(0);
      const txt = (
        <Txt
          position={() => this.toLocal(anchor).add([0, -13])}
          opacity={() => shown() * this.notesShown()}
          fontFamily={SANS}
          fontSize={14}
          fill={C.muted}
          text={note}
        />
      ) as Txt;
      this.notes.push(txt);
      this.overlay.add(txt);
      fades.push(shown(1, 0.5));
    }
    yield* all(...fades);
  }

  /** Mark the element a code scene is "inside" (the context element). */
  *context(id: string, on: boolean, duration = 0.5): ThreadGenerator {
    const b = this.boxes[id];
    if (!b) return;
    yield* all(
      b.fill(on ? C.focusFill : this.view.nodes.find((n) => n.id === id)?.external ? C.external : C.panel, duration),
      b.stroke(on ? C.glow : this.lit.has(id) ? C.accent : C.border, duration),
    );
  }

  /** Light one element and the relationships touching it; dim the rest. */
  *focus(id: string, duration = 0.6): ThreadGenerator {
    const anims: ThreadGenerator[] = [];
    for (const [eid, box] of Object.entries(this.boxes)) {
      if (eid === id) anims.push(box.fill(C.focusFill, duration), box.stroke(C.glow, duration), box.shadowBlur(26, duration));
      else anims.push(box.opacity(0.4, duration));
    }
    for (const e of this.view.edges) {
      const g = this.edges[e.id];
      if (!g) continue;
      if (e.from === id || e.to === id) anims.push(g.line.stroke(C.glow, duration), g.line.lineWidth(g.line.lineWidth() * 1.8, duration));
      else anims.push(g.group.opacity(0.35, duration));
    }
    yield* all(...anims);
  }
}
