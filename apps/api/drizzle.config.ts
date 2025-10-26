import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dbCredentials: {
    url: 'postgres://postgres:postgres@192.168.1.245:5432/codepath'
  },
  dialect: 'postgresql',
  out: './src/drizzle',
  schema: './src/modules/db/schema/*'
})
