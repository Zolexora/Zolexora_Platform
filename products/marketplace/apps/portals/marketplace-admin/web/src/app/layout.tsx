import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "react-hot-toast";
import AdminShell from "@/components/layout/AdminShell";
export const metadata: Metadata = {
  title:"Zolexora Admin",
  description:"Platform control center",
  icons: {
    icon: "/Zolexora_logo.png",
    shortcut: "/Zolexora_logo.png",
    apple: "/Zolexora_logo.png",
  },
};
export default function RootLayout({ children }:{ children:React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-surface font-sans antialiased">
        <AdminShell>{children}</AdminShell>
        <Toaster position="top-right" toastOptions={{ style:{ fontFamily:"var(--font-inter)", fontSize:13, borderRadius:10 }}} />
      </body>
    </html>
  );
}
