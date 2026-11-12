import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "react-hot-toast";
import Navbar from "@/components/layout/Navbar";
import Providers from "./providers";
import { readRuntimeConfig } from "@/lib/runtime";

// Configuration is read from the environment (Infisical) at request time, never at build time.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Zolexora – Shop Premium",
  description: "India's cleanest shopping experience.",
  metadataBase: new URL("https://zolexora.com"),
  icons: {
    icon: "/Zolexora_logo.png",
    shortcut: "/Zolexora_logo.png",
    apple: "/Zolexora_logo.png",
  },
  openGraph: { title: "Zolexora", description: "Shop Premium.", url: "https://zolexora.com" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-cream font-sans antialiased">
        <Providers config={readRuntimeConfig()}>
          <Navbar />
          <main className="min-h-screen pt-16">{children}</main>
          <Toaster position="top-right" toastOptions={{ style: { fontFamily: "var(--font-inter)", fontSize: 14, borderRadius: 12, border: "1px solid #E8E5DF" } }} />
        </Providers>
      </body>
    </html>
  );
}
