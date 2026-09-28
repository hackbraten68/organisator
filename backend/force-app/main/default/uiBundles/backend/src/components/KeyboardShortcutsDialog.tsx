import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";

interface ShortcutItem {
  keys: string[];
  description: string;
}

interface ShortcutCategory {
  title: string;
  items: ShortcutItem[];
}

const SHORTCUTS: ShortcutCategory[] = [
  {
    title: "Allgemein",
    items: [
      { keys: ["?"], description: "Tastenkürzel anzeigen" },
      { keys: ["Esc"], description: "Dialog schließen" },
    ],
  },
  {
    title: "Navigation",
    items: [
      { keys: ["Tab"], description: "Nächstes Element fokussieren" },
      { keys: ["Shift", "Tab"], description: "Vorheriges Element fokussieren" },
      { keys: ["Enter"], description: "Auswählen / Aktivieren" },
      { keys: ["Space"], description: "Auswählen / Toggle" },
    ],
  },
  {
    title: "Tabs",
    items: [
      { keys: ["←"], description: "Vorheriger Tab" },
      { keys: ["→"], description: "Nächster Tab" },
      { keys: ["Home"], description: "Erster Tab" },
      { keys: ["End"], description: "Letzter Tab" },
    ],
  },
  {
    title: "Dropdown-Menüs",
    items: [
      { keys: ["↑"], description: "Vorheriger Eintrag" },
      { keys: ["↓"], description: "Nächster Eintrag" },
      { keys: ["Enter"], description: "Eintrag auswählen" },
      { keys: ["Esc"], description: "Menü schließen" },
    ],
  },
  {
    title: "Akkordeons",
    items: [
      { keys: ["↑"], description: "Vorheriges Element" },
      { keys: ["↓"], description: "Nächstes Element" },
      { keys: ["Enter"], description: "Aufklappen / Zuklappen" },
      { keys: ["Space"], description: "Aufklappen / Zuklappen" },
    ],
  },
];

function isMac(): boolean {
  return typeof navigator !== "undefined" && navigator.platform.toLowerCase().includes("mac");
}

function KeyCap({ label }: { label: string }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[1.75rem] h-7 px-1.5 text-xs font-mono font-medium bg-muted border border-border rounded shadow-sm">
      {label}
    </kbd>
  );
}

function ShortcutRow({ keys, description }: ShortcutItem) {
  const mac = isMac();
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-muted-foreground">{description}</span>
      <div className="flex items-center gap-1">
        {keys.map((key, i) => {
          let label = key;
          if (key === "Ctrl" && mac) label = "⌘";
          else if (key === "Shift" && mac) label = "⇧";
          else if (key === "Alt" && mac) label = "⌥";
          else if (key === "Enter" && mac) label = "↵";
          else if (key === "Esc" && mac) label = "⎋";
          else if (key === "Space" && mac) label = "␣";
          else if (key === "Tab" && mac) label = "⇥";
          else if (key === "Home" && mac) label = "↖";
          else if (key === "End" && mac) label = "↗";
          else if (key === "↑" && mac) label = "↑";
          else if (key === "↓" && mac) label = "↓";
          else if (key === "←" && mac) label = "←";
          else if (key === "→" && mac) label = "→";
          return (
            <span key={i} className="flex items-center gap-1">
              {i > 0 && <span className="text-xs text-muted-foreground">+</span>}
              <KeyCap label={label} />
            </span>
          );
        })}
      </div>
    </div>
  );
}

export function KeyboardShortcutsDialog({
  isOpen,
  onOpenChange,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  useKeyboardShortcuts([
    {
      key: "?",
      description: "Toggle shortcuts dialog",
      action: () => onOpenChange(!isOpen),
      global: true,
    },
    {
      key: "Escape",
      description: "Close dialog",
      action: () => onOpenChange(false),
      global: true,
    },
  ]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Tastenkürzel
            <span className="text-xs font-normal text-muted-foreground">
              {isMac() ? "macOS" : "Windows/Linux"}
            </span>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          {SHORTCUTS.map((category) => (
            <div key={category.title}>
              <h3 className="text-sm font-semibold text-foreground mb-2">
                {category.title}
              </h3>
              <div className="divide-y divide-border">
                {category.items.map((item, i) => (
                  <ShortcutRow key={i} {...item} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
