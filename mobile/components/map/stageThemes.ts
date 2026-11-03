export interface StageWorldTheme {
  name: string;
  accent: string;
  shade: string;
  sky: string;
  horizon: string;
  nightSky: string;
  nightHorizon: string;
  far: string;
  near: string;
  asphalt: string;
  asphaltEdge: string;
  shoulder: string;
  haze: string;
  /** The single colour the whole stage backdrop is painted with (light mode). */
  flat: string;
  /** Same colour for dark mode: tinted but low-chroma so it is neither heavy nor glaring. */
  flatNight: string;
}

export const TRACK_CURB_HOT = '#E2504B';
export const TRACK_CURB_COOL = '#F7F7F5';
export const TRACK_LINE = '#FFFDF6';

export function mixHex(from: string, to: string, amount: number): string {
  const read = (hex: string) => hex.slice(1).match(/../g)?.map((pair) => parseInt(pair, 16)) ?? [0, 0, 0];
  const a = read(from);
  const b = read(to);
  return `#${a
    .map((channel, index) => Math.round(channel + (b[index] ?? channel) * amount).toString(16).padStart(2, '0'))
    .join('')}`;
}

export const STAGE_WORLDS: StageWorldTheme[] = [
  {
    name: 'EMERALD FOREST',
    accent: '#45A978',
    shade: '#287B56',
    sky: '#DDF3E2',
    horizon: '#C4E7C3',
    nightSky: '#183B35',
    nightHorizon: '#24483B',
    far: '#91C99B',
    near: '#69B77F',
    asphalt: '#4B5750',
    asphaltEdge: '#38423C',
    shoulder: '#57A06F',
    haze: '#CBEBCB',
    flat: '#D8EEE1',
    flatNight: '#2D3E34',
  },
  {
    name: 'OCEAN WORLD',
    accent: '#35AFC0',
    shade: '#1C8296',
    sky: '#D8F1F4',
    horizon: '#BDE8E6',
    nightSky: '#173A49',
    nightHorizon: '#204954',
    far: '#77C8C0',
    near: '#56B8B8',
    asphalt: '#46555C',
    asphaltEdge: '#334248',
    shoulder: '#49A9A8',
    haze: '#C2E9E7',
    flat: '#D8EAEE',
    flatNight: '#2D3B3E',
  },
  {
    name: 'SUNSET DESERT',
    accent: '#F0A05A',
    shade: '#C76D36',
    sky: '#FCE8C8',
    horizon: '#F6D6A4',
    nightSky: '#493747',
    nightHorizon: '#59423B',
    far: '#E8B978',
    near: '#DDA45F',
    asphalt: '#544A41',
    asphaltEdge: '#3F372F',
    shoulder: '#CE9650',
    haze: '#F7DCAE',
    flat: '#EEE5D8',
    flatNight: '#3E372D',
  },
  {
    name: 'CRYSTAL KINGDOM',
    accent: '#9279D5',
    shade: '#6651A9',
    sky: '#E9E5FA',
    horizon: '#D7D1F3',
    nightSky: '#292849',
    nightHorizon: '#383554',
    far: '#AAA3DC',
    near: '#8986CA',
    asphalt: '#4A4763',
    asphaltEdge: '#36334A',
    shoulder: '#7A76B4',
    haze: '#DAD4F5',
    flat: '#E0D8EE',
    flatNight: '#332D3E',
  },
  {
    name: 'BLOSSOM GARDEN',
    accent: '#D979A5',
    shade: '#AB4F7A',
    sky: '#FBE6EF',
    horizon: '#F6D1E1',
    nightSky: '#482D46',
    nightHorizon: '#56394F',
    far: '#E9AFC5',
    near: '#D98EAE',
    asphalt: '#54464E',
    asphaltEdge: '#3E333A',
    shoulder: '#C57494',
    haze: '#F8D8E6',
    flat: '#EED8E2',
    flatNight: '#3E2D35',
  },
  {
    name: 'GOLDEN SKY',
    accent: '#D5AC49',
    shade: '#9E781F',
    sky: '#FFF1C9',
    horizon: '#F8DEA0',
    nightSky: '#51422F',
    nightHorizon: '#5D4936',
    far: '#E8C678',
    near: '#D7AD5C',
    asphalt: '#57503F',
    asphaltEdge: '#413B2D',
    shoulder: '#C9A85A',
    haze: '#FAE6B4',
    flat: '#EEEAD8',
    flatNight: '#3E3B2D',
  },
];

export function getStageWorldTheme(stageIndex: number): StageWorldTheme {
  return STAGE_WORLDS[((stageIndex % STAGE_WORLDS.length) + STAGE_WORLDS.length) % STAGE_WORLDS.length];
}

export function stageBaseColor(theme: StageWorldTheme, night: boolean): string {
  return night ? theme.flatNight : theme.flat;
}

export function getStageThemeForCode(code: string | undefined): StageWorldTheme {
  const stageNumber = Number(code?.match(/^s(\d+)-/)?.[1] ?? 1);
  return getStageWorldTheme(stageNumber - 1);
}
