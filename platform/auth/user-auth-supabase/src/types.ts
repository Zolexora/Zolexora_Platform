export type ZolexoraUser = {
  id: string;
  zolexoraId: string;
  email: string;
  emailVerifiedAt: Date | null;
};

export type StoredZolexoraUser = ZolexoraUser & {
  passwordHash: string | null;
};

export type ZolexoraTokenPurpose = "verify-email" | "reset-password";

/** Implement these methods with your database. Email uniqueness and token consumption must be atomic. */
export type ZolexoraAuthStore = {
  findUserByEmail(email: string): Promise<StoredZolexoraUser | null>;
  findUserByZolexoraId?(zolexoraId: string): Promise<StoredZolexoraUser | null>;
  createUser(input: { email: string; passwordHash: string; zolexoraId?: string }): Promise<StoredZolexoraUser>;
  setEmailVerified(userId: string, verifiedAt: Date): Promise<void>;
  /** Update the password and invalidate existing sessions where your app stores them. */
  updatePassword(userId: string, passwordHash: string): Promise<void>;
  createSession(input: { userId: string; tokenHash: string; expiresAt: Date }): Promise<void>;
  findUserBySession(input: { tokenHash: string; now: Date }): Promise<StoredZolexoraUser | null>;
  deleteSession(tokenHash: string): Promise<void>;
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
  /** Optional custom adapter. By default, the package uses ZOLEXORA_AUTHENTICATION_DATABASE_URL. */
  store?: ZolexoraAuthStore;
  databaseUrl?: string;
  resendApiKey?: string;
  from?: string;
  appUrl?: string;
  verificationPath?: string;
  passwordResetPath?: string;
  verificationTokenTtlMs?: number;
  passwordResetTokenTtlMs?: number;
  sessionTtlMs?: number;
  maxDbConnections?: number;
};
