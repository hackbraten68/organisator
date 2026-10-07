/**
 * Bindung zwischen Salesforce-Feldtyp und GraphQL-Variablentyp.
 *
 * WARUM DIESER TEST EXISTIERT
 * `GetAvailabilityAuditTrail.graphql` deklarierte `$userId: ID!`, gefiltert wurde
 * aber ueber `AuditEvent__c.ParentId__c` — ein Textfeld. Der GraphQL-Typ dort ist
 * `StringOperators`, nicht `IDOperators`, und der Codegen bricht mit
 * "used in position expecting type String" ab. Das fiel erst auf, als das Schema
 * (`backend/schema.graphql`) endlich aktuell war und ein Feld aus drei Wochen
 * Commit-Historie sichtbar machte; davor war der Build gruen und der Fehler latent.
 *
 * Ein leerer Typ-Disconnect ist damit kein Build-Fehler, sondern ein Befund, der
 * beim naechsten Schema-Refresh auffaellt. Ein Test, der bei jedem `npm test`
 * laeuft, ist die einzige Stelle, an dem das nicht davon abhaengt.
 *
 * DIE REGEL
 *   Feld ist Lookup oder Master-Detail  -> `$var: ID!`   (IdOrRef-Operatoren)
 *   Feld ist Text, Email, Number, Datum  -> `$var: String!` (Feldtyp-Operatoren)
 *
 * Wird `ParentId__c` je zu einem Lookup umgebaut, MUSS dieser Test mitkippen —
 * dann lautet die richtige Aenderung in der Query `ID!`, nicht hier.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import GET_AVAILABILITY_AUDIT_TRAIL from "./query/GetAvailabilityAuditTrail.graphql?raw";

// src/api/audit -> src -> backend -> uiBundles -> default
const OBJECTS_DIR = join(__dirname, "../../../../../objects");

function fieldTypeMeta(objectName: string, fieldName: string): string {
  const xml = readFileSync(
    join(OBJECTS_DIR, objectName, "fields", `${fieldName}.field-meta.xml`),
    "utf-8",
  );
  const match = xml.match(/<type>([^<]+)<\/type>/);
  if (!match) throw new Error(`Kein <type> in ${objectName}.${fieldName}`);
  return match[1];
}

/** Der Variablentyp, mit dem `$userId` deklariert ist. */
function declaredVariableType(query: string, variable: string): string {
  const match = query.match(new RegExp(`\\$${variable}\\s*:\\s*([A-Za-z]+!?\\s*)`));
  if (!match) throw new Error(`$${variable} wird in der Query nicht deklariert`);
  return match[1].trim();
}

describe("GraphQL-Variablentypen gegen Salesforce-Feldtypen", () => {
  it("ParentId__c ist ein Textfeld, also filtert die Query ueber String", () => {
    // Der Datentyp haengt an Salesforce, nicht an der Query — deshalb wird er hier
    // aus der Feldmetadatei gelesen und nicht fest verdrahtet.
    expect(fieldTypeMeta("AuditEvent__c", "ParentId__c")).toBe("Text");

    expect(declaredVariableType(GET_AVAILABILITY_AUDIT_TRAIL, "userId")).toBe("String!");
  });

  it("die Query filtert ParentId__c tatsaechlich mit der Variablen", () => {
    // Ohne diese Bindung koennte jemand die Variable umbenennen und der Test oben
    // pruefte eine unbenutzte Deklaration.
    expect(GET_AVAILABILITY_AUDIT_TRAIL).toMatch(/ParentId__c:\s*\{\s*eq:\s*\$userId\s*\}/);
  });

  it("der Aufrufer typisiert userId als string, nicht als ID", () => {
    // Das Seiten-Gegenstueck zur Query: TS und GraphQL muessen dieselbe Vorstellung
    // vom Wert haben, sonst laeuft die Query mit einem zur Laufzeit falschen Typ.
    const source = readFileSync(
      join(__dirname, "availabilityAuditTrail.ts"),
      "utf-8",
    );

    expect(source).toMatch(/userId:\s*string/);
    expect(source).not.toMatch(/userId:\s*string\s*\|/);
  });
});