// @ts-check
import { dirname } from 'path'
import { fileURLToPath } from 'url'
import { initNextJsEslint } from '@workspace/eslint-config/next'

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default initNextJsEslint(__dirname)
