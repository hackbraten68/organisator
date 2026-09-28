# UX-Walkthrough: Organisator Teilnehmerbereich

**Datum:** 2026-09-28  
**Version:** 1.0  
**Scope:** Kompletter Anwenderfluss durch den Teilnehmerbereich

---

## 1. Teilnehmer anlegen

### Flow
1. Navigation zu `/participants`
2. Sidebar zeigt Liste mit Gruppen (Achtung / Aktiv / Alle)
3. **Kein "Neuer Teilnehmer"-Button sichtbar** — muss über Salesforce-UI erfolgen

### Klicks
| Schritt | Klicks | Kontextwechsel |
|---------|--------|----------------|
| Zur Seite navigieren | 1 (URL/Bookmark) | — |
| Teilnehmer auswählen | 1 | — |

### Probleme
- **Kein direkter "Teilnehmer anlegen"-Button** im UI — Nutzer muss Salesforce-UI nutzen
- **Kein Onboarding-Flow** im UI — Name/Email werden im Sales-Prozess erfasst
- **Kein Feedback** nach erfolgreicher Anlage (Toast? Redirect?)

### Informationslücken
- Wo legt man einen neuen Teilnehmer an?
- Was passiert nach der Anlage?
- Wird der neue Teilnehmer automatisch in "Achtung" angezeigt?

---

## 2. Onboarding durchführen

### Flow
1. Teilnehmer in Sidebar auswählen (erscheint in "Achtung")
2. Tab "Übersicht" öffnet sich automatisch
3. `ParticipantSummaryCard` zeigt Kontakt + Zuordnung
4. `OnboardingChecklist` zeigt Fortschritt (0/4 → 4/4)
5. Edit-Modus aktivieren (Stift-Button)
6. Felder ausfüllen: Programm, Coach, GitHub, Discord
7. Speichern

### Klicks
| Schritt | Klicks | Kontextwechsel |
|---------|--------|----------------|
| Teilnehmer auswählen | 1 | — |
| Edit-Modus aktivieren | 1 | — |
| Programm auswählen | 1-2 (Dropdown) | — |
| Coach auswählen | 1-2 (Dropdown) | — |
| GitHub eingeben | 1 | — |
| Discord eingeben | 1 | — |
| Speichern | 1 | — |
| **Gesamt** | **7-9** | **0** |

### Probleme
- **Kein Auto-Save** — Nutzer muss manuell speichern
- **Kein Validierung-Feedback** in Echtzeit (erst beim Speichern)
- **Kein Fortschritts-Badge** im Sidebar-Listeneintrag während Edit
- **Kein "Onboarding abgeschlossen"**-Feedback (Checkliste verschwindet still)

### Informationslücken
- Was bedeuten die 4 Felder? (Tooltips fehlen)
- Was passiert bei "Ready"? (Checkliste verschwindet, Layout ändert sich)
- Gibt es Pflichtfelder vs. optionale Felder?

---

## 3. Termin planen

### Flow
1. Tab "Termine" öffnen
2. Unter-Tab "Anstehend" oder "Vergangene" wählen
3. "Neuer Termin"-Button klicken
4. `AppointmentFormDialog` öffnet sich
5. Felder ausfüllen: Typ, Status, Start, Ende, Ort, Coach, Notizen
6. Speichern

### Klicks
| Schritt | Klicks | Kontextwechsel |
|---------|--------|----------------|
| Tab "Termine" | 1 | — |
| "Neuer Termin" | 1 | — |
| Dialog öffnet sich | — | Modal |
| Typ auswählen | 1 | — |
| Status auswählen | 1 | — |
| Start-Datum | 1-2 (DatePicker) | — |
| Ende-Datum | 1-2 (DatePicker) | — |
| Ort auswählen | 1 | — |
| Coach auswählen | 1-2 (Dropdown) | — |
| Notizen eingeben | 1 | — |
| Speichern | 1 | — |
| **Gesamt** | **10-13** | **1 (Modal)** |

### Probleme
- **Kein Slot-Vorschlag** — Nutzer muss manuell Datum/Zeit eingeben
- **Kein Konflikt-Check** — Doppelbuchungen werden nicht verhindert
- **Kein Coach-Verfügbarkeits-Check** — Coach könnte schon vergeben sein
- **Kein "Vorschau"** — sieht der Termin gut aus?
- **Kein Auto-Fill** — Coach könnte voreingestellt sein

### Informationslücken
- Welche Termin-Typen gibt es? (Coaching, Workshop, ...)
- Welche Orte sind verfügbar? (OnSite, Remote, Hybrid)
- Gibt es eine Standard-Dauer?
- Kann man mehrere Teilnehmer zu einem Termin hinzufügen?

---

## 4. Termin verschieben

### Flow
1. Tab "Termine" → "Anstehend"
2. Termin in Liste finden
3. Dropdown-Menü (⋮) öffnen
4. "Verschieben" wählen
5. `AppointmentFormDialog` mit vorgefüllten Daten öffnet sich
6. Datum/Zeit ändern
7. Speichern

### Klicks
| Schritt | Klicks | Kontextwechsel |
|---------|--------|----------------|
| Tab "Termine" | 1 | — |
| Termin finden | 0-3 (Scrollen) | — |
| Dropdown öffnen | 1 | — |
| "Verschieben" wählen | 1 | — |
| Dialog öffnet sich | — | Modal |
| Datum/Zeit ändern | 1-2 | — |
| Speichern | 1 | — |
| **Gesamt** | **6-9** | **1 (Modal)** |

### Probleme
- **Kein Drag & Drop** — Verschieben nur über Formular
- **Kein Konflikt-Warnung** — neue Zeit könnte kollidieren
- **Kein "Grund für Verschiebung"** — keine Dokumentation
- **Kein Storno-Button** — nur "Absagen" verfügbar

### Informationslücken
- Wer wird über die Verschiebung informiert?
- Gibt es eine Historie der Verschiebungen?
- Kann man einen Termin an mehrere Daten verschieben?

---

## 5. Termin abschließen

### Flow
1. Tab "Termine" → "Anstehend"
2. Termin in Liste finden
3. Dropdown-Menü (⋮) öffnen
4. "Abschließen" wählen
5. Bestätigungsdialog
6. Status ändert sich zu "Completed"

### Klicks
| Schritt | Klicks | Kontextwechsel |
|---------|--------|----------------|
| Tab "Termine" | 1 | — |
| Termin finden | 0-3 (Scrollen) | — |
| Dropdown öffnen | 1 | — |
| "Abschließen" wählen | 1 | — |
| Bestätigung | 1 | — |
| **Gesamt** | **4-7** | **0** |

### Probleme
- **Kein "Abschließen" ohne Bestätigung** — könnte versehentlich ausgelöst werden
- **Kein Feedback** nach Abschluss (Toast? Animation?)
- **Kein "Anwesenheit"** — wer war anwesend?
- **Kein "Notizen"** — keine Dokumentation des Termins

### Informationslücken
- Was passiert nach dem Abschlließen?
- Kann man einen abgeschlossenen Termin wieder öffnen?
- Gibt es eine Abschluss-Notiz?

---

## 6. Verfügbarkeiten pflegen

### Flow
1. Tab "Termine" → Unter-Tab "Verfügbarkeit"
2. `AvailabilitySlots` zeigt Slots in Grid
3. "Neue Verfügbarkeit"-Button klicken
4. Dialog öffnet sich
5. Felder ausfüllen: Tag, Start, Ende, Typ, Aktiv
6. Speichern

### Klicks
| Schritt | Klicks | Kontextwechsel |
|---------|--------|----------------|
| Tab "Termine" | 1 | — |
| Unter-Tab "Verfügbarkeit" | 1 | — |
| "Neue Verfügbarkeit" | 1 | — |
| Dialog öffnet sich | — | Modal |
| Tag auswählen | 1 | — |
| Start-Zeit | 1 | — |
| Ende-Zeit | 1 | — |
| Typ auswählen | 1 | — |
| Speichern | 1 | — |
| **Gesamt** | **8** | **1 (Modal)** |

### Probleme
- **Kein Wochen-Übersicht** — Slots werden in Grid angezeigt, nicht als Kalender
- **Kein Bulk-Edit** — mehrere Slots können nicht gleichzeitig bearbeitet werden
- **Kein "Kopieren"** — gleiche Slots für mehrere Tage müssen einzeln erstellt werden
- **Kein "Gültig bis"** — Slots gelten unbegrenzt

### Informationslücken
- Wie sieht die Wochenübersicht aus?
- Gibt es eine Standard-Verfügbarkeit?
- Wer sieht die Verfügbarkeiten? (Nur Coach? Auch Teilnehmer?)

---

## 7. Teilnehmer auf "Ready" setzen

### Flow
1. Tab "Übersicht"
2. `OnboardingChecklist` zeigt Fortschritt
3. Alle 4 Felder ausfüllen (Programm, Coach, GitHub, Discord)
4. Speichern
5. Checkliste verschwindet automatisch
6. `ParticipantSummaryCard` geht auf volle Breite

### Klicks
| Schritt | Klicks | Kontextwechsel |
|---------|--------|----------------|
| Tab "Übersicht" | 1 | — |
| Edit-Modus | 1 | — |
| Alle Felder ausfühlen | 4-6 | — |
| Speichern | 1 | — |
| **Gesamt** | **7-9** | **0** |

### Probleme
- **Kein "Onboarding abgeschlossen"**-Feedback (kein Toast, keine Animation)
- **Kein "Ready"**-Badge im Sidebar-Listeneintrag
- **Kein "Onboarding-Dauer"** — wie lange hat es gedauert?
- **Kein "Onboarding-Historie"** — wer hat wann was ausgefüllt?

### Informationslücken
- Was bedeutet "Ready" genau?
- Gibt es einen "Onboarding abgeschlossen"-Zeitstempel?
- Kann man einen "Ready"-Teilnehmer zurücksetzen?

---

## Zusammenfassung

### Klick-Statistik
| Flow | Klicks | Kontextwechsel |
|------|--------|----------------|
| Teilnehmer anlegen | 1-2 | 0 |
| Onboarding | 7-9 | 0 |
| Termin planen | 10-13 | 1 |
| Termin verschieben | 6-9 | 1 |
| Termin abschließen | 4-7 | 0 |
| Verfügbarkeiten | 8 | 1 |
| Ready setzen | 7-9 | 0 |
| **Gesamt** | **43-58** | **3** |

### Kritische UX-Probleme

1. **Kein "Teilnehmer anlegen"** im UI
2. **Kein Slot-Vorschlag** bei Terminplanung
3. **Kein Konflikt-Check** bei Terminbuchung
4. **Kein Auto-Save** bei Onboarding
5. **Kein Feedback** bei Statusänderungen
6. **Kein Bulk-Edit** bei Verfügbarkeiten
7. **Kein Wochen-Kalender** für Verfügbarkeiten
8. **Kein "Onboarding abgeschlossen"**-Feedback

### Informationslücken

1. Tooltips für Onboarding-Felder fehlen
2. Keine Erklärung der Termin-Typen
3. Keine Erklärung der Orte
4. Keine "Was passiert nach...?"-Hinweise
5. Keine Historie bei Verschiebungen

### Nächste Schritte

1. **"Teilnehmer anlegen"**-Button im UI hinzufügen
2. **Slot-Vorschlag** bei Terminplanung implementieren
3. **Konflikt-Check** bei Terminbuchung implementieren
4. **Auto-Save** bei Onboarding implementieren
5. **Toast-Feedback** bei Statusänderungen hinzufügen
6. **Bulk-Edit** für Verfügbarkeiten implementieren
7. **Wochen-Kalender** für Verfügbarkeiten implementieren
8. **"Onboarding abgeschlossen"**-Animation hinzufügen
