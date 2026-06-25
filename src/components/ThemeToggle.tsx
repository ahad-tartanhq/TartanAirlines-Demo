import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

/**
 * Cycling multi-theme toggle. Applies a theme class to <html> and persists the
 * choice. Rendered as a barely-visible button (top-left) that brightens on hover.
 */
type Theme = {
  id: string;
  /** CSS class applied to <html>; empty string = default light :root */
  cls: string;
  label: string;
  mode: "light" | "dark";
};

const THEMES: Theme[] = [
  { id: "airindia", cls: "theme-airindia", label: "Air India", mode: "light" },
  { id: "light", cls: "", label: "Daylight", mode: "light" },
  { id: "sand", cls: "theme-sand", label: "Warm Sand", mode: "light" },
  { id: "slate", cls: "theme-slate", label: "Slate & Steel", mode: "light" },
  { id: "blush", cls: "theme-blush", label: "Blush & Lavender", mode: "light" },
  { id: "coral", cls: "theme-coral", label: "Coral Pop", mode: "light" },
  { id: "ocean", cls: "theme-ocean", label: "Ocean Deep", mode: "dark" },
  { id: "midnight", cls: "theme-midnight", label: "Midnight", mode: "dark" },
  { id: "emerald", cls: "theme-emerald", label: "Emerald", mode: "dark" },
  { id: "forest", cls: "theme-forest", label: "Forest & Moss", mode: "dark" },
  { id: "noir", cls: "theme-noir", label: "Noir & Gold", mode: "dark" },
  { id: "ember", cls: "theme-ember", label: "Charcoal & Ember", mode: "dark" },
  { id: "vapor", cls: "theme-vapor", label: "Vapor Chrome", mode: "dark" },
];

const STORAGE_KEY = "tartan-theme";
const ALL_CLASSES = THEMES.map((t) => t.cls).filter(Boolean);

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.remove(...ALL_CLASSES);
  if (theme.cls) root.classList.add(theme.cls);
  // Keep the `dark` class in sync so any dark: utilities behave correctly.
  root.classList.toggle("dark", theme.mode === "dark");
}

export function ThemeToggle() {
  const [index, setIndex] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const saved = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
    const start = Math.max(0, THEMES.findIndex((t) => t.id === saved));
    setIndex(start);
    applyTheme(THEMES[start]);
    setMounted(true);
  }, []);

  const cycle = () => {
    const next = (index + 1) % THEMES.length;
    setIndex(next);
    applyTheme(THEMES[next]);
    window.localStorage.setItem(STORAGE_KEY, THEMES[next].id);
  };

  // Avoid hydration mismatch — render nothing until the client resolves the theme.
  if (!mounted) return null;

  const current = THEMES[index];
  const Icon = current.mode === "dark" ? Moon : Sun;

  return (
    <button
      type="button"
      onClick={cycle}
      aria-label={`Theme: ${current.label}. Click to change.`}
      title={`Theme: ${current.label}`}
      className="fixed left-3 top-3 z-50 inline-flex h-8 w-8 items-center justify-center rounded-full border border-border/40 bg-background/40 text-muted-foreground/50 opacity-30 backdrop-blur-sm transition-all duration-300 hover:scale-105 hover:opacity-100 hover:text-foreground focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring"
    >
      <Icon className="h-4 w-4" strokeWidth={1.75} />
    </button>
  );
}
