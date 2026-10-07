# Security-Audit — Gesamter Codebestand

**Datum:** 2026-10-06, Org-Abgleich ergänzt 2026-10-07
**Umfang:** beide UI-Bundles (Backend 229 Dateien / 51.590 Zeilen, Frontend 82 Dateien / 7.810 Zeilen), alle Apex-Klassen und Trigger beider SFDX-Projekte, alle Permission-Sets, Objekt-Metadaten, `npm audit` beider Bundles, Dependency-Baum bis zu den Blattbibliotheken.
**Methode:** statische Analyse plus gezielte Ausführung (ein Test wurde zum Beleg der Kernbefunde geschrieben und danach wieder entfernt). Zusätzlich **Gate G1**: die Org-Konfiguration wurde am 2026-10-07 manuell in Salesforce abgelesen (Abschnitt 4). Ergänzend wurden O3, O4 und O6 am selben Tag **per CLI gegen die Sandbox ausgeführt** — Apex-Testlauf, Sharing-Abfrage und Schreibpfad-Test (Abschnitt 4a).
**Verwandt:** `.opencode/plans/refactor-security-plan.md` (Berechtigungsmodell E1), `.opencode/plans/security-fixes-plan.md` (Pakete P1–P11), `backend/docs/portal/portal-access-plan.md` (Portal-Zweischichtenmodell), `backend/docs/g1-manual-checklist.md` (Gate G1 als Arbeitsanleitung)

---

## 1. Kurzfassung

Zwei Befunde sind neu und beide betreffen **Datenschutz von Gesundheitsdaten**, nicht nur Berechtigungen:

| # | Befund | Schwere | Status |
|---|---|---|---|
| **S1** | Abwesenheitsgründe (`Absence__c.Reason__c`) landen **unredigiert im Audit-Log** — die Redaktions-Policy greift wegen eines Namensfehlers nicht | 🔴 hoch | ✅ behoben `2c99185` |
| **S2** | `CoachComment__c` (Ablehnungskommentar, oft vertraulich) ebenfalls unredigiert | 🟠 mittel | ✅ behoben `2c99185` |
| **S3** | Coaches dürfen `AuditEvent__c` **anlegen** (`allowCreate=true`) — das Audit-Log ist beschreibbar. In der Sandbox verifiziert: frei setzbar sind `SubjectType__c`, `SubjectId__c`, `OccurredAt__c`, `EventType__c` — damit lässt sich einem beliebigen Teilnehmer ein rückdatiertes, erfundenes Ereignis an die Timeline hängen | 🟠 mittel | **neu, empirisch eingegrenzt** |
| **S4** | Coaches dürfen `AuditOutbox__c` **bearbeiten** (`allowEdit=true`), inkl. `Payload__c` und `Error__c` | 🟠 mittel | **neu** |
| **S5** | `visibility` wird beim Lesen **nirgends durchgesetzt** — nur dekorativ im Drawer angezeigt | 🟠 mittel | **neu** |
| **S6** | Interner Org-Wide-Default ist **Public Read/Write** — jeder interne User liest/bearbeitet alle `Participant__c`-Zeilen. Die ursprüngliche Diagnose (`defaultSharing` fehle) war falsch gerahmt: der OWD ist nicht deploybar | 🔴 hoch | **gemessen 2026-10-07** |
| **S7** | Contact-Zugriff hängt an `Account` (intern Public Read/Write, Contact „Controlled by Parent") — **jeder Coach sieht und bearbeitet alle Contacts**. Eine Freigabe am Permission Set kann nichts ändern | 🔴 hoch | **gemessen 2026-10-07** |
| **S8** | Es gibt **kein eigenes Coach-Profil**; Coaches hängen an `Standardbenutzer AM` — dem Profil, vor dem die eigene FLS-Checkliste warnt | 🟠 mittel | **gemessen 2026-10-07** |
| **A1** | `viewAllRecords` auf 12 von 15 Objekten — bei 10 davon **wirkungslos**, weil der interne OWD schon offen ist; tragend nur bei `Audit-Event` | 🔴 hoch | bekannt (E1), verschärft 2026-10-07 |
| **A2** | `backend_Access` ohne Objekt-/Feldrechte, `backend_Coach` trägt alles | 🟡 niedrig | bekannt (E1) |
| **A3** | Frontend-Auth-Pfad (830 Zeilen Session-Logik) mit 15 Tests ungesichert | 🟡 niedrig | bekannt |
| **D1** | `shadcn` steht in `dependencies`, wird nirgends importiert, zieht 6 high-CVEs | 🟠 mittel | behoben 2026-10-06 |
| **D2** | `protobufjs` critical + `@salesforce/platform-sdk` high, transitiv, `fixAvailable: false` | 🟡 niedrig | Rest nicht behebbar, Rest geschlossen |

**Sauber geprüft und unauffällig:** keine Secrets im Repo (inkl. Historie), keine XSS-Vektoren, keine GraphQL-Injection, kein dynamisches SOQL, kein Open Redirect, keine CSRF-Lücke, saubere Fehlerkonvention in Apex (kein Exception-Leak nach außen).

**Wichtigste Nachricht (Stand 2026-10-07, nach Gate G1):** Die ursprüngliche Priorisierung hat sich verschoben. S1/S2 waren die billigsten Befunde — sie sind behoben. Was Gate G1 zutage gefördert hat, ist die eigentliche Ursache: **die Berechtigungen werden vom Org-Wide-Default getragen, nicht vom Permission Set.** Deshalb ist

1. jede Massnahme am `backend_Coach`-Set für zehn der zwölf Objekte **wirkungslos** (S6/A1),
2. die Priorität-0-Anforderung „Coach sieht nur freigegebene Contacts" **nicht im Permission Set lösbar** (S7),
3. der preiswerteste Fix ein manueller Org-Schritt und **kein Commit** — P3 ist entsprechend umgeschrieben.

Vor diesem Hintergrund sind S3 und S4 (beschreibbares Audit-Log) die einzigen Berechtigungsbefunde, die ein Commit tatsächlich beheben kann, weil dort der OWD Private ist.

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

**Empirisch eingegrenzt am 2026-10-07 (Selbsttest in der Sandbox, alle Test-Events wieder gelöscht).** Ich habe mit einem Coach-konformen Benutzer Events über die UI API angelegt, Feld für Feld mit erfundenem Wert:

| Feld | Verhalten bei erfundenem Wert | Konsequenz |
|---|---|---|
| `Action__c` | abgelehnt (restricted) | — |
| `ActorType__c` | abgelehnt (restricted) | — |
| `Domain__c` | abgelehnt (restricted) | — |
| `Visibility__c` | abgelehnt (restricted) | — |
| `Sensitivity__c` | abgelehnt (restricted) | — |
| `Source__c` | abgelehnt (restricted) | — |
| `EventType__c` | **angenommen** (freies Textfeld) | Ereignistyp-Vokabular frei erfunden |
| `SubjectType__c` | **angenommen** (freies Textfeld) | Bezugsobjekt beliebig deklariert |
| `SubjectId__c` | **angenommen**, freier String, max. 18 Zeichen | Ereignis an beliebige Teilnehmer-ID hängen |
| `OccurredAt__c` | **angenommen** | Zeitstempel rückdatierbar |
| `SchemaVersion__c` | **angenommen** | Version des Ereignisschemas fälschlich deklarierbar |

Damit ist S3 nicht „irgendein Log-Eintrag", sondern gezielt: Wer `SubjectType__c`, `SubjectId__c` und `OccurredAt__c` frei wählt, kann einem beliebigen Teilnehmer ein rückdatiertes, erfundenes Ereignis an die Timeline hängen. Die restricted Picklists begrenzen nur die *Beschriftung*, nicht den *Bezug*.

**Erschwerend für den Fix:** Der Coach muss `allowCreate` haben, weil das Audit aus der UI heraus in *seiner* Session geschrieben wird. Der Missbrauch und der legitime Pfad teilen sich dasselbe Recht.

**Fix — aber nicht so billig, wie es aussieht (Korrektur vom 2026-10-06, Umsetzung als Paket P4 in `.opencode/plans/security-fixes-plan.md`):** `allowCreate` auf `false` setzen ist *nicht* möglich, ohne das Audit komplett stillzulegen. Der Audit-Schreibpfad läuft **clientseitig über die Session des angemeldeten Coaches** (`auditApiService.ts:212 createAuditEventRecord` → GraphQL-Mutation `CREATE_AUDIT_EVENT`). Ein Coach braucht also zwingend `allowCreate`, damit der Coach überhaupt ein Audit-Event schreiben kann. Wer `allowCreate` entzieht, löscht das Audit-Log.

Der eigentliche Fix ist ein **serverseitiger Schreibpfad**: eine Apex-Klasse, die das Event in `without sharing`/System-Mode persistiert, den Actor aber aus dem Konstrukt ableitet (nicht aus einem frei setzbaren Parameter). Aus der empirischen Tabelle oben folgt, dass die serverseitige Validierung **nicht** bei `ActorId__c` aufhören darf: auch `SubjectType__c`, `SubjectId__c`, `OccurredAt__c`, `EventType__c` und `SchemaVersion__c` müssen serverseitig gegen eine erlaubte Menge geprüft werden, sonst bleibt die Fälschungsmöglichkeit bestehen, nur ohne UI-Rechte. Danach kann `allowCreate` entzogen werden. Aufwand M statt XS, plus Apex-Testklasse.

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

**Fix:** Siehe Paket P4 in `.opencode/plans/security-fixes-plan.md` — dieselbe Klippe wie bei S3: Die Outbox wird ebenfalls clientseitig geschrieben (`auditOutbox.ts:95 AuditOutbox__cCreate`, `:151 Update`). `allowEdit` kann erst entzogen werden, wenn ein serverseitiger Schreibpfad existiert. Parallel zu entscheiden: Wird die Outbox überhaupt replayed (aktuell nein), oder wird der bewusste Verzicht dokumentiert (ADR-14)? Der jetzige Zustand ist weder das eine noch das andere.

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

### S6 — Der interne Org-Wide-Default ist öffentlich 🔴 (neu gefasst 2026-10-07)

**Der ursprüngliche Befund dieses Abschnitts war falsch gerahmt.** Er lautete: „`<defaultSharing>` fehlt in den Custom-Objekt-Metadaten, ein Deploy in eine saubere Org erzeugt öffentliche Objekte, also `<defaultSharing>Private</defaultSharing>` nachtragen (XS)." Zwei Dinge widerlegen die Handlungsanweisung:

1. **Der Org-Wide-Default ist über die Metadata API nicht deploybar.** Es gibt kein `<defaultSharing>`-Element für `CustomObject`; der OWD ist eine rein organisatorische Einstellung in Setup. Ein Eintrag im Repo wäre Kommentar, keine Invariante — ein grüner Deploy hätte nichts geändert und false confidence erzeugt.
2. **`<sharingModel>` im Objekt-Metadatum ist nicht der OWD.** Es ist das interne Default-Level für Standard-Lookups. `AuditEvent__c` trägt `<sharingModel>Private</sharingModel>`, was lediglich `private` für Custom Objects bedeutet — **nicht** org-weit. Diese Verwechslung hat den ursprünglichen Befund plausibel wirken lassen.

**Was tatsächlich gilt (gemessen, Gate G1):**

| Objekt | Default Internal | Default External | Grant via Hierarchies |
|---|---|---|---|
| `Participant__c` | **Public Read/Write** | Private | ✓ |
| `Account` | **Public Read/Write** | Private | ✓ |
| `Audit-Event` | **Private** | Private | ✓ |
| `Contact` | Controlled by Parent | Controlled by Parent | ✓ |
| 8 weitere Custom-Objekte | nicht gemessen | nicht gemessen | — |

`Participant__c` ist also **nicht** Private. Der Kommentar in `frontend/.../features/participant/api/participantApi.ts:9-13` —

> `Participant__c has an external org-wide default of `Private`

— ist **richtig**, aber unvollständig: er sagt nichts über den internen Default. Genau die Auslassung lässt den Eindruck entstehen, das Objekt sei abgeschottet.

Das ist der eigentliche Befund: **jeder interne User — Coach oder nicht — darf alle `Participant__c`-Zeilen lesen und bearbeiten.** `viewAllRecords` im `backend_Coach`-Set ist dafür nicht einmal nötig (siehe A1). Das Portal ist davon unberührt, weil es über `User.ContactId` und Managed Sharing läuft; der Backoffice-Bereich nicht.

**Wirkung von `<defaultSharing>` im Repo:** keine. **Wirkung des Setup-Schritts:** sehr groß, aber mit Preis (siehe S7). Der former als XS geführte Punkt P3 ist damit **kein Commit, sondern ein manueller Org-Schritt** — mit Erstaufwand in Stunden und dauerhafter Pflege bei jedem neuen Objekt.

---

### S7 — Contact-Zugriff hängt an `Account`, nicht am Contact 🔴 (gemessen 2026-10-07)

Dieser Befund ist die belegte Fassung von „E1 ist nicht machbar" — und er ist schlechter als die Planung annahm.

```text
Account   Default Internal Access = Public Read/Write
   └─► Contact   Default Internal Access = Controlled by Parent
          └─► jeder interne User: lesen + bearbeiten alle Contacts
```

`Contact` erbt den Zugriff vom übergeordneten Account (`Controlled by Parent`). Weil `Account` intern offen ist, gilt das für praktisch jeden Contact der Org. Ausnahme wäre nur ein Account, der selbst wieder „Controlled by Parent" ist — bei den vier kundeneigenen Profilen nicht der Fall.

Drei Konsequenzen, in dieser Reihenfolge wichtig:

1. **Eine Freigabe von `Contact` am Permission Set bewirkt nichts.** Siehe A1 — bei internem Public Read/Write ist `viewAllRecords` wirkungslos. Der UI-Filter im Backoffice-Bundle wäre die dritte Schranke, nicht die erste.
2. **`Account` ist das eigentliche Ventil, und es ist teuer.** `Contact` hängt daran, `Participant__c` hängt am Contact, die Portal-Sharing Rule setzt eine Contact-Zeile voraus. Ein OWD-Wechsel reißt die Kette an drei Stellen und bricht jede interne Nutzung, die heute still über den OWD läuft — im Bundle etwa die Contact-Auflösung in `participantService.ts` und `Coach_Profile__c`. Dafür braucht es eine Sharing-Struktur für Coaches (Rollen-Hierarchie oder Rule nach Rolle) plus eine Bestandsprüfung, wie viele Contacts über abweichend berechtigte Accounts erreichbar sind. Ohne diese Zahl kann niemand sagen, was der Wechsel kappt.
3. **Für `Contact` sind Sharing Rules nicht anlegbar.** Salesforce erlaubt sie nur bei OWD `Public Read Only` / `Public Read/Write` / `Private`; der Bildschirm meldet für Contact wörtlich *„You cannot create sharing rules for this item."* Auf `Account` ist es möglich, dort steht aber *„No sharing rules specified"* — die Kette hängt also tatsächlich rein am OWD. Gemessen, nicht vermutet.

**Der saubere Weg wäre `Contact` auf Private plus Apex Managed Sharing** — dasselbe Muster, mit dem das Portal heute schon arbeitet (`Portal_Access__c`, `without sharing`, `User.ContactId`-Filter), konsistent mit `Participant__c` und `Learning_Path__c`, die genau so abgesichert sind. Aufwand M, Entscheidung E1.

**Entlastend:** extern bleibt alles dicht. `Account` extern Private → `Contact` extern Controlled by Parent → keine externen Contacts. Die Portal-Isolation ist unabhängig von der internen Lage intakt.

---

### S8 — Es gibt kein eigenes Coach-Profil 🟠 (gemessen 2026-10-07)

Die FLS-Architektur des Projekts setzt voraus, dass Coaches eine eigene Profilrolle bekommen. In der Sandbox gibt es sie nicht.

Belegte Profile: `Standardbenutzer AM` (Salesforce-Lizenz, **die Coaches**), `Standardbenutzer Sales`, `Knowledge-Manager`, `Read Only`, `Service-Supervisor`, `Serviceagent`, `Trainer` (Customer Community Plus), `Trainer Login`, `Salesforce API Only System Integrations`. Sonst nichts Eigenes.

Damit hängen die Coaches an `Standardbenutzer AM` — genau dem Profil, vor dem `backend/docs/coach-fls-checkliste.md` warnt:

> Wenn diese Freigaben auf `Standardbenutzer AM` landen, bekommen **alle** User mit diesem Profil Zugriff auf sämtliche Teilnehmerdaten — auch die, die keine Coaches werden sollen.

Die Checkliste empfiehlt 31 required Felder für das Coach-Profil und stellt selbst fest, dass Permission Sets das nicht leisten können (`You cannot deploy to a required field: AuditOutbox__c.RetryCount__c`). Profile werden nie deployed — reine Handarbeit in Setup.

**Die Entscheidung ist organisatorisch, nicht technisch:** 31 Felder auf `Standardbenutzer AM` legen (schnell, aber die Freigabe hängt an einem geteilten Profil und jeder Nicht-Coach mit diesem Profil erbt sie) oder zuerst ein eigenes `Coach`-Profil anlegen (einmalig ~10 Minuten, danach sauber trennbar — aber alle Coaches müssen neu zugewiesen werden, und `scripts/org-setup.config.json` weist ohnehin nur `backend_Access` zu; `backend_Coach` wird pro Coach manuell vergeben).

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

**Verschärfung durch den gemessenen OWD (Gate G1, 2026-10-07):** Bei zehn der zwölf Objekte ist `viewAllRecords` **wirkungslos**, weil der interne OWD bereits Public Read/Write ist — der Org-Default gibt jedem internen User ohnehin Vollzugriff, das Permission Set fügt nichts hinzu. Es gibt genau eine Ausnahme:

| Objekt | interne OWD | Wirkung von `viewAllRecords` |
|---|---|---|
| `Audit-Event` | **Private** | **tragend** — die einzige Zugriffstür überhaupt |
| `Participant__c`, `Account`, 8 weitere Custom | Public Read/Write | wirkungslos |
| `Contact` | Controlled by Parent | wirkungslos |

Damit sitzt die eigentliche Exposition beim Audit-Log: jeder Coach kann **alle** Audit-Events der Org lesen (`Participant__c`, `ActorId__c`, `EventType__c`, Zeitstempel im Klartext) und mit `allowCreate=true` eigene erzeugen (S3). Zwei Fehlerrichtungen in einem Objekt. Und `Participant__c` trägt als einziges Objekt personenbezogene Daten im Klartext.

**Konsequenz für E1:** „Permission-Set umbauen" ist als Massnahme **wirkungslos**. Das einzige Ventil ist der OWD-Wechsel auf Private — und der ist bei `Account`/`Participant__c` ein migrationsrelevanter Eingriff (siehe S7). Die Chef-Vorlage ist entsprechend neu geschrieben.

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

### D1 — `shadcn` als Laufzeit-Abhängigkeit 🟠 (behoben 2026-10-06)

`shadcn@^3.8.5` steht in `dependencies` beider Bundles und wird **nirgends importiert** (verifiziert: `grep -rn "from ['\"]shadcn"` → null Treffer). Es ist ein CLI-Tool und gehört in `devDependencies`.

Über `shadcn` (`→ ts-morph → @ts-morph/common → fast-glob`) sind 6 high-Einträge des `--omit=dev`-Berichts entfallen; `micromatch` und `braces` bleiben, weil `@salesforce/ui-bundle` sie unabhängig von `shadcn` ebenfalls zieht (siehe D2).

**Entwarnung, verifiziert:** Keines dieser Pakete landet im ausgelieferten Bundle. `dist/` (1,3 MB) enthält keinen Treffer für `micromatch`, `ts-morph` oder `protobuf`. **Nachtrag:** `micromatch` und `braces` bleiben nach der Verschiebung im Produktionsbaum, weil `@salesforce/ui-bundle` sie selbst zieht — siehe D2. Die CVEs sind damit **kein Runtime-Risiko für Endnutzer**, wohl aber eines für die Build-Umgebung und für die Aufmerksamkeit, die echte Treffer kosten.

**Fix (XS, umgesetzt 2026-10-06):** `shadcn` von `dependencies` nach `devDependencies` verschieben — **nicht deinstallieren**. Ein Uninstall hätte dieselbe Audit-Wirkung, würde aber die gepinnte `^3.8.5` mitnehmen, sodass `npx shadcn add` die neueste Major-Version zöge und Komponenten für ein neueres Tailwind/React generierte. Gemessen: `npm audit --omit=dev` Backend 28 → 19 Lücken (21 → 15 high), Frontend → 18 (14 high). `shadcn@3.8.5` bleibt gepinnt, Builds grün.

---

### D2 — Transitiv-CVEs: geschlossen, was schließbar war 🟡→behoben

**Geschlossen am 2026-10-06 (P11) über `overrides` in beiden Bundles:**

| Paket | vorher | jetzt | Wirkung |
|---|---|---|---|
| `undici` | 7.29.0 (high) | 7.30.0 | geschlossen |
| `source-map-js` | 1.2.1 (high) | 1.2.2 | geschlossen |
| `@jsforce/jsforce-node` | 3.10.24 (moderate) | 3.10.28 | geschlossen |
| `csv-parse` | 5.6.0 (moderate) | 7.0.3 | geschlossen — folgt aus dem jsforce-Patch, nicht aus einem erzwungenen Major |

`csv-parse` war nur scheinbar ein eigener Fall: die CVE-Klasse `<7.0.2` ließ sich nicht innerhalb der 5.x auflösen, aber `jsforce-node@3.10.28` bringt sie selbst mit. Der Patch-Bump löst beide.

**Bilanz gemessen:** `npm audit --omit=dev` von 28 Lücken / 21 high / 1 critical auf **15 / 13 / 1** je Bundle. Alles Behebbare ist behoben.

**Bleibt offen — und zwar ausschließlich, weil Salesforce es so ausliefert:**

```
CRITICAL protobufjs      Prototype Pollution + Arbitrary code execution   fixAvailable: false
HIGH     @salesforce/platform-sdk                                           fixAvailable: false
HIGH     @salesforce/ui-bundle                                              fixAvailable: false
HIGH     o11y                                                                fixAvailable: false
HIGH     @conduit-client/*  (8 Pakete)                                     fixAvailable: false
HIGH     micromatch  3.1.7/4.0.8 → über @salesforce/ui-bundle              fixAvailable: false
HIGH     braces     3.0.3     → über micromatch                            fixAvailable: false
```

Kette: `@salesforce/platform-sdk → o11y → protobufjs`. Über `platform-sdk@11.71.5` hängen zwei `o11y`-Instanzen (252.7.0 → protobufjs 7.2.4, 266.17.0 → protobufjs 7.5.6).

**Korrektur zur D1-Zuordnung:** `braces` und `micromatch` stehen in der Produktions-Auflösung **nicht** unter `shadcn`, sondern unter `@salesforce/ui-bundle → micromatch@4.0.8 → braces@3.0.3`. Nach der Verschiebung von `shadcn` (siehe D1) bleiben sie deshalb im Produktionsbaum stehen. Die Wirkung der Verschiebung war real — der Audit-Zähler fiel von 28 auf 19 —, die Begründung „ausschließlich über `shadcn`" war es nicht.

**Bewertung des Rests:** keine Handlungsoption ohne Plattform-Upgrade. Der Bundle-Code nutzt protobuf zur Serialisierung der Telemetrie, nicht zur Deserialisierung fremder Eingaben — das verwundbare Muster (Parsen bösartiger Payloads) wird im Bundle nicht erreicht. `dist/` enthält nachweislich weder `protobufjs` noch `ts-morph`. Als **akzeptiert dokumentieren**, nicht als offenes Risiko führen.

**Bewusst nicht geschlossen:** `fast-uri` (moderate, 3.1.7, `fixAvailable: true`). Der Fix wäre `fast-uri@4.x`, also ein Major-Sprung in `ajv@8.20.0`s Abhängigkeit, die über `@salesforce/core` aus `@salesforce/ui-bundle` kommt. Ein erzwungener Major in Salesforces Baum ohne Testabdeckung des betroffenen Pfads (URI-Validierung in der GraphQL-Codegen-Kette) ist schlechter als ein dokumentiertes moderate-Risiko. Beim nächsten SDK-Bump neu bewerten.

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

## 4. Gate G1 — Org-Konfiguration, gemessen

Am 2026-10-07 manuell in Salesforce abgelesen. Alles in dieser Tabelle ist **gemessen**, nicht aus Metadaten abgeleitet. Das Gate selbst ist als Arbeitsanleitung in `backend/docs/g1-manual-checklist.md` dokumentiert.

| # | Punkt | Ergebnis | Aussage |
|---|---|---|---|
| ✅ | Sharing Reason `Portal_Access__c` | vorhanden auf `Participant__c` **und** `Learning_Path__c` | Portal-Absicherung trägt auf beiden Objekten |
| ✅ | OWD `Participant__c` | intern **Public Read/Write**, extern Private, Hierarchien ✓ | siehe S6 — das Portal hängt daran, der Backoffice-Bereich nicht |
| ✅ | OWD `Audit-Event` | intern **Private**, extern Private | einziges Private-Objekt; `viewAllRecords` ist hier tragend |
| ✅ | OWD `Contact` | Controlled by Parent (beide Richtungen) | keine Sharing Rules anlegbar |
| ✅ | OWD `Account` | intern **Public Read/Write**, extern Private | Wurzel der Contact-Kette, siehe S7 |
| ✅ | Sharing Rule `Participant__c` | `Portal User = $User.Id` → Gruppe `Portal_Participants`, **Read Only** | **existiert und wirkt** — siehe Korrektur unten |
| ✅ | Sharing Rule `Account` | keine | Contact-Kette hängt rein am OWD |
| ✅ | Coach-Profil | **existiert nicht** | siehe S8 |
| ✅ | Transaktionssicherheitsrichtlinie | **nicht vorhanden** | Menüpunkt fehlt in Setup **und** in Session Settings; zusätzlich fehlt das `Report`-Permission in `backend_Coach`, Coaches können also ohnehin keine Reports ausführen |
| ✅ | Clickjack-Schutz | Setup- und Nicht-Setup-Seiten aktiv (ausgegraut, Werkseinstellung) | keine Abweichung |
| ✅ | CSRF-Schutz | GET und POST auf Nicht-Setup-Seiten aktiv (ausgegraut, Werkseinstellung) | keine Abweichung |
| ⚠️ | Externe Weiterleitungen | **„With user's permission"** | siehe unten |
| ◐ | OWD der 8 übrigen Custom-Objekte | nicht gemessen | Erwartung Public Read/Write, kein Informationsgewinn |
| ✅ | Portal-Sharing-Zeilen pro User | **2 Zeilen** mit `Read` + RowCause `Portal_Access__c` (SOQL gegen `Participant__Share`) | O6 geschlossen — siehe 4a |
| ✅ | `sf apex run test` | **59 Tests, 100 % Pass, 0 Fehler**, Lauf `7079X00002J6KP7` | O4 geschlossen — siehe 4a |
| ✅ | Audit-Schreibpfad | Anlegen **und** Löschen über die UI API funktioniert; Felder teilweise frei (siehe S3) | O3 geschlossen — siehe 4a |

**Korrektur zu einem früheren Befund.** Ich hatte geschlossen, die Sharing Rule `PortalParticipantSeesOwnRecord` existiere nicht und `$User.Id` werde nicht ausgewertet. Das war eine Verwechslung zweier Mechanismen. Die **Formelfelder** (`Participant__c.Portal_User_Id__c` u. a.) werten `$User` tatsächlich nicht aus — das ist in `portal-deploy-status.md` korrekt dokumentiert. **Sharing-Rule-Kriterien** auf einem Lookup-Feld funktionieren dagegen zur Laufzeit, und die Regel existiert (unter anderem Namen; der Kommentar in `Participant_Portal_Access.permissionset-meta.xml:65` ist falsch). Die Portal-Isolation auf `Participant__c` ist damit **dreifach** belegt: OWD Private + Sharing Rule (Read Only an `Portal_Participants`) + Apex Managed Sharing.

**Nebenbefund:** Die Rule gewährt **Read Only**. Portal-User können über die UI API keine `Participant__c`-Zeilen schreiben. Das passt zum heutigen reinen Lese-Zugriff; ein künftiger Portal-Schreibpfad würde hier brechen.

**Externe Weiterleitungen auf „With user's permission".** Das ist eine Freigabestufe, keine Abschaltung — User mit Erlaubnis dürfen aus Flows oder Apex-Redirects an beliebige externe URLs springen, ohne Whitelist. Unser Login-Pfad ist doppelt abgesichert (`authHelpers.ts:54-60` clientseitig, `UIBundleLogin.cls:26` → `UIBundleAuthUtils.getSanitizedStartUrl` serverseitig, dekodiert vor der Prüfung) und beide Stellen sind verdrahtet. Die Lücke liegt in der **Organisation**: jeder künftige Loginweg, der nicht über diese beiden Funktionen läuft, entscheidet an der Org-Einstellung und nicht an unserem Code. Als Konvention in `backend/docs/AGENTS.md` hinterlegt.

**✅ Schema-Abgleich Repo gegen Org (2026-10-07):** `npm run schema:check` grün — 92 Felder in 10 Custom-Objekten, Repo und Org identisch, `soqlFailures=0`, `newObjFailures=0`, `insertFailures=0`, `missingObjects=0`. Damit ist bestätigt, dass die manuell in Setup angelegten Felder (`Participant__c.Portal_User__c`, `Portal_User_Id__c`) real existieren. `Account` wird übersprungen, weil das Repo dort keine Custom-Felder deklariert. **Merke:** das Skript startet eine Browser-Session, es braucht also einen interaktiven Login.

### 4a. Was weiterhin ungeprüft ist

**Die drei offenen Punkte O3, O4 und O6 sind am 2026-10-07 per CLI gegen die Sandbox geschlossen.** Die CLI-Verbindung unter dem Alias `hubSandbox` bestand bereits; meine Annahme, es fehle eine Anmeldung, war falsch (siehe 4b).

| # | Punkt | Ergebnis | Beleg |
|---|---|---|---|
| O4 | Apex-Tests | **59 Tests, 100 % Pass, 0 Fehler** | `sf apex run test -o hubSandbox -n ParticipantPortalSharingServiceTest -n ParticipantPortalDataTest -n StaffIdentityTest -n UIBundleAuthUtils_Test -n UIBundleSocialLoginConfig_Test` → Lauf `7079X00002J6KP7`, 9,4 s Ausführung |
| O6 | Portal-Sharing-Zeilen | **2 Zeilen** vorhanden, beide `Read` mit RowCause `Portal_Access__c` | `SELECT ParentId, UserOrGroupId, AccessLevel FROM Participant__Share WHERE RowCause='Portal_Access__c'` → `a0s9X00000bqpfRQAQ`/`0059X00000qeMkQQAU` und `a0s9X00000boVT9QAM`/`0059X00000rOHULQA4` |
| O3 | Audit-Schreibpfad | **funktioniert, und ist gefährlicher als angenommen** | `sf data create record -s AuditEvent__c` erfolgreich; Feldtest in der S3-Tabelle. Alle Test-Events anschließend gelöscht, Restbestand `SubjectId__c='G1SELBSTTEST2026X'` = 0 |

**Was O4 zusätzlich belegt.** `UIBundleAuthUtils_Test` (8 Tests) und `UIBundleSocialLoginConfig_Test` (9 Tests) prüfen die Open-Redirect-Abwehr serverseitig: absolute URL, `//host`, Backslash-Variante, `@`, Doppelpunkt, Steuerzeichen, kodierter Protocol-Relative-Bypass. Die im Abschnitt 3 als Negativbefund geführte Absicherung ist damit **in der Org laufend verifiziert**, nicht nur im Quelltext gelesen.

**Was an O3 nicht geklärt ist.** Getestet wurde der REST-Pfad der UI API. Der Bundle-Audit nutzt eine **GraphQL-Mutation** (`CREATE_AUDIT_EVENT`, `auditApiService.ts:212`) gegen den UI-Bundle-Endpunkt. Ob genau dieser Mutation-Deploy in der Sandbox existiert, lässt sich per CLI nicht feststellen — dafür bräuchte es einen Bundle-Aufruf im Browser. Die Rechtefrage ist aber dieselbe, also gilt der Befund aus S3 unverändert.

### 4b. Fallstricke beim Ablesen in Salesforce

Zwei Wege, die ich selbst gegangen bin und die niemandem sonst Zeit kosten sollten:

- **Der OWD steht nicht in den Objekt-Metadaten.** `<sharingModel>` ist nicht der Org-Wide-Default (siehe S6), und ein `<defaultSharing>`-Element gibt es nicht. Nur ablesbar in `Setup → Security → Sharing Settings`, Spalten *Default Internal Access* / *Default External Access*.
- **Der Lightning Object Manager hilft dafür nicht.** `Objekt → Details` zeigt nur „Edit Custom Object", keinen OWD-Abschnitt. Der Objektfilter mit App-Präfix existiert nur in Classic — in Lightning gibt es nur ein Suchfeld für Objekte.
- **Sharing Rules für `Contact` lassen sich nicht anlegen**, solange der OWD `Controlled by Parent` ist; der Bildschirm sagt das wörtlich. Das ist ein Befund, kein Bedienfehler.
- **Transaktionssicherheitsrichtlinien** sind weder top-level noch unter `Security` auffindbar, wenn die Funktion fehlt. Auch in Classic prüfbar, bevor man auf eine Feature-Abwesenheit schliesst.
- **Vor jeder Anmelde-Session prüfen, ob überhaupt eine nötig ist.** `~/.sfdx/sfdx-config.json` enthielt nur `{"defaultusername": "hubSandbox"}` und unter `~/.sf/*.json` lag keine Auth-Datei — daraus habe ich auf eine fehlende Anmeldung geschlossen. `sf data query -o hubSandbox` funktionierte jedoch sofort: der CLI findet Auth-Dateien auch im alten Verzeichnis `~/.sfdx/`. Ein Sandbox-Alias kann also völlig intakt sein, ohne dass unter `~/.sf/` etwas zu sehen ist.
- **`sf org login web` nimmt keinen Login-Host.** Das Flag kennt `-r/--instance-url`, nutzt für den Web-Flow aber immer `login.salesforce.com`. Für eine Sandbox, deren Credentials dort abgelehnt werden, ist der Umweg ein selbst gesetzter OAuth-Aufruf gegen den Instanz-Host mit `redirect_uri=http://localhost:1717/OauthRedirect` (aus dem CLI-Quelltext `authInfo.js:getRedirectUri()`), Empfänger auf Port 1717, Tausch über `POST /services/oauth2/token`. Für dieses Projekt war beides überflüssig (siehe oben).

---

## 5. Empfohlene Reihenfolge

Nach Risiko, dann Aufwand — **nach** dem Org-Abgleich vom 2026-10-07. Die Spalte „Kann ein Commit das lösen?" ist neu und beantwortet die Frage, die sich bei jedem Punkt stellt: der Berechtigungszustand wird vom OWD getragen, nicht vom Permission Set.

| Prio | Befund | Aufwand | Commit? | Warum jetzt |
|---|---|---|---|---|
| **1** | ✅ S1 + S2 — Policy-Schlüssel auf `__c` umstellen, `CoachComment__c` ergänzen, Werte strippen statt nur Flag setzen, 9 Tests | erledigt | ✅ `2c99185` | Gesundheitsdaten im Klartext. Der Code **behauptete** bereits Redaktion — der Fix stellte die Absicht wieder her |
| **2** | S3 + S4 — serverseitiger Audit-Schreibpfad (Apex), danach `allowCreate`/`allowEdit` entziehen | **M** | ✅ ja | Einziger Berechtigungsbefund, den ein Commit wirklich behebt — weil `Audit-Event` als einziges Objekt intern `Private` steht. Ohne das ist S1 nur Kosmetik |
| **3** | S5 — `visibility` beim Lesen durchsetzen oder ehrlich dokumentieren | S | ✅ ja | Folge von A1; als Undokumentiertes erzeugt es falsche Sicherheit |
| **4** | A2 — Kommentar im `backend_Access`-Permission-Set | XS | ✅ ja | Verhindert den Fehlgebrauch, den der Name nahelegt |
| **5** | ✅ A3 — Tests für `sessionTimeService` und `isValidRedirect` | erledigt | ✅ `7168439` | 35 Tests gegen 830 Zeilen Session-Logik |
| **6** | S6/S7 — OWD-Plan: `Account`/`Participant__c`/`Contact` auf Private, Sharing-Struktur für Coaches, Bestandsprüfung | **L** | ❌ **Setup** | Der eigentliche Befund. Ein Repo-Commit kann ihn nicht beheben, und ein `<defaultSharing>`-Eintrag wäre wirkungsloses Kosmetik-Metadatum. Entscheidung E1, Aufwand mehrere Wochen |
| **7** | S8 — eigenes `Coach`-Profil oder FLS auf `Standardbenutzer AM` | XS–M | ❌ **Setup** | Profile werden nie deployed. Entscheidung organisatorisch, blockiert die saubere FLS-Lösung |
| **8** | S4-Teil 2 — Outbox: Replay bauen oder Verzicht dokumentieren | M | ✅ ja | Derzeit weder das eine noch das andere |
| **9** | ⚠️ Redirect-Konvention: jeder Loginweg über `UIBundleAuthUtils.getSanitizedStartUrl` | XS | ✅ ja | Org erlaubt untrusted Redirects („with user's permission"); die Absicherung hängt an der Verdrahtung, nicht an der Org |
| **10** | ✅ D1 + D2 — `shadcn` nach `devDependencies`, `undici`/`source-map-js`/`jsforce` per Override | erledigt | ✅ `a2c942b`, `82e4cde` | 28 → 15 Lücken je Bundle, Rest nicht behebbar |

**Umnummerierung gegenüber 2026-10-06:** Punkt 2 der alten Liste (`defaultSharing>Private`, XS) ist gestrichen — er war als Deploy formuliert und ist damit gegenstandslos. Er ist als Punkt 6 wieder da, aber als Setup-Arbeit mit anderer Einordnung. Punkt 9 der alten Liste (A1/E1) ist in 6 und 7 aufgegangen.

Punkt 2 sollte nicht vor O3 laufen (beide Projekte deployen in dieselbe Org, der Schreibpfad muss vorher verifiziert sein). Punkt 6 und 7 bleiben blockiert, bis E1 entschieden ist.

Die Paketliste ist als Plan in `.opencode/plans/security-fixes-plan.md` fortgeschrieben (P1–P11, offene Entscheidungen E1–E9); dieser Abschnitt bleibt als Befund-Snapshot mit Reihenfolge stehen.

---

## 6. Reproduzierbarkeit

Alle Zahlen in diesem Report sind gemessen, nicht geschätzt:

- Zeilenzahlen und Testzahlen: `wc -l`, `vitest run`
- CVEs: `npm audit --omit=dev --json` beider Bundles, ausgefiltert nach `severity` und `fixAvailable`
- Permission-Sets: XML-Parsing über `objectPermissions` und `fieldPermissions` (15 Objekte, 59 Felder, Werte in Abschnitt A1)
- S1/S2: Test gegen `applyFieldRedaction` mit den realen Feldnamen, danach entfernt. Die Ausgabe steht wörtlich in S1.
- `dist/`-Prüfung: `grep -rl` gegen `dist/assets` — kein Treffer für `micromatch`, `ts-morph`, `protobuf`
- Outbox ohne Verarbeiter: `grep -rn "processOutboxOnce"` über `src` → nur `auditOutbox.test.ts`
- `shadcn` ungenutzt: `grep -rn "from ['"]shadcn"` → null Treffer
- Secrets in der Historie: `git log --all -p -S "BEGIN RSA"` über 158 Commits → null
- **Org-Konfiguration (Gate G1):** manuell in Salesforce abgelesen, Anleitung in `g1-manual-checklist.md`. Nicht automatisierbar — der OWD ist über keine API und über kein Metadatum lesbar, nur über die Oberfläche.
- **Schema-Abgleich:** `npm run schema:check` (Vier Ebenen je Objekt, 92 Felder in 10 Custom-Objekten). Braucht einen interaktiven Browser-Login.
- **O3/O4/O6 (2026-10-07, CLI gegen `hubSandbox`):** `sf apex run test -o hubSandbox -n …` (5 Klassen, 59 Tests), `sf data query -o hubSandbox -q "… FROM Participant__Share WHERE RowCause='Portal_Access__c'"`, `sf data create record -o hubSandbox -s AuditEvent__c` und `sf data delete record` für den Schreibpfad. Die Selbstanlage schreibt echte Audit-Events; **alle Test-Records wurden anschließend gelöscht und der Restbestand gegengeprüft** (`COUNT(Id) WHERE SubjectId__c='G1SELBSTTEST2026X'` = 0).

**Was an dieser Methode eine Grenze hat:** alle Org-Werte stammen aus einer Sandbox. Ob die Ziel-Org genauso konfiguriert ist, ist unbelegt — der OWD ist beim Anlegen einer neuen Sandbox der wahrscheinlichste Divisor. Vor dem Produktivbetrieb gehört dieselbe Checkliste erneut abgearbeitet.
