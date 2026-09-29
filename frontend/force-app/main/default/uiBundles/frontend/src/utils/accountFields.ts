/** Field helpers for reading uiapi GraphQL response nodes: values arrive as `{ value, displayValue }` objects, so callers need one place to unwrap them. */

/** Picks the user-facing string for a `{ value, displayValue }` field. */
export function fieldValue(
	field: { displayValue?: string | null; value?: unknown } | null | undefined,
): string | null {
	if (field?.displayValue != null) return field.displayValue;
	if (field?.value != null) return String(field.value);
	return null;
}

/** Builds the display lines for a Salesforce compound address, or null if empty. */
export function getAddressFieldLines(address: {
	street?: string | null;
	city?: string | null;
	state?: string | null;
	postalCode?: string | null;
	country?: string | null;
}) {
	const cityStateZip = [address.city, address.state].filter(Boolean).join(", ");
	const cityStateZipLine = [cityStateZip, address.postalCode].filter(Boolean).join(" ");
	const lines = [address.street, cityStateZipLine, address.country].filter(Boolean);
	if (lines.length === 0) return null;
	return lines;
}
