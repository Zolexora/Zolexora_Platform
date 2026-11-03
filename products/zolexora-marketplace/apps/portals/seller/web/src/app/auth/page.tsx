"use client";
import { useRouter } from "next/navigation";
import { PublicSignIn } from "@zolexora/marketplace-sign-in";
import { firebaseAuth } from "@/lib/firebase";
import { runtimeConfig } from "@/lib/runtime";

/** Sellers sign in with their Zolexora account (auth service); seller access is checked by the API. */
export default function AuthPage() {
  const router = useRouter();
  const config = runtimeConfig();
  return (
    <div className="min-h-screen bg-surface px-4 py-10">
      <PublicSignIn
        authUrl={config.authServiceUrl}
        turnstileSiteKey={config.turnstileSiteKey}
        firebaseAuth={firebaseAuth}
        brand="Zolexora Seller"
        accent="#C9A84C"
        onSignedIn={() => router.push("/dashboard")}
      />
    </div>
  );
}
