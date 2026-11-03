import { Circle, Defs, Ellipse, G, LinearGradient, Path, Rect, Stop, Svg } from 'react-native-svg';
import { getStageThemeForCode } from './stageThemes';

export type FlagStatus = 'locked' | 'unlocked' | 'available' | 'completed';

// The marker is authored in a fixed 64x68 space; `size` scales it uniformly via the viewBox.
export const FLAG_WIDTH = 76;
const FLAG_HEIGHT = 82;

type Prim =
  | { c: [number, number, number]; s?: number }
  | { r: [number, number, number, number, number?]; s?: number }
  | { p: string; s?: number };

// Banner silhouettes in local space: x = 0..29 outward from the pole, y = 0..22 down.
// `emblem` is the fitted placement box for the emblem (which is drawn around its own 0,0).
// Emblems are drawn around (0,0) in the center of each lesson medallion.
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

const DISC_MARKS: Record<'completed' | 'current' | 'locked', Prim[]> = {
  completed: [{ p: 'M-3.8 0 L-1.3 2.8 L4 -3', s: 2 }],
  current: [
    { p: 'M0 -4.6 L1.4 -1.5 L4.8 -1.1 L2.3 1.2 L2.9 4.6 L0 3 L-2.9 4.6 L-2.3 1.2 L-4.8 -1.1 L-1.4 -1.5 Z' },
  ],
  locked: [
    { r: [-3.4, -0.8, 6.8, 5.4, 1.3] },
    { p: 'M-2 -0.8 L-2 -2.6 Q-2 -4.6 0 -4.6 Q2 -4.6 2 -2.6 L2 -0.8', s: 1.4 },
  ],
};

export interface FlagPalette {
  main: string;
  shade: string;
}

export function getFlagPalette(code: string | undefined): FlagPalette {
  const stageTheme = getStageThemeForCode(code);
  return { main: stageTheme.accent, shade: stageTheme.shade };
}

// Each lesson keeps a recognizable topic glyph and a distinct badge silhouette.
const FLAG_BY_LESSON: Record<string, { shape: string; emblem: string }> = {
  's1-greetings': { shape: 'rect', emblem: 'greet' },
  's1-introductions': { shape: 'arch', emblem: 'person' },
  's1-numbers': { shape: 'pennant', emblem: 'count' },
  's1-family': { shape: 'chevron', emblem: 'family' },
  's1-food': { shape: 'notch', emblem: 'cup' },
  's2-food': { shape: 'scallop', emblem: 'plate' },
  's2-shopping': { shape: 'rect', emblem: 'bag' },
  's2-daily-activities': { shape: 'fork', emblem: 'clock' },
  's2-transportation': { shape: 'arch', emblem: 'car' },
  's2-hobbies': { shape: 'wave', emblem: 'note' },
  's3-travel': { shape: 'pennant', emblem: 'plane' },
  's3-school': { shape: 'rect', emblem: 'book' },
  's3-hobbies': { shape: 'chevron', emblem: 'sun' },
  's3-job-interview': { shape: 'notch', emblem: 'brief' },
  's3-technology': { shape: 'scallop', emblem: 'chip' },
  's4-telephone': { shape: 'arch', emblem: 'handset' },
  's4-meetings': { shape: 'fork', emblem: 'table' },
  's4-emails': { shape: 'rect', emblem: 'mail' },
  's4-workplace': { shape: 'wave', emblem: 'monitor' },
  's4-negotiation': { shape: 'chevron', emblem: 'deal' },
  's5-opinions': { shape: 'notch', emblem: 'idea' },
  's5-storytelling': { shape: 'scallop', emblem: 'story' },
  's5-goals': { shape: 'pennant', emblem: 'target' },
  's5-discussion': { shape: 'arch', emblem: 'debate' },
  's5-review': { shape: 'fork', emblem: 'review' },
  's6-idioms': { shape: 'rect', emblem: 'quote' },
  's6-academic': { shape: 'wave', emblem: 'cap' },
  's6-grammar': { shape: 'notch', emblem: 'grammar' },
  's6-rhetoric': { shape: 'scallop', emblem: 'podium' },
  's6-masterclass': { shape: 'pennant', emblem: 'crown' },
};

const SHAPE_CYCLE = ['rect', 'fork', 'pennant', 'wave', 'arch', 'chevron', 'notch', 'scallop'];
const EMBLEM_CYCLE = Object.keys(EMBLEMS);

const BADGE_SHAPES: Record<string, string> = {
  rect: 'M38 5 C54 5 66 17 66 34 C66 51 54 65 38 68 C22 65 10 51 10 34 C10 17 22 5 38 5 Z',
  fork: 'M38 5 C51 5 62 13 66 26 L61 36 L66 46 C61 60 51 66 38 68 C25 66 15 60 10 46 L15 36 L10 26 C14 13 25 5 38 5 Z',
  pennant: 'M38 5 C53 8 64 19 66 35 C63 51 53 63 38 68 C23 63 13 51 10 35 C12 19 23 8 38 5 Z',
  wave: 'M38 5 C52 5 65 16 66 31 C66 47 55 63 38 68 C21 63 10 47 10 31 C11 16 24 5 38 5 Z',
  arch: 'M38 5 C54 5 66 15 66 31 L66 44 C66 58 54 67 38 68 C22 67 10 58 10 44 L10 31 C10 15 22 5 38 5 Z',
  chevron: 'M38 5 C52 5 64 16 66 31 L62 48 L38 68 L14 48 L10 31 C12 16 24 5 38 5 Z',
  notch: 'M38 5 C54 5 66 17 66 34 L62 49 L38 68 L14 49 L10 34 C10 17 22 5 38 5 Z',
  scallop: 'M38 5 C51 5 61 14 66 26 C61 31 61 39 66 44 C61 58 51 66 38 68 C25 66 15 58 10 44 C15 39 15 31 10 26 C15 14 25 5 38 5 Z',
};

function designFor(code: string) {
  const known = FLAG_BY_LESSON[code];
  if (known) return known;
  let hash = 0;
  for (let index = 0; index < code.length; index += 1) {
    hash = (hash * 31 + code.charCodeAt(index)) % 9973;
  }
  return {
    shape: SHAPE_CYCLE[hash % SHAPE_CYCLE.length],
    emblem: EMBLEM_CYCLE[Math.floor(hash / SHAPE_CYCLE.length) % EMBLEM_CYCLE.length],
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

interface FlagMarkerProps {
  code: string;
  mirrored: boolean;
  status: FlagStatus;
  size?: number;
  theme: 'light' | 'dark';
}

export default function FlagMarker({ code, mirrored, status, size = FLAG_WIDTH, theme }: FlagMarkerProps) {
  const { shape, emblem } = designFor(code);
  const isCompleted = status === 'completed';
  const isLocked = status === 'locked';
  const stageTheme = getStageThemeForCode(code);
  const palette = isLocked
    ? theme === 'dark'
      ? { main: '#58656F', shade: '#3D4852' }
      : { main: '#B9C6CE', shade: '#8999A4' }
    : { main: stageTheme.accent, shade: stageTheme.shade };
  const badgePath = BADGE_SHAPES[shape] ?? BADGE_SHAPES.rect;
  const gradientId = `lesson-${code.replace(/[^a-zA-Z0-9]/g, '-')}-fill`;
  const discState: keyof typeof DISC_MARKS = isCompleted ? 'completed' : isLocked ? 'locked' : 'current';
  const discFill = isCompleted ? '#F2BE54' : isLocked ? (theme === 'dark' ? '#3A4650' : '#71818D') : stageTheme.shade;
  const discMarkColor = isLocked ? '#F1F4F5' : '#FFFFFF';

  return (
    <Svg width={size} height={size * (FLAG_HEIGHT / FLAG_WIDTH)} viewBox={`0 0 ${FLAG_WIDTH} ${FLAG_HEIGHT}`}>
      <Defs>
        <LinearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
          <Stop offset="0" stopColor={palette.main} />
          <Stop offset="1" stopColor={palette.shade} />
        </LinearGradient>
      </Defs>
      <Ellipse cx="38" cy="74" rx="22" ry="5" fill="#263A3D" opacity={theme === 'dark' ? 0.3 : 0.15} />
      <Path d={badgePath} fill={palette.shade} stroke="#FFFFFF" strokeOpacity={theme === 'dark' ? 0.12 : 0.65} strokeWidth="2" />
      <G transform="translate(38 36.5) scale(0.9) translate(-38 -36.5)">
        <Path d={badgePath} fill={`url(#${gradientId})`} stroke="#FFFFFF" strokeOpacity={isLocked ? 0.12 : 0.5} strokeWidth="1.5" />
      </G>
      <Path d="M22 18 Q28 11 37 10" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" opacity={isLocked ? 0.2 : 0.5} />
      <Circle cx={mirrored ? 18 : 58} cy="19" r="2" fill="#FFFFFF" opacity={isLocked ? 0.22 : 0.84} />
      <G transform="translate(38 35) scale(0.9)">
        {(EMBLEMS[emblem] ?? EMBLEMS.greet).map((prim, index) => (
          <Glyph key={index} prim={prim} color={isLocked ? '#E6ECEF' : '#FFFDF4'} />
        ))}
      </G>
      <Circle cx="57" cy="59" r="10.5" fill="#FFFFFF" opacity={theme === 'dark' ? 0.16 : 0.85} />
      <Circle cx="57" cy="59" r="8.5" fill={discFill} />
      <G transform="translate(57 59) scale(0.92)">
        {DISC_MARKS[discState].map((prim, index) => (
          <Glyph key={index} prim={prim} color={discMarkColor} />
        ))}
      </G>
    </Svg>
  );
}
