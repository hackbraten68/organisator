import { useEffect, useCallback } from "react";

export interface KeyboardShortcut {
	key: string;
	modifiers?: ("ctrl" | "alt" | "shift" | "meta")[];
	description: string;
	action: () => void;
}

const TEXT_ENTRY_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

/**
 * True while the user is typing into a field or a contenteditable region.
 *
 * A single-letter shortcut is fireable from anywhere on the page, and the portal
 * has real text entry: the login form, the password-reset form, and `Mein Konto`.
 * Without this guard, typing "?" into the username field opens the shortcuts
 * dialog over the form the user is in the middle of, and `event.preventDefault()`
 * stops the character from ever being entered. A shortcut must never take the
 * keyboard away from a field.
 *
 * `isComposing` additionally covers dead keys and IME input, where the keystroke
 * belongs to text composition rather than to a shortcut.
 */
function isTextEntry(target: EventTarget | null): boolean {
	if (!(target instanceof HTMLElement)) return false;
	if (TEXT_ENTRY_TAGS.has(target.tagName)) return true;
	return target.isContentEditable;
}

export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[]) {
	const handleKeyDown = useCallback(
		(event: KeyboardEvent) => {
			if (event.isComposing || isTextEntry(event.target)) return;

			for (const shortcut of shortcuts) {
				const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();
				const ctrlMatch = shortcut.modifiers?.includes("ctrl")
					? event.ctrlKey || event.metaKey
					: !event.ctrlKey && !event.metaKey;
				const altMatch = shortcut.modifiers?.includes("alt")
					? event.altKey
					: !event.altKey;
				const shiftMatch = shortcut.modifiers?.includes("shift")
					? event.shiftKey
					: !event.shiftKey;
				const metaMatch = shortcut.modifiers?.includes("meta")
					? event.metaKey
					: !event.metaKey;

				if (keyMatch && ctrlMatch && altMatch && shiftMatch && metaMatch) {
					event.preventDefault();
					shortcut.action();
					return;
				}
			}
		},
		[shortcuts],
	);

	useEffect(() => {
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [handleKeyDown]);
}