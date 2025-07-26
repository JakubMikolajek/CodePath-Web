import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  out: './src/drizzle',
  schema: './src/modules/db/schema/*',
  dialect: 'postgresql',
  dbCredentials: {
    url: 'postgres://postgres:postgres@192.168.1.245:5432/codepath',
  },
})
