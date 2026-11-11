import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  'apps/core-platform/*',
  'apps/standalone-apps/*',
  'packages/*',
  'apps/*'
]);
