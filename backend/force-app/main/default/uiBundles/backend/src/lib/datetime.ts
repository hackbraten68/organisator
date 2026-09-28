/**
 * Datum/Zeit-Konvertierung für die Salesforce-UIAPI.
 *
 * `<input type="datetime-local">` liefert eine lokale Wanduhrzeit ohne
 * Zeitzone ("2026-09-30T10:00"). UIAPI verlangt für `DateTime` dagegen eine
 * vollstaendige ISO-8601-Zeit MIT Offset — ohne Offset schlaegt die Mutation
 * mit einem GraphQL-Fehler fehl, ohne dass die UI etwas anzeigt.
 */

/** ISO-8601 mit Z oder ±HH:MM am Ende. */
const HAS_OFFSET = /(?:Z|[+-]\d{2}:?\d{2})$/i;

/**
 * Wanduhrzeit aus einem datetime-local-Input in eine API-konforme
 * ISO-Zeit umrechnen. Werte, die bereits einen Offset tragen, bleiben
 * unveraendert (z. B. initialData aus einem bestehenden Termin).
 *
 * @param value Rohwert aus dem Input, z. B. "2026-09-30T10:00"
 * @returns ISO-8601 in UTC, z. B. "2026-09-30T08:00:00.000Z"
 */
export function toApiDateTime(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  if (HAS_OFFSET.test(trimmed)) return trimmed;

  // Ohne Offset: als lokale Zeit interpretieren und in UTC umrechnen.
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Ungültiger Datum/Zeit-Wert: "${value}"`);
  }
  return parsed.toISOString();
}

/**
 * Wanduhrzeit aus einem datetime-local-Input in der lokalen Zeitzone
 * zurückgeben — für die Anzeige in einem datetime-local-Input, das keine
 * Zeitzone kennt.
 *
 * @param isoString ISO-8601 Zeitstempel
 * @returns "yyyy-MM-dd'T'HH:mm" in lokaler Zeit
 */
export function toDateTimeLocalValue(isoString: string): string {
  if (!isoString) return "";
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "";

  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}
