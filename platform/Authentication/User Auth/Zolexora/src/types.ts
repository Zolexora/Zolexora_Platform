export type ZolexoraUser = {
  id: string;
  email: string;
  emailVerifiedAt: Date | null;
};

export type StoredZolexoraUser = ZolexoraUser & {
  passwordHash: string;
};

export type ZolexoraTokenPurpose = "verify-email" | "reset-password";

/** Implement these methods with your database. Email uniqueness and token consumption must be atomic. */
export type ZolexoraAuthStore = {
  findUserByEmail(email: string): Promise<StoredZolexoraUser | null>;
  createUser(input: { email: string; passwordHash: string }): Promise<StoredZolexoraUser>;
  setEmailVerified(userId: string, verifiedAt: Date): Promise<void>;
  /** Update the password and invalidate existing sessions where your app stores them. */
  updatePassword(userId: string, passwordHash: string): Promise<void>;
  createToken(input: {
    userId: string;
    tokenHash: string;
    purpose: ZolexoraTokenPurpose;
    expiresAt: Date;
  }): Promise<void>;
  /** Atomically delete/consume an unexpired token and return its user ID. */
  consumeToken(input: {
    tokenHash: string;
    purpose: ZolexoraTokenPurpose;
    now: Date;
  }): Promise<string | null>;
};

export type ZolexoraAuthOptions = {
  store: ZolexoraAuthStore;
  resendApiKey: string;
  from: string;
  appUrl: string;
  verificationTokenTtlMs?: number;
  passwordResetTokenTtlMs?: number;
};
