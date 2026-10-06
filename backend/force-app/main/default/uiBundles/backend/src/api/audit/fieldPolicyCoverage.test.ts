/**
 * Strukturschutz fuer die Feld-Policies.
 *
 * P1 hat zwei Felder repariert (`Reason__c`, `CoachComment__c`). Ohne diesen
 * Test ist derselbe Fehler beim naechsten Audit-Feld wieder da — und still,
 * weil `applyFieldRedaction` einen Fehltreffer in der Policy nicht als Fehler
 * meldet, sondern auf `FULL` zurueckfallen laesst.
 *
 * Drei Pruefungen:
 *   1. Abdeckung  — jedes emittierte Feld hat eine Policy
 *   2. Suffix     — Policy-Schluessel enden auf __c
 *   3. Org-Schema — jedes emittierte Feld existiert als Feld in der Org
 *
 * Zugrunde liegt `emittedFields.ts`, das die Emitter selbst benutzen. Ohne
 * diese Registry muesste der Test die Integrationsdateien parsen, und genau
 * an den Stellen ausserhalb des `audit/`-Ordners (siehe dort) schoepft es
 * sonst die Felder gar nicht.
 */

import { describe, it, expect } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { DEFAULT_FIELD_POLICIES } from "@/types/audit";
import type { AuditDomain } from "@/types/audit";
import { EMITTED_AUDIT_FIELDS, emittedFieldNames } from "./emittedFields";

/** Domains mit echtem Emitter. Der Rest steht weiter unten mit Begruendung. */
const DOMAINS_WITH_EMITTER = Object.keys(EMITTED_AUDIT_FIELDS) as AuditDomain[];

/**
 * Policy-Schluessel ohne __c.
 *
 * Bewusst benannt, nicht global erlaubt — eine Ausnahme, die still mitwaechst,
 * ist genau der Mechanismus, den dieser Test verhindern soll.
 */
const FIELDS_WITHOUT_SUFFIX: ReadonlyArray<{ field: string; why: string }> = [
  {
    field: "Name",
    why:
      "Standard-nameField jedes Salesforce-Objekts. Participant__c.label lautet laut " +
      "object-meta.xml \"Participant-Name\"; es gibt keine Name__c.",
  },
  {
    field: "Documents",
    why:
      "Kein Salesforce-Feld. absence.document_added traegt nur den Dateinamen " +
      "des Anhangs im Change-Set.",
  },
  {
    field: "RescheduleReason",
    why:
      "Offene Entscheidung E9: traegt kein __c und existiert in der Org nicht. " +
      "Wird umbenannt oder aus changes gestrichen, faellt der Eintrag hier weg.",
  },
];

/**
 * Emittierte Felder, die es bewusst nicht in der Org gibt.
 *
 * `Documents` und `RescheduleReason` siehe oben. `Name` existiert als
 * Standardfeld auf jedem Objekt, ist aber nicht unter `fields/` abgelegt —
 * die Metadaten fuehren es nicht, Salesforce haelt es implizit.
 */
const FIELDS_WITHOUT_ORG_METADATA: ReadonlyArray<{ field: string; why: string }> = [
  {
    field: "Name",
    why:
      "Standard-nameField, haelt Salesforce nicht unter fields/. Im Repo " +
      "zufaellig ueber Account/fields/Name.field-meta.xml vorhanden — darauf " +
      "verlaesst sich der Test nicht, sonst haenge er an fremder Metadatenpflege.",
  },
  {
    field: "Documents",
    why: "Kein Org-Feld, siehe Suffix-Ausnahme.",
  },
  {
    field: "RescheduleReason",
    why: "Kein Org-Feld, offene Entscheidung E9.",
  },
];

// ---------------------------------------------------------------------------
// Org-Schema: Felder aus den SFDX-Metadaten lesen
// ---------------------------------------------------------------------------

const OBJECTS_DIR = path.resolve(process.cwd(), "../../objects");

/** Alle Feldnamen aller Custom-Objekte, aus `fields/*.field-meta.xml`. */
function orgFieldNames(): Set<string> {
  if (!existsSync(OBJECTS_DIR)) {
    // Ohne Metadaten-Verzeichnis kein Schema-Test. Soll nicht vorkommen, aber
    // ein fehlender Ordner darf nicht als "alle Felder sind gueltig" durchgehen.
    throw new Error(
      `Objekt-Metadaten nicht gefunden unter ${OBJECTS_DIR}. ` +
        "Der Schema-Test laeuft aus dem Bundle-Wurzelverzeichnis.",
    );
  }

  const fields = new Set<string>();
  for (const objectDir of readdirSync(OBJECTS_DIR, { withFileTypes: true })) {
    if (!objectDir.isDirectory()) continue;
    const fieldsDir = path.join(OBJECTS_DIR, objectDir.name, "fields");
    if (!existsSync(fieldsDir)) continue;
    for (const file of readdirSync(fieldsDir)) {
      if (!file.endsWith(".field-meta.xml")) continue;
      const xml = readFileSync(path.join(fieldsDir, file), "utf8");
      const fullName = xml.match(/<fullName>([^<]+)<\/fullName>/)?.[1];
      if (fullName) fields.add(fullName);
    }
  }
  return fields;
}

const ORG_FIELDS = orgFieldNames();

// ---------------------------------------------------------------------------
// 1. Abdeckung
// ---------------------------------------------------------------------------

describe("field policy coverage", () => {
  it("kennt mindestens eine Domain mit Emitter", () => {
    expect(DOMAINS_WITH_EMITTER.length).toBeGreaterThan(0);
  });

  it.each(DOMAINS_WITH_EMITTER)(
    "%s: jedes emittierte Feld hat eine Policy",
    (domain) => {
      const policies = DEFAULT_FIELD_POLICIES[domain];
      expect(policies).toBeDefined();

      const missing = emittedFieldNames(domain).filter(
        (field) => !(field in (policies ?? {})),
      );

      expect(
        missing,
        `In DEFAULT_FIELD_POLICIES.${domain} fehlt: ${missing.join(", ")}. ` +
          "Ohne Policy faellt applyFieldRedaction auf FULL zurueck und der " +
          "Wert landet im Klartext im Audit-Log.",
      ).toEqual([]);
    },
  );

  it("jede Domain mit Emitter hat eine Policy-Map in DEFAULT_FIELD_POLICIES", () => {
    const withoutMap = DOMAINS_WITH_EMITTER.filter(
      (domain) => !(domain in DEFAULT_FIELD_POLICIES),
    );
    expect(withoutMap).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 2. Suffix
// ---------------------------------------------------------------------------

describe("field policy suffix", () => {
  it.each(DOMAINS_WITH_EMITTER)(
    "%s: Policy-Schluessel enden auf __c",
    (domain) => {
      const allowed = new Map(
        FIELDS_WITHOUT_SUFFIX.map((entry) => [entry.field, entry.why]),
      );
      const offenders = Object.keys(DEFAULT_FIELD_POLICIES[domain] ?? {}).filter(
        (key) => !key.endsWith("__c") && !allowed.has(key),
      );

      expect(
        offenders,
        `Policy-Schluessel ohne __c und ohne benannte Ausnahme: ${offenders.join(", ")}.`,
      ).toEqual([]);
    },
  );

  it("die Ausnahmen sind einzeln begruendet", () => {
    for (const entry of FIELDS_WITHOUT_SUFFIX) {
      expect(entry.why.length, `${entry.field} braucht eine Begruendung`).toBeGreaterThan(
        20,
      );
    }
  });

  it("jede Ausnahme wird auch wirklich emittiert", () => {
    const emitted = DOMAINS_WITH_EMITTER.flatMap(emittedFieldNames);
    const stale = FIELDS_WITHOUT_SUFFIX.map((e) => e.field).filter(
      (field) => !emitted.includes(field),
    );

    expect(
      stale,
      `Ausnahme ohne Emitter, die Ausnahme ist ueberfluessig: ${stale.join(", ")}`,
    ).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 3. Org-Schema
// ---------------------------------------------------------------------------

describe("emittierte Felder existieren in der Org", () => {
  it("liest Feldnamen aus den Objekt-Metadaten", () => {
    expect(ORG_FIELDS.size).toBeGreaterThan(0);
    expect(ORG_FIELDS.has("Reason__c")).toBe(true);
    expect(ORG_FIELDS.has("CoachComment__c")).toBe(true);
  });

  it.each(DOMAINS_WITH_EMITTER)(
    "%s: jeder Feldname existiert als Feld in der Org",
    (domain) => {
      const allowed = new Set(
        FIELDS_WITHOUT_ORG_METADATA.map((entry) => entry.field),
      );
      const unknown = emittedFieldNames(domain).filter(
        (field) => !ORG_FIELDS.has(field) && !allowed.has(field),
      );

      expect(
        unknown,
        `In der Org nicht vorhanden: ${unknown.join(", ")}. Entweder fehlt die ` +
          "field-meta.xml (Retrieve nachziehen) oder der Audit-Name stimmt nicht.",
      ).toEqual([]);
    },
  );

  it("Name ist als Standardfeld benannt, nicht ueber Account abgesichert", () => {
    // Der Eintrag in FIELDS_WITHOUT_ORG_METADATA ist noetig, damit der Test
    // nicht an Account/fields/Name.field-meta.xml haengt. Dass `Name__c`
    // nirgends existiert, ist die eigentliche Aussage.
    const allowed = new Set(FIELDS_WITHOUT_ORG_METADATA.map((e) => e.field));
    expect(allowed.has("Name")).toBe(true);
    expect(ORG_FIELDS.has("Name__c")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Domänen ohne Emitter
// ---------------------------------------------------------------------------

describe("Domains ohne Emitter", () => {
  const WITHOUT_EMITTER = [
    "workbook",
    "classbook",
    "daily_checkin",
    "time_tracking",
  ] as AuditDomain[];

  it.each(WITHOUT_EMITTER)(
    "%s hat Policies, aber keinen Emitter — aspirational",
    (domain) => {
      // Kein Fehler, sondern eine Feststellung: der Abdeckungstest laesst
      // diese Domain durch, und genau in dem Moment, in dem jemand den ersten
      // Emitter schreibt, muss der Eintrag hier weichen.
      expect(Object.keys(DEFAULT_FIELD_POLICIES[domain] ?? {}).length).toBeGreaterThan(
        0,
      );
      expect(EMITTED_AUDIT_FIELDS[domain]).toBeUndefined();
    },
  );

  it("authentication und system sind als leer und nicht als fehlend gefuehrt", () => {
    expect(DEFAULT_FIELD_POLICIES.authentication).toEqual({});
    expect(DEFAULT_FIELD_POLICIES.system).toEqual({});
  });
});