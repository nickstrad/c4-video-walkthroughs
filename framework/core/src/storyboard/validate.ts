// Structural checks on a storyboard against the dataset views it names. Pure:
// returns a list of problems, empty when the storyboard is renderable. The
// pinned-git checks live in code-source/; the cue-phrase checks in
// narration/timeline.ts, where the spoken text is known.
import type { Dataset, View } from "../diagram/view.ts";
import { BEATS, type BeatScenes } from "../beats/registry.ts";
import { PATTERNS } from "../beats/patterns.ts";
import { hopEdge } from "../play.ts";
import { DIAGRAM_KINDS, SCHEMA, contextAt, isCodeScene, takesOf, type BeatRole, type Hop, type Range, type Scene, type Storyboard } from "./schema.ts";

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
      else if (v && !hopEdge(v, h)) err(`${s.id}: no edge joins ${h.from} and ${h.to} in ${v.id}; name one`);
      checkCue(s, h.cue);
    }
  };

  for (const [i, s] of sb.scenes.entries()) {
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
      const ctx = contextAt(sb.scenes, i);
      const v = ctx ? checkView(s, ctx.view) : undefined;
      if (s.context?.elementId) checkEl(s, v, s.context.elementId);
      if (s.hops && !ctx) err(`${s.id}: hops in a code scene need a context view`);
      checkHops(s, v, s.hops);
      checkCue(s, s.packet?.cue);
      checkCue(s, s.enter);
    } else if (s.kind === "repo-card") {
      if (s.view) checkView(s, s.view);
    } else if (s.kind === "credits") {
      const captions = takesOf(s).map((t) => t.caption).join(" ");
      for (const n of s.names ?? []) if (!captions.includes(n)) err(`${s.id}: name ${n} is not in any caption of the scene`);
    } else {
      if (!(DIAGRAM_KINDS as readonly string[]).includes(s.kind)) { err(`${s.id}: unknown kind ${(s as Scene).kind}`); continue; }
      const v = checkView(s, s.view);
      if (s.descend || s.settle) {
        if (s.kind !== "architecture-overview") err(`${s.id}: descend and settle are architecture-overview fields`);
        if (s.descend && s.settle) err(`${s.id}: descend or settle, not both`);
        const to = s.descend ?? s.settle!;
        checkEl(s, v, to.elementId);
        checkCue(s, to.cue);
      }
      if (s.responsibilities) {
        if (s.kind !== "focus-element") err(`${s.id}: responsibilities is a focus-element field`);
        for (const r of s.responsibilities) checkCue(s, r.cue);
      }
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
  errs.push(...validateArc(sb));
  return errs;
}

/**
 * The arc rules (docs/story-arc-plan.md § 1.2). Pure. No arc: nothing to
 * check. Otherwise every beat is an act with a role, in the storyboard's act
 * order; no scene lies outside a beat unless its act is optional; the
 * pattern's required roles are present and every role sits in pattern order;
 * each beat holds only its role's scene kinds and passes the role's checks.
 */
export function validateArc(sb: Storyboard): string[] {
  const arc = sb.arc;
  if (!arc) return [];
  const errs: string[] = [];
  const err = (m: string) => errs.push(m);
  if (!sb.acts) return ["arc: an arc needs acts (each beat is an act)"];
  const pattern = PATTERNS[arc.pattern];
  if (!pattern) err(`arc: unknown pattern ${arc.pattern} (known: ${Object.keys(PATTERNS).join(", ")})`);
  const acts = new Map(sb.acts.map((a) => [a.id, a]));
  if (new Set(arc.beats).size !== arc.beats.length) err("arc: a beat is listed twice");
  const actOrder = sb.acts.map((a) => a.id);
  let lastAct = -1, lastSlot = -1;
  const roles: BeatRole[] = [];
  for (const id of arc.beats) {
    const a = acts.get(id);
    if (!a) { err(`arc: beat ${id} is not an act`); continue; }
    if (actOrder.indexOf(id) < lastAct) err(`arc: beat ${id} is out of the storyboard's act order`);
    lastAct = actOrder.indexOf(id);
    if (!a.role) { err(`arc: beat ${id} has no role`); continue; }
    const def = BEATS[a.role];
    if (!def) { err(`arc: beat ${id}: unknown role ${a.role}`); continue; }
    if (def.reserved) { err(`arc: beat ${id}: role ${a.role} is ${def.reserved}`); continue; }
    if (a.variant !== undefined) err(`arc: beat ${id}: role ${a.role} has no variant ${a.variant}`);
    roles.push(a.role);
    if (pattern) {
      const slot = pattern.slots.findIndex((x) => x.role === a.role);
      if (slot < 0) err(`arc: beat ${id}: role ${a.role} has no slot in pattern ${pattern.id}`);
      else if (slot < lastSlot) err(`arc: beat ${id}: role ${a.role} is out of pattern ${pattern.id}'s order`);
      else if (slot === lastSlot) err(`arc: beat ${id}: a second ${a.role} beat`);
      else lastSlot = slot;
    }
    const scenes: BeatScenes = sb.scenes.flatMap((scene, i) => (scene.act === id ? [{ scene, i }] : []));
    if (!scenes.length) err(`arc: beat ${id} has no scenes`);
    for (const { scene } of scenes) if (!def.kinds.includes(scene.kind)) err(`${scene.id}: kind ${scene.kind} is not allowed in a ${a.role} beat (allowed: ${def.kinds.join(", ")})`);
    errs.push(...(def.validate?.(a, scenes, sb) ?? []));
  }
  if (pattern) for (const slot of pattern.slots) if (slot.required && !roles.includes(slot.role)) err(`arc: pattern ${pattern.id} requires a ${slot.role} beat`);
  for (const a of sb.acts) if (!arc.beats.includes(a.id) && !a.optional) err(`arc: act ${a.id} is outside the arc; list it in arc.beats or mark it optional`);
  return errs;
}

/**
 * Every C4 reference the storyboard makes exists in the dataset itself: views
 * in its diagrams, excerpt bindings in its model, scenario steps in their
 * view. Run before views are projected, so a typo is a listed problem rather
 * than a thrown projection error. Pure.
 */
export function validateRefs(sb: Storyboard, ds: Dataset): string[] {
  const errs: string[] = [];
  const diagrams = new Map(ds.diagrams.map((d) => [d.id, d]));
  const elements = new Set(ds.model.elements.map((e) => e.id));
  const rels = new Set(ds.model.relationships.map((r) => r.id));
  for (const x of sb.excerpts) {
    if (x.elementId && !elements.has(x.elementId)) errs.push(`excerpt ${x.id}: element ${x.elementId} not in the dataset model`);
    if (x.relationshipId && !rels.has(x.relationshipId)) errs.push(`excerpt ${x.id}: relationship ${x.relationshipId} not in the dataset model`);
  }
  for (const [i, s] of sb.scenes.entries()) {
    if (s.kind === "repo-card" && !elements.has(s.elementId)) errs.push(`${s.id}: element ${s.elementId} not in the dataset model`);
    if (!isCodeScene(s) && s.kind !== "repo-card" && s.kind !== "credits" && s.descend) {
      const node = diagrams.get(s.view)?.nodes.find((n) => n.elementId === s.descend!.elementId);
      const next = sb.scenes[i + 1];
      const nextView = next && !isCodeScene(next) && next.kind !== "credits" ? next.view : undefined;
      if (!node?.detail?.diagramId) errs.push(`${s.id}: descend element ${s.descend.elementId} has no detail view in ${s.view}`);
      else if (nextView !== node.detail.diagramId) errs.push(`${s.id}: descend into ${s.descend.elementId} must be followed by its detail view ${node.detail.diagramId}, not ${nextView ?? "(no diagram)"}`);
    }
    if (s.kind === "credits") continue;
    const viewId = isCodeScene(s) ? s.context?.view : s.view;
    if (viewId === undefined) {
      if (s.datasetStep) errs.push(`${s.id}: datasetStep ${s.datasetStep} needs a view or context view`);
      continue;
    }
    const d = diagrams.get(viewId);
    if (!d) { errs.push(`${s.id}: view ${viewId} not in the dataset's diagrams`); continue; }
    if (s.datasetStep && !d.scenario?.children.some((c) => c.id === s.datasetStep)) errs.push(`${s.id}: datasetStep ${s.datasetStep} not in ${viewId}'s scenario`);
  }
  return errs;
}
