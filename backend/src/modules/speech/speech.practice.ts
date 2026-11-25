export const PAUSE_THRESHOLD_SECONDS = 0.7;

export interface TimedWord {
  word: string;
  start: number;
  end: number;
}

interface AlignedWord {
  word: string;
  status: 'matched' | 'missing' | 'different';
  heard?: string;
}

function tokens(text: string): Array<{ word: string; key: string }> {
  return (text.match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu) ?? [])
    .map((word) => ({ word, key: word.normalize('NFKC').toLowerCase().replace(/’/g, "'") }));
}

export function alignWords(expected: string, submitted: string) {
  const target = tokens(expected);
  const spoken = tokens(submitted);
  const matches = Array.from({ length: target.length + 1 }, () => new Uint16Array(spoken.length + 1));
  for (let i = target.length - 1; i >= 0; i--) {
    for (let j = spoken.length - 1; j >= 0; j--) {
      matches[i][j] = target[i].key === spoken[j].key
        ? 1 + matches[i + 1][j + 1]
        : Math.max(matches[i + 1][j], matches[i][j + 1]);
    }
  }

  const words: AlignedWord[] = [];
  let i = 0;
  let j = 0;
  let expectedFrom = 0;
  let heardFrom = 0;
  const appendUnmatched = (end: number, heardEnd: number) => {
    while (expectedFrom < end) {
      const word = target[expectedFrom++].word;
      words.push(heardFrom < heardEnd
        ? { word, status: 'different', heard: spoken[heardFrom++].word }
        : { word, status: 'missing' });
    }
  };
  while (i < target.length && j < spoken.length) {
    if (target[i].key === spoken[j].key) {
      appendUnmatched(i, j);
      words.push({ word: target[i++].word, status: 'matched' });
      expectedFrom = i;
      heardFrom = ++j;
    } else if (matches[i + 1][j] >= matches[i][j + 1]) {
      i++;
    } else {
      j++;
    }
  }
  appendUnmatched(target.length, spoken.length);
  const matched = matches[0][0];
  return { words, matched, total: target.length, completeness: target.length ? matched / target.length : 0 };
}

export function measurePacing(words: readonly TimedWord[]) {
  if (words.length < 2) return null;
  const duration = words[words.length - 1].end - words[0].start;
  if (duration <= 0) return null;
  const pauses = words.slice(1).flatMap((word, index) => {
    const gap = word.start - words[index].end;
    return gap >= PAUSE_THRESHOLD_SECONDS - 1e-9
      ? [{ afterWord: words[index].word, beforeWord: word.word, seconds: Number(gap.toFixed(3)) }]
      : [];
  });
  return { wordsPerMinute: Math.round(words.length * 60 / duration), pauses };
}

export function readTimedWords(segments: unknown): TimedWord[] {
  if (!Array.isArray(segments)) return [];
  return segments.flatMap((segment: { words?: unknown } | null) => {
    if (!Array.isArray(segment?.words)) return [];
    return segment.words.flatMap((value: Partial<TimedWord> | null) => {
      if (!value || typeof value.word !== 'string' || !value.word.trim()
        || typeof value.start !== 'number' || typeof value.end !== 'number'
        || !Number.isFinite(value.start) || !Number.isFinite(value.end)
        || value.start < 0 || value.end < value.start) return [];
      return [{ word: value.word.trim(), start: value.start, end: value.end }];
    });
  }).sort((a, b) => a.start - b.start);
}
