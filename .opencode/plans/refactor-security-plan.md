# Refactor- und Sicherheitsplan — Gesamter Codebestand

**Datum:** 2026-10-06
**Geltungsbereich:** beide UI-Bundles, Apex-Klassen und -Trigger, Permission-Sets, Dependencies
**Methode:** statische Prüfung + `tsc --noEmit` + `eslint` + `vitest run` + `npm audit`
**Nicht geprüft:** Laufzeitverhalten in der Org, Apex-Tests (`sf apex run test`),
echte Berechtigungsprofile in der Sandbox. Diese Punkte brauchen Org-Zugriff und sind unten
als **ORG** markiert.

---

## 0. Ausgangslage (gemessen)

| Kriterium | Backend-Bundle | Frontend-Bundle |
|---|---|---|
| Quelldateien (ts/tsx) | 229 | 82 |
| Zeilen | 51.590 | 7.810 |
| `tsc --noEmit` | ✅ 0 Fehler | ✅ 0 Fehler |
| `eslint src` | ⚠️ 0 Fehler, **16 Warnungen** | ✅ sauber |
| `vitest run` | ✅ 35 Dateien, **270 Tests** | ✅ 1 Datei, **15 Tests** |
| `npm audit --omit=dev` | 25 Lücken (19 high, **1 critical**) | 23 Lücken (18 high, **1 critical**) |
| `@salesforce/platform-sdk` | **^11.57.2** | **^12.4.5** |
| Coverage-Konfiguration | keine | keine |

Apex: 9 Klassen (4 Produktiv, 4 Test, 1 Exception), 3 Trigger.
Per `grep -ri "dangerouslySetInnerHTML\|innerHTML\|eval(\|new Function" src` **null Treffer**
in beiden Bundles — keine XSS-Senke durch unescapte HTML-Einbettung.

**Kurzurteil:** Die Codequalität ist besser als der Plan von 2026-09-28 nahelegte. Es gibt
keine akute Sicherheitslücke im Anwendungscode. Die echten Befunde liegen an den Rändern —
Dependencies, toter Code, Testlücken und eine Berechtigungsfrage, die über die gesamte
Datenebene geht.

---

# Teil A — Sicherheit

## A1. Row-Level-Isolation zwischen Coaches existiert nicht · 🔴 offen

**Befund:** `backend/force-app/main/default/permissionsets/backend_Coach.permissionset-meta.xml`
setzt `<viewAllRecords>true</viewAllRecords>` auf **12 der 15 Objekte** (die Ausnahmen
sind `User`, `ContentVersion`, `ContentDocumentLink`), darunter `Participant__c`,
`Appointment__c`, `Absence__c`, `Program__c` und auch `Contact`. Jeder Coach sieht damit
alle Teilnehmer, alle Termine, alle Abwesenheiten und alle Contacts der gesamten Org.

**Warum das zählt:** Priorität 0 des `next-steps-plan.md` verlangt, dass Coaches **nur
freigegebene** Contacts sehen. Das ist eine Datenanforderung, die im Permission-Set nicht
abbildbar ist — `viewAllRecords` hebt jede Zeilenbeschränkung auf. Eine Query-Filterung im
UI-Bundle ist **kosmetisch**: sie greift nur, solange niemand die UI umgeht. Ein exportierter
Report, ein Flow oder eine Apex-Query eines Coaches umgeht sie vollständig.

**Optionen zur Entscheidung (ORG nötig):**

| Option | Umsetzung | Folge |
|---|---|---|
| A. Scope bleibt „Coach sieht alles" | keine Code-Änderung | Priorität 0 kann die Freigabe-Idee nur im UI durchsetzen, nicht in der Datenebene. Dokumentieren als bewusste Entscheidung. |
| B. Sharing-Rules / Apex-Sharing | `Participant__c` Sharing-Records je Coach | echte Trennung, aber erheblicher Aufwand in Apex + Trigger-Pflege |
| C. Custom Field + Criteria Sharing | `Academy_Released__c`-ähnliches Flag, Coach-Sharing nur bei Flag | Mittelweg, braucht das Feld aus P0 zuerst |

**Empfehlung:** Erst als **A** dokumentieren und P0 darauf ausrichten. Wenn die Freigabe
wirklich datenbindend sein soll, ist es Option C und damit **ORG-Arbeit**, die
zusammen mit dem Feld aus P0 erledigt werden muss — nicht später.

## A2. `backend_Access` hat null Feld- und Objekt-Berechtigungen · 🟡 Naming/Überraschung

`backend_Access.permissionset-meta.xml` enthält **ausschließlich** `ApiEnabled` und den
`StaffIdentity`-Klassenzugriff — 0 `<fieldPermissions>`, 0 `<objectPermissions>`.
Alle 59 Feld- und 13 Objekt-Berechtigungen stecken in `backend_Coach`.

Das ist funktional vermutlich richtig (Access = Durchreichen für eingeschränkte Profile,
Coach = Datenzugriff), aber der Name lädt zum Gegenteil ein. Wer `backend_Access` einem
Profil gibt, bekommt **keine** Daten — und merkt es erst zur Laufzeit.

**Maßnahme:** Header-Kommentar in beiden Permission-Sets aufschreiben, welche Rolle welche
Bedeutung hat. Kein Code-Risiko, aber eine Fehlerquelle für die Person, die als Nächstes
an die Release-Freigabe rangeht.

## A3. Nur 15 Tests im gesamten Portal-Bundle · 🔴 Testlücke mit Sicherheitsbezug

Das Frontend-Bundle enthält den kompletten Login-, Session- und Portalpfad und hat **eine**
Testdatei:

- `src/features/authentication/sessionTimeout/SessionTimeoutValidator.tsx` — **604 Zeilen**,
  kein Test
- `src/features/authentication/sessionTimeService.ts` — CSRF-Token-Erkennung, kein Test
- `src/features/authentication/forms/auth-form.tsx` — Login, kein Test
- `src/features/participant/api/learningPathApi.ts`, `participantApi.ts` — kein Test

Der Code selbst ist gut: `authHelpers.ts` validiert Redirect-Ziele gegen Open Redirect
(Protokoll-relativ, Backslash, Steuerzeichen), `sessionTimeoutConfig.ts` hat CSRF-Prefix
und Latenzpuffer. **Aber:** eine Änderung an der CSRF-Erkennung bricht nichts, weil kein Test
sie hält.

**Maßnahme:** Tests für `isValidRedirect`, die CSRF-Antwortverarbeitung und den
Session-Timeout-Abbruch. Das ist die höchste Testdichte pro Zeile im ganzen Repo.

## A4. `protobufjs` critical, kein Fix verfügbar · 🟡 akzeptieren und dokumentieren

`npm audit --omit=dev` meldet `protobufjs` als **critical** und
`@salesforce/platform-sdk` als **high**, beide ohne verfügbaren Fix
(`fixAvailable: false`). Sie stammen transitiv aus dem Salesforce-SDK, nicht aus
eigenem Code.

**Maßnahme:** Nicht behebbar. Als akzeptiert dokumentieren, damit `npm audit` nicht bei
jeder Routineaufgabe als neues Problem erscheint. Kein Handlungsbedarf am Code.

## A5. Positive Befunde, die keine Arbeit brauchen

Damit klar ist, was **nicht** angefasst werden muss:

- **Kein XSS-Senkenpfad:** kein `dangerouslySetInnerHTML`, kein `innerHTML`, kein `eval`
- **GraphQL-Injection:** `features/search/queryBuilder.ts` setzt ausschließlich Fragmente
  aus statischer Config zusammen; Suchbegriffe und Filterwerte gehen über den
  `variables`-Map, nicht in den Dokumenttext. `assertValidKey`
  (`adapters/sobject/queryFragment.ts:33`) erzwingt zusätzlich `^[A-Za-z_][A-Za-z0-9_]*$`
  auf jeden Source-Key, der als GraphQL-Alias in den Text wandert.
- **Kein Token-Handling im Client:** keine `accessToken`/`refreshToken`/`document.cookie`,
  kein `localStorage`-Secret. `localStorage` trägt nur Theme und die Actor-Selbstauskunft.
- **Apex-Sharing bewusst:** `StaffIdentity` ist `global with sharing` und liest genau eine
  Zeile. `ParticipantPortalSharingService` ist `without sharing` **mit dokumentierter
  Begründung** (administrative Infrastruktur). Trigger laufen in inherited sharing.
- **Keine dynamischen SOQL-Strings** in Klassen und Triggern — alle Abfragen sind
  statisch oder gebunden.

---

# Teil B — Refactor

## B1. Verschachtelter Dialog · 🔴 echter Bug, kein Refactor

`components/appointments/ParticipantAppointmentsTab.tsx:368-380` umhüllt
`<AppointmentFormDialog>` in einem zweiten `<Dialog><DialogContent>`, obwohl
`AppointmentFormDialog.tsx:139` selbst ein vollständiges `<Dialog>` rendert.

**Folge:** doppeltes Portal, doppelter Header („Termin anlegen" zweimal sichtbar),
doppelte Fokus-Falle für Screenreader.

**Fix:** den äußeren `<Dialog>`-Block ersetzen durch direktes Rendern von
`<AppointmentFormDialog>`. **Test:** `AppointmentFormDialog.test.tsx` existiert bereits und
muss grün bleiben; zusätzlich ein Assert, dass nur ein `DialogTitle` im Dokument steht.

## B2. Toter Code, zwei Stellen · 🔴

**`editingAppointment`** (`ParticipantAppointmentsTab.tsx:39`) wird nur zurückgesetzt,
nie gesetzt — `setEditingAppointment` erscheint ausschließlich in den Reset-Zeilen 368/375.
Der Dialog-Titel „Termin bearbeiten" ist unerreichbar.

**`SelectSlotDialog`** (`ParticipantAppointmentsTab.tsx:397-408`) wird gerendert, aber
`selectSlotFor` wird nirgends auf eine Appointment gesetzt (nur `setSelectSlotFor(null)` in
Zeile 151). Die vorgeschlagenen Slots sind Festwerte Januar 2026.

**Fix (empfohlen):** beides löschen, nicht verdrahten. Das Bearbeiten von Terminen ist eine
eigene Produktentscheidung, und die Terminfindung braucht den Datenweg aus B3. Beides zu
bauen, bevor die Produktfrage aus `ux-walkthrough.md` beantwortet ist, wäre Raten.

**Test:** Vitest-Snapshot des gerenderten Tabs — `screen.queryByText("Termin bearbeiten")`
muss null sein.

## B3. „3 Slots vorschlagen" verwirft zwei von drei · 🔴 Datenverlust

`handleProposeSlots` (`ParticipantAppointmentsTab.tsx:143`) ruft auf:
```ts
rescheduleAppointment(proposeSlotsFor.id, slots[0].startTime, slots[0].endTime, proposeSlotsFor.correlationId)
```
Der Dialog sammelt drei, es landet einer. Zusammen mit **A5-Befund 3** ist das der
einzige Punkt im Repo, der still falsche Daten schreibt.

**Fix:** kurzfristig `if (slots.length !== 1) return;` plus Fehlermeldung — der Button
verspricht dann das, was er liefert. Langfristig: Terminvindung (`Finding`-Status) sauber
modellieren, dann alle drei Sätze persistieren. Beides braucht eine Produktentscheidung
(siehe E2).

## B4. ISO-Datum-Bau ohne `validFrom` · 🔴 Datenqualität

`components/appointments/ProposeSlotsDialog.tsx:80-87`:
```ts
startTime: slot.validFrom ? `${slot.validFrom}T${slot.startTime}` : slot.startTime
```
Ohne `validFrom` entsteht der Wert `"09:00T10:00"` — kein ISO-Datum. Der Wert geht so in
die Mutation.

**Fix:** `dayOfWeek` + `validFrom` zu einem echten Datum auflösen (die Woche des
Termins berechnen, nicht raten) und den ISO-String durch `lib/datetime` bauen lassen. Es
gibt bereits einen Helfer: `src/lib/datetime`.

## B5. Fehlerkonvention uneinheitlich · 🟡

- `alert()` in `ProposeSlotsDialog.tsx:73,92` — der Rest der App nutzt `toast` (sonner)
- **deutsche UI, englische Meldungen:** `ParticipantPage.tsx:232` (`"Participant saved"`),
  `:239` (`"Saving failed"`), `OnboardingChecklist.tsx:104` (`Missing: …`)

**Fix:** `alert()` durch `toast` ersetzen, alle Meldungen auf Deutsch. Reiner Texttausch,
kein Verhaltensrisiko.

## B6. 16 ESLint-Warnungen, alle React-Hooks · 🟡

`eslint src` meldet 0 Fehler und 16 Warnungen, davon 6× `react-hooks/set-state-in-effect`
und 7× `react-hooks/exhaustive-deps`. Betroffene Dateien:

`features/search/hooks/useSearch.ts` (453 Zeilen, größte Warnungshäufung),
`ParticipantAbsencesTab.tsx:61`, `AvailabilitySlots.tsx:64`,
`ParticipantAppointmentsTab.tsx:94`, `ActivityTimeline.tsx:165`,
`ParticipantActivity.tsx:96`, `useSearchableContentTypes.ts:97`, `SearchBar.tsx:36`,
`NumericRangeFilter.tsx:44`, `TextFilter.tsx:34`, `useDistinctValues.tsx:32`,
`types/globals.d.ts:12` (ungenutzte Disable-Directive — per `--fix` lösbar)

**Wichtig:** `set-state-in-effect` ist **kein** Lint-Geräusch. Der Kommentar im ESLint-Output
beschreibt kaskadierende Re-Renders — in `useSearch.ts` eine 966-Zeilen-Datei, die bei jeder
Suche mehrfach rendert. Das ist ein Performance-Befund, kein Formalismus.

**Fix:** pro Datei einzeln, mit Test. `types/globals.d.ts:12` sofort per `--fix`.

## B7. Dublette Codebasis zwischen den Bundles · 🟡 Architektur-Entscheidung

Beide Bundles enthalten **23 identische** shadcn-Komponenten
(`alert`, `avatar`, `badge`, `breadcrumb`, `button`, `calendar`, `card`, `checkbox`,
`collapsible`, `datePicker`, `dialog`, `dropdown-menu`, `field`, `input`, `label`,
`pagination`, `popover`, `select`, `separator`, `skeleton`, `sonner`, `spinner`, `table`,
`tabs`) und ein **byte-identisches** `lib/utils.ts`.

**Warum das trotzdem eine Entscheidung ist und keine Fleißarbeit:** UI-Bundles werden
unabhängig voneinander deployt. Ein gemeinsames Paket bedeutet entweder einen Workspace über
beide SFDX-Projekte hinweg — was der Zweiprojekt-Struktur aus `CONTRIBUTING.md` widerspricht —
oder Vendor-Kopieren mit einem Skript, das den Drift überwacht.

**Empfehlung:** **nicht** jetzt angehen. Der Gewinn ist Wartungsaufwand, nicht Sicherheit,
und die Refactor-Kosten treffen den Deploy-Pfad. Als „bewusst dupliziert" in
`backend/docs/AGENTS.md` festhalten, damit es niemand später für einen Fund hält.

## B8. Versionsdrift des Salesforce-SDK · 🟡

Backend-Bundle auf `@salesforce/platform-sdk` **^11.57.2**, Frontend-Bundle auf **^12.4.5** —
ein Major-Unterschied zwischen zwei Bundles, die in dieselbe Org deployen.

Das ist kein akutes Risiko (kein geteilter Bundle-Zustand), aber eine stille
Kompatibilitätsfalle. **Fix:** Upgrade des Backend-Bundles auf 12.x in einem eigenen
Commit mit Build- und Testlauf. Nicht mit einem Refactoring vermischen.

---

# Teil C — Qualitätssicherung

| Punkt | Maßnahme | Aufwand |
|---|---|---|
| C1 Keine Test-Coverage konfiguriert | Vitest-Coverage an (`@vitest/coverage-v8`) und Schwelle setzen, z. B. 60 % Lines für `api/` | S |
| C2 Frontend-Testlücke | Tests für `isValidRedirect`, CSRF-Verarbeitung, Session-Timeout (siehe A3) | M |
| C3 `sessionTimeoutConfig.ts` englische Labels in deutscher App | `LABELS` übersetzen | XS |
| C4 Kein `aria-busy` auf Loading-Containern | 8 Stellen, aus dem alten Plan übernommen | S |

---

# Reihenfolge

Jedes Paket ist einzeln commitbar und einzeln verifizierbar. Reihenfolge nach
Nutzen/Weg-Risiko, nicht nach Aufwand.

| # | Paket | Warum zuerst | Risiko | Aufwand |
|---|---|---|---|---|
| 1 | **B1** verschachtelter Dialog | sichtbarer UI-Bug | niedrig | XS |
| 2 | **B4** ISO-Datum | schreibt falsche Daten in die Mutation | niedrig | S |
| 3 | **B5** Fehlerkonvention | reiner Text, sofort konsistent | minimal | XS |
| 4 | **B2** toter Code löschen | entfernt irreführende UI-Zweige | niedrig | S |
| 5 | **B3a** `slots[0]` absichern | Datenverlust stoppen | niedrig | XS |
| 6 | **C3** + **B6** Lint-Directive | billigste Hygiene | minimal | XS |
| 7 | **A2** Permission-Sets kommentieren | verhindert Fehlvergabe | keiner | XS |
| 8 | **C2** Frontend-Sicherheitstests | schützt A3 ab | niedrig | M |
| 9 | **B3b** Terminfindung sauber | braucht E2-Entscheidung | mittel | M |
| 10 | **B6** restliche Hook-Warnungen | Performance in `useSearch.ts` | mittel | M |
| 11 | **B8** SDK-Upgrade | Versionsdrift | mittel | M |
| 12 | **C1** Coverage-Gate | verhindert Rückfall | niedrig | S |

**Nach Paket 8 ist der Code in einem Zustand, in dem die offenen Produktfragen sinnvoll
entscheidbar sind.** Paket 9+ ist Feature-Arbeit mit Testschutz, keine Aufräumarbeit mehr.

---

# Entscheidungen, die vorher fallen müssen

**E1 — Berechtigungsmodell (A1).** Sieht ein Coach alle Teilnehmer der Org oder nur seine
eigenen? Das ist die größte offene Sicherheitsfrage und sie entscheidet, ob Priorität 0 des
`next-steps-plan.md` im UI oder in der Datenebene gelöst wird. **ORG-Zugriff nötig.**
Vorschlag: als Entscheidung dokumentieren, C umsetzen sobald das Feld aus P0 steht.

**E2 — Terminfindung (B3).** Reichen dem Coach drei Vorschläge plus Teilnehmer-Auswahl, oder
verschiebt er direkt? Die Antwort entscheidet, ob B3b gebaut oder der Datenpfad für
Terminfinding geschlossen wird.

**E3 — geteiltes Paket (B7).** Bewusst dupliziert lassen und dokumentieren, oder
Monorepo-Struktur ändern? Empfehlung: dupliziert lassen.

**E4 — Testschwelle (C1).** Welche Coverage-Zahl wird zur Bremse? Vorschlag: 60 % für `api/`,
keine globale Schwelle, bis die Lücke im Portal geschlossen ist.

---

# Was dieser Plan nicht enthält

- **Kein Apex-Refactor.** 4 Produktivklassen und 3 Trigger sind klein, dokumentiert und
  ohne Befund. Anzufassen wäre Activity ohne Erkenntnis.
- **Keine Änderung am `without sharing` in `ParticipantPortalSharingService`.** Die
  Begründung steht im Code und ist tragfähig.
- **Kein Umbau der Sucharchitektur.** `useSearch.ts` hat echte Warnungen, ist aber funktional
  und getestet — B6 reicht.
- **Keine Performance-Messung ohne Baseline.** Paket 10 behandelt die Warnungen, nicht
  Bundle-Größe; das bleibt Priorität 4 des `next-steps-plan.md`.