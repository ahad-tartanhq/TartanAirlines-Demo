import { useEffect, useState } from "react";
import { LayoutGrid, Rows3, Sparkles, Newspaper, Layers, Square } from "lucide-react";

/**
 * Cycling layout / "style pack" toggle. Applies a layout class to <html> and
 * persists the choice. Fully independent of the color theme toggle — any theme
 * can be combined with any layout. Rendered as a barely-visible button
 * (top-right) that brightens on hover, mirroring the theme toggle.
 */
type Layout = {
  id: string;
  /** CSS class applied to <html>; empty string = default layout */
  cls: string;
  label: string;
  Icon: typeof LayoutGrid;
};

const LAYOUTS: Layout[] = [
  { id: "signature", cls: "", label: "Signature", Icon: LayoutGrid },
  { id: "compact", cls: "layout-compact", label: "Compact", Icon: Rows3 },
  { id: "soft", cls: "layout-soft", label: "Soft", Icon: Sparkles },
  { id: "editorial", cls: "layout-editorial", label: "Editorial", Icon: Newspaper },
  { id: "elevated", cls: "layout-elevated", label: "Elevated", Icon: Layers },
  { id: "brutal", cls: "layout-brutal", label: "Brutalist", Icon: Square },
];

const STORAGE_KEY = "tartan-layout";
const ALL_CLASSES = LAYOUTS.map((l) => l.cls).filter(Boolean);

function applyLayout(layout: Layout) {
  const root = document.documentElement;
  root.classList.remove(...ALL_CLASSES);
  if (layout.cls) root.classList.add(layout.cls);
}

export function LayoutToggle() {
  const [index, setIndex] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const saved = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
    const start = Math.max(0, LAYOUTS.findIndex((l) => l.id === saved));
    setIndex(start);
    applyLayout(LAYOUTS[start]);
    setMounted(true);
  }, []);

  const cycle = () => {
    const next = (index + 1) % LAYOUTS.length;
    setIndex(next);
    applyLayout(LAYOUTS[next]);
    window.localStorage.setItem(STORAGE_KEY, LAYOUTS[next].id);
  };

  // Avoid hydration mismatch — render nothing until the client resolves it.
  if (!mounted) return null;

  const current = LAYOUTS[index];
  const Icon = current.Icon;

  return (
    <button
      type="button"
      onClick={cycle}
      aria-label={`Layout: ${current.label}. Click to change.`}
      title={`Layout: ${current.label}`}
      className="fixed right-3 top-3 z-50 inline-flex h-8 w-8 items-center justify-center rounded-full border border-border/40 bg-background/40 text-muted-foreground/50 opacity-30 backdrop-blur-sm transition-all duration-300 hover:scale-105 hover:opacity-100 hover:text-foreground focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring"
    >
      <Icon className="h-4 w-4" strokeWidth={1.75} />
    </button>
  );
}
