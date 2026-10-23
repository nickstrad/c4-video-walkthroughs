import {
  Circle,
  Code,
  Layout,
  LezerHighlighter,
  Line,
  Node,
  Rect,
  Txt,
  lines,
  makeScene2D,
} from '@motion-canvas/2d';
import {
  Reference,
  ThreadGenerator,
  Vector2,
  all,
  chain,
  createRef,
  createSignal,
  delay,
  easeInOutCubic,
  sequence,
  waitFor,
} from '@motion-canvas/core';
import {parser} from '@lezer/go';
import board from '../../storyboard/query-flow.storyboard.json';
import extracted from '../snippets.json';

Code.defaultHighlighter = new LezerHighlighter(parser);

const C = {
  bg: '#0d1117',
  panel: '#161b22',
  border: '#30363d',
  text: '#e6edf3',
  muted: '#8b949e',
  accent: '#58a6ff',
  packet: '#f0b429',
  ok: '#3fb950',
  warn: '#f85149',
};
const MONO = 'DejaVu Sans Mono';
const SANS = 'DejaVu Sans';

type Snippet = {id: string; file: string; function: string; lines: [number, number]; text: string};
type Scene = {id: string; duration: number; caption: string; snippet?: string; highlight?: [number, number]; highlights?: [number, number][]};
const snippets = extracted.snippets as unknown as Record<string, Snippet>;
const scenes = board.scenes as unknown as Scene[];
const scene = (id: string) => scenes.find(s => s.id === id)!;

// Phase A layout: the query-flow dynamic view, cache-hit path in the bottom row.
const POS: Record<string, [number, number]> = {
  tenant: [-500, 70],
  ingress: [-280, 70],
  gateway: [-60, 70],
  node: [160, 70],
  'tenant-files': [380, 70],
  control: [-60, -120],
  registry: [160, -120],
};
const EDGES: [string, string, string, number][] = [
  ['tenant-edge', 'tenant', 'ingress', 1],
  ['balance', 'ingress', 'gateway', 2],
  ['resolve', 'gateway', 'control', 3],
  ['sql-registry', 'control', 'registry', 4],
  ['forward', 'gateway', 'node', 5],
  ['sql-tenant', 'node', 'tenant-files', 6],
];
const BOX = {w: 176, h: 88};
// The packet rides just above the boxes so it never covers their labels.
const LIFT: [number, number] = [0, -62];
const at = (id: string) => new Vector2(POS[id]).add(LIFT);

function anchor(from: string, to: string): [Vector2, Vector2] {
  const a = new Vector2(POS[from]);
  const b = new Vector2(POS[to]);
  const vertical = a.x === b.x;
  const dx = vertical ? 0 : Math.sign(b.x - a.x) * (BOX.w / 2 + 4);
  const dy = vertical ? Math.sign(b.y - a.y) * (BOX.h / 2 + 4) : 0;
  return [a.add([dx, dy]), b.add([-dx, -dy])];
}

function shortSha(s: string) {
  return s.slice(0, 7);
}

export default makeScene2D(function* (view) {
  view.fill(C.bg);

  const boxes: Record<string, Reference<Rect>> = {};
  const edges: Record<string, Reference<Line>> = {};
  const diagram = createRef<Node>();
  const packet = createRef<Rect>();
  const packetLabel = createRef<Txt>();
  const caption = createRef<Txt>();
  const title = createRef<Txt>();
  const cacheBadge = createRef<Rect>();
  const skipTag = createRef<Txt>();
  const panel = createRef<Rect>();
  const header = createRef<Txt>();
  const gutter = createRef<Code>();
  const code = createRef<Code>();
  const state = createRef<Layout>();
  const epochTxt = createRef<Txt>();
  const lanes = [createRef<Rect>(), createRef<Rect>()];
  const rows = createSignal(0);
  const truncTxt = createRef<Txt>();

  for (const id of Object.keys(POS)) boxes[id] = createRef<Rect>();
  for (const [id] of EDGES) edges[id] = createRef<Line>();

  const el = (id: string) => board.elements.find(e => e.id === id)!;

  view.add(
    <>
      <Txt
        ref={title}
        x={-620}
        y={-330}
        offset={[-1, 0]}
        fontFamily={SANS}
        fontSize={20}
        fill={C.muted}
        text={`litefleet · C4 dynamic view "${board.dataset.diagramId}" · code @ ${board.code.tag} (${shortSha(board.code.commit)})`}
      />
      <Node ref={diagram}>
        {EDGES.map(([id, from, to, n]) => {
          const [a, b] = anchor(from, to);
          const mid = a.add(b).scale(0.5);
          return (
            <Node>
              <Line ref={edges[id]} points={[a, b]} stroke={C.border} lineWidth={3} endArrow arrowSize={12} />
              <Circle
                position={mid.add(a.x === b.x ? [18, 0] : [0, -18])}
                size={24}
                fill={C.panel}
                stroke={C.border}
                lineWidth={2}
              >
                <Txt fontFamily={SANS} fontSize={13} fill={C.muted} text={String(n)} />
              </Circle>
            </Node>
          );
        })}
        {Object.entries(POS).map(([id, [x, y]]) => (
          <Rect
            ref={boxes[id]}
            x={x}
            y={y}
            width={BOX.w}
            height={BOX.h}
            radius={10}
            fill={C.panel}
            stroke={C.border}
            lineWidth={3}
            layout
            direction="column"
            justifyContent="center"
            alignItems="center"
            gap={6}
          >
            <Txt fontFamily={SANS} fontSize={18} fontWeight={700} fill={C.text} text={el(id).label} />
            <Txt fontFamily={SANS} fontSize={13} fill={C.muted} text={el(id).tech} />
          </Rect>
        ))}
        <Rect
          ref={cacheBadge}
          x={-60}
          y={142}
          radius={6}
          padding={[4, 10]}
          fill={C.ok}
          opacity={0}
          layout
        >
          <Txt fontFamily={SANS} fontSize={14} fontWeight={700} fill={C.bg} text="route cache: HIT" />
        </Rect>
        <Txt ref={skipTag} x={50} y={-185} fontFamily={SANS} fontSize={15} fill={C.muted} opacity={0} text="steps 3-5 skipped on a live cache hit" />
        <Rect
          ref={packet}
          position={at('tenant')}
          radius={14}
          padding={[5, 12]}
          fill={C.packet}
          opacity={0}
          layout
        >
          <Txt ref={packetLabel} fontFamily={MONO} fontSize={14} fontWeight={700} fill={C.bg} text="SELECT … + API key" />
        </Rect>
      </Node>

      <Layout ref={state} x={330} y={-262} direction="column" gap={10} layout opacity={0} alignItems="start">
        <Txt fontFamily={SANS} fontSize={15} fill={C.muted} text="node state · illustrative request, not a live recording" />
        <Layout gap={10} alignItems="center">
          <Txt fontFamily={MONO} fontSize={15} fill={C.text} text="epoch    " />
          <Txt ref={epochTxt} fontFamily={MONO} fontSize={15} fill={C.muted} text="X-Epoch received" />
        </Layout>
        <Layout gap={8} alignItems="center">
          <Txt fontFamily={MONO} fontSize={15} fill={C.text} text="read lane" />
          {lanes.map(r => (
            <Rect ref={r} width={22} height={16} radius={3} stroke={C.muted} lineWidth={2} fill={C.bg} />
          ))}
          <Txt fontFamily={MONO} fontSize={13} fill={C.muted} text="(2 per database)" />
        </Layout>
        <Layout gap={10} alignItems="center">
          <Txt fontFamily={MONO} fontSize={15} fill={C.text} text="rows     " />
          <Txt fontFamily={MONO} fontSize={15} fill={C.packet} text={() => `${Math.round(rows())} / MaxRows 1000`} />
        </Layout>
        <Layout gap={10} alignItems="center">
          <Txt fontFamily={MONO} fontSize={15} fill={C.text} text="truncated" />
          <Txt ref={truncTxt} fontFamily={MONO} fontSize={15} fill={C.muted} text="false" />
        </Layout>
      </Layout>

      <Rect
        ref={panel}
        x={0}
        y={58}
        width={1250}
        height={460}
        radius={10}
        fill={C.panel}
        stroke={C.border}
        lineWidth={2}
        opacity={0}
        clip
      >
        <Txt ref={header} x={-605} y={-210} offset={[-1, 0]} fontFamily={MONO} fontSize={14} fill={C.accent} text="" />
        <Code ref={gutter} x={-605} y={-190} offset={[-1, -1]} fontFamily={MONO} fontSize={13} lineHeight={17} fill={C.muted} code="" highlighter={null} />
        <Code ref={code} x={-560} y={-190} offset={[-1, -1]} fontFamily={MONO} fontSize={13} lineHeight={17} code="" />
      </Rect>

      <Rect x={0} y={322} width={1280} height={72} fill={'#010409'}>
        <Txt ref={caption} fontFamily={SANS} fontSize={24} fill={C.text} text="" textAlign="center" width={1200} />
      </Rect>
    </>,
  );

  const numbers = (s: Snippet) => {
    const out: string[] = [];
    for (let n = s.lines[0]; n <= s.lines[1]; n++) out.push(String(n).padStart(3, ' '));
    return out.join('\n');
  };
  const headerFor = (s: Snippet) =>
    `${s.file.replace('books/release-it/project/', '')} · ${s.function} · L${s.lines[0]}–${s.lines[1]} · ${shortSha(board.code.commit)}`;
  // Storyboard line numbers are file-absolute; Code ranges are 0-based within the snippet.
  const select = (s: Snippet, ranges: [number, number][]) =>
    ranges.map(([a, b]) => lines(a - s.lines[0], b - s.lines[0]));

  function* say(id: string) {
    const s = scene(id);
    yield* caption().opacity(0, 0.15);
    caption().text(s.caption);
    yield* caption().opacity(1, 0.2);
  }
  // Each storyboard scene lasts exactly its duration; animations run inside it.
  function* beat(id: string, ...anims: ThreadGenerator[]) {
    yield* all(say(id), waitFor(scene(id).duration), ...anims);
  }
  function* light(id: string, on = true) {
    yield* boxes[id]().stroke(on ? C.accent : C.border, 0.3);
  }
  function* travel(from: string, to: string, edge?: string, t = 1.1) {
    packet().position(at(from));
    yield* all(
      packet().position(at(to), t, easeInOutCubic),
      edge ? chain(edges[edge]().stroke(C.packet, 0.2), delay(t - 0.2, edges[edge]().stroke(C.accent, 0.3))) : waitFor(0),
      delay(t * 0.6, light(to)),
    );
  }

  // Scene 1: the request leaves the tenant.
  yield* all(
    packet().opacity(1, 0.3),
    light('tenant'),
    beat('s1-request', delay(0.5, travel('tenant', 'ingress', 'tenant-edge'))),
  );
  yield* beat('s2-balance', travel('ingress', 'gateway', 'balance'));
  yield* beat(
    's3-cache-hit',
    cacheBadge().opacity(1, 0.4),
    delay(0.4, all(boxes.control().opacity(0.3, 0.5), boxes.registry().opacity(0.3, 0.5), edges.resolve().opacity(0.3, 0.5), edges['sql-registry']().opacity(0.3, 0.5), skipTag().opacity(1, 0.5))),
  );
  yield* beat(
    's4-forward',
    chain(packetLabel().text('SQL + X-Epoch', 0.3), travel('gateway', 'node', 'forward')),
  );

  // Scene 5: the camera pulls the diagram into a top strip and opens the node's code.
  const guards = snippets['query-guards'];
  header().text(headerFor(guards));
  gutter().code(numbers(guards));
  code().code(guards.text);
  yield* beat(
    's5-into-code',
    diagram().scale(0.5, 0.9, easeInOutCubic),
    diagram().position([-300, -262], 0.9, easeInOutCubic),
    title().opacity(0, 0.4),
    skipTag().opacity(0, 0.4),
    boxes.node().fill('#1f2a3a', 0.6),
    delay(0.4, all(panel().opacity(1, 0.5), state().opacity(1, 0.5))),
  );

  const s6 = scene('s6-read-only');
  yield* beat('s6-read-only', code().selection(select(guards, [s6.highlight!]), 0.5));
  const s7 = scene('s7-epoch');
  yield* beat(
    's7-epoch',
    code().selection(select(guards, [s7.highlight!]), 0.5),
    delay(0.6, all(epochTxt().text('matches handle epoch ✓', 0.4), epochTxt().fill(C.ok, 0.4))),
  );
  const s8 = scene('s8-lane');
  yield* beat(
    's8-lane',
    code().selection(select(guards, [s8.highlight!]), 0.5),
    delay(0.6, all(lanes[0]().fill(C.packet, 0.3), lanes[0]().stroke(C.packet, 0.3))),
  );

  // Scene 9: the code morphs to the row loop while rows stream from the file.
  const caps = snippets['query-caps'];
  const s9 = scene('s9-rows');
  yield* beat(
    's9-rows',
    chain(
      all(
        code().selection(lines(0, Infinity), 0.2),
        header().text(headerFor(caps), 0.4),
        gutter().code(numbers(caps), 0.6),
        code().code(caps.text, 0.6),
      ),
      code().selection(select(caps, s9.highlights!), 0.4),
    ),
    chain(packetLabel().text('rows', 0.2), travel('node', 'tenant-files', 'sql-tenant', 0.9), travel('tenant-files', 'node', undefined, 0.7)),
    delay(0.9, rows(640, 1.6)),
  );
  const s10 = scene('s10-caps');
  yield* beat(
    's10-caps',
    code().selection(select(caps, s10.highlights!), 0.5),
    sequence(0.2, rows(1000, 0.8), all(truncTxt().text('true', 0.3), truncTxt().fill(C.warn, 0.3))),
  );

  // Scene 11: the capped answer streams back to the tenant.
  yield* beat(
    's11-reply',
    all(code().selection(lines(0, Infinity), 0.4), lanes[0]().fill(C.bg, 0.4), packetLabel().text('rows + "truncated": true', 0.3)),
    chain(
      travel('node', 'gateway', undefined, 0.6),
      travel('gateway', 'ingress', undefined, 0.6),
      travel('ingress', 'tenant', undefined, 0.6),
    ),
  );
  yield* waitFor(0.4);
});
