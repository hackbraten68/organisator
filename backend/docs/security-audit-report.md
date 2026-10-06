# Security-Audit — Gesamter Codebestand

**Datum:** 2026-10-06
**Umfang:** beide UI-Bundles (Backend 229 Dateien / 51.590 Zeilen, Frontend 82 Dateien / 7.810 Zeilen), alle Apex-Klassen und Trigger beider SFDX-Projekte, alle Permission-Sets, Objekt-Metadaten, `npm audit` beider Bundles, Dependency-Baum bis zu den Blattbibliotheken.
**Methode:** statische Analyse plus gezielte Ausführung (ein Test wurde zum Beleg der Kernbefunde geschrieben und danach wieder entfernt). Kein Zugriff auf eine Sandbox-Org — wo das nötig war, steht es als **ORG** dabei.
**Verwandt:** `.opencode/plans/refactor-security-plan.md` (Berechtigungsmodell E1), `backend/docs/portal/portal-access-plan.md` (Portal-Zweischichtenmodell)

---

## 1. Kurzfassung

Zwei Befunde sind neu und beide betreffen **Datenschutz von Gesundheitsdaten**, nicht nur Berechtigungen:

| # | Befund | Schwere | Status |
|---|---|---|---|
| **S1** | Abwesenheitsgründe (`Absence__c.Reason__c`) landen **unredigiert im Audit-Log** — die Redaktions-Policy greift wegen eines Namensfehlers nicht | 🔴 hoch | ✅ behoben `2c99185` |
| **S2** | `CoachComment__c` (Ablehnungskommentar, oft vertraulich) ebenfalls unredigiert | 🟠 mittel | ✅ behoben `2c99185` |
| **S3** | Coaches dürfen `AuditEvent__c` **anlegen** (`allowCreate=true`) — das Audit-Log ist beschreibbar | 🟠 mittel | **neu** |
| **S4** | Coaches dürfen `AuditOutbox__c` **bearbeiten** (`allowEdit=true`), inkl. `Payload__c` und `Error__c` | 🟠 mittel | **neu** |
| **S5** | `visibility` wird beim Lesen **nirgends durchgesetzt** — nur dekorativ im Drawer angezeigt | 🟠 mittel | **neu** |
| **S6** | `defaultSharing` fehlt in allen vier Custom-Objekten des Backend-Projekts | 🟠 mittel | **neu** |
| **A1** | `viewAllRecords` auf 12 von 15 Objekten — kein Row-Level-Modell für Coaches | 🔴 hoch | bekannt (E1) |
| **A2** | `backend_Access` ohne Objekt-/Feldrechte, `backend_Coach` trägt alles | 🟡 niedrig | bekannt (E1) |
| **A3** | Frontend-Auth-Pfad (830 Zeilen Session-Logik) mit 15 Tests ungesichert | 🟡 niedrig | bekannt |
| **D1** | `shadcn` steht in `dependencies`, wird nirgends importiert, zieht 8 high-CVEs | 🟠 mittel | bekannt, verschärft |
| **D2** | `protobufjs` critical + `@salesforce/platform-sdk` high, transitiv, `fixAvailable: false` | 🟡 niedrig | nicht behebbar |

**Sauber geprüft und unauffällig:** keine Secrets im Repo (inkl. Historie), keine XSS-Vektoren, keine GraphQL-Injection, kein dynamisches SOQL, kein Open Redirect, keine CSRF-Lücke, saubere Fehlerkonvention in Apex (kein Exception-Leak nach außen).

**Wichtigste Nachricht:** S1 und S2 sind billig zu beheben (Namensangleich, kein Refactor) und betreffen genau die Datenkategorie, für die in der Org eine Bestätigungspflicht gilt. Ich würde sie vor allem anderen anfassen.

**Nachtrag 2026-10-06:** S1 und S2 sind behoben (`2c99185`, Paket P1 in `.opencode/plans/security-fixes-plan.md`). Die Beschreibung unten ist der **Auditbefund vor dem Fix** und bleibt unverändert stehen, damit der Befund nachvollziehbar bleibt. Drei Punkte, die erst beim Umsetzen sichtbar wurden:

1. Der im Befund vorgeschlagene Fix für das Hand-Flag (`redacted = policyRedacted || incomingRedacted`) hätte **nicht** funktioniert. Bei Strategie `FULL` bleiben die Werte im Speicher, das ODER auf das Flag hätte `Changes__c` weiter mit Klartext befüllt, während die Oberfläche „Wert geschwärzt" anzeigt. Korrekt ist ein Kurzschluss, der die Werte strippt.
2. Das Hand-Flag stand an **zwei** Stellen auf `false` (`absenceAuditIntegration.ts:174` und `absenceService.ts:313-318`), nicht nur an der im Befund genannten.
3. Bereits persistierte Events enthalten die Werte weiterhin. Die Bereinigung ist als Folgeaufgabe E8 im Fix-Plan geführt, **nach** P4 — sie braucht Schreibrechte, die P4 erst entzieht. `CoachComment__c` steht zusätzlich im Klartext auf dem `Absence__c`-Datensatz selbst, die Bereinigung des Logs beseitigt also nur die Dublette.

Nach P1 sind `Reason__c` und `CoachComment__c` für **niemanden** im Audit sichtbar, auch nicht für die Person, die sie eingetragen hat: `canSeeRedacted` wird nur an einer Stelle gesetzt und ist dort dauerhaft `false`. Das entspricht der Absicht im Feld-Beschreibungstext, lässt die Policy-Option `allowRedactionByPermission` aber ungenutzt, bis ein Berechtigungsmodell existiert (A1/E1).

---

## 2. Befunde im Detail

### S1 — Abwesenheitsgründe werden unredigiert protokolliert 🔴

**Behauptete Absicht** (`backend/force-app/main/default/uiBundles/backend/src/types/audit.ts:269`):

```ts
absence: {
  Type: { strategy: 'FULL', displayType: 'status' },
  StartDate: { strategy: 'FULL', displayType: 'date' },
  EndDate: { strategy: 'FULL', displayType: 'date' },
  Reason: { strategy: 'REDACTED', displayType: 'text', allowRedactionByPermission: true },
},
```

**Was tatsächlich emittiert wird** (`src/api/audit/absenceAuditIntegration.ts:105-109`):

```ts
{ field: "Status__c",   oldValue: null, newValue: "Submitted", redacted: false },
{ field: "Type__c",     oldValue: null, newValue: absence.type, redacted: false },
{ field: "StartDate__c",… }, { field: "EndDate__c", … },
...(absence.reason ? [{ field: "Reason__c", oldValue: null,
                        newValue: absence.reason, redacted: true }] : []),
```

`applyFieldRedaction` (`src/api/audit/auditService.ts:85-87`) schlägt `policies[field]` **exakt** nach:

```ts
const policy = policies[field];
const strategy: AuditFieldStrategy = policy?.strategy ?? 'FULL';
```

`Reason__c` ≠ `Reason` → kein Policy-Treffer → `strategy: 'FULL'` → **Wert bleibt im Klartext**.

**Reproduziert.** Test gegen `applyFieldRedaction`, danach wieder entfernt:

```
absence Reason__c -> [{"field":"Reason__c","newValue":"Krebs, Chemo, 3 Wochen","redacted":false}]
absence Reason     -> [{"field":"Reason","redacted":true}]              // Policy greift
```

**Aggravierender Detailpunkt:** Die Integrationsdatei setzt `redacted: true` **von Hand** in das Change-Objekt — der Autor wusste also, dass das Feld sensibel ist. Dieses Flag wird aber von `applyFieldRedaction` **nicht gelesen**: die Funktion destrukturiert `{ field, oldValue, newValue }` und **überschreibt** `redacted` mit dem Ergebnis der Policy-Nachschlagung. Das Hand-Flag hat keine Wirkung und erzeugt die falsche Sicherheit, die wir beim Lesen des Codes empfinden.

**Zweite Ausprägung derselben Ursache:** `classbook.EntryText` ist `REDACTED` definiert, aber es existiert keine `classbook`-Integration, die den Wert emittiert — dort ist die Lücke theoretisch. `daily_checkin` hat Policies (`Mood`, `AnswerText`, `ResponseText`, `EntryText` — alle drei REDACTED) und ebenfalls keine Integrationsdatei. Diese Felder sind heute harmlos, aber die Policies suggerieren eine Absicherung, die es nicht gibt.

**Warum das zählt:** Ein Abwesenheitsgrund ist die Angabe „Krebserkrankung, laufende Chemotherapie". Der Wert steht unverschlüsselt in `AuditEvent__c.Changes__c`, und `AuditEvent__c` hat `viewAllRecords=true` — **jeder** Coach liest die Gründe **aller** Coaches. Bei einer betrieblichen Krankmeldung mit anschließender Krankschreibung ist das genau die Information, die branchenüblich als besonders schutzbedürftig eingestuft wird.

**Fix (XS):** Policy-Schlüssel auf `__c` umstellen — `Reason__c`, `Type__c`, `StartDate__c`, `EndDate__c` — und `Status__c` als `FULL` ergänzen. Zusätzlich `applyFieldRedaction` das eingehende `redacted`-Flag **respektieren** lassen, damit ein Hand-Flag nicht stillschweigend überschrieben wird. Test dazu: einer, der mit `Reason__c` einen Wert reindict und `newValue === undefined` erwartet.

---

### S2 — Ablehnungskommentar ebenfalls unredigiert 🟠

`absenceAuditIntegration.ts:174`:

```ts
{ field: "CoachComment__c", oldValue: null, newValue: reason, redacted: false },
```

Für `absence` existiert **kein** Policy-Eintrag für `CoachComment__c` (die `absence`-Policies kennen nur `Type`, `StartDate`, `EndDate`, `Reason`) → Default `FULL`. Der Kommentar wird also unabhängig von der Namensfrage im Klartext gespeichert.

Ein Ablehnungskommentar wie *„Patientin befindet sich laut Hausarzt in psychischer Krise, bitte im nächsten Quartal erneut versuchen"* ist sensible Gesundheitsinformation und steht dauerhaft im Audit-Log.

**Fix (XS):** Policy `CoachComment__c: { strategy: 'REDACTED', allowRedactionByPermission: true }` und `redacted: false` → `true` korrigieren.

---

### S3 — Das Audit-Log ist beschreibbar 🟠

`backend/force-app/main/default/permissionsets/backend_Coach.permissionset-meta.xml`:

```
AuditEvent__c  allowRead=true  allowCreate=true  allowEdit=false  allowDelete=false
               viewAllRecords=true  modifyAllRecords=false
```

`allowEdit=false` wirkt nachvollziehbar (Manipulation bestehender Events soll nicht gehen). Aber **`allowCreate=true`** bedeutet: ein Coach kann über UI API ein beliebiges `AuditEvent__c`-Objekt erzeugen — mit selbst gewähltem `ActorId__c`, `EventType__c`, Zeitstempel und Inhalt. Die 11 Feld-Berechtigungen auf `AuditEvent__c` sind erwartungsgemäß alle `editable=true`, aber `allowCreate` allein genügt.

Ein solcher Fake-Event landet in `GetParticipantActivityTimeline` **neben** den echten und wird in der Aktivitäts-Timeline angezeigt. Ein Admin, der später einen Vorwurf prüft, kann nicht unterscheiden, was passiert ist, von was jemand behauptet hat.

**Erschwerend für den Fix:** Der Coach muss `allowCreate` haben, weil das Audit aus der UI heraus in *seiner* Session geschrieben wird. Der Missbrauch und der legitime Pfad teilen sich dasselbe Recht.

**Fix — aber nicht so billig, wie es aussieht (Korrektur vom 2026-10-06, siehe Abschnitt 7):** `allowCreate` auf `false` setzen ist *nicht* möglich, ohne das Audit komplett stillzulegen. Der Audit-Schreibpfad läuft **clientseitig über die Session des angemeldeten Coaches** (`auditApiService.ts:212 createAuditEventRecord` → GraphQL-Mutation `CREATE_AUDIT_EVENT`). Ein Coach braucht also zwingend `allowCreate`, damit der Coach überhaupt ein Audit-Event schreiben kann. Wer `allowCreate` entzieht, löscht das Audit-Log.

Der eigentliche Fix ist ein **serverseitiger Schreibpfad**: eine Apex-Klasse, die das Event in `without sharing`/System-Mode persistiert, den Actor aber aus dem Konstrukt ableitet (nicht aus einem frei setzbaren Parameter). Danach kann `allowCreate` entzogen werden. Aufwand M statt XS, plus Apex-Testklasse.

---

### S4 — Die Outbox ist von Coaches beschreibbar 🟠

```
AuditOutbox__c  allowRead=true  allowCreate=true  allowEdit=true  allowDelete=false
                viewAllRecords=true
Feldrechte: CorrelationId__c, Error__c, NextRetryAt__c, ParticipantId__c,
            Payload__c, SubjectId__c  — alle editable=true
```

`Payload__c` enthält das **eingefrorene Audit-Event** (`auditOutbox.ts:75`), inklusive aller Feldänderungen. Ein Coach kann einen PENDING-Eintrag umschreiben — etwa `Reason__c` aus einem Abwesenheitsgrund entfernen, bevor er replayed wird. `Error__c` und `NextRetryAt__c` sind ebenfalls schreibbar, womit sich ein fehlgeschlagener Eintrag gezielt in der Wiederholungsschleife festhalten oder verwerfen lässt.

**Verschärfend:** Die Outbox hat **keinen Verarbeiter.** `processOutboxOnce()`, `listOutboxEntries()`, `requeueOutboxEntry()` und `failOutboxEntry()` (`auditOutbox.ts:119-246`) werden **nirgends im Produktivcode aufgerufen** — nur in `auditOutbox.test.ts`. Es gibt keinen Scheduled Apex in beiden Projekten (verifiziert: keine `scheduledJobs`-Metadaten). Die Einträge bleiben also dauerhaft PENDING.

Das ist primär ein Korrektheitsproblem, sekundär ein Sicherheitsproblem: der Pfad, über den die Rechte vergeben sind, ist gleichzeitig der Pfad, der nie läuft. Wer S3/S4 entschärft, sollte sich bewusst sein, dass der Ausfall-Pfad derzeit nur aus einem Log-Eintrag besteht.

**Fix:** Siehe Abschnitt 7 — dieselbe Klippe wie bei S3: Die Outbox wird ebenfalls clientseitig geschrieben (`auditOutbox.ts:95 AuditOutbox__cCreate`, `:151 Update`). `allowEdit` kann erst entzogen werden, wenn ein serverseitiger Schreibpfad existiert. Parallel zu entscheiden: Wird die Outbox überhaupt replayed (aktuell nein), oder wird der bewusste Verzicht dokumentiert (ADR-14)? Der jetzige Zustand ist weder das eine noch das andere.

---

### S5 — `visibility` wird beim Lesen nicht durchgesetzt 🟠

`DEFAULT_DOMAIN_VISIBILITY` (`src/types/audit.ts:315`) setzt `absence: 'restricted'`, `daily_checkin: 'restricted'`, `authentication: 'restricted'`. Der Wert wird korrekt **geschrieben** (`auditService.ts:259`).

Beim Lesen wird er jedoch nur angezeigt:

```
components/audit/ActivityEventDetailsDrawer.tsx:224   {event.visibility === 'restricted' … : event.visibility}
```

Der Filter, der beim Lesen tatsächlich greift, ist ein anderer: `filterForAudience()` (`activityProjection.ts:184`) prüft `includeInActivity`, `technical` und `audiences` — **niemals** `event.visibility`.

Die Kommentare behaupten das Gegenteil. `auditApiService.ts:126`:

> „Applied ONLY to the already authorized result set: sharing, permissions, visibility, sensitivity and redaction are enforced upstream (server)."

Das ist im Bundle **nicht wahr**: `getParticipantActivity()` holt alle Events für den Teilnehmer via UI API und filtert clientseitig. Es gibt keine serverseitige Sichtbarkeitsdurchsetzung — die „ upstream"-Schicht ist ein Kommentar.

Dieselbe Lücke bei `sensitivity` (gleiche Datei, gleiches Muster).

**Auswirkung:** Der Sichtbarkeitsschutz existiert als Feld, nicht als Regel. Praktisch entschärft durch A1 (alle Coaches sehen alles), aber sobald A1 behoben wird, entsteht **falsche Sicherheit**: die `visibility`-Spalte suggeriert dann eine Trennung, die es nicht gibt.

**Fix (S):** Entweder `visibility`/`sensitivity` in `filterForAudience` einbeziehen, oder — besser — die Zuordnung Audience↔Domain als serverseitige Regel in die Sharing-Definition der Org verlagern und die Kommentare so korrigieren, dass sie beschreiben, was tatsächlich erzwungen wird.

---

### S6 — `defaultSharing` fehlt in allen Custom-Objekten 🟠

`backend/force-app/main/default/objects/{Participant,Absence,Appointment,AuditEvent}__c` enthalten **kein** `<defaultSharing>`-Element.

Ohne dieses Element gilt der Salesforce-Default für Custom Objects: `ReadWrite` bzw. `PublicReadWrite` — das Modell, das die Frontend-Dokumentation ausdrücklich als **falsch** beschreibt:

> `Participant__c` has an external org-wide default of `Private` (aus `frontend/.../participantApi.ts:9-13`)

Der aktuelle Sandboxzustand ist offenbar `Private` (die Portal-Doku stützt sich darauf), aber er steht **nirgends im Repo**. Ein `sf project deploy` in eine saubere oder neue Org erzeugt Objekte mit öffentlichem Lesezugriff. Dasselbe gilt für `AuditEvent__c`: ohne `defaultSharing` sind Audit-Events org-weit lesbar, sobald ein Benutzer `allowRead` auf das Objekt hat.

**Fix (XS):** `<defaultSharing>Private</defaultSharing>` in alle vier (bzw. alle sieben Custom-Objekt-Metadaten) eintragen und mitdeployen. Damit wird der Ist-Zustand zurdeploybaren Invariante.

---

### A1 — `viewAllRecords` auf 12 von 15 Objekten 🔴 (bekannt)

`backend_Coach.permissionset-meta.xml`, 15 `<objectPermissions>`, davon 12 mit `<viewAllRecords>true</viewAllRecords>`. Ausnahmen: `User`, `ContentVersion`, `ContentDocumentLink`.

Betroffen sind `Participant__c`, `Appointment__c`, `Absence__c`, `Program__c`, `Module__c`, `Learning_Path__c`, `AvailabilitySlot__c`, `AuditEvent__c`, `AuditOutbox__c`, `Coach_Profile__c`, `Account`, `Contact`.

Detaillierte Aufschlüsselung (neu, für die Chef-Vorlage nützlich):

| Objekt | read | create | edit | delete | viewAll |
|---|---|---|---|---|---|
| Participant__c | ✓ | ✓ | ✓ | ✗ | ✓ |
| Appointment__c | ✓ | ✓ | ✓ | ✗ | ✓ |
| Absence__c | ✓ | ✓ | ✓ | ✗ | ✓ |
| Program__c | ✓ | ✓ | ✓ | ✗ | ✓ |
| Module__c | ✓ | ✓ | ✓ | **✓** | ✓ |
| Learning_Path__c | ✓ | ✓ | ✓ | **✓** | ✓ |
| AvailabilitySlot__c | ✓ | ✓ | ✓ | **✓** | ✓ |
| AuditEvent__c | ✓ | **✓** | ✗ | ✗ | ✓ |
| AuditOutbox__c | ✓ | **✓** | **✓** | ✗ | ✓ |
| Coach_Profile__c | ✓ | ✗ | ✗ | ✗ | ✓ |
| Account | ✓ | ✗ | ✗ | ✗ | ✓ |
| Contact | ✓ | ✗ | ✗ | ✗ | ✓ |
| User | ✓ | ✗ | ✗ | ✗ | ✗ |
| ContentVersion | ✓ | **✓** | ✗ | ✗ | ✗ |
| ContentDocumentLink | ✓ | ✗ | ✗ | ✗ | ✗ |

Bemerkenswert: `ContentVersion` hat `allowCreate=true` bei `viewAllRecords=false` — das ist der Datei-Upload-Pfad der Abwesenheitsdokumente (`AbsenceDocuments.tsx`), also gewollt.

**Kernproblem:** Die Priorität-0-Anforderung „Coach sieht nur freigegebene Contacts" ist im Permission-Set nicht abbildbar. Ein UI-Filter ist kosmetisch; Report, Flow und Apex-Query eines Coaches umgehen ihn. → Entscheidung E1, Chef-Nachricht liegt vor.

---

### A2 — Namensführung lädt zum Fehlgebrauch ein 🟡 (bekannt)

`backend_Access.permissionset-meta.xml`: `ApiEnabled` + `StaffIdentity`-Klassenzugriff, **null** Objekt-/Feld-Berechtigungen. Alle 59 Feld- und 15 Objekt-Berechtigungen stecken in `backend_Coach`.

Wer `backend_Access` zuweist, bekommt eine funktionierende, aber handlungsunfähige Sitzung. Der Name verspricht Zugang, liefert aber weder Lese- noch Schreibzugriff. `org-setup.config.json` weist genau dieses Set zu (`assignee: currentUser`) — das Skript stellt also einen Zustand her, der nicht der Produktion entspricht.

**Fix (XS):** Kommentar im Permission-Set, der die Rollenaufteilung explizit macht und `backend_Access` als „API-Freigabe ohne Datenrechte" kennzeichnet.

---

### A3 — Frontend-Auth-Pfad ohne Testdeckung 🟡 (bekannt)

830 Zeilen Session-Logik in `frontend/.../features/authentication/sessionTimeout/` gegen 15 Tests im gesamten Frontend-Bundle.

**Das ist kein Qualitäts-, sondern ein Risikobefund**, weil der Pfad Sicherheitslogik trägt: `SessionTimeoutValidator.tsx` (604 Zeilen), `sessionTimeService.ts` (149), `sessionTimeoutConfig.ts` (77) mit `LATENCY_BUFFER_SECONDS: 3` und dem CSRF-Prefix `"while(1);\n"` (CSRF-Schutz von Salesforce).

Der Code selbst ist solide — `isValidRedirect` (`authHelpers.ts:54-60`) prüft gegen Open Redirect (kein `//`, kein `\`, Regex `/[^!-ÿ]/` für Steuerzeichen), `AuthContext` bricht den Probe mit Timeout ab, statt die UI dauerhaft zu blockieren. Es fehlt die Absicherung, nicht die Qualität.

**Fix (M):** Tests für `sessionTimeService` (Prefix-Stripping, Latenzpuffer) und `isValidRedirect` (Tabelle mit `//evil.com`, `/\evil.com`, `%2f%2f`, Steuerzeichen).

---

### D1 — `shadcn` als Laufzeit-Abhängigkeit 🟠 (bekannt, verschärft)

`shadcn@^3.8.5` steht in `dependencies` beider Bundles und wird **nirgends importiert** (verifiziert: `grep -rn "from ['\"]shadcn"` → null Treffer). Es ist ein CLI-Tool und gehört in `devDependencies`.

Es verursacht 8 der 19 high-CVEs im Backend-Bundle (`shadcn` → `ts-morph` → `@ts-morph/common` → `fast-glob` → `micromatch` → `braces` → `brace-expansion`).

**Entwarnung, verifiziert:** Keines dieser Pakete landet im ausgelieferten Bundle. `dist/` (1,3 MB) enthält keinen Treffer für `micromatch`, `ts-morph` oder `protobuf`. Die CVEs sind damit **kein Runtime-Risiko für Endnutzer**, wohl aber eines für die Build-Umgebung und für die Aufmerksamkeit, die echte Treffer kosten.

**Fix (XS):** `npm uninstall shadcn` in beiden Bundles. `npm audit --omit=dev` fällt von 25 auf ~17 Lücken.

---

### D2 — Nicht behebbare Transitiv-CVEs 🟡

```
CRITICAL protobufjs   Prototype Pollution + Arbitrary code execution   fixAvailable: false
HIGH     @salesforce/platform-sdk                                          fixAvailable: false
HIGH     @conduit-client/*  (8 Pakete)                                    fixAvailable: false
HIGH     o11y                                                                 fixAvailable: false
```

Kette: `@salesforce/platform-sdk → o11y → protobufjs`. Über `@salesforce/platform-sdk@11.71.5` hängen zwei `o11y`-Instanzen (252.7.0 → protobufjs 7.2.4, und 266.17.0 → protobufjs 7.5.6).

Bewertung: keine Handlungsoption ohne Plattform-Upgrade. Der Code ist Browser-Code, der protobuf nur zur Serialisierung der Telemetrie nutzt, nicht zur Deserialisierung fremder Eingaben — das verwundbare Muster (Parsen bösartiger Payloads) wird im Bundle nicht erreicht. Als **akzeptiert dokumentieren**, nicht als offenes Risiko führen.

`undici` (2 high, `fixAvailable: true`) lässt sich dagegen per Lockfile-Update schließen.

---

## 3. Geprüft und unauffällig

Diese Prüfungen sind **negativ** ausgegangen. Sie aufzunehmen ist Absicht — ein Audit, das nur Funde listet, suggeriert Lücken, die es nicht gab.

**Secrets**
- `git grep` über alle tracked Files nach `api_key|secret|password|token|bearer` mit Wertzuweisung: nur Test-Fixtures (`learningPathAudit.test.ts:288 internalToken: "secret"`, `signed-in-shell.spec.ts:48 token: 'e2e-csrf-token'`) und UI-Labels (`authenticationConfig.ts:40 PASSWORD: "Enter your password"`, `sessionTimeoutConfig.ts:41 CSRF_TOKEN: "while(1);\n"`).
- Keine `.env`, `.pem`, `.p12`, `.jks`, `credentials` in tracked Files.
- `.gitignore` deckt `.sf/`, `.sfdx/`, `.opencode/node_modules/` ab; `.sfdx/sfdx-config.json` ist **nicht** tracked.
- `git log --all -p -S "BEGIN RSA"`: keine Treffer in 158 Commits.
- `config/project-scratch-def.json`: nur `EnableSetPasswordInApi` + Lightning-Settings. `scripts/org-setup.config.json`: nur eine Permission-Set-Zuweisung.

**Injection**
- GraphQL: `executeGraphQL` (`api/graphqlClient.ts`) nutzt `createDataSDK` + `data.graphql.query/mutate`. Sämtliche Nutzereingaben gehen über den `variables`-Map, nie in den Dokumenttext.
- Such-Modul: `queryFragment.ts:33` erzwingt `assertValidKey` mit `KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/` auf jeden Source-Key, der als Alias in den Dokumenttext wandert. `cmsQueryFragment.ts` nutzt ausschließlich `$cmsKeyword`/`$UIBundleId`/`$cmsOffset`/`$cmsLimit`/`$cmsContentTypeFQNs`; `isValidCmsFqn` (`contentTypeUtils.ts:27`) bewacht jeden FQN.
- Apex: kein dynamisch zusammengesetztes SOQL in `ParticipantPortalSharingService`, `StaffIdentity` und den vier Triggern.
- Datenableitung: `createParticipant` (`participantService.ts:346`) holt den Contact per `getContact(input.contactId)` und leitet `name`/`email` aus dem Contact-Datensatz ab, **nicht** aus dem Client-Input. Ein Coach kann einen Teilnehmer also nicht unter fremder E-Mail anlegen.

**XSS / Browser**
- Null Treffer für `dangerouslySetInnerHTML`, `innerHTML`, `eval`, `new Function` in beiden Bundles.
- Kein `postMessage`-Listener.
- `window.open` nur an einer Stelle, mit `rel="noopener noreferrer"`: `AppointmentListCard.tsx:131`.
- React 19.2 — `href={appointment.meetingLink}` ist ein `type="url"`-Input ohne Schema-Check. **Niedrig, nicht ausgeschlossen:** ein `javascript:`-Schema würde React nicht blockieren. Praktisch durch den Authentifizierungs-Zwang und die Herkunft des Feldes begrenzt (Coach trägt den Link selbst ein); ich führe es nicht als Befund, sondern als Randnotiz.
- `localStorage` enthält nur Theme und Actor-Selbstauskunft, keine Tokens.

**Auth / Redirect (Frontend-Projekt)**
- `isValidRedirect` (`authHelpers.ts:54`): kein `//`, kein `\`, kein Steuerzeichen, kein `@`, kein `:`.
- `UIBundleAuthUtils.getSanitizedStartUrl` (Apex, serverseitig, `without sharing`): dekodiert **vor** der Prüfung (`EncodingUtil.urlDecode`) — fängt `%2f%2f` → `//`, also den kodierten Bypass. Prüft `/`-Präfix, `//`, `\`, `@`, `:`, Steuerzeichen. Aufgerufen von `UIBundleLogin.cls:26` und `UIBundleSocialLoginConfig.cls:98` — der Guard ist also tatsächlich verdrahtet und wird nicht umgangen.
- `UIBundleLogin` fängt Login-Fehler und gibt **generische** Meldungen zurück (`'Invalid username or password.'`), kein Exception-Leak, kein User-Enumerations-Unterschied zwischen „User existiert nicht" und „falsches Passwort".
- `UIBundleForgotPassword` gibt denselben Erfolg für existierende und nicht existierende User → keine Enumeration.
- `ParticipantPortalData` und `ParticipantPortalLearningPath` laufen beide `with sharing`, akzeptieren **keine** Teilnehmer-ID aus dem Client und filtern serverseitig über `User.ContactId` — plus die Sharing-Zeile pro Portal-User. Das ist das dokumentierte Zweischichtenmodell, und es hält.
- `Participant_Portal_Access`: kein `viewAllRecords`, kein Schreibzugriff. `frontend_Guest_User_Api_Access`: nur die drei Login-Klassen, mit begründetem Kommentar gegen eine nachträgliche Gast-Gewährung auf `ParticipantPortalLearningPath`.

**Apex-Hygiene**
- `StaffIdentity.cls:141` fängt Ausnahmen und gibt **nie** die rohe Meldung nach außen (`'Staff identity unavailable.'`), mit dokumentierter Begründung, warum der Catch-all existiert.
- `ParticipantPortalSharingService` ist `without sharing`, aber mit ausführlicher Begründung im Docstring, dass es Verwaltungsinfrastruktur ist.
- Kein `WITH SECURITY_ENFORCED` / `Security.stripInaccessible` — bei `ParticipantPortalData` bewusst, weil die Feldberechtigungen im Permission-Set stattdessen explizit vergeben sind (dokumentiert).

**Build**
- `dist/`, `build/`, `node_modules/`, `playwright-report/` sind git-ignoriert, kein Build-Artefakt im Repo.

---

## 4. Was ich nicht prüfen konnte

Diese Punkte sind als **ORG** markiert. Ohne Org-Zugang sind das Vermutungen, keine Befunde — ich behaupte hier nichts, was ich nicht gemessen habe.

| # | Offen | Warum es zählt | Wie man es klärt |
|---|---|---|---|
| O1 | Ist `Participant__c` in der Sandbox tatsächlich `Private`? | Die gesamte Portal-Sicherheitsarchitektur hängt daran (siehe S6) | `sf org describe` bzw. Objekt-Metadaten aus der Org ziehen |
| O2 | Zusätzliche Profile/Sharing Rules über die Permission-Sets hinaus | Ein Profil mit `viewAllRecords` würde A1 verschlimmern, eins mit `Private`-Default würde es mildern | Sharing-Konfiguration aus der Org exportieren |
| O3 | Funktioniert der Audit-Schreibpfad nach der S3-Korrektur? | Beide Projekte deployen in dieselbe Org — `allowCreate=false` könnte den Schreibpfad treffen | In Sandbox deployen und einen Absenz-Wert melden |
| O4 | Apex-Tests in der Org (`sf apex run test`) | Testabdeckung der Klassen ist lokal nicht prüfbar | Testlauf gegen Sandbox |
| O5 | Sind die Transaktionssicherheitsrichtlinien aktiv? | `sfdc_default_ReportExport_Protection` liegt als Metadaten im Repo, die Aktivierung in der Org ist ein separates Thema | `TransactionSecurityPolicies` in der Org prüfen |
| O6 | Portal-Sharing-Zeilen pro User tatsächlich vorhanden | Ohne die `Portal_Access__c`-Zeile sieht der Portal-User 0 Rows | Sharing-Liste abfragen |

---

## 5. Empfohlene Reihenfolge

Nach Risiko, dann Aufwand. Die oberen vier Zeilen kosten zusammen unter einer Stunde.

| Prio | Befund | Aufwand | Warum jetzt |
|---|---|---|---|
| **1** | ✅ S1 + S2 — Policy-Schlüssel auf `__c` umstellen, `CoachComment__c` ergänzen, eingehendes `redacted`-Flag respektieren, 9 Tests | erledigt | Gesundheitsdaten im Klartext. Der Code **behauptet** bereits Redaktion — der Fix stellt die Absicht wieder her |
| **2** | S6 — `defaultSharing>Private` in alle Custom-Objekte | XS | Deploybare Invariante statt undokumentiertem Org-Zustand |
| **3** | S3 + S4 — serverseitiger Audit-Schreibpfad (Apex), danach `allowCreate`/`allowEdit` entziehen | **M** (nicht XS, s. Abschnitt 7) | Log muss unveränderbar sein, sonst ist S1 nur Kosmetik |
| **4** | D1 — `npm uninstall shadcn` | XS | 8 CVEs weniger, `npm audit` wird wieder lesbar |
| **5** | A2 — Kommentar im `backend_Access`-Permission-Set | XS | Verhindert den Fehlgebrauch, den der Name nahelegt |
| **6** | A3 — Tests für `sessionTimeService` und `isValidRedirect` | M | Schließt die Lücke, bevor jemand am Pfad ändert |
| **7** | S5 — `visibility` durchsetzen oder ehrlich dokumentieren | S | Folge von A1; jetzt zu lösen verhindert falsche Sicherheit |
| **8** | S4-Teil 2 — Outbox: Replay bauen oder Verzicht dokumentieren | M | Derzeit weder das eine noch das andere |
| **9** | A1 — Berechtigungsmodell | M + O1/O2 | Entscheidung liegt beim Chef, Umsetzung braucht Org-Zugang |
| **10** | D2 — `undici` per Lockfile-Update schließen, Rest dokumentieren | XS | Der Rest ist nicht behebbar |

Punkt 9 bleibt blockiert, bis E1 entschieden ist. Punkt 3 sollte nicht vor O3 laufen.

Punkt 1 ist als `2c99185` umgesetzt. Die Prioritätenliste ist als Plan in `.opencode/plans/security-fixes-plan.md` fortgeschrieben (Pakete P1–P11, offene Entscheidungen E1–E9); dieser Abschnitt bleibt als Befund-Snapshot stehen.

---

## 6. Reproduzierbarkeit

Alle Zahlen in diesem Report sind gemessen, nicht geschätzt:

- Zeilenzahlen und Testzahlen: `wc -l`, `vitest run`
- CVEs: `npm audit --omit=dev --json` beider Bundles, ausgefiltert nach `severity` und `fixAvailable`
- Permission-Sets: XML-Parsing über `objectPermissions` und `fieldPermissions` (15 Objekte, 59 Felder, Werte in Abschnitt A1)
- S1/S2: Test gegen `applyFieldRedaction` mit den realen Feldnamen, danach entfernt. Die Ausgabe steht wörtlich in S1.
- `dist/`-Prüfung: `grep -rl` gegen `dist/assets` — kein Treffer für `micromatch`, `ts-morph`, `protobuf`
- Outbox ohne Verarbeiter: `grep -rn "processOutboxOnce"` über `src` → nur `auditOutbox.test.ts`
- `shadcn` ungenutzt: `grep -rn "from ['\"]shadcn"` → null Treffer
- Secrets in der Historie: `git log --all -p -S "BEGIN RSA"` über 158 Commits → null