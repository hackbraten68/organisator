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
 * Leer seit dem 2026-10-07. Damals war die Entscheidung, die Org-Picklist zu
 * erweitern statt die Oberflaeche zurueckzubiegen — `OnSite`, `Phone` und
 * `Hybrid` sollten in die Org kommen, `Discord` und `Zoom` blieben als
 * Altwerte fuer Bestandstermine gueltig, wuerden aber nicht mehr angeboten.
 *
 * **Die Setup-Erweiterung wurde nie ausgefuehrt.** `Location__c` kennt in der
 * Org bis heute nur `Discord`, `Zoom`, `Teams` und `External`. Damit waren drei
 * von fuenf Optionen im Dialog unbenutzbar: die restricted Picklist lehnt das
 * Speichern ab, der Coach sieht nach dem Anlegen nur eine Fehlermeldung. Und
 * der Test hier war gruen, weil er die Bundle-Liste gegen das *Deploy-Metadatum*
 * prueft — und das Repo Metadaten fuer drei Werte fuehrte, die es in der Org
 * nie gab.
 *
 * Die Liste ist deshalb jetzt auf die Org-Wahrheit gesetzt, per Retrieve
 * bestaetigt. Ob `OnSite`, `Phone` und `Hybrid` spaeter in die Org kommen, ist
 * eine Produktentscheidung und keine Frage dieses Tests. Sollen sie es, sind
 * die Werte in der Org zuerst anzulegen und hier ueber Retrieve nachzuziehen —
 * nicht umgekehrt.
 *
 * Bewusst als benannte Liste gefuehrt und nicht global erlaubt: eine Ausnahme,
 * die still mitwaechst, waere genau der Mechanismus, den dieser Test verhindert.
 */
const LEGACY_ORG_VALUES: ReadonlyArray<{ field: string; value: string; why: string }> = [];

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

  it("Location__c startet auf keinem erzwungenen Wert", () => {
    // Die Org hat fuer Location__c keinen Default-Wert. AppointmentFormDialog
    // darf deshalb keinen festen Wert vorsetzen, der dann auch noch im Wertset
    // stehen muesste. Verifiziert: ein Insert ohne Location ergibt in der Org ein
    // leeres Feld, kein OnSite.
    const xml = readFileSync(
      path.join(FIELDS_DIR, "Location__c.field-meta.xml"),
      "utf8",
    );
    expect(xml).not.toMatch(/<default>true<\/default>/);
  });
});
