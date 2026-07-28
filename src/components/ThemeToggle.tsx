"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

// Reads/writes the theme on <html data-theme> and persists it in localStorage.
// The initial value is applied by an inline script in the root layout (no flash).
export default function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.dataset.theme === "dark");
  }, []);

  const toggle = () => {
    const next = dark ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("theme", next); } catch {}
    setDark(!dark);
  };

  return (
    <button
      onClick={toggle}
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
      className="flex h-9 w-9 items-center justify-center rounded-lg border border-line text-body hover:bg-paper"
    >
      {dark ? <Sun size={17} /> : <Moon size={17} />}
    </button>
  );
}
