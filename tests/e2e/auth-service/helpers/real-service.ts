// Boots the REAL auth service (apps/zolexora-auth-service buildApp) on a loopback port.
// Only the outside world is replaced: Postgres → in-memory repository, Turnstile/Resend → fakes,
// Cloudinary/S3 → fake endpoints, Google's Firebase keys → locally generated keys.
import type { FastifyInstance } from "fastify";
import { applyTestEnv } from "../../../../apps/zolexora-auth-service/test/helpers/test-env";
import { fakeFetch } from "../../../../apps/zolexora-auth-service/test/helpers/fake-network";

export interface RealService {
  url: string;
  /** Latest 6-digit code emailed to `to`. */
  lastCode: (to: string) => string | undefined;
  /** Latest email text sent to `to` (invite links). */
  lastMail: (to: string) => string | undefined;
  firebaseIdToken: (o?: Record<string, unknown>) => Promise<string>;
  pnvToken: (phone: string) => Promise<string>;
  /** A real session token signed by the service's key. */
  token: (claims: Record<string, unknown>) => string;
  stop: () => Promise<void>;
}

export async function startRealService(): Promise<RealService> {
  applyTestEnv();
  const realFetch = globalThis.fetch;
  globalThis.fetch = fakeFetch(realFetch) as typeof fetch;

  // Imported after the env is set: the service reads its config at import time.
  const fakes = await import("../../../../apps/zolexora-auth-service/test/helpers/fakes");
  const { InMemoryAuthRepository } = await import("../../../../apps/zolexora-auth-service/test/helpers/in-memory-auth.repository");

  const app: FastifyInstance & { mail: InstanceType<typeof fakes.FakeMail> } = await fakes.buildTestApp(new InMemoryAuthRepository());
  const address = await app.listen({ port: 0, host: "127.0.0.1" });

  return {
    url: address,
    lastCode: (to) => app.mail.lastCode(to),
    lastMail: (to) => [...app.mail.sent].reverse().find((m) => m.to === to)?.text,
    firebaseIdToken: (o) => fakes.firebaseIdToken(o as any),
    pnvToken: (phone) => fakes.pnvToken(phone),
    token: (claims) => fakes.testTokens().signJwt(claims),
    stop: async () => {
      await app.close();
      globalThis.fetch = realFetch;
    },
  };
}
