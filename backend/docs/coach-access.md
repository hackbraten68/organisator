# Coach Access

Zwei Zugriffsstufen, klar getrennt.

| Rolle      | App                                    | Berechtigungen                                                | Umgesetzt als                                                       |
| ---------- | -------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------- |
| Admin      | Backend                                | alles                                                         | Profil des Org (System Administrator)                               |
| Coach      | Backend                                | fachliche Objekte, keine Löschrechte auf Teilnehmer/Programme | Permission Set `backend_Coach`                                      |
| Teilnehmer | Experience Cloud Portal `/organisator` | ausschließlich eigene Daten                                   | Profil `Customer Community Plus User` + `Participant_Portal_Access` |

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

| Objekt                                              | Pflichtfelder                                                                                                                                                                   |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AuditEvent__c`                                     | `EventType__c`, `OccurredAt__c`, `SubjectId__c`, `SubjectType__c`, `Domain__c`, `Action__c`, `ActorType__c`, `Visibility__c`, `Sensitivity__c`, `Source__c`, `SchemaVersion__c` |
| `AuditOutbox__c`                                    | `EventType__c`, `Status__c`, `RetryCount__c`                                                                                                                                    |
| `Absence__c`                                        | `Participant__c`, `Status__c`, `Type__c`, `StartDate__c`, `EndDate__c`                                                                                                          |
| `Appointment__c`                                    | `Participant__c`, `Status__c`, `Type__c`, `StartTime__c`, `EndTime__c`                                                                                                          |
| `AvailabilitySlot__c`                               | `User__c`-Zeitfelder, `DayOfWeek__c`, `Type__c`                                                                                                                                 |
| `Module__c` / `Learning_Path__c` / `Participant__c` | je 1 Feld                                                                                                                                                                       |

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

## Stand in `hubSandbox` (2026-10-07)

`backend_Coach` ist vier Usern zugewiesen:

| User                                       | Profil                   | Aussagekräftig als Coach-Test? |
| ------------------------------------------ | ------------------------ | ------------------------------ |
| `sandra@codingschule.de.devhub`            | `Standardbenutzer Sales` | **ja** — einziger Nicht-Admin  |
| `frank@codingschule.de.devhub`             | `System Administrator`   | nein                           |
| `samuel.dillenburg@codingschule.de.devhub` | `System Administrator`   | nein                           |
| `coach.test@codingschule.de.devhub`        | `Standardbenutzer AM`    | Referenzprofil                 |

**Offen:** Frank und Sam sitzen auf `System Administrator`. Die Zuweisung von
`backend_Coach` ändert für sie nichts — Modify All Data gewährt bereits alles. Sie
haben damit Zugang, aber ihr Test bestätigt nichts. Für einen belastbaren Test ist
entweder eine Profilumstellung nötig oder Sandra der Testkollege.

**`Coach_Profile__c.User__c` gibt es seit dem 2026-10-09.** Lookup auf `User`,
optional, in `backend_Coach` nur lesbar. Damit ist die Zuordnung von Coach-Profil
zu Login eine Datenbankbeziehung statt einer Namensvermutung.

| Coach_Profile      | Rolle            | `User__c`            | Login                           |
| ------------------ | ---------------- | -------------------- | ------------------------------- |
| Frank Blum         | Staff            | `0056700000DbWBqAAN` | `frank@codingschule.de.devhub`  |
| Sam Dillenburg     | Staff            | `005Oj000016CN1hIAG` | `samuel.dillenburg@…`           |
| Sandra Krüger      | Kubernetes Coach | `0056700000DbU5CAAV` | `sandra@codingschule.de.devhub` |
| **Ghaith Saidani** | AWS Coach        | **leer**             | **kein Account**                |

Das leere Feld ist der eigentliche Fund. Vorher war nicht unterscheidbar, ob Ghaith
ein Coach ohne Zugang ist oder ein Datensatz, der nie zugeordnet wurde — alle vier
Profile hatten `Email__c`, `Discord__c` und `GitHub__c` leer und keinen eigenen
Contact-Satz. Jetzt steht es als Fehlwert da. **Ein leeres `User__c` ist der
Normalfall, kein Fehlerfall**; `listCoaches()` liefert dann `userId: undefined`, und
der Coach bleibt unter seinem Namen nutzbar. `coachService.test.ts` sichert genau
diesen Fall ab.

**Was das Feld nicht löst:** der Termin-Picker. `Appointment__c.Coach__c` und
`AvailabilitySlot__c.User__c` zeigen beide auf `User`, und Salesforce lehnt
`Coach_Profile__c`-Ids für diese beiden Felder ab (`src/api/user/userService.ts`).
Wer einen Termin bucht, wählt weiterhin einen Login. Eine Umstellung wäre ein
Feldtypwechsel an zwei Feldern mit Daten und ist eine eigene Entscheidung.

Nicht deploybar und daher manuell: die 31 Pflichtfelder, jedes Profil, und jedes neue
Custom-Feld — `User__c` wurde nach Regel E1 von Hand in Setup angelegt und danach
per Retrieve ins Repository geholt. Deploybar und bereits erledigt: `backend_Coach`
selbst und die Beschreibung von `User__c` (Änderung am bestehenden Feld, Regel E2).

## Verifikation

Der eigentliche Test ist nicht der Login, sondern dass ein Coach mit einem
**Standardprofil** (nicht Admin) die Fachobjekte sieht und bearbeiten kann,
während er keine Berechtigung auf Objekte hat, die nicht im Set stehen. Ein
Coach mit System-Administrator-Profil beweist nichts — der umgeht FLS und OWD.

Der Ablauf steht in `docs/coach-test-protocol.md`, einschließlich des
Freischalt-Tests unter `/contacts`.
