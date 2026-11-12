import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  'apps/platform-core/*',
  'apps/platform-apps/*',
  'packages/*',
  'apps/*'
]);
