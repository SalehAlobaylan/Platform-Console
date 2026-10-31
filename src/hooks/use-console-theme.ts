'use client';

import { useEffect, useState } from 'react';

export function useConsoleTheme() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const saved = localStorage.getItem('theme');
    const next =
      saved === 'light' || saved === 'dark'
        ? saved
        : window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light';
    setTheme(next);
    document.documentElement.classList.toggle('dark', next === 'dark');
    setMounted(true);
  }, []);
  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    localStorage.setItem('theme', next);
    document.documentElement.classList.toggle('dark', next === 'dark');
  };
  return { theme, mounted, toggleTheme };
}
