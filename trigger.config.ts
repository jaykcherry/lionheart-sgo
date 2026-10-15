import { defineConfig } from '@trigger.dev/sdk';

export default defineConfig({
  project: process.env.TRIGGER_PROJECT_REF ?? 'proj_lionheart',
  dirs: ['./src/jobs'],
  maxDuration: 900,
  retries: { enabledInDev: false, default: { maxAttempts: 3, minTimeoutInMs: 2_000, maxTimeoutInMs: 60_000, factor: 2 } },
});
