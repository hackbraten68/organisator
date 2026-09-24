import { useEffect, useState } from "react";

export type ThemeChoice = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "organisator-theme";

function getStoredChoice(): ThemeChoice {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") {
      return stored;
    }
  } catch {
    // Storage unavailable (private mode, embedding) — fall through to system.
  }
  return "system";
}

function resolveChoice(choice: ThemeChoice): ResolvedTheme {
  if (choice !== "system") return choice;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function applyResolved(resolved: ResolvedTheme): void {
  document.documentElement.classList.toggle("dark", resolved === "dark");
}

/**
 * System-aware theme state. Default follows the OS; an explicit choice is
 * persisted in localStorage and wins over the OS setting. The `.dark` class
 * drives the shadcn token set (see styles/global.css `@custom-variant dark`).
 */
export function useTheme() {
  const [choice, setChoice] = useState<ThemeChoice>(getStoredChoice);
  const [resolved, setResolved] = useState<ResolvedTheme>(() =>
    resolveChoice(getStoredChoice()),
  );

  useEffect(() => {
    const update = () => {
      const next = resolveChoice(choice);
      applyResolved(next);
      setResolved(next);
    };
    update();
    if (choice !== "system") return undefined;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [choice]);

  function setTheme(next: ThemeChoice): void {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Ignore persistence failures; in-memory choice still applies.
    }
    setChoice(next);
  }

  /** system -> dark -> light -> system (first click relieves light-OS users). */
  function cycleTheme(): void {
    setTheme(
      choice === "system" ? "dark" : choice === "dark" ? "light" : "system",
    );
  }

  return { choice, resolved, setTheme, cycleTheme };
}
