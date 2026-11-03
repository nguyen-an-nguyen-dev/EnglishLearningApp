import { Circle, Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Rect, Stop, Svg } from 'react-native-svg';
import { getStageThemeForCode } from './stageThemes';

export type CheckpointStatus = 'locked' | 'unlocked' | 'available' | 'completed';

// Authored in a fixed 76x82 space; `size` scales it through the viewBox.
export const CHECKPOINT_WIDTH = 76;
const CHECKPOINT_HEIGHT = 82;

type Prim =
  | { c: [number, number, number]; s?: number }
  | { r: [number, number, number, number, number?]; s?: number }
  | { p: string; s?: number };

// Topic glyphs, drawn around their own (0,0) and fitted into each checkpoint medallion.
const EMBLEMS: Record<string, Prim[]> = {
  greet: [
    { r: [-8, -6.5, 11.5, 8.5, 3] }, { p: 'M-5.5 2 L-5.5 5.8 L-1.8 2 Z' },
    { c: [-5, -2.2, 0.95] }, { c: [-2.2, -2.2, 0.95] }, { c: [0.6, -2.2, 0.95] },
    { r: [0.5, -0.5, 7.5, 6.5, 2.6] },
  ],
  person: [{ c: [-1, -4.2, 2.7] }, { p: 'M-6.8 6.2 Q-6.8 -0.6 0 -0.6 Q6.8 -0.6 6.8 6.2 Z' }],
  count: [
    { r: [-7, 0, 3, 6.5, 1.4] }, { r: [-2.2, -4, 3, 10.5, 1.4] }, { r: [2.6, -7, 3, 13.5, 1.4] },
  ],
  family: [
    { p: 'M-8.5 -0.5 L0 -7.5 L8.5 -0.5 Z' }, { r: [-6.2, -0.5, 12.4, 8, 1] }, { c: [0, 3, 1.9] },
  ],
  cup: [
    { p: 'M-6 -4 L4 -4 L3 5 Q3 6.6 1.4 6.6 L-3.6 6.6 Q-5 6.6 -5.2 5 Z' },
    { c: [6.2, 0, 2.7], s: 1.6 }, { r: [-7.5, 7, 14, 1.7, 0.85] },
  ],
  plate: [
    { c: [-0.5, 0, 5.6], s: 1.6 }, { c: [-0.5, 0, 2.2] },
    { r: [-8.6, -6, 1.7, 12, 0.85] }, { r: [6, -6, 1.7, 12, 0.85] },
  ],
  bag: [
    { r: [-6.2, -1.8, 12.4, 8.8, 1.7] }, { p: 'M-3.2 -1.8 L-3.2 -4 Q-3.2 -7 0 -7 Q3.2 -7 3.2 -4 L3.2 -1.8', s: 1.6 },
  ],
  clock: [
    { c: [0, 0, 6.5], s: 1.7 }, { r: [-0.7, -4.2, 1.4, 4.9, 0.7] }, { r: [0, -0.7, 3.8, 1.4, 0.7] },
  ],
  car: [
    { p: 'M-7.5 1.5 L-5.5 -3.5 Q-5 -4.8 -3.6 -4.8 L3.6 -4.8 Q5 -4.8 5.6 -3.5 L7.6 1.5 Z' },
    { r: [-8.4, 1, 16.8, 3.8, 1.7] }, { c: [-4.6, 5.6, 2.1] }, { c: [4.6, 5.6, 2.1] },
  ],
  note: [
    { c: [-3.6, 4.4, 2.9] }, { r: [-1, -6.8, 1.7, 10.8, 0.7] },
    { p: 'M-1 -6.8 Q5.2 -6.2 5.2 -1.4 Q3 -3.6 -1 -3.6 Z' },
  ],
  plane: [{ p: 'M-8.2 0.8 L1.6 -1.2 L7 -7.4 L8.6 -6.2 L6.6 0.9 L8.6 8 L7 9.2 L1.6 3 L-6.4 5 Z' }],
  book: [
    { p: 'M-8 -4.6 Q-3 -6.6 0 -4.4 L0 6.2 Q-3 4.2 -8 5.6 Z' },
    { p: 'M8 -4.6 Q3 -6.6 0 -4.4 L0 6.2 Q3 4.2 8 5.6 Z' },
  ],
  sun: [
    { c: [-2, -2.6, 3.5] }, { p: 'M-8.6 6.6 Q-3.4 0.4 1 4 Q4.6 6.6 8.6 6.6 L8.6 7.6 L-8.6 7.6 Z' },
  ],
  brief: [
    { r: [-7.6, -2.4, 15.2, 9.8, 1.8] },
    { p: 'M-3 -2.4 L-3 -5.2 Q-3 -6.6 -1.6 -6.6 L1.6 -6.6 Q3 -6.6 3 -5.2 L3 -2.4', s: 1.6 },
    { r: [-1.2, 1, 2.4, 3.2, 0.8] },
  ],
  chip: [
    { r: [-4.6, -4.6, 9.2, 9.2, 1.5] }, { r: [-2, -2, 4, 4, 0.9] },
    { p: 'M-4.6 -6.8 L4.6 -6.8 M-4.6 6.8 L4.6 6.8 M-6.8 -4.6 L-6.8 4.6 M6.8 -4.6 L6.8 4.6', s: 1.4 },
  ],
  handset: [
    { p: 'M-6.6 -7 Q-2.6 -6.4 -1.4 -2 Q-0.2 2.4 3.4 4.8 Q6.4 6.8 7.4 4.2 L7.6 7 Q7.4 8.8 5 8.2 Q-5.6 5.6 -8 -4.4 Q-8.4 -6.6 -6.6 -7 Z' },
  ],
  table: [
    { c: [0, -4.4, 2.3] }, { c: [-5.8, 2.2, 2.3] }, { c: [5.8, 2.2, 2.3] }, { c: [0, 2.2, 3.6], s: 1.5 },
  ],
  mail: [{ r: [-8, -5.2, 16, 11, 1.7] }, { p: 'M-7.4 -4.4 L0 1.6 L7.4 -4.4', s: 1.6 }],
  monitor: [
    { r: [-7.6, -6.6, 15.2, 10, 1.7] }, { r: [-1.5, 3.4, 3, 3.2] }, { r: [-5.2, 6.6, 10.4, 1.9, 0.95] },
  ],
  deal: [
    { p: 'M-8.2 -1.6 L-3.4 -5.6 L-3.4 -2.2 Q1 -2.2 3.2 -0.2 L8.2 -0.2 L8.2 3.2 L2.4 3.2 Q-0.6 3.2 -3.4 4.4 L-3.4 7.2 Z' },
    { p: 'M-6.4 6.8 L6.4 6.8', s: 1.4 },
  ],
  idea: [
    { r: [-7.2, -7.2, 14.4, 11.4, 3.6] }, { p: 'M-2.2 4.2 L-2.2 7.6 L2.2 4.2 Z' },
    { c: [-3.6, -1.6, 1.2] }, { c: [0, -1.6, 1.2] }, { c: [3.6, -1.6, 1.2] },
  ],
  story: [
    { p: 'M-8.4 -3.4 Q-2.6 -6 0 -2.6 L0 6.6 Q-3.4 4.6 -8.4 5.8 Z' },
    { p: 'M8.4 -3.4 Q2.6 -6 0 -2.6 L0 6.6 Q3.4 4.6 8.4 5.8 Z' },
    { p: 'M3.4 -8.4 L4.4 -5.8 L7 -5.8 L4.9 -4.1 L5.7 -1.6 L3.4 -3.2 L1.1 -1.6 L1.9 -4.1 L-0.2 -5.8 L2.4 -5.8 Z' },
  ],
  target: [{ c: [0, 0, 6.8], s: 1.7 }, { c: [0, 0, 3.3], s: 1.7 }, { c: [0, 0, 1.3] }],
  debate: [
    { r: [-8.2, -6.4, 10.6, 8, 2.8] }, { p: 'M-5.4 1.6 L-5.4 4.8 L-1.8 1.6 Z' },
    { r: [-0.4, -0.6, 8.8, 7.2, 2.6] }, { p: 'M4.2 6.6 L4.2 9 L1.4 6.6 Z' },
  ],
  review: [
    { p: 'M5.6 -4 A6.8 6.8 0 1 0 6.8 2.6', s: 1.9 }, { p: 'M3.4 -7.6 L8.8 -3.4 L3.2 -1.4 Z' },
  ],
  quote: [
    { p: 'M-8.4 -2.6 Q-8.4 -7.4 -3.6 -7.4 Q-3.6 -3.6 -6.2 -2.4 Q-3.6 -1 -3.6 2.4 Q-8.4 2.4 -8.4 -2.6 Z' },
    { p: 'M0.6 -2.6 Q0.6 -7.4 5.4 -7.4 Q5.4 -3.6 2.8 -2.4 Q5.4 -1 5.4 2.4 Q0.6 2.4 0.6 -2.6 Z' },
  ],
  cap: [
    { p: 'M0 -6.4 L9.2 -2.4 L0 1.6 L-9.2 -2.4 Z' },
    { p: 'M-5.2 -0.4 L-5.2 4 Q-2.6 6.2 0 6.2 Q2.6 6.2 5.2 4 L5.2 -0.4 L0 1.8 Z' },
    { r: [6.8, -1.6, 1.5, 5.8, 0.75] },
  ],
  grammar: [
    { p: 'M-8.6 6.2 L-4.6 -6.2 L-0.6 6.2 L-2.8 6.2 L-4.6 0.4 L-6.4 6.2 Z' },
    { r: [-6.9, 2.4, 4.6, 1.5, 0.75] },
    { p: 'M7.8 6.2 L7.8 -0.6 Q7.8 -3.4 5.2 -3.4 Q2.6 -3.4 2.6 -0.6 L2.6 6.2 L4.4 6.2 L4.4 -0.8 Q4.4 -2 5.3 -2 Q6.2 -2 6.2 -0.8 L6.2 6.2 Z' },
  ],
  podium: [
    { p: 'M-6 6.4 L-2.2 -1.4 L2.2 -1.4 L6 6.4 Z' }, { c: [0, -4.6, 2.7] }, { r: [-8.2, 6.6, 16.4, 1.9, 0.95] },
  ],
  crown: [
    { p: 'M-8.2 4.4 L-8.2 -4 L-3.8 0.6 L0 -6.2 L3.8 0.6 L8.2 -4 L8.2 4.4 Z' },
    { r: [-8.2, 5.2, 16.4, 2.6, 1.1] },
  ],
};

// Trackside structure per lesson. `head` is authored around (0,0); `medal` is the topic disc.
const HEADS: Record<string, { head: Prim[]; medal: [number, number, number] }> = {
  gantry: {
    head: [
      { p: 'M-26 24 V2 Q-26 -18 0 -18 Q26 -18 26 2 V24', s: 6 },
      { r: [-26, -22, 52, 9, 3] },
    ],
    medal: [0, 8, 11.5],
  },
  sign: {
    head: [
      { r: [-28, -21, 56, 32, 7] },
      { r: [-3, 11, 6, 13] },
      { r: [-14, 22, 28, 3, 1.5] },
    ],
    medal: [0, -5, 12],
  },
  totem: {
    head: [
      { r: [-13, -23, 26, 47, 11] },
      { p: 'M-13 -13 L13 -13', s: 3 },
    ],
    medal: [0, -8, 10.5],
  },
  fuel: {
    head: [
      { r: [-24, -20, 44, 44, 7] },
      { p: 'M20 -6 Q27 -2 27 10 L27 18', s: 3 },
      { r: [23, -14, 7, 9, 2] },
    ],
    medal: [-3, -2, 11.5],
  },
  board: {
    head: [
      { r: [-28, -21, 56, 33, 5] },
      { r: [-24, -18, 48, 6, 2] },
      { r: [-3, 12, 6, 12] },
    ],
    medal: [0, 2, 11],
  },
};

const CAP_MARKS: Record<'completed' | 'active' | 'locked', Prim[]> = {
  completed: [{ p: 'M-3.8 0 L-1.3 2.8 L4 -3', s: 2 }],
  active: [
    { p: 'M0 -4.6 L1.4 -1.5 L4.8 -1.1 L2.3 1.2 L2.9 4.6 L0 3 L-2.9 4.6 L-2.3 1.2 L-4.8 -1.1 L-1.4 -1.5 Z' },
  ],
  locked: [
    { r: [-3.4, -0.8, 6.8, 5.4, 1.3] },
    { p: 'M-2 -0.8 L-2 -2.6 Q-2 -4.6 0 -4.6 Q2 -4.6 2 -2.6 L2 -0.8', s: 1.4 },
  ],
};

export interface CheckpointPalette {
  main: string;
  shade: string;
}

export function getCheckpointPalette(code: string | undefined): CheckpointPalette {
  const stageTheme = getStageThemeForCode(code);
  return { main: stageTheme.accent, shade: stageTheme.shade };
}

const CHECKPOINT_BY_LESSON: Record<string, { kind: string; emblem: string }> = {
  's1-greetings': { kind: 'sign', emblem: 'greet' },
  's1-introductions': { kind: 'gantry', emblem: 'person' },
  's1-numbers': { kind: 'totem', emblem: 'count' },
  's1-family': { kind: 'board', emblem: 'family' },
  's1-food': { kind: 'fuel', emblem: 'cup' },
  's2-food': { kind: 'sign', emblem: 'plate' },
  's2-shopping': { kind: 'gantry', emblem: 'bag' },
  's2-daily-activities': { kind: 'totem', emblem: 'clock' },
  's2-transportation': { kind: 'board', emblem: 'car' },
  's2-hobbies': { kind: 'fuel', emblem: 'note' },
  's3-travel': { kind: 'sign', emblem: 'plane' },
  's3-school': { kind: 'gantry', emblem: 'book' },
  's3-hobbies': { kind: 'totem', emblem: 'sun' },
  's3-job-interview': { kind: 'board', emblem: 'brief' },
  's3-technology': { kind: 'fuel', emblem: 'chip' },
  's4-telephone': { kind: 'sign', emblem: 'handset' },
  's4-meetings': { kind: 'gantry', emblem: 'table' },
  's4-emails': { kind: 'totem', emblem: 'mail' },
  's4-workplace': { kind: 'board', emblem: 'monitor' },
  's4-negotiation': { kind: 'fuel', emblem: 'deal' },
  's5-opinions': { kind: 'sign', emblem: 'idea' },
  's5-storytelling': { kind: 'gantry', emblem: 'story' },
  's5-goals': { kind: 'totem', emblem: 'target' },
  's5-discussion': { kind: 'board', emblem: 'debate' },
  's5-review': { kind: 'fuel', emblem: 'review' },
  's6-idioms': { kind: 'sign', emblem: 'quote' },
  's6-academic': { kind: 'gantry', emblem: 'cap' },
  's6-grammar': { kind: 'totem', emblem: 'grammar' },
  's6-rhetoric': { kind: 'board', emblem: 'podium' },
  's6-masterclass': { kind: 'fuel', emblem: 'crown' },
};

const KIND_CYCLE = ['sign', 'gantry', 'totem', 'board', 'fuel'];
const EMBLEM_CYCLE = Object.keys(EMBLEMS);

function designFor(code: string) {
  const known = CHECKPOINT_BY_LESSON[code];
  if (known) return known;
  let hash = 0;
  for (let index = 0; index < code.length; index += 1) {
    hash = (hash * 31 + code.charCodeAt(index)) % 9973;
  }
  return {
    kind: KIND_CYCLE[hash % KIND_CYCLE.length],
    emblem: EMBLEM_CYCLE[Math.floor(hash / KIND_CYCLE.length) % EMBLEM_CYCLE.length],
  };
}

function Glyph({ prim, color }: { prim: Prim; color: string }) {
  if ('c' in prim) {
    const [cx, cy, r] = prim.c;
    const stroked = prim.s !== undefined;
    return (
      <Circle
        cx={cx}
        cy={cy}
        r={r}
        fill={stroked ? 'none' : color}
        stroke={stroked ? color : 'none'}
        strokeWidth={prim.s ?? 0}
      />
    );
  }
  if ('r' in prim) {
    const [x, y, w, h, rx] = prim.r;
    return <Rect x={x} y={y} width={w} height={h} rx={rx ?? 0} fill={color} />;
  }
  const stroked = prim.s !== undefined;
  return (
    <Path
      d={prim.p}
      fill={stroked ? 'none' : color}
      stroke={stroked ? color : 'none'}
      strokeWidth={prim.s ?? 0}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}

interface CheckpointMarkerProps {
  code: string;
  mirrored: boolean;
  status: CheckpointStatus;
  size?: number;
  theme: 'light' | 'dark';
}

export default function CheckpointMarker({
  code,
  mirrored,
  status,
  size = CHECKPOINT_WIDTH,
  theme,
}: CheckpointMarkerProps) {
  const { kind, emblem } = designFor(code);
  const design = HEADS[kind] ?? HEADS.sign;
  const isCompleted = status === 'completed';
  const isLocked = status === 'locked';
  const stageTheme = getStageThemeForCode(code);
  const palette = isLocked
    ? theme === 'dark'
      ? { main: '#5A666F', shade: '#3E4952' }
      : { main: '#BAC7CF', shade: '#8A9AA5' }
    : { main: stageTheme.accent, shade: stageTheme.shade };
  const glowId = `cp-${code.replace(/[^a-zA-Z0-9]/g, '-')}-glow`;
  const fillId = `cp-${code.replace(/[^a-zA-Z0-9]/g, '-')}-body`;
  const capMark = isCompleted ? 'completed' : isLocked ? 'locked' : 'active';
  const capFill = isCompleted ? '#F2BE54' : isLocked ? (theme === 'dark' ? '#39454F' : '#72828E') : stageTheme.shade;
  const shellTint = isLocked ? '#E7EDEF' : '#FFFDF4';
  const headShift = mirrored ? (kind === 'fuel' ? 4 : 0) : kind === 'fuel' ? -4 : 0;

  return (
    <Svg width={size} height={size * (CHECKPOINT_HEIGHT / CHECKPOINT_WIDTH)} viewBox={`0 0 ${CHECKPOINT_WIDTH} ${CHECKPOINT_HEIGHT}`}>
      <Defs>
        <LinearGradient id={fillId} x1="0" x2="0" y1="0" y2="1">
          <Stop offset="0" stopColor={palette.main} />
          <Stop offset="1" stopColor={palette.shade} />
        </LinearGradient>
        <RadialGradient id={glowId} cx="0.5" cy="0.5" r="0.5">
          <Stop offset="0" stopColor={palette.main} stopOpacity={isLocked ? 0 : theme === 'dark' ? 0.42 : 0.3} />
          <Stop offset="1" stopColor={palette.main} stopOpacity="0" />
        </RadialGradient>
      </Defs>

      {!isLocked && <Circle cx="38" cy="30" r="30" fill={`url(#${glowId})`} />}
      <Ellipse cx="38" cy="75" rx="21" ry="4.6" fill="#1E2E33" opacity={theme === 'dark' ? 0.34 : 0.16} />

      <G transform={`translate(${38 + headShift} 26)`}>
        {design.head.map((prim, index) => (
          <Glyph key={index} prim={prim} color={palette.shade} />
        ))}
        {design.head.map((prim, index) => (
          <G key={`in-${index}`} transform="translate(0 -0.6) scale(0.9) translate(0 0.6)">
            <Glyph prim={prim} color={isLocked ? palette.main : `url(#${fillId})`} />
          </G>
        ))}
      </G>

      <Circle cx={38 + headShift} cy={26 + design.medal[1]} r={design.medal[2] + 2.4} fill="#FFFFFF" opacity={isLocked ? 0.24 : 0.9} />
      <Circle cx={38 + headShift} cy={26 + design.medal[1]} r={design.medal[2]} fill={isLocked ? (theme === 'dark' ? '#48545E' : '#9AAAB5') : palette.shade} />
      <G transform={`translate(${38 + headShift} ${26 + design.medal[1]}) scale(${design.medal[2] / 11})`}>
        {(EMBLEMS[emblem] ?? EMBLEMS.greet).map((prim, index) => (
          <Glyph key={index} prim={prim} color={shellTint} />
        ))}
      </G>

      <Rect x="21" y="60" width="34" height="10" rx="5" fill={palette.shade} />
      <Rect x="23" y="60" width="30" height="4" rx="2" fill="#FFFFFF" opacity={isLocked ? 0.14 : 0.3} />
      <Circle cx="38" cy="58" r="10.5" fill="#FFFFFF" opacity={theme === 'dark' ? 0.18 : 0.9} />
      <Circle cx="38" cy="58" r="8.6" fill={capFill} />
      <G transform="translate(38 58) scale(0.92)">
        {CAP_MARKS[capMark].map((prim, index) => (
          <Glyph key={index} prim={prim} color={isLocked ? '#F1F4F5' : '#FFFFFF'} />
        ))}
      </G>
    </Svg>
  );
}
