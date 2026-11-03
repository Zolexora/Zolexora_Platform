// Test-only configuration. Production values come exclusively from Infisical.
import { beforeEach, vi } from "vitest";
import { applyTestEnv } from "./helpers/test-env.js";
import { fakeFetch } from "./helpers/fake-network.js";

applyTestEnv();
export { fakeS3Objects } from "./helpers/fake-network.js";

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(fakeFetch()));
});
