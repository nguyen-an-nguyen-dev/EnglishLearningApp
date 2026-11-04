export interface DictationToken {
  raw: string
  clean: string
}

export function tokenizeDictation(text: string): DictationToken[] {
  const words = text.match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu) ?? []
  return words.map((raw) => ({
    raw,
    clean: raw.toLocaleLowerCase('en').replace(/[^a-z0-9]/g, ''),
  })).filter((token) => token.clean.length > 0)
}

export interface DictationMatch {
  revealed: Set<number>
  prefixes: Map<number, number>
}

function commonPrefix(a: string, b: string): number {
  const limit = Math.min(a.length, b.length)
  let index = 0
  while (index < limit && a[index] === b[index]) index += 1
  return index
}

// The sentence is revealed strictly in order: finished words stay open, the next word
// keeps the letters the learner already typed correctly, and every word after stays masked.
export function matchDictation(
  script: DictationToken[],
  typed: DictationToken[],
): DictationMatch {
  const revealed = new Set<number>()
  const prefixes = new Map<number, number>()

  for (let index = 0; index < script.length; index += 1) {
    const typedToken = typed[index]
    if (!typedToken) break
    const target = script[index]
    if (typedToken.clean === target.clean) {
      revealed.add(index)
      continue
    }
    // A near miss ("excuta" vs "excute") still keeps its correct head, so the word
    // reads "Excut*" instead of collapsing back to "******".
    const shared = commonPrefix(typedToken.clean, target.clean)
    if (shared > 0) prefixes.set(index, Math.min(shared, target.raw.length))
    break
  }

  return { revealed, prefixes }
}
