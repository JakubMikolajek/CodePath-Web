export const IGNORED_DIRS = new Set([
  'node_modules', '.git', '.idea', '.vscode', 'dist', 'build', '.next', 'out',
  '.venv', '__pycache__', '.pytest_cache'
])

export const IGNORED_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico',
  '.zip', '.tar', '.gz', '.7z', '.exe', '.dll',
  '.pdf', '.mp4', '.mp3', '.mov', '.wasm'
])

export const IGNORED_FILES = new Set([
  'package.json', 'package-lock.json', 'yarn.lock',
  'pnpm-lock.yaml', 'bun.lockb', '.env', '.DS_Store',
  'README.md', 'LICENSE', 'LICENSE.md', 'CHANGELOG.md'
])
