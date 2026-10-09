"use client";
import { useEffect } from "react";
import { useAuthStore } from "@/store";

export default function Providers({ children }: { children: React.ReactNode }) {
  const fetchMe = useAuthStore((s) => s.fetchMe);
  const logout = useAuthStore((s) => s.logout);

  useEffect(() => {
    fetchMe();
    const handler = () => logout();
    window.addEventListener("z:logout", handler);
    return () => window.removeEventListener("z:logout", handler);
  }, [fetchMe, logout]);

  return <>{children}</>;
}
