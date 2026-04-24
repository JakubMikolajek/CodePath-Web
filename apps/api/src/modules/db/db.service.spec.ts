import { shouldBootstrapLegacyMigrationBaseline } from './services/db.service'

describe('shouldBootstrapLegacyMigrationBaseline', () => {
  it('returns true when schema looks legacy and migration history is empty', () => {
    expect(
      shouldBootstrapLegacyMigrationBaseline(false, {
        dependencies: true,
        files: true,
        repos: true,
        users: true
      })
    ).toBe(true)
  })

  it('returns false when migration history already exists', () => {
    expect(
      shouldBootstrapLegacyMigrationBaseline(true, {
        dependencies: true,
        files: true,
        repos: true,
        users: true
      })
    ).toBe(false)
  })

  it('returns false when any required legacy table is missing', () => {
    expect(
      shouldBootstrapLegacyMigrationBaseline(false, {
        dependencies: true,
        files: true,
        repos: false,
        users: true
      })
    ).toBe(false)
  })
})
