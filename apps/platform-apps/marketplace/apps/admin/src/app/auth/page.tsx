"use client";
import { useRouter } from "next/navigation";
import { AdminSignIn } from "@zolexora/shop-sign-in";
import { runtimeConfig } from "@/lib/runtime";

/** Marketplace admins are Zolexora platform admins (managed in platform-admin). */
export default function AdminAuthPage() {
  const router = useRouter();
  return (
    <div className="min-h-screen bg-ink flex items-center justify-center px-4">
      <AdminSignIn turnstileSiteKey={runtimeConfig().turnstileSiteKey} accent="#C9A84C" onSignedIn={() => router.push("/dashboard")} />
    </div>
  );
}
