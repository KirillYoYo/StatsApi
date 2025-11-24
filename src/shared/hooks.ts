import { useState, useEffect } from 'react';

export function useBootstrapTheme() {
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('bs-theme');
    const systemDark = window.matchMedia(
      '(prefers-color-scheme: dark)',
    ).matches;
    return saved ? saved === 'dark' : systemDark;
  });

  useEffect(() => {
    const htmlElement = document.documentElement;

    if (isDark) {
      htmlElement.setAttribute('data-bs-theme', 'dark');
      localStorage.setItem('bs-theme', 'dark');
    } else {
      htmlElement.setAttribute('data-bs-theme', 'light');
      localStorage.setItem('bs-theme', 'light');
    }
  }, [isDark]);

  return { isDark, setIsDark };
}
