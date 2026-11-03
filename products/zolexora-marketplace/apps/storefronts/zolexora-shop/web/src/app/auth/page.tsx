"use client";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PublicSignIn } from "@zolexora/marketplace-sign-in";
import { firebaseAuth } from "@/lib/firebase";
import { runtimeConfig } from "@/lib/runtime";

function SignIn() {
  const router = useRouter();
  const redirect = useSearchParams().get("redirect");
  // Only same-site paths: never redirect to another origin after sign-in.
  const next = redirect && redirect.startsWith("/") && !redirect.startsWith("//") ? redirect : "/";
  const config = runtimeConfig();
  return (
    <div className="px-4 py-10">
      <PublicSignIn
        authUrl={config.authServiceUrl}
        turnstileSiteKey={config.turnstileSiteKey}
        firebaseAuth={firebaseAuth}
        brand="Zolexora Shop"
        accent="#1C1C1C"
        onSignedIn={() => router.push(next)}
      />
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense>
      <SignIn />
    </Suspense>
  );
}
