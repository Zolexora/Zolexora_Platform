import React, { createContext, useContext, useState } from "react";

export type AppSection = "Finance" | "Fitness" | "Lifestyle";

interface SectionContextType {
  activeSection: AppSection;
  setActiveSection: (s: AppSection) => void;
}

const SectionContext = createContext<SectionContextType | null>(null);

export function SectionProvider({ children }: { children: React.ReactNode }) {
  const [activeSection, setActiveSection] = useState<AppSection>("Finance");
  return (
    <SectionContext.Provider value={{ activeSection, setActiveSection }}>
      {children}
    </SectionContext.Provider>
  );
}

export function useSection() {
  const ctx = useContext(SectionContext);
  if (!ctx) throw new Error("useSection must be used within SectionProvider");
  return ctx;
}
