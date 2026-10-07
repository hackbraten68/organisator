# Plan: Behebung der Sicherheitsbefunde

**Datum:** 2026-10-06
**Quelle:** `backend/docs/security-audit-report.md`
**Verwandt:** `.opencode/plans/refactor-security-plan.md` (B1–B8, C1–C3, Entscheidungen E1–E4), `backend/docs/AGENTS.md` (Naming, Metadata-Ownership, Deploy-Vorgehen)

Dieser Plan enthält nur die Behebung der Sicherheitsbefunde S1–S6, A1–A3, D1–D2. Die Refactor-Pakete B1–B8 bleiben in ihrem eigenen Plan.

---

## 0. Kurzfassung der Reihenfolge

| Prio | Paket | Befund | Aufwand | Braucht Org? | Blockiert |
|---|---|---|---|---|---|
| **P1** OK | Feld-Policies auf emittierte Namen umstellen + Hand-Flag respektieren | S1, S2 | S | nein | erledigt `2c99185` |
| **P2** OK | Strukturschutz: Abdeckungstest „jedes emittierte Feld hat eine Policy" | S1 (Struktur) | S | nein | erledigt `e8b949d` |
| **P3** | `defaultSharing>Private` in 9 Custom-Objekten | S6 | XS | **ja** (Gate G1) | — |
| **P4** | Serverseitiger Audit-Schreibpfad, dann Rechte entziehen | S3, S4 | M | **ja** | P5 |
| **P5** | Outbox: Replay bauen oder Verzicht dokumentieren | S4 | M | ja | P4 |
| **P6** OK | `shadcn` von `dependencies` nach `devDependencies` in beiden Bundles | D1 | XS | nein | erledigt 2026-10-06 |
| **P7** | Kommentar im `backend_Access`-Permission-Set | A2 | XS | ja (Deploy) | — |
| **P8** | Tests für `sessionTimeService` und `isValidRedirect` | A3 | M | nein | — |
| **P9** | `visibility`/`sensitivity` durchsetzen oder ehrlich dokumentieren | S5 | S | nein | A1 |
| **P10** | Berechtigungsmodell umsetzen | A1 | M | ja | Chef-Entscheidung E1 |
| **P11** OK | `undici`/`source-map-js`/`jsforce` per Override schließen, Rest dokumentieren | D2 | XS | nein | erledigt 2026-10-06 |

**P1, P2, P6, P8, P11 sind sofort machbar** — kein Org-Zugang, kein Warten auf eine Entscheidung.

**Stand 2026-10-06:** P1 ist umgesetzt (`2c99185`). S1 und S2 sind für neu geschriebene Events behoben; die bereits persistierten Klartexte sind es nicht (siehe E8).

---

## Gate G1 — Org-Zugang

P3, P4, P5, P7, P10 setzen eine Sandbox voraus. Vor P3 sind drei Fragen zu beantworten, sonst baue ich auf einer Annahme:

- **G1a** Hat `Participant__c` in der Sandbox tatsächlich `defaultSharing=Private`? Falls **nein**, gibt es heute org-weiten Lesezugriff auf Teilnehmer — das wäre ein eigenständiger Befund und ändert die Reihenfolge (dann vor P1 sofort melden).
- **G1b** Existiert die Sharing Rule `PortalParticipantSeesOwnRecord` in der Org? Sie wird von `Participant_Portal_Access` referenziert, liegt aber in **keinem** der beiden Projekte (`find` bestätigt: kein `sharingRules`-Ordner). Fehlt sie in der Org, sieht das Portal 0 Rows und P3 nimmt dem Portal die letzte Datengrundlage.
- **G1c** Gibt es Profile oder Sharing Rules außerhalb unserer Permission-Sets, die Objekte org-weit freigeben?

**Einfachste Prüfung:** `sf sobject describe --sobject Participant__c --target-org organiser-dev` und `sf data query --use-tooling-api "SELECT TableDefine, DurableId FROM EntityParticle"` — bzw. der Objekt-Export der gesamten Sharing-Konfiguration. Liegt die Antwort nicht in einer Stunde vor, bleiben P1/P2/P6/P8/P11 das Tagesprogramm und der Rest wartet.

---

## P1 — Redaktions-Policies auf die emittierten Feldnamen umstellen (S1, S2) · ✅ erledigt `2c99185`

**Warum zuerst:** Ein Abwesenheitsgrund („Krebserkrankung, laufende Chemo") steht heute im Klartext in `AuditEvent__c`, und `viewAllRecords` gibt jedem Coach Zugriff darauf. Der Code behauptet bereits, das Feld sei geschützt — der Fix stellt die Absicht wieder her, statt sie neu zu erfinden.

**Ursache:** `applyFieldRedaction` (`src/api/audit/auditService.ts:85-87`) schlägt `policies[field]` exakt nach. Die Policies in `src/types/audit.ts:248` verwenden Namen ohne `__c`, die Integrationen emittieren mit `__c`. Zusätzlich wird ein von Hand gesetztes `redacted: true` in der Integrationsdatei überschrieben, weil die Funktion nur `{ field, oldValue, newValue }` destrukturiert.

### Schritte

**1. Tests zuerst (rot).** Neue Datei `src/api/audit/absenceAudit.test.ts`, nach dem Muster des `describe("availability field policy")`-Blocks in `availabilityAudit.test.ts:63-90`. Fälle:

```
applyFieldRedaction([{ field: "Reason__c", newValue: "Krebs, Chemo" }], "absence")
  → newValue === undefined, redacted === true
applyFieldRedaction([{ field: "CoachComment__c", newValue: "VERTRAULICH" }], "absence")
  → newValue === undefined, redacted === true
applyFieldRedaction([{ field: "Status__c", newValue: "Submitted" }], "absence")
  → newValue === "Submitted", redacted === false
```

Für „`redacted === undefined`" (Wert verschwunden) muss der Test die tatsächliche Form von `applyFieldRedaction` treffen — erst den Rückgabetyp lesen, dann den Test schreiben.

**2. Policies umstellen.** `src/types/audit.ts`, Block `absence` (`:265-270`): Schlüssel `Type`, `StartDate`, `EndDate` → `Type__c`, `StartDate__c`, `EndDate__c`; `Reason` → `Reason__c` (`strategy: 'REDACTED'`, `allowRedactionByPermission: true` bleibt); **`Status__c` ergänzen** (wird emittiert, hat aber keine Policy → fällt auf `FULL`, das ist korrekt, aber explizit besser); **`CoachComment__c` neu** mit `strategy: 'REDACTED'`, `allowRedactionByPermission: true`.

Im gleichen Zug Block `appointment` (`:271-276`): `StartTime` → `StartTime__c`, `EndTime` → `EndTime__c`, `Status` → `Status__c`, `Type__c` ergänzen. `Attendees` als Schlüssel **entfernen** — es gibt kein emittiertes `Attendees`-Feld, die `REFERENCE`-Regel ist toter Code (Boy Scout). Emittiert werden zusätzlich `Coach__c`, `CancellationReason__c`, `CorrelationId__c`, `RescheduleReason`; dafür Policy-Einträge anlegen, damit `Coach__c` als Referenz statt als Klarname gespeichert wird.

**3. Hand-Flag respektieren.** In `applyFieldRedaction` (`auditService.ts:78-110`): ein eingehendes `redacted: true` darf **nie** durch das Policy-Ergebnis `false` überschrieben werden. Damit ist die Absicht der Integrationsdatei wirksam, auch wenn die Policy eines Tages fehlt.

> **Abweichung von der ursprünglichen Fassung — bitte beachten.** Der Plan schrieb `redacted = policyRedacted || incomingRedacted` vor. Das wäre ein stiller Datenabfluss gewesen: bei Strategie `FULL` lässt der `switch` die Werte unverändert im Speicher, ein nachträgliches ODER auf das Flag hätte `Changes__c` weiter mit Klartext befüllt, während die UI „Wert geschwärzt" anzeigt. Umgesetzt ist deshalb ein **Kurzschluss vor dem `switch`**: ein eingehendes `redacted: true` strippt `oldValue` und `newValue` und setzt das Flag, unabhängig von `strategy`.
>
> Zwei Konsequenzen daraus: der `NONE`-Fall musste aus dem `switch` **nach vorne** gezogen werden, sonst hätte der Kurzschluss ein als `NONE` markiertes Feld wieder durchlassen; und der `REFERENCE`-Zweig wäre nach dem `switch` nicht erreichbar gewesen, hätte aber `redacted = false` gesetzt. Beides ist durch die Reihenfolge `NONE` → Hand-Flag → `switch` erledigt.

**4. `CoachComment__c` im Integrationstext korrigieren.** `absenceAuditIntegration.ts:174` steht auf `redacted: false`. Nach Schritt 3 unschädlich (die Policy greift), aber irreführend — auf `true` setzen, damit der Text die Absicht zeigt.

**5. Kommentar zu `record()` ergänzen.** `auditService.ts:264` ruft `applyFieldRedaction` ein zweites Mal mit `canSeeRedacted: false, // TODO: Check user permissions`. Der Kommentar muss erklären, dass dieser Aufruf **der Durchsetzungspunkt für absence und appointment ist** — beide Integrationen rufen `applyFieldRedaction` nicht selbst auf und verlassen sich vollständig auf `record()`. Die Idee, den Doppelaufruf zu entfernen, wäre ein stiller Datenabfluss. Den `TODO` auflösen: für die Persistenz ist Redigierung immer korrekt; wer einen redigierten Wert sehen darf, entscheidet der Lesepfad.

**6. UI-Labels nachziehen.** `ChangeSetViewer.tsx:43-48` mappt `Reason`, `Type`, `StartTime`, `EndTime` — ohne `__c`. Diese Einträge waren bereits tot, weil `change.field` immer den Suffix trug; die Timeline zeigte literal `Reason__c`. Auf `__c` umgestellt und die neuen Felder ergänzt, sonst hätte die Redaktion in der Oberfläche als Feldname statt als Wert erscheinen müssen.

### Ergebnis

- Testsuite 121 → **130 Tests** in den berührten Verzeichnissen, **279** im ganzen Bundle (vorher 270). `tsc --noEmit` sauber, Lint unverändert bei 16 Warnungen.
- **Probe bestätigt die Absicherung:** ein absichtlich falscher Policy-Schlüssel (`CoachComment__c2`) lässt genau den zugehörigen Test fallen, nicht die ganze Suite. Der Suffix-Test aus P2 würde das künftig für alle Domains erzwingen.
- Zusätzlich emittierte Felder ohne Policy aufgenommen (`ApprovedBy__c`, `ApprovedAt__c`, `RejectedAt__c`, `Documents`, `Coach__c`, `CorrelationId__c`, `CancellationReason__c`) — ohne sie wäre P2s Abdeckungstest sofort rot gelaufen.
- **Zweite falsche Hand-Flag-Stelle korrigiert, im Plan nicht genannt:** `absenceService.ts:313-318` setzte `CoachComment__c` ebenfalls auf `redacted: false`.

**Verifikation:** `npx vitest run` grün; `npx tsc --noEmit` sauber; `npm run lint` ohne neue Warnung.
**Aufwand:** S. **Risiko:** Nach dem Fix fehlen `Reason__c`/`CoachComment__c`-Werte in bereits persistierten Alt-Events weiterhin im Klartext. Datenbereinigung der Historie ist **nicht** Teil dieses Pakets (siehe E8).

---

## P2 — Strukturschutz statt Einzelfallkorrektur (S1, Ursache)

**Warum:** P1 behebt die zwei gefundenen Felder. Ohne strukturelle Absicherung ist derselbe Fehler beim nächsten neuen Audit-Feld wieder da — und zwar still, weil ein vergessener `__c` keine Fehlermeldung erzeugt, nur Klartext.

**Schritte**

1. In jeder Integration die emittierten Feldnamen als exportierte Konstante führen (`ABSENCE_AUDIT_FIELDS`, `APPOINTMENT_AUDIT_FIELDS`, …) und im Emitter verwenden. Damit ist „was schreiben wir" eine Datendeklaration statt eine Streuung über ~20 Stellen.
2. Test `fieldPolicyCoverage.test.ts`: für jede Domain prüfen, dass jeder Name aus `<DOMAIN>_AUDIT_FIELDS` in `DEFAULT_FIELD_POLICIES[domain]` vorkommt. Fehlende Felder als `describe`-Fehler mit Feldnamen ausgeben.
3. Test `fieldPolicySuffix.test.ts`: jeder Policy-Schlüssel einer Domain, die `__c`-Objekte abbildet, endet auf `__c`. Ausnahme: Felder ohne Suffix, die tatsächlich emittiert werden, sind über eine explizite Allowlist im Test benannt — mit einem Kommentar, warum. Bereits heute in der Allowlist: `Documents` (kein Salesforce-Feld, der Audit-Event trägt nur den Dateinamen) sowie `workbook`, `classbook`, `daily_checkin` und `time_tracking`, deren Policies noch auf alte, ungesuffixte Namen lauten und im Rahmen dieses Pakets mit umgestellt werden.
4. **`RescheduleReason` entscheiden** (`appointmentAuditIntegration.ts:101`). Der Name trägt kein `__c`, und ein Feld dieses Namens existiert in der Org nicht — es ist ein reines Audit-Label. Drei Wege: auf `RescheduleReason__c` umbenennen und ein Policy anlegen, als bewusste Ausnahme in die Allowlist aus Schritt 3 aufnehmen, oder ganz aus `changes` streichen (der Wert landet ohnehin nur über `metadata.rescheduleReason` und fällt dort an der Allowlist durch). **Vom Auftraggeber zurückgestellt** — die Allowlist in Schritt 3 muss den Fall also als offene Frage ausweisen, nicht stillschweigend als erledigt behandeln.
5. **Die `authentication`-Domain mitdenken:** `DEFAULT_FIELD_POLICIES` hat keinen Eintrag für `authentication` und `system`. `sessionAudit.ts:31` schreibt derzeit `changes: []`, also entsteht heute kein Leck — der Moment, in dem jemand `metadata: { authMethod }` zu einem Feld macht, ist aber schon da. Aufgabe im Plan: entweder leere Policies `{ authentication: {}, system: {} }` anlegen (macht die Lücke explizit) oder im `authentication`-Abschnitt von `types/audit.ts` dokumentieren, warum die Domain feldlos bleibt. Ich nehme die leeren Maps — sie kosten zwei Zeilen und der Abdeckungstest aus Schritt 2 verlangt sonst jedes Feld.

**Status 2026-10-06: umgesetzt** in `2c99185` (P1) und `e8b949d` (P2). Die beiden Tests aus Schritt 2 und 3 liegen zusammen in `src/api/audit/fieldPolicyCoverage.test.ts` (ein Dateiname statt zwei), die Emitter-Registry in `src/api/audit/emittedFields.ts`. Der Test prüft zusätzlich gegen die Objekt-Metadaten, dass jeder emittierte Feldname wirklich einem Feld in der Org entspricht — das fängt den Fall `RescheduleReason` (Schritt 4) strukturell ab, solange die Entscheidung E9 offen ist.

**Verifikation (gemessen 2026-10-06):** `tsc --noEmit` 0 Fehler · `vitest run` 37 Dateien / 305 Tests grün (vorher 35 / 270) · `eslint src` 0 Fehler, 16 Warnungen (unverändert, Paket B6) · Mutationsprobe: ein absichtlich eingetragenes Feld `CoachComment__cProbe` lässt zwei Tests fehlschlagen („fehlt in DEFAULT_FIELD_POLICIES" und „existiert nicht in der Org"). Der Test beißt.


**Verifikation:** siehe Status oben — der Test wurde mit einer absichtlich eingetragenen Mutante geprüft.
**Aufwand:** S. **Risiko:** keins — reiner Test + zwei leere Maps.

---

## P3 — `defaultSharing>Private` (S6)

**Warum:** Die gesamte Sicherheitsarchitektur des Portals hängt daran, dass `Participant__c` `Private` ist. Diese Information steht nur in einem Kommentar in `frontend/.../participantApi.ts:9-13` — nicht in deploybarer Form. Ein Deploy in eine saubere Org erzeugt öffentliche Objekte.

**Betroffen:** alle **9** Custom-Objekte unter `backend/force-app/main/default/objects/`:
`Absence__c`, `Appointment__c`, `AuditEvent__c`, `AuditOutbox__c`, `AvailabilitySlot__c`, `Coach_Profile__c`, `Learning_Path__c`, `Module__c`, `Participant__c`, `Program__c`

Verifiziert: kein Objekt hat ein `<defaultSharing>`-Element. (`Account` ist ein Standardobjekt — die Org-Default-Sharing-Rolle dafür können wir nicht per Metadaten setzen; das gehört in die Liste der Punkte, die wir dem Chef bzw. dem Admin geben.)

**Schritte**

1. **Gate G1a/G1b beantworten.** Ohne diese Antwort kein Deploy — sonst nehmen wir dem Portal die Datengrundlage, ohne es zu merken.
2. In jeder `*-meta.xml` `<defaultSharing>Private</defaultSharing>` ergänzen (Schema-Position: nach `<label>`, vor `<deploymentStatus>` — die exakte Reihenfolge beim ersten Mal an der Salesforce-DTD-Prüfung verifizieren, nicht aus dem Gedächtnis).
3. Sharing Rule `PortalParticipantSeesOwnRecord` **ins Repo holen** (Retrieve aus der Org) oder als fehlend dokumentieren. Ein Permission-Set, das eine nicht existierende Rule referenziert, ist eine stille Fehlkonfiguration.
4. In dieser Reihenfolge deployen: erst Objekte, dann Rules/Permission-Sets. Nicht in einem `sf project deploy` vermischen — sonst ist bei einem Fehler nicht mehr klar, was schon Teil des Teil-Deploys war.

**Verifikation:** `sf sobject describe --sobject Participant__c --target-org organiser-dev` zeigt `sharingModel` wie erwartet; danach als Coach und als Portal-User je einen Smoke-Test (Absenz anlegen, Teilnehmer sehen, Portal öffnen).
**Aufwand:** XS nach G1. **Risiko:** mittel, wenn G1b falsch beantwortet ist — dann sieht das Portal 0 Rows.

---

## P4 — Serverseitiger Audit-Schreibpfad (S3, S4)

**Korrektur gegenüber dem Report:** Im Report steht, S3 sei mit `allowCreate=false` in XS behoben. Das ist **falsch**, und der Grund ist wichtig: Das Audit wird **clientseitig** über die Session des angemeldeten Coaches geschrieben (`auditApiService.ts:212 createAuditEventRecord` → GraphQL-Mutation `CREATE_AUDIT_EVENT`). Ein Coach braucht `allowCreate` zwingend, damit er überhaupt ein Event schreiben kann. `allowCreate=false` löscht das Audit-Log. Dasselbe gilt für die Outbox (`auditOutbox.ts:95 AuditOutbox__cCreate`, `:151 Update`).

**Ziel:** Der Coach braucht keine Schreibrechte auf `AuditEvent__c`/`AuditOutbox__c`, und trotzdem entstehen vollständige Events.

**Schritte**

1. Apex-Klasse `AuditEventWriter.cls`, `@AuraEnabled` (bzw. `@RestResource`, wenn der Bundle-Pfad keinen Aura-Kontext hat — das entscheidet die tatsächliche Aufrufstelle), `without sharing` mit begründetem Docstring im Stil von `StaffIdentity.cls`.
2. **Der Actor wird nicht aus dem Parameter übernommen.** Entweder aus `StaffIdentity` (steht bereits als serverseitige Helper-Klasse bereit) oder als nicht vertrauenswürdiger Input, der serverseitig gegen `UserInfo` geprüft wird. Ein `ActorId__c`-Parameter, den der Client frei setzt, wäre genau die Fälschung, die S3 meldet — nur serverseitig.
3. `validateMetadata`/`MAX_METADATA_SIZE = 10000` und die `METADATA_ALLOWLISTS` (`src/types/audit.ts:395`) **serverseitig** spiegeln. Im Client sind sie nur Kosmetik, weil der Client die Quelle der Daten ist.
4. Testklasse `AuditEventWriterTest.cls` nach dem Muster der vorhandenen Apex-Tests.
5. `auditApiService.createAuditEventRecord` und `auditOutbox` auf den neuen Pfad umstellen.
6. **Erst wenn das deployed und getestet ist:** `AuditEvent__c allowCreate=false`, `AuditOutbox__c allowEdit=false` (+ `allowCreate=false`) in `backend_Coach`.
7. Smoke-Test in der Org: Absenz anlegen, Event in der Timeline prüfen, danach die Rechte entziehen und den Smoke-Test wiederholen.

**Aufwand:** M. **Risiko:** hoch, wenn Schritt 6 vor Schritt 5/7 kommt — dann ist das Audit weg. Deshalb wird Schritt 6 in einem **eigenen Commit** gemacht, getrennt von der Server-Implementierung.

---

## P5 — Outbox: Replay oder dokumentierter Verzicht (S4)

**Entscheidung nötig, ich kann sie nicht allein treffen:** Die Outbox hat keinen Verarbeiter. `processOutboxOnce()`, `listOutboxEntries()`, `requeueOutboxEntry()`, `failOutboxEntry()` (`auditOutbox.ts:119-246`) werden nirgends im Produktivcode aufgerufen — nur in `auditOutbox.test.ts`. Kein Scheduled Apex in beiden Projekten.

Optionen: **(a)** Scheduled Apex + Apex-Implementierung des Replays (M, echte Ausfallsicherung), **(b)** dokumentierter Verzicht — ADR-14 says Audit ist best-effort, dann wird die Outbox-Dokumentation entsprechend angepasst und `processOutboxOnce` entweder als Werkzeug für Handbetrieb oder tot markiert. Der jetzige Zustand ist keines von beiden: Code, der aussieht als würde er replayen, und Rechte, die ihm vertrauen.

Meine Empfehlung: **(b)**, solange kein produktiver Anlass für (a) benannt ist. Die 40 Zeilen Dead Code zu entfernen ist billiger und ehrlicher als eine Scheduler-Infrastruktur ohne Auftrag.

---

## P6 — `shadcn` aus den Runtime-Abhängigkeiten (D1)

`shadcn@^3.8.5` steht in `dependencies` beider Bundles und wird nirgends importiert. Es ist ein CLI-Tool für die Komponentenerzeugung — das es nutzt, ist `components.json` plus die fertigen Dateien.

**Maßnahme: verschieben, nicht deinstallieren.** `shadcn` bleibt, wandert aber nach `devDependencies`. Ein Uninstall hätte dieselbe Audit-Wirkung, würde aber die gepinnte `^3.8.5` mitnehmen — `npx shadcn add` zöge dann die neueste Major-Version, die Komponenten für ein neueres Tailwind/React generiert und den Build zerschießen kann. Die Verschiebung kostet nichts und behält die Pin.

```bash
# in beiden Bundles: Eintrag von "dependencies" nach "devDependencies" verschieben
cd backend/force-app/main/default/uiBundles/backend && npm install
cd frontend/force-app/main/default/uiBundles/frontend && npm install
```

**Nicht** `npm install --save-dev shadcn` — das löst die *neueste* Version auf. Im ersten Versuch zog das `shadcn@4.21.3` statt 3.8.5 (Major-Sprung) und schrieb 882 Lockfile-Zeilen um. Der Eintrag wird von Hand verschoben, `npm install` übernimmt nur die `dev: true`-Markierung.

**Erwartete Wirkung, gemessen:** `shadcn → ts-morph → @ts-morph/common → fast-glob → micromatch → braces` sind 6 high-CVEs, ausschließlich über `shadcn` erreichbar, mit Null Überschneidung zur `o11y`-Kette. Die CVEs selbst sind ReDoS in Glob-Code, der nur beim lokalen `shadcn add` läuft — kein Runtime-Risiko, `dist/` enthält nachweislich keinen dieser Bäume. Der Wert dieses Pakets ist die Audit-Signalqualität, nicht die Behebung eines ausnutzbaren Fehlers.

**Verifikation (gemessen 2026-10-06):** `npm audit --omit=dev` Backend 28 → **19** Lücken (21 → 15 high, 1 critical) · Frontend → **18** Lücken (14 high, 1 critical) · `shadcn@3.8.5` in beiden Bundles weiterhin installiert und gepinnt · `tsc --noEmit` sauber, `npm run build` grün, Tests 305 (Backend) / 15 (Frontend).

Die kritische `protobufjs`-Lücke und die high-CVEs über `@salesforce/platform-sdk → o11y` bleiben unberührt — sie sind transitiv und nicht behebbar (P11).

**Aufwand:** XS. **Risiko:** keins. Der `npm run build` ist die eigentliche Absicherung, nicht `tsc`.

---

## P7 — Kommentar im `backend_Access`-Permission-Set (A2)

`backend_Access` trägt `ApiEnabled` + `StaffIdentity`-Klassenzugriff und **null** Objekt-/Feld-Berechtigungen. Der Name verspricht Zugang; wer ihn zuweist, bekommt eine handlungsunfähige Sitzung. `org-setup.config.json` weist genau dieses Set an `currentUser` zu — das Setup-Skript stellt damit nicht den Produktionszustand her.

Zwei Teile: XML-Kommentar in `backend_Access.permissionset-meta.xml`, der die Rollenaufteilung festhält, und ein Satz in `backend/docs/coach-access.md`, der das Skript als „Sitzungs-Smoke-Test" statt als Rechte-Abbild einordnet.

**Aufwand:** XS. **Risiko:** keins.

---

## P8 — Frontend-Auth-Tests (A3)

830 Zeilen Session-Logik gegen 15 Tests im ganzen Frontend-Bundle. Der Code ist gut (`isValidRedirect` in `authHelpers.ts:54` ist korrekt, `AuthContext` bricht den Probe-Timeout ab) — es fehlt die Absicherung.

**Fall 1 — Aufräumen nebenbei.** `vite.config.ts:64` referenziert `setupFiles: ['./src/test/setup.ts']`, und diese Datei **existiert nicht**. Vitest nimmt trotzdem `vitest.config.ts` und läuft über `vitest.setup.ts` (`import '@testing-library/jest-dom/vitest'`). Der `test`-Block in `vite.config.ts` ist toter Konfigurationsrest und führt in die Irre — entweder löschen oder auf den richtigen Pfad zeigen.

**Fall 2 — Tests.** Neu `src/features/authentication/__tests__/`:
- `isValidRedirect`: Tabelle mit `//evil.com`, `/\evil.com`, `%2f%2fevil.com`, `\` , Steuerzeichen, relativer Pfad, absoluter gleich-origin-Pfad. Positiv- und Negativfälle.
- `sessionTimeService`: CSRF-Prefix-Removal (`while(1);\n`), `LATENCY_BUFFER_SECONDS = 3`, Ablauf an der Grenze.

**Aufwand:** M. **Risiko:** keins, reine Testdateien.

---

## P9 — `visibility` durchsetzen oder ehrlich dokumentieren (S5)

`DEFAULT_DOMAIN_VISIBILITY` schreibt `restricted` für `absence`, `daily_checkin`, `authentication` — beim Lesen wird der Wert nur angezeigt (`ActivityEventDetailsDrawer.tsx:224`). `filterForAudience()` (`activityProjection.ts:184`) prüft `includeInActivity`, `technical`, `audiences`, `categories`, **nicht** `visibility`. Der Kommentar in `auditApiService.ts:126` behauptet das Gegenteil („enforced upstream (server)") — im Bundle trifft das nicht zu, das Lesen läuft clientseitig über `GetParticipantActivityTimeline.graphql`.

Zwei Wege, und die Entscheidung gehört zur Zugriffsfrage, nicht hierher: **(a)** `visibility` in `filterForAudience` einbeziehen — problematisch, solange A1 gilt, weil ein `restricted`-Event dann für einen Coach unsichtbar wird, der fachlich zuständig ist; die Regel braucht dann eine Rolle, nicht nur ein Feld. **(b)** Die Zuordnung Audience↔Domain wird serverseitig in Sharing umgesetzt, der `visibility`-Wert wird zum Hinweis für die Oberfläche, und der Kommentar in `auditApiService.ts:126` wird korrigiert, sodass er beschreibt, was tatsächlich erzwungen wird.

Solange A1 (P10) offen ist, erzeugt jede Umsetzung von (a) falsche Sicherheit. Ich platziere P9 deshalb **nach** P10 und nicht davor.

---

## P10 — Berechtigungsmodell (A1)

`viewAllRecords=true` auf 12 von 15 Objekten. Blockiert durch Chef-Entscheidung E1; die Nachricht liegt vor, die Antwort steht aus. Umsetzung hängt an den Varianten aus `.opencode/plans/refactor-security-plan.md` und am Zugang zu Rollen/Portal-Sharing-Zeilen.

Reihenfolge innerhalb von P10, sobald E1 beantwortet ist: erst die Sharing-Grundlage (`defaultSharing`, P3), dann object-level Rechte, dann field-level, dann `viewAllRecords` pro Objekt zurückbauen. Nicht umgekehrt — sonst gibt es ein Fenster, in dem Coaches weder sehen noch schreiben können.

---

## P11 — Dependency-Hygiene (D2) ✅

**Erledigt 2026-10-06.** Drei `overrides` in beiden Bundles, alle auf Patch- oder Minor-Ebene innerhalb derselben Major:

```json
"overrides": {
  "@jsforce/jsforce-node": "^3.10.28",
  "lodash": "^4.18.1",
  "source-map-js": "^1.2.2",
  "undici": "^7.30.0"
}
```

`csv-parse` musste nicht erzwungen werden: `jsforce-node@3.10.28` bringt `csv-parse@7.0.3` selbst mit, womit sich auch diese moderate CVE ohne Major-Sprung auflöst.

**Gemessen:** `npm audit --omit=dev` je Bundle von 28 Lücken / 21 high / 1 critical auf **15 / 13 / 1**. `tsc --noEmit` sauber, Builds grün, Tests 305 / 15 unverändert.

**Bewusst nicht geschlossen: `fast-uri` (moderate).** Fix wäre `fast-uri@4.x`, ein Major-Sprung in `ajv@8.20.0`s Abhängigkeit unter `@salesforce/core`. Ein erzwungener Major in Salesforces Baum ohne Testabdeckung der URI-Validierung ist schlechter als ein dokumentiertes moderate-Risiko. Beim nächsten SDK-Bump neu bewerten.

**Was bleibt, ist nicht behebbar** und im Report als akzeptierte Entscheidung begründet: `protobufjs` critical, `@salesforce/platform-sdk`, `@salesforce/ui-bundle`, `o11y`, 8× `@conduit-client/*`, `micromatch`, `braces` — sämtlich `fixAvailable: false` und von Salesforce ausgeliefert.

---

## Commit-Struktur

Nach `backend/docs/AGENTS.md` und der bisherigen Branch-Historie: eine Sache pro Commit, Conventional Commits, keine Mischform von Code und Doku.

```
fix(audit):Policy-Schlüssel auf emittierte Feldnamen umstellen        (P1)
test(audit): Abdeckungstest für Feld-Policies                       (P2)
chore(metadata): defaultSharing Private für alle Custom-Objekte    (P3)   ← nach G1
feat(audit): serverseitiger Schreibpfad für Audit-Events            (P4a)
fix(perms): Schreibrechte auf AuditEvent__c/AuditOutbox__c entziehen (P4b) ← eigener Commit, nach 4a getestet
chore(deps): shadcn aus den Runtime-Abhängigkeiten entfernen        (P6)
docs(perms): Rollenaufteilung im backend_Access-Set festhalten       (P7)
test(auth): Redirect- und Session-Zeit-Tests                          (P8)
docs(security): nicht behebbare Transitiv-CVEs begründen            (P11)
```

(Nachricht in Zeile 1 zunächst auf Deutsch formulieren, das Repo ist gemischt — die letzten Commits sind deutsch, ich richte mich danach.)

Die Doku-Commits aus der Branch-Historie (`0deaef4`, `0924bda`, `74fd3df`, der Security-Report mit der Korrektur an `refactor-security-plan.md:41` sowie der Nachtrag zu P1) gehören in **eigenen** Docs-Commit und bleiben von P1–P11 getrennt.

---

## Offene Entscheidungen

| # | Frage | Empfehlung | Blockiert |
|---|---|---|---|
| E1 | Berechtigungsmodell (`viewAllRecords`) | liegt beim Chef | P10 |
| E5 | Audit-Schreibpfad: Aura-Klasse oder REST-Ressource? | nach Aufrufstelle entscheiden | P4 |
| E6 | `visibility`: clientseitig erzwingen oder serverseitig modellieren? | (b) nach P10 | P9 |
| E7 | Outbox: Replay bauen oder Verzicht dokumentieren? | (b) Verzicht | P5 |
| E8 | Datenbereinigung: bestehende Audit-Events mit Klartextgründen bereinigen? | **Folgeaufgabe** nach P4, ORG-Fenster | — |
| E9 | `RescheduleReason` ohne `__c` und ohne Org-Feld | offen, siehe P2 Schritt 4 | P2 Schritt 3 |

### E8 im Detail — Folgeaufgabe

**Was offen ist:** P1 verhindert ab dem Deployment neue Klartexte. Bereits persistierte `AuditEvent__c` behalten ihre Werte in `Changes__c`. Ein Coach mit `viewAllRecords` auf `AuditEvent__c` liest sie weiterhin.

**Warum sie nicht jetzt:** Ein `UPDATE` auf `AuditEvent__c` braucht Schreibrechte auf dem Objekt, und die sind genau das, was P4 entzieht. Vorher bereinigen hieße, die Rechte zu verbiegen und sie danach wieder zurückzugeben. Richtige Reihenfolge ist P4 → Bereinigung → Rechte-Entzug abschließen.

**Was beim Bereinigen zu bedenken ist:**

- **Nicht nur `AuditEvent__c`.** `CoachComment__c` steht zusätzlich im Klartext auf dem `Absence__c`-Datensatz selbst (`AbsenceListCard.tsx:117` zeigt ihn als „Ablehnungsgrund"). Eine Bereinigung des Audit-Logs beseitigt die Dublette, nicht den Text. Zu entscheiden ist, ob `Absence__c.CoachComment__c` überhaupt noch im Klartext stehen soll — das ist eine Produktfrage, keine technische, weil der Coach den Kommentar fachlich braucht.
- **`Reason__c` ist der härtere Fall.** Das Feld gehört dem Teilnehmer und wird über `AbsenceService` geschrieben (`Reason__c.field-meta.xml`: „sensitiv - Audit redaktioniert"). Ob es am Datensatz selbst verbleibt oder ebenfalls verschwindet, entscheidet die Geschäftsführung.
- **`allowRedactionByPermission` hat weiter keinen Wirkungsweg.** `canSeeRedacted` wird nur an einer Stelle gesetzt und ist dort `false`. Nach P1 sind `Reason__c` und `CoachComment__c` für **niemanden** sichtbar, auch nicht für die Person, die sie eingetragen hat. Das entspricht der Absicht im Feld-Beschreibungstext, aber die Policy-Option selbst ist ungenutzt, bis P10 ein Berechtigungsmodell bringt. Das gehört in dieselbe Besprechung wie E1.

**Umfang vor der Org-Entscheidung messbar:** Anzahl der Events mit unredigiertem Wert, ältestes davon, ob überhaupt Historie existiert. Ohne diese Zahl ist „bereinigen" eine unbestimmte Aufgabe.

---

## Was dieser Plan nicht enthält

- **Bereinigung der Historie.** Als Folgeaufgabe unter E8 geführt: Reihenfolge P4 → Bereinigung → Rechte-Entzug abschließen, mit den offenen Produktfragen zu `Absence__c.CoachComment__c` und `Reason__c`.
- **Die Refactor-Pakete B1–B8.** Sie stehen in `.opencode/plans/refactor-security-plan.md` und sind unabhängig ausführbar.
- **Das Portal-Sharing-Zweischichtenmodell.** `ParticipantPortalData`/`ParticipantPortalLearningPath` sind geprüft und in Ordnung; Änderungen dort gehören nicht in diesen Plan.
- **A1 vor E1.** Ohne Entscheidung ist jede Berechtigungsänderung eine Vermutung.
- **Deployment in die Produktiv-Org.** Alle Org-Schritte laufen gegen `organiser-dev`.
