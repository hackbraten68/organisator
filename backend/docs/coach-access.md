# Coach Access

Zwei Zugriffsstufen, klar getrennt.

| Rolle | App | Berechtigungen | Umgesetzt als |
|---|---|---|---|
| Admin | Backend | alles | Profil des Org (System Administrator) |
| Coach | Backend | fachliche Objekte, keine Löschrechte auf Teilnehmer/Programme | Permission Set `backend_Coach` |
| Teilnehmer | Experience Cloud Portal `/organisator` | ausschließlich eigene Daten | Profil `Customer Community Plus User` + `Participant_Portal_Access` |

Die Trennung wird von Salesforce erzwungen, nicht nur von der App:

- `allowInternalUserLogin: false` im Network — interne Kollegen können sich nicht
  im Portal einloggen
- `backend.app-meta.xml` ist eine interne `CustomApplication` ohne
  `isGuestAccessible` und ohne `profileFilter`
- Alle Portal-Objekte haben `externalSharingModel: Private`
- `selfRegistration: false` — Portal-Accounts werden von Staff angelegt, nicht
  selbst registriert (ADR-005)

## Was `backend_Coach` gewährt

Objekt- und Feldberechtigungen sind aus den GraphQL-Operationen abgeleitet, die
das UI-Bundle tatsächlich absetzt — den Create/Update/Delete-Mutations und den
Feldauswahlen der `uiapi { query }`-Operationen. Das ist wichtig, weil das
Bundle **keinen Apex** verwendet: Zugriff hängt vollständig an CRUD und FLS.

Daraus folgen drei Entscheidungen, die nicht selbstverständlich sind:

1. **`AuditEvent__c` bekommt Create.** Die App schreibt Audit-Events in der
   Session des handelnden Users. Ohne dieses Recht scheitert jeder
   Audit-Write mit `INSUFFICIENT_ACCESS` — bei Coaches genauso wie beim Admin.
2. **`AuditEvent__c` bekommt kein Update.** Der Event-Log ist append-only.
3. **`AuditEvent__c` bekommt `viewAllRecords`.** Es ist das einzige Objekt mit
   internem OWD `Private`. View All umgeht das. Eine OWD-Änderung wäre eine
   globale, dauerhafte Freigabe gewesen; View All ist eine widerrufbare
   Zuweisung.

`Participant__c` und `Program__c` haben bewusst **kein** Delete — für beide gibt
es im Bundle keine Delete-Mutation.

## ⚠️ Pflichtfelder: FLS kommt vom Profil, nicht vom Permission Set

31 Felder der Coach-Objekte sind `required`. Salesforce **lehnt jeden**
`fieldPermissions`-Eintrag für ein Pflichtfeld ab:

```
You cannot deploy to a required field: AuditOutbox__c.RetryCount__c
```

Das gilt unabhängig vom Wert — auch `editable=false` wird abgelehnt, und keines
der 29 Permission Sets in der Org listet ein Pflichtfeld. Verifiziert an
`API_User` im Org (37 von 56 Feldern gelistet, beide Pflichtfelder fehlen).

Die Feldberechtigung für diese 31 Felder kommt damit **aus dem zugewiesenen
Profil**. Ein Permission Set kann sie nicht liefern.

Betroffen sind unter anderem:

| Objekt | Pflichtfelder |
|---|---|
| `AuditEvent__c` | `EventType__c`, `OccurredAt__c`, `SubjectId__c`, `SubjectType__c`, `Domain__c`, `Action__c`, `ActorType__c`, `Visibility__c`, `Sensitivity__c`, `Source__c`, `SchemaVersion__c` |
| `AuditOutbox__c` | `EventType__c`, `Status__c`, `RetryCount__c` |
| `Absence__c` | `Participant__c`, `Status__c`, `Type__c`, `StartDate__c`, `EndDate__c` |
| `Appointment__c` | `Participant__c`, `Status__c`, `Type__c`, `StartTime__c`, `EndTime__c` |
| `AvailabilitySlot__c` | `User__c`-Zeitfelder, `DayOfWeek__c`, `Type__c` |
| `Module__c` / `Learning_Path__c` / `Participant__c` | je 1 Feld |

**Konsequenz:** Wenn das Profil des Kollegen diese Felder nicht freigibt,
schlägt der erste Insert fehl und — schlimmer — der Audit-Write daneben auch.
Das ist die wahrscheinlichste Stelle, an der der erste Coach-Test rot wird.

### Setup-Schritte vor der Zuweisung

1. Ein bestehendes Coach-Profil um die 31 Felder erweitern, **oder** ein eigenes
   Profil dafür anlegen. Profile werden nie deployed (`.forceignore` plus
   `scripts/preflight-deploy.mjs`, Kontrolltest E3 in `AGENTS.md`) — die
   Freigabe erfolgt in Setup.
2. `backend_Coach` den ausgewählten Kollegen zuweisen.
3. Einen Coach-Test durchspielen: Teilnehmer anlegen, Termin anlegen,
   Abwesenheit genehmigen. Prüfen, ob die Audit-Events im Verlauf erscheinen.

## Verifikation

Der eigentliche Test ist nicht der Login, sondern dass ein Coach mit einem
**Standardprofil** (nicht Admin) die Fachobjekte sieht und bearbeiten kann,
während er keine Berechtigung auf Objekte hat, die nicht im Set stehen. Ein
Coach mit System-Administrator-Profil beweist nichts — der umgeht FLS und OWD.