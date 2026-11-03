"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { PublicSignIn, StaffSignIn, setActiveOrganizationId } from "@zolexora/marketplace-sign-in";
import { firebaseAuth } from "@/lib/firebase";
import { runtimeConfig } from "@/lib/runtime";

/** Like TMS: owners sign in with their Zolexora account (Track 1) and then choose or create an
 *  organisation; staff sign in to their organisation with its ZX-ORG id (Track 2). */
export default function AuthPage() {
  const router = useRouter();
  const config = runtimeConfig();
  const [tab, setTab] = useState<"owner" | "staff">("owner");
  return (
    <div className="min-h-screen bg-surface px-4 py-10">
      <div className="max-w-[400px] mx-auto grid grid-cols-2 gap-1 rounded-xl bg-gray-100 p-1 text-sm">
        {([["owner", "Business owner"], ["staff", "Staff"]] as const).map(([key, label]) => (
          <button key={key} type="button" onClick={() => setTab(key)}
            className={`py-2 rounded-lg font-semibold ${tab === key ? "bg-white text-ink shadow-sm" : "text-ink-muted"}`}>
            {label}
          </button>
        ))}
      </div>
      {tab === "owner" ? (
        <PublicSignIn
          authUrl={config.authServiceUrl}
          turnstileSiteKey={config.turnstileSiteKey}
          firebaseAuth={firebaseAuth}
          brand="Zolexora Seller"
          accent="#C9A84C"
          onSignedIn={() => router.push("/organisations")}
        />
      ) : (
        <StaffSignIn
          turnstileSiteKey={config.turnstileSiteKey}
          brand="Zolexora Seller"
          accent="#C9A84C"
          onSignedIn={() => { setActiveOrganizationId(null); router.push("/dashboard"); }}
        />
      )}
    </div>
  );
}
