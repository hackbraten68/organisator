/**
 * Termin-Listen gegen die Org-Metadaten.
 *
 * Gefunden bei der Planung der Anfrage-Funktion: `Type__c` und `Location__c`
 * sind `restricted` Picklists, die Bundle-Listen kamen aber aus einer anderen
 * Quelle. Ergebnis war kein kosmetischer Fehler — `AppointmentFormDialog.tsx`
 * bot `Berufsschule` an, was es auf `Appointment__c.Type__c` nicht gibt
 * (das ist ein Absence-Typ), und der Ort-Dialog startete auf `OnSite`, was auf
 * `Location__c` ebenfalls nicht existierte. Bei einer restricted Picklist
 * lehnt die Org den Speichern ab: der Dialog hat einen Termin angelegt und der
 * Coach hat danach eine Fehlermeldung bekommen.
 *
 * Die Ursache war doppelt — die Listen waren falsch *und* an drei Stellen
 * hart verdrahtet. Deshalb kommt die Liste jetzt aus `types/appointment.ts`,
 * und dieser Test haelt sie gegen das Deploy-Metadatum.
 *
 * Gleicher Ansatz wie `api/audit/fieldPolicyCoverage.test.ts`.
 */

import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import {
  APPOINTMENT_TYPES,
  APPOINTMENT_STATUSES,
  APPOINTMENT_LOCATIONS,
} from "./appointment";

const FIELDS_DIR = path.resolve(
  process.cwd(),
  "../../objects/Appointment__c/fields",
);

/**
 * Werte einer Picklist aus den SFDX-Metadaten.
 *
 * Gelesen wird der erste `<fullName>` jeder `<value>`-Blaecke. Der `<fullName>`
 * des Feldes selbst steht ebenfalls dort und wird ueber `index` ubersprungen —
 * sonst kaeme jedes Feld als eigener Wert zurueck.
 */
function picklistValues(field: string): string[] {
  const file = path.join(FIELDS_DIR, `${field}.field-meta.xml`);
  if (!existsSync(file)) {
    // Ein fehlendes Metadatum darf nicht als "die Liste ist in Ordnung"
    // durchgehen — sonst faellt der Test genau dann still aus, wenn das
    // Deploy noch nicht vollstaendig ist.
    throw new Error(`Feld-Metadaten nicht gefunden: ${file}`);
  }

  const xml = readFileSync(file, "utf8");
  const valueSet = xml.match(/<valueSetDefinition>([\s\S]*?)<\/valueSetDefinition>/);
  if (!valueSet) {
    throw new Error(`Kein valueSet in ${file} — ist das Feld wirklich eine Picklist?`);
  }

  const values = [...valueSet[1].matchAll(/<value>\s*<fullName>([^<]+)<\/fullName>/g)].map(
    (m) => m[1],
  );
  return values;
}

/**
 * Werte der Org, die das Bundle bewusst nicht anbietet.
 *
 * `Discord` und `Zoom` sind die Kanäle, ueber die vor der Umstellung auf
 * Vor-Ort-Termine gearbeitet wurde. Die Entscheidung vom 2026-10-07 war,
 * die Org-Picklist zu erweitern statt die Oberflaeche zurueckzubiegen —
 * damit bleiben `OnSite`, `Phone` und `Hybrid` auswaehlbar. Die beiden
 * alten Werte bleiben fuer Bestandstermine gueltig, werden aber nicht mehr
 * angeboten.
 *
 * Bewusst benannt und nicht global erlaubt: eine Ausnahme, die still
 * mitwaechst, waere genau der Mechanismus, den dieser Test verhindert.
 */
const LEGACY_ORG_VALUES: ReadonlyArray<{ field: string; value: string; why: string }> = [
  { field: "Location__c", value: "Discord", why: "Altes Beratungsformat, nicht mehr im Dialog." },
  { field: "Location__c", value: "Zoom", why: "Altes Beratungsformat, nicht mehr im Dialog." },
];

/** Zu vergleichen: Feld in der Org gegen die Liste, die das Bundle anbietet. */
const LISTS: ReadonlyArray<{ field: string; bundleValues: readonly string[] }> = [
  { field: "Type__c", bundleValues: APPOINTMENT_TYPES },
  { field: "Status__c", bundleValues: APPOINTMENT_STATUSES },
  { field: "Location__c", bundleValues: APPOINTMENT_LOCATIONS },
];

describe("Termin-Picklists decken sich mit der Org", () => {
  it.each(LISTS)("$field: jeder Bundle-Wert existiert in der Org", ({ field, bundleValues }) => {
    const orgValues = picklistValues(field);
    expect(orgValues.length).toBeGreaterThan(0);

    const unknown = bundleValues.filter((v) => !orgValues.includes(v));
    expect(
      unknown,
      `In APPOINTMENT_*.${field.replace("__c", "").toUpperCase()} steht "${unknown.join(", ")}", ` +
        "das kennt die Picklist nicht. Bei restricted=true lehnt die Org das " +
        "Speichern ab. Werte der Org: " + orgValues.join(", "),
    ).toEqual([]);
  });

  it.each(LISTS)("$field: die Bundle-Liste verliert keinen Wert", ({ field, bundleValues }) => {
    const orgValues = picklistValues(field);
    const known = new Set(LEGACY_ORG_VALUES.filter((e) => e.field === field).map((e) => e.value));
    const missing = orgValues.filter((v) => !bundleValues.includes(v) && !known.has(v));
    expect(
      missing,
      `Die Org kennt auf ${field} "${missing.join(", ")}", die Bundle-Liste nicht. ` +
        `Nicht auswaehlbare Werte: ${missing.join(", ")}. Ist das Absicht, ` +
        "dann als LEGACY_ORG_VALUES mit Begruendung eintragen — sonst ist es " +
        "ein Wert, den niemand mehr auswaehlen kann.",
    ).toEqual([]);
  });

  it("Location__c startet auf einem Wert, den das Bundle anbietet", () => {
    // AppointmentFormDialog.tsx faellt auf "OnSite" zurueck, wenn kein
    // Termin bearbeitet wird. Der Wert muss deshalb in beiden Listen stehen.
    expect<string[]>([...APPOINTMENT_LOCATIONS]).toContain("OnSite");
  });
});
