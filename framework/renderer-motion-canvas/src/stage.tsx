// The stage: every on-screen component, built once from the bundle, and the
// one move between them — `transition(shot)`. A scene kind says *what* it
// wants on screen (a Shot); the stage works out how to get there from what is
// showing now (camera moves, morphs, fades). New transitions plug in here.
import {Node, type View2D} from '@motion-canvas/2d';
import {all, delay, easeInOutCubic, type ThreadGenerator} from '@motion-canvas/core';
import {fit, packetLabelAt, type Box, type Excerpt, type RenderBundle} from '../../core/src/index.ts';
import {CodePanel, StepRail} from './code.tsx';
import {DiagramView, type CameraTarget} from './diagram.tsx';
import {captions, statePanel, titleCard, viewHeader} from './panels.tsx';
import {screenLayout, type ScreenLayout} from './theme.ts';

export type Shot = {
  /** A diagram on screen: which view, where (screen box), and what the camera frames. */
  diagram?: {view: string; vp: Box; target: CameraTarget; notes?: boolean; context?: string};
  /** The code panel: which excerpt, where. */
  code?: {excerpt: string; box: Box};
  state?: boolean;
  rail?: boolean;
  /** Small one-line view header, or the big title card with a heading. */
  header?: {kind: 'line'} | {kind: 'card'; heading: string};
};

export const SHOT_MOVE = 0.8; // s, a camera move or morph between shots

export class Stage {
  readonly L: ScreenLayout;
  readonly diagrams: Record<string, DiagramView> = {};
  readonly code: CodePanel;
  readonly rail: StepRail;
  private readonly state: Node | null;
  private readonly header: ReturnType<typeof viewHeader>;
  private readonly card: ReturnType<typeof titleCard>;
  private cur: Shot = {};

  constructor(
    readonly b: RenderBundle,
    readonly clock: () => number,
    view: View2D,
  ) {
    const screen = {width: b.timeline.width, height: b.timeline.height};
    const L = (this.L = screenLayout(screen));
    const label = () => packetLabelAt(b, clock());
    for (const [id, {view: v, layout}] of Object.entries(b.views)) {
      // Text is sized to read at the view's full-screen fit.
      const design = fit({x: 0, y: 0, w: layout.width, h: layout.height}, L.diagram, 20).scale;
      this.diagrams[id] = new DiagramView(v, layout, screen, design, label);
      view.add(this.diagrams[id].root);
    }
    this.code = new CodePanel(screen, (x) => this.ownerOf(x));
    this.rail = new StepRail(screen, L.rail);
    this.state = b.storyboard.statePanel ? statePanel(b, b.storyboard.statePanel, clock, L.statePanel, screen) : null;
    this.header = viewHeader(L.header, L.statePanel.x - L.header.x - 20, screen);
    this.card = titleCard(L.titleCard, screen);
    view.add(this.code.root);
    view.add(this.rail.root);
    if (this.state) view.add(this.state);
    view.add(this.header.root);
    view.add(this.card.root);
    view.add(captions(b, clock, L.caption, screen));
  }

  /** The element (or relationship) an excerpt implements, by its name in any view. */
  private ownerOf(x: Excerpt): string | undefined {
    const spec = this.b.storyboard.excerpts.find((e) => e.id === x.id);
    const id = spec?.elementId;
    if (!id) return undefined;
    for (const {view} of Object.values(this.b.views)) {
      const n = view.nodes.find((e) => e.id === id) ?? (view.scope?.id === id ? view.scope : undefined);
      if (n) return n.name;
    }
    return undefined;
  }

  excerpt(id: string): Excerpt {
    const x = this.b.excerpts[id];
    if (!x) throw new Error(`bundle has no excerpt ${id}`);
    return x;
  }

  diagram(id: string): DiagramView {
    const d = this.diagrams[id];
    if (!d) throw new Error(`bundle has no view ${id}`);
    return d;
  }

  get current(): Readonly<Shot> {
    return this.cur;
  }

  /** Move from the current shot to `next`. */
  *transition(next: Shot, d = SHOT_MOVE): ThreadGenerator {
    const prev = this.cur;
    this.cur = next;
    const anims: ThreadGenerator[] = [];
    // Panels entering while the code panel moves wait for it to get out of
    // their way; a view entering while another leaves waits for it to clear.
    const codeMoves = !!prev.code && !!next.code && prev.code.box !== next.code.box;
    const viewLeaves = !!prev.diagram && prev.diagram.view !== next.diagram?.view;
    const enter = (anim: ThreadGenerator, after = codeMoves ? d * 0.5 : 0) => (after > 0 ? delay(after, anim) : anim);

    // Diagrams: the shot's view moves (or fades in); the others leave. A view
    // that the next view zooms into (the next view's scope is one of its
    // boxes) pushes in on that box as it fades: "entering" the element.
    for (const [id, dv] of Object.entries(this.diagrams)) {
      const want = next.diagram?.view === id ? next.diagram : undefined;
      const was = prev.diagram?.view === id ? prev.diagram : undefined;
      if (want) {
        if (was) anims.push(dv.shoot(want.target, want.vp, d));
        else {
          anims.push(dv.shoot(want.target, want.vp, 0));
          anims.push(enter(dv.root.opacity(1, d * 0.6), codeMoves ? d * 0.5 : viewLeaves ? d * 0.25 : 0));
        }
        anims.push(dv.notesShown(want.notes === false ? 0 : 1, d * 0.5));
        if (was?.context !== want.context) {
          if (was?.context) anims.push(dv.context(was.context, false));
          if (want.context) anims.push(dv.context(want.context, true));
        }
      } else if (was) {
        const into = next.diagram && this.b.views[next.diagram.view]?.view.scope?.id;
        if (into && dv.has(into)) anims.push(dv.shoot({region: dv.box(into), margin: 0}, was.vp, d));
        anims.push(dv.root.opacity(0, d * 0.6));
      }
    }

    // Code: enter at its box, or morph to the new excerpt / box, or leave.
    if (next.code) {
      const x = this.excerpt(next.code.excerpt);
      if (prev.code) {
        if (prev.code.excerpt !== next.code.excerpt || prev.code.box !== next.code.box) anims.push(this.code.show(x, next.code.box, d));
      } else {
        anims.push(this.code.show(x, next.code.box, 0));
        anims.push(this.code.root.opacity(1, d * 0.6));
      }
    } else if (prev.code) anims.push(this.code.root.opacity(0, d * 0.6));

    if (this.state && !!next.state !== !!prev.state) anims.push(next.state ? enter(this.state.opacity(1, d * 0.5)) : this.state.opacity(0, d * 0.4));
    if (!!next.rail !== !!prev.rail) anims.push(delay(next.rail ? d * 0.4 : 0, this.rail.root.opacity(next.rail ? 1 : 0, d * 0.6)));

    // Headers follow the diagram on screen.
    const view = next.diagram && this.b.views[next.diagram.view]?.view;
    const line = next.header?.kind === 'line' && view, card = next.header?.kind === 'card' && view;
    if (line) this.header.set(view);
    if (card && next.header?.kind === 'card') this.card.set(view, next.header.heading);
    anims.push(this.header.root.opacity(line ? 1 : 0, d * 0.5), this.card.root.opacity(card ? 1 : 0, d * 0.5));

    yield* all(...anims);
  }

  /** Record a shot reached by a scene's own moves (e.g. a focus zoom), without animating. */
  assume(shot: Shot) {
    this.cur = shot;
  }

  /** Fade the title card (e.g. as a focus zoom takes the screen). */
  *dropHeader(d = 0.5): ThreadGenerator {
    this.cur = {...this.cur, header: undefined};
    yield* all(this.card.root.opacity(0, d, easeInOutCubic), this.header.root.opacity(0, d));
  }
}
