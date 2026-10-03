import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";

interface ShortcutItem {
	keys: string[];
	description: string;
}

interface ShortcutCategory {
	title: string;
	items: ShortcutItem[];
}

/**
 * What this portal actually contains.
 *
 * The backoffice bundle's legend also lists "Tabs" and "Akkordeons". Those
 * components exist in neither page here, and a legend is documentation — an entry
 * for a control that is not on the page is a false promise, so those categories
 * are omitted rather than copied. If a Tabs/Akkordeon is ever added, add the
 * category back in the same commit.
 */
const SHORTCUTS: ShortcutCategory[] = [
	{
		title: "Allgemein",
		items: [
			{ keys: ["?"], description: "Diese Übersicht anzeigen" },
			{ keys: ["Esc"], description: "Dialog schließen" },
		],
	},
	{
		title: "Portal",
		items: [
			{ keys: ["Shift", "Tab"], description: "Vorheriges Element fokussieren" },
			{ keys: ["Tab"], description: "Nächstes Element fokussieren" },
			{ keys: ["Enter"], description: "Link oder Button aktivieren" },
		],
	},
	{
		title: "Menüs",
		items: [
			{ keys: ["↑"], description: "Vorheriger Eintrag" },
			{ keys: ["↓"], description: "Nächster Eintrag" },
			{ keys: ["Enter"], description: "Eintrag auswählen" },
			{ keys: ["Esc"], description: "Menü schließen" },
		],
	},
];

function isMac(): boolean {
	return typeof navigator !== "undefined" && navigator.platform.toLowerCase().includes("mac");
}

/** Glyph for a key on the current platform; falls back to the literal label. */
function keyGlyph(key: string, mac: boolean): string {
	if (!mac) return key;
	switch (key) {
		case "Shift":
			return "⇧";
		case "Tab":
			return "⇥";
		case "Enter":
			return "↵";
		case "Esc":
			return "⎋";
		default:
			return key;
	}
}

function KeyCap({ label }: { label: string }) {
	return (
		<kbd className="inline-flex h-7 min-w-[1.75rem] items-center justify-center rounded border border-border bg-muted px-1.5 font-mono text-xs font-medium shadow-sm">
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
				{keys.map((key, index) => (
					<span key={key} className="flex items-center gap-1">
						{index > 0 && <span className="text-xs text-muted-foreground">+</span>}
						<KeyCap label={keyGlyph(key, mac)} />
					</span>
				))}
			</div>
		</div>
	);
}

/**
 * Presentational only.
 *
 * It registers no key handlers of its own; `?` is bound once in `appLayout`.
 *
 * The backoffice bundle binds `?` in *both* places. Measured here: with both
 * bound, the dialog still opens correctly, because the two handlers converge on
 * the same value — `appLayout` toggles functionally, this one passes the stale
 * `!isOpen` prop — so the double toggle cancels out. It is kept single-bound
 * because that cancellation is a coincidence of those two expressions, not a
 * contract: change either one and the dialog starts opening and closing again.
 * Escape needs no handler either, since `DialogContent` already closes on it.
 */
export function KeyboardShortcutsDialog({
	isOpen,
	onOpenChange,
}: {
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	return (
		<Dialog open={isOpen} onOpenChange={onOpenChange}>
			<DialogContent className="max-h-[80vh] max-w-lg overflow-y-auto">
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
							<h3 className="mb-2 text-sm font-semibold text-foreground">{category.title}</h3>
							<div className="divide-y divide-border">
								{category.items.map((item) => (
									<ShortcutRow key={item.description} {...item} />
								))}
							</div>
						</div>
					))}
				</div>
			</DialogContent>
		</Dialog>
	);
}

export default KeyboardShortcutsDialog;