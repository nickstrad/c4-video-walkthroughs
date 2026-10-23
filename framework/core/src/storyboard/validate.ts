// Structural checks on a storyboard against the dataset views it names. Pure:
// returns a list of problems, empty when the storyboard is renderable. The
// pinned-git checks live in code-source/; the cue-phrase checks in
// narration/timeline.ts, where the spoken text is known.
import type { View } from "../diagram/view.ts";
import { DIAGRAM_KINDS, SCHEMA, isCodeScene, type Hop, type Range, type Scene, type Storyboard } from "./schema.ts";

const inside = ([a, b]: Range, [lo, hi]: Range) => a >= lo && b <= hi && a <= b;

export function validateStoryboard(sb: Storyboard, views: Record<string, View>): string[] {
  const errs: string[] = [];
  const err = (m: string) => errs.push(m);
  if (sb.schema !== SCHEMA) err(`schema is ${sb.schema}, expected ${SCHEMA}`);
  const ids = new Set<string>();
  for (const s of sb.scenes) {
    if (ids.has(s.id)) err(`duplicate scene id ${s.id}`);
    ids.add(s.id);
  }
  const excerpts = new Map(sb.excerpts.map((e) => [e.id, e]));
  for (const x of sb.excerpts) if (x.kind === "evidence" && x.wholeFunction) err(`excerpt ${x.id}: evidence cannot be wholeFunction`);
  if (sb.acts) {
    const order = sb.acts.map((a) => a.id);
    if (new Set(order).size !== order.length) err("duplicate act id");
    let at = -1;
    for (const s of sb.scenes) {
      const k = s.act === undefined ? -1 : order.indexOf(s.act);
      if (k < 0) { err(`${s.id}: act ${s.act ?? "(none)"} is not in acts`); continue; }
      if (k < at) err(`${s.id}: act ${s.act} resumes after a later act; an act's scenes must be contiguous and in order`);
      at = k;
    }
  } else for (const s of sb.scenes) if (s.act !== undefined) err(`${s.id}: act ${s.act} but the storyboard declares no acts`);
  const fields = new Map((sb.statePanel?.fields ?? []).map((f) => [f.id, f]));

  const checkView = (s: Scene, viewId: string) => {
    const v = views[viewId];
    if (!v) err(`${s.id}: view ${viewId} not in dataset`);
    return v;
  };
  const checkEl = (s: Scene, v: View | undefined, id: string) => {
    if (v && !v.nodes.some((n) => n.id === id)) err(`${s.id}: element ${id} not in view ${v.id}`);
  };
  const checkEdge = (s: Scene, v: View | undefined, id: string) => {
    if (v && !v.edges.some((e) => e.id === id)) err(`${s.id}: relationship ${id} not in view ${v.id}`);
  };
  const checkCue = (s: Scene, cue: string | undefined) => {
    if (cue !== undefined && !(s.narration?.cues && cue in s.narration.cues)) err(`${s.id}: cue ${cue} is not declared in narration.cues`);
  };
  const checkHops = (s: Scene, v: View | undefined, hops: Hop[] = []) => {
    for (const h of hops) {
      checkEl(s, v, h.from);
      checkEl(s, v, h.to);
      if (h.edge) checkEdge(s, v, h.edge);
      checkCue(s, h.cue);
    }
  };

  for (const s of sb.scenes) {
    const says = [s.caption !== undefined, isCodeScene(s) && !!s.steps, !!s.lines].filter(Boolean).length;
    if (says !== 1) err(`${s.id}: a scene says exactly one of caption, steps or lines`);
    if (s.lines) {
      if (!s.lines.length) err(`${s.id}: lines is empty`);
      if (new Set(s.lines.map((l) => l.id)).size !== s.lines.length) err(`${s.id}: duplicate line id`);
      if (s.narration?.take) err(`${s.id}: narration.take names one take; a multi-line scene sets take per line`);
    }
    for (const c of s.state ?? []) {
      if (!fields.has(c.field)) err(`${s.id}: state field ${c.field} not in statePanel`);
      checkCue(s, c.cue);
    }
    if (isCodeScene(s)) {
      const x = excerpts.get(s.excerpt);
      if (!x) { err(`${s.id}: excerpt ${s.excerpt} not declared`); continue; }
      for (const f of s.focus ?? []) {
        checkCue(s, f.cue);
        for (const r of f.ranges) if (!inside(r, x.lines)) err(`${s.id}: focus ${r} outside ${x.id} ${x.lines}`);
      }
      for (const st of s.steps ?? []) if (!inside(st.lines, x.lines)) err(`${s.id}: step ${st.id} ${st.lines} outside ${x.id} ${x.lines}`);
      if (s.steps && s.focus) err(`${s.id}: use steps or focus, not both`);
      const v = s.context ? checkView(s, s.context.view) : undefined;
      if (s.context?.elementId) checkEl(s, v, s.context.elementId);
      if (s.hops && !s.context) err(`${s.id}: hops in a code scene need a context view`);
      checkHops(s, v, s.hops);
      checkCue(s, s.packet?.cue);
    } else {
      if (!(DIAGRAM_KINDS as readonly string[]).includes(s.kind)) { err(`${s.id}: unknown kind ${(s as Scene).kind}`); continue; }
      const v = checkView(s, s.view);
      if (s.kind === "focus-element") {
        if (!s.elementId) err(`${s.id}: focus-element needs elementId`);
        else checkEl(s, v, s.elementId);
      }
      checkHops(s, v, s.hops);
      checkCue(s, s.packet?.cue);
      if (s.badge) { checkEl(s, v, s.badge.elementId); checkCue(s, s.badge.cue); }
      if (s.skip) {
        s.skip.elements.forEach((e) => checkEl(s, v, e));
        s.skip.edges.forEach((e) => checkEdge(s, v, e));
        checkCue(s, s.skip.cue);
      }
    }
  }
  return errs;
}
