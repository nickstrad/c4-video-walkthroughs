// C4 dataset → one view's display data. Pure: the dataset JSON goes in, a
// renderer-neutral View comes out (names, kinds, edges with display numbers,
// the dynamic view's scenario). Renderers draw Views; they never read datasets.

/** The slice of the book-notes C4 dataset format this module reads. */
export type Dataset = {
  revision: string;
  model: {
    elements: { id: string; kind: string; name: string; description: string; technology?: string; tags?: string[]; status: string; parentId?: string; sourceIds?: string[] }[];
    relationships: { id: string; sourceId: string; targetId: string; label: string; technology?: string; sourceIds?: string[] }[];
  };
  diagrams: {
    id: string; kind: string; title: string; scopeId?: string;
    nodes: { elementId: string; detail?: { diagramId: string } }[];
    edges: { relationshipId: string; displayNumber: number }[];
    layout?: { mode: string; direction: string };
    scenario?: { children: { id: string; relationshipId: string; direction: "forward" | "reverse"; label: string }[] };
  }[];
  sources: { id: string; title: string; url: string; revision: string; path: string; notes: string }[];
  documents?: { id: string; title: string; plain: string }[];
};

export type ViewElement = {
  id: string; kind: string; name: string; description: string;
  technology: string | null; tags: string[]; external: boolean;
  /** Drawn inside the view's scope boundary (its parent is the scope). */
  inScope: boolean;
};
export type ViewEdge = { id: string; n: number; from: string; to: string; label: string; technology: string | null };
export type ScenarioStep = { id: string; edge: string; direction: "forward" | "reverse"; label: string };
export type View = {
  id: string; kind: string; title: string; datasetRevision: string;
  /** The dataset's layout hint (LR, TB, …). */
  direction: string;
  scope: ViewElement | null;
  nodes: ViewElement[];
  edges: ViewEdge[];
  scenario: ScenarioStep[];
};

export function projectView(ds: Dataset, viewId: string): View {
  const d = ds.diagrams.find((x) => x.id === viewId);
  if (!d) throw new Error(`dataset has no view ${viewId}`);
  const els = new Map(ds.model.elements.map((e) => [e.id, e]));
  const rels = new Map(ds.model.relationships.map((r) => [r.id, r]));
  const el = (id: string): ViewElement => {
    const e = els.get(id);
    if (!e) throw new Error(`view ${viewId}: no element ${id}`);
    const tags = e.tags ?? [];
    return {
      id: e.id, kind: e.kind, name: e.name, description: e.description,
      technology: e.technology ?? null, tags, external: tags.includes("external"),
      inScope: !!d.scopeId && e.parentId === d.scopeId,
    };
  };
  return {
    id: d.id, kind: d.kind, title: d.title, datasetRevision: ds.revision,
    direction: d.layout?.direction ?? "LR",
    scope: d.scopeId ? { ...el(d.scopeId), inScope: false } : null,
    nodes: d.nodes.map((n) => el(n.elementId)),
    edges: d.edges.map((e) => {
      const r = rels.get(e.relationshipId);
      if (!r) throw new Error(`view ${viewId}: no relationship ${e.relationshipId}`);
      return { id: r.id, n: e.displayNumber, from: r.sourceId, to: r.targetId, label: r.label, technology: r.technology ?? null };
    }),
    scenario: (d.scenario?.children ?? []).map((c) => ({ id: c.id, edge: c.relationshipId, direction: c.direction, label: c.label })),
  };
}

/**
 * The dataset source selector cited by a model item (element or relationship)
 * for a piece of code: the anchor that ties an excerpt to the diagram.
 */
export function sourceSelector(ds: Dataset, citedBy: string, sourceId: string) {
  const item = ds.model.elements.find((x) => x.id === citedBy) ?? ds.model.relationships.find((x) => x.id === citedBy);
  if (!item) throw new Error(`no element or relationship ${citedBy}`);
  if (!(item as { sourceIds?: string[] }).sourceIds?.includes(sourceId)) throw new Error(`${citedBy} does not cite source ${sourceId}`);
  const s = ds.sources.find((x) => x.id === sourceId);
  if (!s) throw new Error(`no source ${sourceId}`);
  const line = Number(/line (\d+)/.exec(s.notes)?.[1]);
  return { ...s, line: Number.isFinite(line) ? line : null };
}
