const replacements: Record<string, string> = {
  '–': '-',
  '—': '--',
  '…': '...',
  '•': '-',
  '←': '<-',
  '→': '->',
  '×': 'x',
  '☐': '[ ]',
  '☑': '[x]',
  '✓': 'v',
  '✗': 'x'
}

/** Removes emoji and converts symbols not guaranteed by the embedded fonts. */
export function sanitizePdfText(value: string): string {
  return Array.from(value).map(character => {
    if (replacements[character]) return replacements[character]
    const codePoint = character.codePointAt(0)!
    // The embedded body face is verified for Latin Extended; reject other scripts/symbol planes
    // rather than allowing a missing glyph box into a generated document.
    if (!(codePoint <= 0x7e || (codePoint >= 0xa0 && codePoint <= 0x24f) || '“”‘’'.includes(character))) return '[symbol]'

    return character
  }).join('')
}
