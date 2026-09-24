import { Monitor, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/hooks/useTheme";

/**
 * Header theme toggle: system -> dark -> light -> system.
 * Icon shows the active source (monitor for system, moon/sun for explicit).
 */
export default function ThemeToggle() {
  const { choice, resolved, cycleTheme } = useTheme();
  const Icon = choice === "system" ? Monitor : resolved === "dark" ? Moon : Sun;
  const label =
    choice === "system"
      ? `System theme (currently ${resolved})`
      : resolved === "dark"
        ? "Dark theme"
        : "Light theme";

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={cycleTheme}
      aria-label={`Color theme: ${label}. Activate to switch theme.`}
      title={label}
    >
      <Icon className="size-5" aria-hidden="true" />
    </Button>
  );
}
