# Plan: Produktreife & Nutzerfluss (Post Phase 0-6)

## Übersicht

Phase 0-6 der Portal-Entwicklung ist abgeschlossen. Der Fokus liegt jetzt auf
Produktreife, UX-Vollständigkeit und Performance.

Dieses Dokument ist eine **Fortschreibung**, kein Neustart. Beim Überarbeiten am
2026-10-06 wurde jede Priorität gegen den tatsächlichen Code geprüft (nicht gegen
den Text dieses Plans). Ergebnis: **4 der 7 Prioritäten sind teilweise oder ganz
erledigt, obwohl sie hier noch als offen stehen.** Die Liste unten ist deshalb neu
gewichtet, nicht nur umformuliert.

## Legende

- ✅ erledigt
- 🟡 teilweise erledigt, Rest ist konkret
- ⬜ offen, Arbeit steht aus
- ⚠️ Widerspruch zum alten Plan, siehe "Korrekturen"

---

## Priorität 0 — Contact-Freigabe: Vertrieb gibt Contact frei, Coach macht daraus einen Teilnehmer

**Zieltermin: 31.10.2026.** Diese Funktion hat Vorrang vor allen anderen Prioritäten.

### Was der Nutzer will

1. Im normalen Salesforce-UI den Contact **freigeben** (Flag setzen).
2. Er erscheint daraufhin für Coaches im Backend-UI.
3. Der Coach **wandelt ihn in einen Teilnehmer um** (Programm, Coach, Daten).

### Gute Nachricht: ~80 % existieren bereits

Der Convert-Pfad ist nicht neu zu bauen, er ist schon da und getestet:

| Baustein | Status | Fundstelle |
|---|---|---|
| Contact-Übersicht im Backend | ✅ | `src/pages/ContactPage.tsx`, `src/components/contacts/ContactTable.tsx` |
| Spalte „Teilnehmer" (zeigst schon umgewandelt) | ✅ | `Contact.participantId`/`participantName` in `src/types/contact.ts` |
| „Als Teilnehmer anlegen"-Aktion | ✅ | `ContactPage.tsx:64` `openDialog()` |
| Dialog mit Programm/Coach/Daten | ✅ | `CreateParticipantDialog.tsx` |
| Mutation `CreateParticipant` | ✅ | `src/api/participant/query/CreateParticipant.graphql` |
| 1:1-Schutz Contact ↔ Participant | ✅ | `ParticipantContactUniqueness.trigger` |
| Ableitung Name/E-Mail aus Contact | ✅ | ADR-001, `Participant__c.Email__c` ist Snapshot |

**Es fehlt genau eine Sache: das Freigabe-Flag.** Und das ist der Teil, der
Salesforce-B Know-how braucht, nicht TypeScript.

### Zu bauen

1. **Feld `Academy_Released__c` (Checkbox) auf Contact.**
   ⚠️ **Nicht per Deploy.** Laut Repo-Regel manuell in Setup anlegen, dann
   `sf project retrieve start --metadata CustomField:Contact.Academy_Released__c`.
   Grund: ein per Deploy erzeugtes Feld landet nicht zuverlässig im Runtime-Schema.
2. **Feld in den Permission Sets freigeben.** Ohne `<fieldPermissions>` ist das
   Feld für Backend-User unsichtbar und die GraphQL-Query bricht. Read-only für
   `backend_Access` und `backend_Coach` — gesetzt wird die Freigabe im
   Salesforce-Classic-UI durch den Vertrieb, nicht durchs Backend.
3. **Query erweitern:** `ListContacts.graphql` selektiert das Feld.
4. **Sichtbarkeit:** Coaches sehen standardmäßig **nur freigegebene** Contacts
   (Filter in der Query, nicht clientseitig). Optional ein Schalter
   „alle anzeigen" für staff.
5. **Guard:** Aktion „Als Teilnehmer anlegen" ist bei nicht freigegebenen
   Contacts deaktiviert, mit Tooltip „Noch nicht freigegeben".
6. **Spalte „Freigegeben"** in `ContactTable` (Checkbox-Icon ja/nein).
7. **`schema:check`** + Apex-Tests + Doku (`DATA_MODEL.md`, AGENTS.md).

### Wochenplan bis 31.10.

| KW | Datum | Inhalt | Abhängigkeit |
|---|---|---|---|
| 41 | 06.–10.10. | Feld in Setup anlegen, retrieve, Permsets, `schema:check` | Org-Zugriff |
| 41 | 10.10. | Query + Types + Spalte + Guard | Feld existiert |
| 42 | 12.–16.10. | Filterung, Tests (270er-Suite erweitern), Doku | |
| 43 | 19.–23.10. | Buffer, Live-Test in der Org, Abnahme mit einem Coach | |
| 44 | 26.–30.10. | Puffer für Schema-Nachzieher, Bugfixes | |

**Kritischer Pfad:** Schritt 1 ist manuell. Wenn das Feld nicht bis **10.10.** steht,
verschiebt sich alles. Das ist der einzige Punkt, der nicht am Code hängt.

### Bewusst nicht in dieser Funktion

- **Portalzugang** — folgt automatisch über die bestehende Membership-Logik
  (Phase 2/3), ist aber ein eigener Schritt. Erst klären, ob *jeder* umgewandelte
  Contact Portalzugang bekommt oder nur ausgewählte.
- **Rückzug** (Coach nimmt Freigabe zurück) — braucht einen Filter „nur noch nicht
  umgewandelte freigegebene Contacts", sonst sieht man bereits Erledigtes.

### Offene Entscheidungen

- **Checkbox oder Picklist?** Checkbox ist das Minimum. Ein Picklist
  (`Interesse → Angemeldet → Freigegeben → Abgelehnt`) gibt dem Vertrieb mehr
  Führung, kostet aber UI in beiden Apps. Entscheidung nötig.
- **Wer darf das Flag setzen?** Nur Vertrieb (Classic) oder auch staff im Backend?
- **Sichtbarkeit:** nur freigegebene Contacts hart filtern oder alle zeigen und
  die nicht freigegebenen ausgrauen?

---

## Korrekturen am alten Plan (Prüfung 2026-10-06)

Diese Punkte widersprachen dem Code. Wer sie nicht korrigiert, arbeitet an
erledigten Dingen:

1. **Design-System-Statusfarben existieren bereits.** `src/styles/global.css:115-120`
   definiert `--success`, `--warning`, `--info` (inkl. Dark-Mode-Varianten ab Zeile 156),
   und `src/components/ui/badge.tsx:17-20` hat bereits die Varianten `success` und
   `warning`. Offen ist nur die **Dokumentation** und die Zuordnung Status → Variante.
2. **Mobile Navigation ist gebaut.** `src/appLayout.tsx` hat Hamburger (Zeile 99),
   Overlay (Zeile 144) und Off-Canvas-Aside (Zeile 148); `src/pages/ParticipantPage.tsx:294`
   hat einen `lg:hidden`-Bereich für den Teilnehmer-Selektor. Priorität 3 ist damit
   größerteils erledigt.
3. **Der Layout-Dateiname stimmt nicht mehr.** Der Plan nennt
   `src/components/layout/AppLayout.tsx` — die Datei liegt jetzt in `src/appLayout.tsx`.
4. **`ParticipantActivity` hat States.** Die alte Tabelle führt sie mit ❌/❌/❌.
   Tatsächlich: `role="status"` in `src/components/participants/ParticipantActivity.tsx:195`,
   Ladeindikator vorhanden. Die offene Frage ist nur der Empty-State.
5. **A11y ist teilweise da.** `aria-live="polite"` in `sonner.tsx:17`,
   `MergedSearchResults.tsx:120`, `SourceSection.tsx:80`,
   `ActivityEventDetailsDrawer.tsx:262`, `role="status"` in `ActivityTimeline.tsx:226`.
   Offen sind Skip-Link und `aria-busy`.
6. **`dist/` ist nicht im Git.** `git ls-files | grep dist/` liefert 0 Treffer.
   Phase-6-Punkt 6.6 ist erledigt.
7. **Teststand ist grün:** 35 Testdateien, **270/270 Tests grün** (3,3 s).

---

## Priorität 1 — UX-Walkthrough neu erheben (höchste Priorität)

✅ **Erledigt am 2026-10-06.** `backend/docs/ux-walkthrough.md` steht auf v2.0:
8 von 13 behaupteten Lücken sind erledigt, 5 offen, 6 neue Defekte dokumentiert
(u. a. verschachtelter Dialog und „3 Slots vorschlagen" nutzt nur `slots[0]`).

**Warum zuerst:** `backend/docs/ux-walkthrough.md` ist vom **2026-09-28** und
beschreibt Lücken, die seitdem teilweise geschlossen wurden. Das Dokument behauptet
z. B. "Kein *Neuer Teilnehmer*-Button im UI", "Kein Onboarding-Flow", "kein Toast-Feedback".
Ob das noch gilt, ist unbelegt. **Jede nachfolgende Priorität hängt an dieser Frage.**

### Schritte
1. ✅ Bestehenden Walkthrough gegen den aktuellen Code geprüft, Zeile für Zeile.
2. ✅ Verbleibende Lücken nach **Produktnutzen** priorisiert (siehe v2.0, Abschnitt
   „Nächste Schritte").
3. ✅ Dokument auf Version 2.0 gehoben, mit Spalte „Status seit 2026-09-28" und Belegen.

### Ergebnis
- **Größte offene Lücke:** Konflikt-Check (`grep -ri conflict src/` → null Treffer).
- **Billigster Hebel:** die 6 in v2.0 dokumentierten 🔴-Defekte, zwei davon
  (`slots[0]`, ISO-Datum ohne `validFrom`) erzeugen falsche Daten.
- Neu im Plan fehlend und daher als **Priorität 1a** zu behandeln: Defektliste abarbeiten.

### Entscheidungsbedarf (aus v2.0)
- **Anlegepfad:** Contact-Flow bleibt einziger Weg, oder kommt ein Button ins Backoffice?
- **Terminfindung:** drei Vorschläge + Teilnehmer-Auswahl als Zielzustand — das
  entscheidet, ob `SelectSlotDialog` verdrahtet oder gelöscht wird (er ist toter Code).
- **Konflikt-Check:** Warnung, Alternativen oder harte Blockade?

### Dateien
- `backend/docs/ux-walkthrough.md`

---

## Priorität 2 — Loading-/Error-/Empty-States abschließen

Korrigierte Tabelle (Stand 2026-10-06):

| Komponente | Loading | Error | Empty |
|------------|---------|-------|-------|
| ParticipantListCard | ✅ | ✅ | ✅ |
| ParticipantSummaryCard | ✅ | ✅ `Alert` | ⬜ fehlt |
| ActivityTimeline | ✅ `Skeleton` | ✅ `role="status"` | ⬜ prüfen |
| ParticipantActivity | ✅ | ✅ `role="status"` | ⬜ prüfen |
| AvailabilitySlots | ✅ | ⚠️ Toast | ✅ |
| ParticipantAppointmentsTab | ✅ | ⚠️ Toast | ✅ |
| ParticipantAbsencesTab | ✅ | ⚠️ Toast | ⚠️ Custom |
| ParticipantLearningPath | ✅ | ✅ | ⚠️ Custom |

`EmptyState` liegt in `src/components/ui/empty-state.tsx` und wird aktuell von
`ParticipantListCard`, `AvailabilitySlots`, `ParticipantAppointmentsTab`,
`ContactTable` und `ContactDetailCard` benutzt.

### Schritte
1. `ParticipantSummaryCard` — `EmptyState` ergänzen
2. `ActivityTimeline` / `ParticipantActivity` — leerer Fall klären
3. AbsencesTab, LearningPath — Custom-Empty durch `EmptyState` ersetzen
4. Toast → Inline-Alert **ergänzen**, nicht ersetzen (Toast bleibt für Mutation-Feedback)

---

## Priorität 3 — Responsive verifizieren (Restarbeiten)

Der Code ist fertig, der Nachweis fehlt. Priorität 3 ist damit kein Bau-, sondern ein
**Test-Thema**, und damit billiger als sie aussieht.

### Schritte
1. Breakpoint-Test 1024 / 1280 / 1366 / 1440 px dokumentieren
2. Tab-Overflow prüfen (kein `overflow-x-auto` im Code gefunden)
3. Container-Check: 1600 px Container + 256 px Sidebar (`w-64`)
4. Ergebnis als Checkliste in `backend/docs/ux-walkthrough.md` ablegen

**Fallen beachten:** Pfade sind `src/components/appointments/` und
`src/components/absences/`, nicht `participants/`. Layout liegt in `src/appLayout.tsx`.

---

## Priorität 4 — Performance (nur Index-Chunk)

Route-Splitting ist gebaut: `lazy` + `Suspense` über 11 Routen, Vendor-Chunks getrennt
(`vendor-react`, `vendor-radix`, `vendor-date`, `vendor-icons`), `ActivityEventDetailsDrawer`
ebenfalls lazy.

Offen ist **eine** Messung: der 492K-Index-Chunk.

### Schritte
1. `rollup-plugin-visualizer` einbauen
2. Sichtbar machen, was den Index-Chunk aufbläht
3. `ParticipantPage` (196K) prüfen — ist die Route zu breit?
4. React-Query: `staleTime` / `cacheTime` auf Plausibilität prüfen

### Dateien
- `vite.config.ts`, `src/routes.tsx`

---

## Priorität 5 — Design System dokumentieren (Code ist fertig)

Priorität 5 ist zu ~80 % erledigt. Es fehlt Dokumentation, nicht Code.

### Schritte
1. Status → Badge-Varianten als Tabelle festhalten (draft/confirmed/cancelled → `default`/`success`/`warning`/`destructive`)
2. Icon-Konvention: Calendar=Termine, Clock=Verfügbarkeit, User=Teilnehmer, MapPin=Ort
3. Animation-Tokens (Duration, Easing) und Z-Index-Skala (Modal, Dropdown, Toast, Sticky)
4. Dark-Mode-Werte der Statusfarben mit dokumentieren

### Dateien
- `backend/docs/design-system.md`, `src/styles/global.css`

---

## Priorität 6 — A11y-Rest (klein)

`aria-live` und `role="status"` sind bereits verbreitet. Was fehlt:

1. Skip-to-Content-Link in `src/appLayout.tsx`
2. `aria-busy` auf Loading-Containern
3. Tab-Reihenfolge verifizieren: Sidebar → Teilnehmer → Tabs → Aktionen
4. Escape/Enter/Space in Dialogen, Dropdowns, Drawern prüfen

---

## Priorität 7 — Aufräumen (billig, vor RC1 erledigen)

> Ergänzung 2026-10-06: der Refactor-/Sicherheitscheck über den Gesamtbestand liegt in
> [`refactor-security-plan.md`](./refactor-security-plan.md). Er ist nach Produktnutzen
> sortiert und dieser Plan sollte sich daran ausrichten, nicht umgekehrt.

Aus der alten Phase-6-Liste, zwei Punkte sind noch offen:

1. **Schema-Drift:** `backend/docs/migrations/2026-09-appointment-staff-backup.csv`
   referenziert `Appointment__c.Staff__c` und `Staff__r.Name`. Das Feld existiert
   nicht — im Source liegt nur `Coach__c`. Die CSV ist irreführend.
   → Backup umbenennen auf `...-coach-backup.csv` und Spalten korrigieren.
2. `Student_Test__c` in Scratch-Rest prüfen/löschen (Phase 6.4)

---

## Priorität 8 — RC1

RC-Checkliste:
- [ ] Build erfolgreich
- [ ] Lint 0 Fehler
- [ ] Vitest grün (aktuell 270/270)
- [ ] Apex grün (`sf apex run test`)
- [ ] Responsive 1024–1440 px geprüft
- [ ] A11y geprüft
- [ ] Dark Mode geprüft
- [ ] Chrome, Edge, Firefox
- [ ] UX-Walkthrough auf Version 2.0
- [ ] Dokumentation aktualisiert

Danach: RC1 taggen, 2–3 reale Nutzer, Feedback priorisieren.

---

## Strategische Initiativen (unverändert, weiterhin offen)

### Shepherd.js Tutorials
Evaluierung → Tutorial-Standards → Pilot-Tutorials → Feedback-Runde → Rollout.

### Vollständiges Activity-Tracking (sehr hoch)
Aktueller Stand laut Plan: 8 Kategorien, 5 Audiences, 40+ Event-Typen.
Zu prüfen: Termine, Abwesenheiten, Genehmigungen, Statusänderungen — werden die
Benachrichtigungen korrekt ausgelöst, ist der Feed konsistent zur Datenquelle?
Bezug: `backend/docs/activity-coverage.md`.

**Hinweis:** Activity-Tracking berührt Salesforce-Metadaten (Backend-Ownership) und ist
damit deutlich größer als der UI-Polish — eigener Planungszyklus.

---

## Empfohlene Reihenfolge

```text
0  Contact-Freigabe                ← NEU, Zieltermin 31.10., zieht alles vor
1  UX-Walkthrough neu erheben      ← entscheidet, ob 2-6 überhaupt nötig sind
2  Design System dokumentieren     ← billig, Code steht
3  Loading/Empty-States            ← konkrete, kleine Lücken
4  Responsive verifizieren         ← Test, kein Bau
5  Aufräumen (CSV-Drift, Scratch) ← trivial
6  A11y-Rest                       ← klein
7  Performance (Index-Chunk)       ← erst messen, dann bauen
8  RC1
```

Die Reihenfolge ist gegenüber dem alten Plan bewusst umgedreht: **erst messen und
dokumentieren, dann bauen.** Der alte Plan hat sechs Themen parallel offen gehalten;
drei davon (Design System, Mobile, A11y) waren bereits fertig, ohne dass es jemand
merkte.

**Ab 06.10. gilt aber:** Priorität 0 hat Vorrang. Alles aus 1–8 läuft in der Zeit,
die Priority 0 übrig lässt. RC1 ist ohne Priorität 0 sinnlos, weil die Kernfunktion
der Produktidee dann fehlt.

---

## Noch offene Fragen für den Product Owner

**Beantwortet am 2026-10-06:**
- Wer legt Teilnehmer an → **Vertrieb gibt den Contact im Salesforce-UI frei, der Coach
  wandelt ihn im Backend um.** Siehe Priorität 0.
- Zieltermin → **Ende Oktober** für die Contact-Freigabe. RC1 bleibt undatiert.

**Weiterhin offen:**
1. **Checkbox oder Picklist** für das Freigabe-Flag (siehe Priorität 0)?
2. **Nur freigegebene Contacts zeigen** oder alle mit ausgegrauten? (Betrifft UX-Walkthrough-Punkt 1 direkt — die alte Notiz "kein *Neuer Teilnehmer*-Button" löst sich mit Priorität 0 auf.)
3. **Termin-Konflikt-Check** — Feature oder für Phase 2 der Produktplanung?
4. Bekommt **jeder** umgewandelte Contact automatisch Portalzugang, oder nur ausgewählte?
5. Welche der strategischen Initiativen hat Vorrang: Shepherd.js-Tutorials oder Activity-Tracking?
