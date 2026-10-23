// Panels driven straight by the core's playback queries at the current time:
// the state panel (storyboard.statePanel + stateAt), captions (captionAt) and
// the view titles. Nothing here holds a time of its own.
import {Layout as Flex, Node, Rect, Txt} from '@motion-canvas/2d';
import {createComputed} from '@motion-canvas/core';
import {captionAt, stateAt, type Box, type RenderBundle, type StatePanel as StatePanelSpec, type View} from '../../core/src/index.ts';
import {C, MONO, SANS, TONE} from './theme.ts';
import {SANS_ADVANCE, wrapText} from './text.ts';
import {viewKindName} from './diagram.tsx';

type Screen = {width: number; height: number};
const toScreen = (s: Screen, x: number, y: number): [number, number] => [x - s.width / 2, y - s.height / 2];

/** The illustrative state panel: one row per storyboard.statePanel field. */
export function statePanel(b: RenderBundle, spec: StatePanelSpec, clock: () => number, box: Box, s: Screen): Node {
  const vals = createComputed(() => stateAt(b, clock()));
  const labelW = Math.max(...spec.fields.map((f) => f.label.length));
  const font = 15;
  const tone = (id: string, fallback: string) => () => TONE[vals()[id]?.tone ?? ''] ?? fallback;
  const row = (f: StatePanelSpec['fields'][number]) => {
    const label = <Txt fontFamily={MONO} fontSize={font} fill={C.text} text={f.label.padEnd(labelW, ' ')} />;
    if (f.kind === 'slots') {
      const filled = () => Math.round(Number(vals()[f.id]?.value ?? 0));
      return (
        <Flex gap={8} alignItems="center">
          {label}
          {Array.from({length: f.of}, (_, i) => (
            <Rect
              width={22}
              height={16}
              radius={3}
              lineWidth={2}
              stroke={() => (i < filled() ? C.packet : C.muted)}
              fill={() => (i < filled() ? C.packet : C.bg)}
            />
          ))}
          {f.note ? <Txt fontFamily={MONO} fontSize={13} fill={C.muted} text={f.note} /> : null}
        </Flex>
      );
    }
    const text =
      f.kind === 'counter'
        ? () => `${Math.round(Number(vals()[f.id]?.value ?? f.initial))}${f.suffix ?? ''}`
        : () => String(vals()[f.id]?.value ?? f.initial);
    return (
      <Flex gap={10} alignItems="center">
        {label}
        <Txt fontFamily={MONO} fontSize={font} fill={tone(f.id, f.kind === 'counter' ? C.packet : C.muted)} text={text} />
      </Flex>
    );
  };
  const [x, y] = toScreen(s, box.x, box.y);
  return (
    <Flex opacity={0} x={x + 12} y={y + 8} offset={[-1, -1]} direction="column" gap={10} alignItems="start" layout>
      <Txt fontFamily={SANS} fontSize={14} fill={C.muted} text={spec.title} />
      {spec.fields.map(row)}
    </Flex>
  ) as Node;
}

/** Caption band: the timeline caption at the current time, faded in as it starts. */
export function captions(b: RenderBundle, clock: () => number, box: Box, s: Screen): Node {
  const cur = createComputed(() => captionAt(b, clock()));
  const maxW = box.w - 80;
  const layoutOf = (text: string) => {
    for (const font of [24, 22, 20]) {
      const ls = wrapText(text, maxW, font, SANS_ADVANCE * 1.02);
      if (ls.length <= 2) return {font, text: ls.join('\n')};
    }
    return {font: 20, text: wrapText(text, maxW, 20, SANS_ADVANCE * 1.02, 2).join('\n')};
  };
  const shaped = createComputed(() => {
    const c = cur();
    return c ? layoutOf(c.text) : null;
  });
  const [x, y] = toScreen(s, box.x + box.w / 2, box.y + box.h / 2);
  return (
    <Rect x={x} y={y} width={box.w} height={box.h} fill={C.caption}>
      <Txt
        fontFamily={SANS}
        fontSize={() => shaped()?.font ?? 24}
        lineHeight={() => (shaped()?.font ?? 24) * 1.25}
        textAlign="center"
        fill={C.text}
        text={() => shaped()?.text ?? ''}
        opacity={() => {
          const c = cur();
          return c ? Math.min(1, (clock() - c.start) / 0.2) : 0;
        }}
      />
    </Rect>
  ) as Rect;
}

/** Big title card for an overview: view kind, title, dataset revision. */
export function titleCard(at: {x: number; y: number}, s: Screen) {
  const kind = (<Txt fontFamily={SANS} fontWeight={700} fontSize={13} letterSpacing={1.5} fill={C.muted} text="" />) as Txt;
  const title = (<Txt fontFamily={SANS} fontWeight={700} fontSize={34} fill={C.text} text="" />) as Txt;
  const rev = (<Txt fontFamily={MONO} fontSize={14} fill={C.muted} text="" />) as Txt;
  const [x, y] = toScreen(s, at.x, at.y);
  const root = (
    <Flex opacity={0} x={x} y={y} offset={[-1, -1]} direction="column" gap={4} alignItems="start" layout>
      {kind}
      {title}
      {rev}
    </Flex>
  ) as Node;
  return {
    root,
    set(view: View, heading: string) {
      kind.text(viewKindName(view.kind));
      title.text(heading);
      rev.text(view.datasetRevision);
    },
  };
}

/** One-line header over a full-screen diagram: view kind · title · revision. */
export function viewHeader(at: {x: number; y: number}, maxW: number, s: Screen) {
  const txt = (<Txt fontFamily={SANS} fontSize={14} fill={C.muted} text="" />) as Txt;
  const [x, y] = toScreen(s, at.x, at.y);
  const root = (
    <Node opacity={0} x={x} y={y}>
      <Flex offset={[-1, -1]} layout>
        {txt}
      </Flex>
    </Node>
  ) as Node;
  return {
    root,
    set(view: View) {
      const full = `${viewKindName(view.kind)} · ${view.title} · ${view.datasetRevision}`;
      txt.text(wrapText(full, maxW, 14, SANS_ADVANCE, 1)[0]);
    },
  };
}
