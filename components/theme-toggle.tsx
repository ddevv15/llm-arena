"use client";

import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Light/dark, pinned to the sidebar footer beside the user button.
 *
 * Which icon shows is decided in CSS by the `dark` class the theme provider
 * already puts on the document, not by React state. That's deliberate: the
 * server can't know the stored theme, so any state-based version needs a
 * mount flag and flashes the wrong icon on the way through. CSS just gets it
 * right on the first paint.
 *
 * The accessible name stays "Toggle theme" rather than naming the target
 * theme, because a name that flips under the user is a control they can't
 * learn — the icon carries the current state.
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-8 rounded-full"
      aria-label="Toggle theme"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      <Sun className="size-4 dark:hidden" aria-hidden="true" />
      <Moon className="hidden size-4 dark:block" aria-hidden="true" />
    </Button>
  );
}
