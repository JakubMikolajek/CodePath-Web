export const normalizeFilePath = (value: string) => value
  .trim()
  .replaceAll('\\', '/')
  .replace(/^\.\/+/, '')
  .replace(/\/{2,}/g, '/')
