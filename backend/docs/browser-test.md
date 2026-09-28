# Browser-Test: Organisator

**Datum:** 2026-09-28  
**Version:** RC1  
**Browser:** Chrome, Edge, Firefox

---

## Test-Environment

| Browser | Version | Status |
|---------|---------|--------|
| Chrome | Latest | ⏳ |
| Edge | Latest | ⏳ |
| Firefox | Latest | ⏳ |

---

## Test-Fälle

### 1. Laden & Rendering
- [ ] App lädt ohne Fehler
- [ ] Sidebar zeigt Teilnehmerliste
- [ ] Tabs sind sichtbar (Übersicht, Verlauf, Lernpfad, Abwesenheiten, Termine)
- [ ] Teilnehmerdetails werden angezeigt

### 2. Navigation
- [ ] Tab-Wechsel funktioniert
- [ ] Teilnehmer-Auswahl in Sidebar funktioniert
- [ ] Breadcrumb zeigt aktuellen Teilnehmer

### 3. Responsive
- [ ] 1024px: Sidebar sichtbar, Layout korrekt
- [ ] 1280px: Sidebar sichtbar, Layout korrekt
- [ ] 1366px: Sidebar sichtbar, Layout korrekt
- [ ] 1440px: Sidebar sichtbar, Layout korrekt
- [ ] < 1024px: Mobile-Sheet funktioniert

### 4. Tastatur
- [ ] `Tab` navigiert durch alle Elemente
- [ ] `Escape` schließt Dialoge
- [ ] `Enter` aktiviert Buttons
- [ ] `?` öffnet Shortcut-Legende
- [ ] Skip-to-Content Link funktioniert

### 5. Loading/Error/Empty States
- [ ] Skeleton wird während Ladens angezeigt
- [ ] Error-Alert bei Fehlern
- [ ] EmptyState bei leeren Listen

### 6. Dark Mode
- [ ] Dark Mode funktioniert
- [ ] Farben sind korrekt
- [ ] Kontrast ist ausreichend

### 7. Interaktionen
- [ ] Termin erstellen
- [ ] Termin verschieben
- [ ] Termin abschließen
- [ ] Verfügbarkeit hinzufügen
- [ ] Verfügbarkeit löschen

---

## Bekannte Probleme

| Problem | Schwere | Status |
|---------|---------|--------|
| Kein "Teilnehmer anlegen" im UI | Mittel | ⏳ |
| Kein Slot-Vorschlag bei Terminplanung | Mittel | ⏳ |
| Kein Konflikt-Check bei Terminbuchung | Mittel | ⏳ |

---

## Testergebnis

| Browser | Datum | Tester | Ergebnis |
|---------|-------|--------|----------|
| Chrome | — | — | ⏳ |
| Edge | — | — | ⏳ |
| Firefox | — | — | ⏳ |

---

## Sign-Off

- [ ] Alle kritischen Fehler behoben
- [ ] Dokumentation aktualisiert
- [ ] RC1 freigegeben
