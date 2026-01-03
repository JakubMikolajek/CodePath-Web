import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dbCredentials: {
    url: 'postgres://postgres:postgres@127.0.0.1:5432/codepath'
  },
  dialect: 'postgresql',
  out: './src/drizzle',
  schema: './src/modules/db/schema/*'
})
