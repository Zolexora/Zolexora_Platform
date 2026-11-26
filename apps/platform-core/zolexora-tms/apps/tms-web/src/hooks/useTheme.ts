import { useEffect, useState } from 'react';

export type ThemeMode = 'dark' | 'light';

/** Persists Dark/Light mode on <html> (`data-theme="light"`) across public pages. */
export function useTheme() {
  const [theme, setTheme] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('tms-theme');
    return saved === 'light' || saved === 'lime' ? 'light' : 'dark';
  });

  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    localStorage.setItem('tms-theme', theme);
  }, [theme]);

  const toggle = () => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));

  return { theme, toggle };
}
