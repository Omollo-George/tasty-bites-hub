import { defineWorkspace } from 'vitest/config'

export default defineWorkspace([
  'client/vitest.config.ts',
  'server/vitest.config.ts',
  'shared/package.json', // Vitest will scan for tests in the shared folder
])