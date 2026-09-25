import React, { useEffect, useRef, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

const preference = () => {
  try { const value = localStorage.getItem('telaah-theme'); return ['light', 'dark'].includes(value) ? value : null; }
  catch { return null; }
};

export default function ThemeToggle() {
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme || 'light');
  const explicit = useRef(preference());

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#101a17' : '#f3f6f4');
  }, [theme]);

  useEffect(() => {
    const system = window.matchMedia('(prefers-color-scheme: dark)');
    const followSystem = () => { if (!explicit.current) setTheme(system.matches ? 'dark' : 'light'); };
    const sync = event => {
      if (event.key !== 'telaah-theme' && event.key !== null) return;
      explicit.current = preference();
      setTheme(explicit.current || (system.matches ? 'dark' : 'light'));
    };
    system.addEventListener('change', followSystem);
    window.addEventListener('storage', sync);
    return () => { system.removeEventListener('change', followSystem); window.removeEventListener('storage', sync); };
  }, []);

  function toggle() {
    const next = theme === 'dark' ? 'light' : 'dark';
    explicit.current = next;
    setTheme(next);
    try { localStorage.setItem('telaah-theme', next); } catch { /* Keep the session choice. */ }
  }

  return <button className="theme-toggle" type="button" onClick={toggle} aria-label="Mode gelap" aria-pressed={theme === 'dark'} title={theme === 'dark' ? 'Beralih ke mode terang' : 'Beralih ke mode gelap'}>
    {theme === 'dark' ? <Sun size={17}/> : <Moon size={17}/>}
    <span>{theme === 'dark' ? 'Mode terang' : 'Mode gelap'}</span>
  </button>;
}
