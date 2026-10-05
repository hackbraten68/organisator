# UX-Walkthrough: Organisator Teilnehmerbereich

**Datum:** 2026-09-28 (v1.0) · **Geprüft:** 2026-10-06 (v2.0)
**Scope:** Kompletter Anwenderfluss durch den Teilnehmerbereich

> **v2.0 ist eine Verifikation, kein neuer Durchlauf.** Jede Behauptung aus v1.0 wurde
> gegen den Code in `backend/force-app/main/default/uiBundles/backend/src` geprüft, nicht
> gegen die v1.0-Notizen. Ergebnis: **8 der 13 behaupteten UX-Lücken sind erledigt**,
> **5 sind offen**, und **6 neue Befunde** kamen dazu, die v1.0 nicht sehen konnte.
>
> Prüfpfad für die Spalte „Beleg": Datei und Zeile, wo der Zustand tatsächlich steht.
> Alles ohne Beleg in diesem Dokument ist eine Behauptung, kein Nachweis.

**Legende:** ✅ erledigt seit 2026-09-28 · ⬜ weiterhin offen · 🔴 neu (Defekt, kein Feature)

---

## 1. Teilnehmer anlegen

### Status: ✅ erledigt

Die v1.0-Aussage „Kein *Neuer Teilnehmer*-Button im UI" ist falsch. Der Weg ist der
**Contact-zuerst-Flow**, er ist bewusst so gebaut (ADR-001: Name und E-Mail werden auf dem
Contact gepflegt, der Teilnehmer ist eine Rolle darüber).

| Baustein | Beleg |
|---|---|
| Contact-Übersicht | `src/pages/ContactPage.tsx` |
| „Als Teilnehmer anlegen" in der Tabelle | `src/components/contacts/ContactTable.tsx:164` |
| „Als Teilnehmer anlegen" in der Detailkarte | `src/components/contacts/ContactDetailCard.tsx:120` |
| Dialog mit Programm/Coach/Daten | `src/components/contacts/CreateParticipantDialog.tsx` |
| Mutation | `src/api/participant/query/CreateParticipant.graphql` |

**Verbleibende Frage (Produkt, nicht Code):** Im *Teilnehmerbereich* gibt es weiterhin
keinen Anlege-Knopf — der Einstieg liegt nur auf der Contact-Seite. Das ist konsistent,
sollte aber bewusst entschieden werden (siehe „Offene Produktfragen").

**Neu (v2.0):** Freigabe-Filter fehlt. Coaches sehen alle Contacts, nicht nur die vom
Vertrieb freigegebenen. Siehe Priorität 0 im `next-steps-plan.md`.

---

## 2. Onboarding durchführen

### Status: 🟡 teilweise — Struktur steht, Feedback und Sprache nicht

| v1.0-Behauptung | Status | Beleg |
|---|---|---|
| Kein Edit-Modus | ✅ | `ParticipantSummaryCard.tsx` — Button „Bearbeiten"/„Fertig" (`onToggleEdit`) |
| Kein Speichern | ✅ | `ParticipantPage.tsx:216` `handleSave()` → `updateParticipant`, Sticky-Header `onSave` (Zeile 325) |
| Kein Fortschritts-Badge | ✅ | `OnboardingBadge.tsx`, eingebunden in `ParticipantChecklist`/`OnboardingChecklist.tsx:73` **und** `ParticipantListCard.tsx:205` |
| Kein Live-Fortschritt | ✅ | `OnboardingChecklist` rechnet aus dem editierbaren Teilnehmer-Objekt, Checkmarks reagieren während des Editierens |
| Kein Auto-Save | ⬜ | weiterhin manuelles Speichern — bewusste Entscheidung, kein Defekt |
| Kein Tooltip/Erklärung der Felder | ⬜ | nur bei E-Mail steht ein Hilfetext; Programm/Coach/GitHub/Discord stehen ohne Erklärung |
| Kein „Onboarding abgeschlossen"-Feedback | ⬜ | `ParticipantPage.tsx:232` toastet „Participant saved" — aber unabhängig vom Fertig-Werden. Es gibt kein Signal „Ready erreicht". |

**Neu (v2.0) — 🔴 Sprachbruch:** Die UI ist deutsch, zwei Stellen sind englisch:
- `ParticipantPage.tsx:232` / `:239` — `toast.success("Participant saved")`, `toast.error("Saving failed")`
- `OnboardingChecklist.tsx:104` — `Missing: Program, Coach` (Labels selbst sind deutsch)

---

## 3. Termin planen

### Status: 🟡 teilweise — Knopf und Formular da, Konfliktprüfung fehlt komplett

| v1.0-Behauptung | Status | Beleg |
|---|---|---|
| Kein „Neuer Termin"-Button | ✅ | `ParticipantAppointmentsTab.tsx` — „Termin anlegen", plus EmptyState-Aktion |
| Kein Feedback | ✅ | `toast.success("Termin erstellt")`, Fehlerzweig inkl. `console.error` (`handleCreate`) |
| Kein Slot-Vorschlag | ✅ | `ProposeSlotsDialog.tsx`, „3 Terminvorschläge für {Typ}" |
| Keine Typ-Erklärung | 🟡 | Typen sind fest im Code, keine Description im UI (`appointmentTypes` in `ParticipantAppointmentsTab.tsx`) |
| Kein Konflikt-Check | ⬜ | `grep -ri conflict src/` liefert **null Treffer**. Doppelbuchung ist ungeprüft |
| Kein Auto-Fill Coach | ⬜ | Formular startet mit `coachId = ""` (`AppointmentFormDialog.tsx:53`) |

**Neu (v2.0) — 🔴 zwei Defekte in derselben Datei:**

1. **Verschachtelter Dialog.** `ParticipantAppointmentsTab.tsx:368-380` umhüllt
   `<AppointmentFormDialog>` in einem eigenen `<Dialog><DialogContent>`, während
   `AppointmentFormDialog.tsx:139` selbst ein vollständiges `<Dialog>` rendert.
   Ergebnis: doppelter Portal, doppelter Header („Termin anlegen" zweimal),
   doppelte Fokus-Falle. Der äußere Dialog muss weg.
2. **„3 Slots vorschlagen" verschluckt 2 von 3.** `handleProposeSlots`
   (`ParticipantAppointmentsTab.tsx:143`) ruft `rescheduleAppointment(..., slots[0].startTime, slots[0].endTime, ...)` auf.
   Der Dialog verlangt und sammelt drei Slots, es landet einer. Entweder
   `slots[0]` korrekt auf `slots.length === 1` umstellen oder den Datenweg für
   Terminfindung (`status: Finding`) bauen.
3. **`alert()` statt Toast.** `ProposeSlotsDialog.tsx:73` und `:92` nutzen `alert()`
   für Validierung und Fehler — der Rest der App nutzt `toast`.

**Neu (v2.0) — 🔴 toter Code:** `SelectSlotDialog` wird in
`ParticipantAppointmentsTab.tsx:397-408` gerendert, aber `selectSlotFor` wird nirgends
gesetzt (`setSelectSlotFor` erscheint nur in der Reset-Zeile 151). Die vorgeschlagenen
Slots sind Festwerte aus Januar 2026 (Zeilen 400-403). Entweder an den
Finding-Status hängen oder entfernen.

**Neu (v2.0) — 🔴 „Termin bearbeiten" ist toter Weg:** `editingAppointment` wird nur
zurückgesetzt, nie gesetzt (`setEditingAppointment` in Zeilen 368/375). Der Titel
„Termin bearbeiten" im Dialog ist damit unerreichbar.

---

## 4. Termin verschieben

### Status: 🟡 teilweise — Fluss existiert, weicht aber vom Dokument ab

Der Weg „Dropdown → Verschieben → Formular mit Vorbelegung" ist **nicht** der
implementierte. Implementiert ist: `handleReschedule` (`ParticipantAppointmentsTab.tsx:133`)
öffnet direkt `ProposeSlotsDialog` mit den Slots des Coachs. Das ist funktional besser
als das Dokument annahm — aber die drei vorgeschlagenen Termine sind oben beschrieben
verloren.

| v1.0-Behauptung | Status | Beleg |
|---|---|---|
| Kein Slot-Vorschlag | ✅ | siehe 3. |
| Keine Historie der Verschiebungen | ✅ | `api/audit/appointmentAuditIntegration.ts:81` `recordAppointmentRescheduled`, sichtbar im `ActivityTimeline` |
| Kein Konflikt-Hinweis | ⬜ | siehe 3., kein Konfliktcode im Repo |
| Kein Grund für die Verschiebung | ⬜ | `reason` existiert im Audit-Interface (`RescheduleReason`), wird aber vom UI nicht erfragt |
| Kein Drag & Drop | ⬜ | echtes Feature, keine Abkürzung |

---

## 5. Termin abschließen

### Status: 🟡 teilweise — Aktionen und Anwesenheit da, Bestätigung fehlt

| v1.0-Behauptung | Status | Beleg |
|---|---|---|
| Kein Feedback nach Abschluss | ✅ | `handleComplete` / `handleConfirm` / `handleNoShow` → jeweils `toast.success(...)` |
| Keine Anwesenheit | ✅ | `updateAppointmentAttendance(id, "NoShow")`, Status `NoShow` in der Filterliste |
| Keine Notizen | ✅ | `AppointmentFormDialog.tsx` hat ein Notizen-Feld |
| Keine Bestätigung vor dem Abschluss | ⬜ | `handleComplete` ruft direkt auf. `AlertDialog` existiert (`components/ui/alert-dialog.tsx`) und wird nur in `AbsenceApprovalActions.tsx` benutzt — die Lücke ist also billig zu schließen |
| Was passiert danach? | ⬜ | Statusübergang zu `Documented` ist nicht im UI erklärt |

---

## 6. Verfügbarkeiten pflegen

### Status: 🟡 teilweise — Felder da, „Kalender" ist eine Liste

| v1.0-Behauptung | Status | Beleg |
|---|---|---|
| Kein „Gültig bis" | ✅ | `validFrom`/`validTo` im Formular (`AvailabilitySlots.tsx:368-379`), Anzeige in Zeile 256-258 |
| Keine Wochenübersicht | 🟡 | Gruppierung nach Wochentag existiert, aber als Kartenliste, nicht als Wochenraster. `ProposeSlotsDialog` gruppiert nach `dayOfWeek` |
| Kein Bulk-Edit | ⬜ | bestätigt, kein Kopier-Pfad |
| Kein Standard-Slot je Wochentag | ⬜ | nicht vorhanden |

**Neu (v2.0) — 🔴:** `ProposeSlotsDialog` baut den Zeitstempel aus
`slot.validFrom ? \`${slot.validFrom}T${slot.startTime}\` : slot.startTime`
(`ProposeSlotsDialog.tsx:80-87`). Ohne `validFrom` entsteht der Wert
`"09:00T10:00"` statt eines ISO-Datums — der Mutation-Aufruf bekommt dann Müll.

---

## 7. Teilnehmer auf „Ready" setzen

### Status: 🟡 teilweise — technisch vorhanden, unsichtbar

| v1.0-Behauptung | Status | Beleg |
|---|---|---|
| Kein Ready-Badge in der Liste | ✅ | `ParticipantListCard.tsx:205` |
| Checkliste verschwindet | ✅ | `OnboardingChecklist.tsx` — `if (completion.state === "ready") return null` |
| Kein Abschluss-Feedback | ⬜ | siehe 2. |
| Kein Zeitstempel des Abschlusses | ⬜ | nicht erfasst |
| Ready zurücksetzen | ⬜ | nur durch Leeren der vier Felder |

---

## Zusammenfassung

### Was sich seit v1.0 geändert hat

| # | v1.0-Befund | Status 2026-10-06 |
|---|---|---|
| 1 | Kein „Teilnehmer anlegen" im UI | ✅ erledigt (Contact-Flow) |
| 2 | Kein Slot-Vorschlag | ✅ erledigt, aber Datenverlust (siehe 3.) |
| 3 | Kein Konflikt-Check bei Terminbuchung | ⬜ offen, **größter offener Produktfehler** |
| 4 | Kein Auto-Save bei Onboarding | ⬜ offen, bewusste Entscheidung |
| 5 | Kein Toast-Feedback bei Statusänderungen | ✅ erledigt |
| 6 | Kein Bulk-Edit bei Verfügbarkeiten | ⬜ offen |
| 7 | Kein Wochen-Kalender für Verfügbarkeiten | 🟡 als Wochentagsliste vorhanden |
| 8 | Kein „Onboarding abgeschlossen"-Feedback | ⬜ offen |
| 9 | Tooltips für Onboarding-Felder fehlen | ⬜ offen |
| 10 | Keine Erklärung der Termin-Typen | 🟡 Typen vorhanden, ohne Description |
| 11 | Keine Erklärung der Orte | ⬜ offen |
| 12 | Keine Historie bei Verschiebungen | ✅ erledigt (Audit-Timeline) |
| 13 | Keine Anwesenheitserfassung | ✅ erledigt |

### 🔴 Neue Defekte aus der Verifikation (alle vor v2.0)

Diese sechs stehen in **keinem** alten Dokument, weil sie keine UX-Lücken sind,
sondern Fehler:

1. **Verschachtelter Dialog** beim Termin-Formular — `ParticipantAppointmentsTab.tsx:368`
2. **`editingAppointment` wird nie gesetzt** — „Termin bearbeiten" unerreichbar
3. **`SelectSlotDialog` ist toter Code** mit Festwerten als Januar-2026-Daten
4. **„3 Slots vorschlagen" nutzt nur `slots[0]`** — zwei von drei Vorschlägen gehen verloren
5. **ISO-Datum-Bau ohne `validFrom`** in `ProposeSlotsDialog.tsx:80` — Ergebnis `"09:00T10:00"`
6. **Sprachbruch** in Toasts und Checkliste (deutsche UI, englische Meldungen)

### Klick-Statistik (unverändert gültig, keine Klickbilder verfügbar)

| Flow | Klicks | Kontextwechsel | geändert seit v1.0 |
|---|---|---|---|
| Teilnehmer anlegen | 3-4 | 1 | ja — Contact-Seite + Dialog |
| Onboarding | 7-9 | 0 | nein |
| Termin planen | 10-13 | 1 | nein |
| Termin verschieben | 4-6 | 1 | ja — direkt in den Slot-Dialog |
| Termin abschließen | 3-5 | 0 | ja — Toast, keine Rückfrage |
| Verfügbarkeiten | 8-9 | 1 | nein |
| Ready setzen | 7-9 | 0 | nein |

### Informationslücken (unverändert, neu nummeriert)

1. Tooltips/Description für Onboarding-Felder (Programm, Coach, GitHub, Discord)
2. Bedeutung des Termin-Typs — welche der sechs Typen ist der Normalfall?
3. Bedeutung des Ortes (OnSite / Remote / Hybrid)
4. Was passiert nach „Durchgeführt"? Wann folgt `Documented`?
5. Gibt es eine Standarddauer für Termine und Slots?
6. Warum kann der Vertrieb einen Contact freigeben und nicht das Backend?

---

## Offene Produktfragen

Diese drei sind nicht durch Code entscheidbar und blockieren die Feinplanung:

1. **Anlegepfad:** bleibt es beim Contact-Flow ohne Rückweg, oder bekommt der
   Teilnehmerbereich auch einen Anlege-Knopf? Betrifft Priorität 0.
2. **Terminfindung:** sind drei Vorschläge plus Teilnehmer-Auswahl der Zielzustand,
   oder genügt „Coach verschiebt direkt"? Entscheidet, ob Defekt 3 und 4 behoben
   oder der `SelectSlotDialog` gelöscht wird.
3. **Konflikt-Check:** Wer darf bei einer Kollision entscheiden — Coach sieht
   Warnung, Teilnehmer sieht Alternativen, oder wird hart blockiert?

## Nächste Schritte, nach Nutzen priorisiert

1. **Konflikt-Check bei Terminbuchung** — einzige verbleibende Lücke, die zu
   Datenfehlern führt (Doppelbuchung)
2. **Die sechs 🔴-Defekte beheben** — sie sind billiger als jeder Feature-Punkt
   und zwei davon (`slots[0]`, ISO-Datum) erzeugen falsche Daten
3. **„Ready erreicht"-Feedback** — schließt Lücke 8 und macht das Onboarding für
   den Coach sichtbar
4. **Bestätigungsdialog vor „Durchgeführt"** — `AlertDialog` liegt bereits da
5. **Sprachbruch und `alert()` vereinheitlichen** — Toasts, Deutsch, eine einzige
   Fehlerkonvention
6. **Feldbeschreibungen** (Onboarding, Termin-Typen, Orte) — Informationslücken 1-3
7. **Bulk-Edit für Verfügbarkeiten** — erst wenn 1-6 durch sind