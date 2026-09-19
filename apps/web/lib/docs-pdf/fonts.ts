const FONT_FILES = {
  Code: {
    bold: 'DejaVuSansMono-Bold.ttf',
    bolditalics: 'DejaVuSansMono-BoldOblique.ttf',
    italics: 'DejaVuSansMono-Oblique.ttf',
    normal: 'DejaVuSansMono.ttf'
  },
  Roboto: {
    bold: 'Roboto-Medium.ttf',
    bolditalics: 'Roboto-MediumItalic.ttf',
    italics: 'Roboto-Italic.ttf',
    normal: 'Roboto-Regular.ttf'
  }
} as const

let cachedFonts: Promise<Record<string, string>> | undefined

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''

  for (const byte of bytes) binary += String.fromCharCode(byte)

  return btoa(binary)
}

export async function loadPdfFonts(): Promise<Record<string, string>> {
  cachedFonts ??= Promise.all(Object.values(FONT_FILES).flatMap(Object.values).map(async file => {
    const response = await fetch(`/fonts/${file}`)
    if (!response.ok) throw new Error(`Could not load PDF font ${file}`)

    return [file, toBase64(await response.arrayBuffer())] as const
  })).then(entries => Object.fromEntries(entries) as Record<string, string>)

  return cachedFonts
}

export const pdfFonts = FONT_FILES
