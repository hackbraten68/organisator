# Plan: Produktreife & Nutzerfluss (Post Phase 0-6)

## Übersicht

Phase 0-6 ist abgeschlossen. Jetzt Fokus auf Produktreife, UX-Vollständigkeit und Performance.

---

## Priorität 1: UX-Walkthrough (Dokumentation)

**Ziel:** Kompletten Anwenderfluss durchspielen und UX-Probleme dokumentieren.

### Schritte
1. **Teilnehmer anlegen** — Klicks zählen, Kontextwechsel identifizieren
2. **Onboarding durchführen** — Checkliste verfolgen, "Ready"-State testen
3. **Termin planen** — Formular-Durchlauf, Validierung, Feedback
4. **Termin verschieben** — Reschedule-Flow, Konflikterkennung
5. **Termin abschließen** — Status-Änderung, Bestätigung
6. **Verfügbarkeiten pflegen** — Slot-Erstellung, -Löschung, Wochenübersicht
7. **Teilnehmer auf "ready" setzen** — Checkliste verschwindet, Layout passt sich an

### Dokumentation
- UX-Walkthrough-Protokoll in `docs/ux-walkthrough.md`
- Klick-Zähler pro Flow
- Kontextwechsel markieren
- Informationslücken notieren

---

## Priorität 2: Loading-, Error- und Empty-States

**Ziel:** Konsistente States über alle Komponenten.

### Aktueller Stand (gemessen 2026-10-05, nicht geschätzt)

| Komponente | Loading | Error | Empty |
|------------|---------|-------|-------|
| ParticipantListCard | ✅ Skeleton | ✅ Alert | ✅ EmptyState |
| ParticipantSummaryCard | ✅ Skeleton | ✅ Alert | ❌ fehlt |
| AvailabilitySlots | ✅ Skeleton | ⚠️ Toast | ✅ EmptyState |
| ParticipantAppointmentsTab (`appointments/`) | ✅ Skeleton | ⚠️ Toast | ✅ EmptyState |
| ParticipantActivity | ❌ | ❌ | ❌ — prüfen, was dort tatsächlich läuft |
| ParticipantAbsencesTab (`absences/`) | ✅ Skeleton | ⚠️ Toast | ❌ Custom |
| ParticipantLearningPath | ✅ Skeleton | ✅ Alert | ❌ Custom |

Die Tabelle stand hier lange auf dem Stand "Skeleton ❌ / Alert ❌". Das war
veraltet: ListCard, SummaryCard und AvailabilitySlots haben inzwischen alle
drei States. Die echten Lücken sind schmaler — es fehlen Empty-States, keine
Ladenden.

**Achtung Pfade:** `ParticipantAppointmentsTab` und `ParticipantAbsencesTab`
liegen unter `src/components/appointments/` bzw. `src/components/absences/`,
nicht unter `participants/`. Die alte Liste hier führte sie unter
`participants/`.

### Schritte
1. **ParticipantSummaryCard** — EmptyState ergänzen (einziger echter Loading/Error-Fall)
2. **ParticipantActivity** — klären, was dort beim Laden und bei leerer Liste passiert
3. **AbsencesTab, LearningPath** — Custom-Empty durch die `EmptyState`-Komponente ersetzen
4. **AvailabilitySlots, ParticipantAppointmentsTab** — Toast durch Inline-Alert ergänzen (nicht ersetzen)

---

## Priorität 3: Mobile / Tablet Check

**Ziel:** Responsive-Verhalten bei 1024px, 1280px, 1366px, 1440px verifizieren.

### Aktueller Stand
- Sidebar: `hidden lg:block` (ab 1024px sichtbar)
- Kein Mobile-Teilnehmer-Selektor
- Kein Tab-Overflow-Handling
- Skeleton-Layout-Mismatch (480px vs 384px)

### Schritte
1. **Mobile-Teilnehmer-Selektor** — Drawer oder Select-Dropdown für `< lg`
2. **Tab-Overflow** — `overflow-x-auto` oder Scroll-Pills für kleine Screens
3. **Skeleton-Layout** — 480px → 384px korrigieren
4. **Breakpoint-Tests** — 1024px, 1280px, 1366px, 1440px manuell testen
5. **Container-Check** — 1600px Container + 384px Sidebar = genug Platz?

### Dateien
- `src/components/layout/AppLayout.tsx`
- `src/pages/ParticipantPage.tsx`
- `src/components/participants/ParticipantListCard.tsx` (Skeleton)

---

## Priorität 4: Performance

**Ziel:** Bundle-Größe optimieren, Code-Splitting einführen.

### Aktueller Stand (gemessen am Build vom 2026-10-05)

Der Abschnitt behauptete "kein Code-Splitting, keine React.lazy, alle 7 Routes
statisch, 1.1 MB JS". Das ist überholt — Route-Splitting, Vendor-Chunks und
Component-Lazy sind gebaut:

```text
index-SJsrBgMG.js           492K   Application-Shell
vendor-radix-DA-s4Xvv.js    236K   getrennt
ParticipantPage-CHVfun7E.js 196K   lazy
vendor-react-DPHgkQsE.js    100K   getrennt
vendor-date-BXAVOGEr.js      28K   getrennt
ProgramDetailPage            20K   lazy
vendor-icons                 16K   getrennt
ContactPage                   12K   lazy
Summe JS                   1,2M    Summe CSS 100K
```

`routes.tsx` nutzt `lazy` + `Suspense` (11 Routen), `ActivityEventDetailsDrawer`
ist ebenfalls lazy. Offen ist eigentlich nur noch der 492K-Index-Chunk.

### Schritte
1. **Bundle-Analyse** — `rollup-plugin-visualizer` hinzufügen, um zu sehen, was den Index-Chunk aufbläht
2. **Index-Chunk** — nach dem Messen entscheiden, was davon in eigene Chunks wandert; `ParticipantPage` (196K) ist der größte Einzelposten
3. **React-Query-Optimierung** — `staleTime`, `cacheTime` prüfen

### Dateien
- `vite.config.ts`
- `src/routes.tsx`

---

## Priorität 5: Design System abschließen

**Ziel:** Semantische Statusfarben, Badge-System, Icon-Konvention.

### Aktueller Stand
- Keine semantischen Statusfarben (success, warning, info)
- Badge-Variants: default, secondary, destructive, outline
- Keine Icon-Konvention dokumentiert

### Schritte
1. **Statusfarben** — `--color-success`, `--color-warning`, `--color-info` in `global.css`
2. **Badge-System** — Mapping von Status zu Badge-Varianten dokumentieren
3. **Icon-Konvention** — Calendar=Termine, Clock=Verfügbarkeit, User=Teilnehmer, MapPin=Ort
4. **Animation-Tokens** — Duration, Easing definieren
5. **Z-Index-Skala** — Modal, Dropdown, Toast, Sticky definieren

### Dateien
- `src/styles/global.css`
- `src/components/ui/badge.tsx`
- `docs/design-system.md`

---

## Priorität 6: Tastatur-Workflow

**Ziel:** Vollständige Tastatur-Navigation, Fokus-Management.

### Aktueller Stand
- Radix UI primitives haben eingebaute Tastatur-Navigation
- Keine `onKeyDown` Handler im Application Code
- Kein Skip-to-Content Link
- Keine `aria-busy` auf Loading-Containern
- Keine `aria-live` für dynamische Updates

### Schritte
1. **Skip-to-Content** — Link zum Hauptinhalt für Screenreader
2. **`aria-busy`** — Auf Loading-Container setzen
3. **`aria-live`** — Für Toast-Notifications und dynamische Updates
4. **Tab-Reihenfolge** — Sidebar → Teilnehmer → Tabs → Aktionen verifizieren
5. **Escape-Verhalten** — Dialoge, Dropdowns, Drawer testen
6. **Enter/Space** — Suche, Formulare, Akkordeons testen

### Dateien
- `src/components/layout/AppLayout.tsx`
- `src/components/ui/alert.tsx`
- `src/components/ui/toast.tsx`

---

## Priorität 7: Feature Freeze + Release Candidate

**Ziel:** RC1 erstellen und User-Feedback sammeln.

### RC-Checkliste
- [ ] Build erfolgreich
- [ ] Lint 0 Fehler
- [ ] Tests 270/270 Vitest + Apex grün
- [ ] Responsive geprüft (1024-1440px)
- [ ] Accessibility geprüft
- [ ] Dark Mode geprüft
- [ ] Browser getestet (Chrome, Edge, Firefox)
- [ ] UX-Walkthrough durchgeführt
- [ ] Dokumentation aktualisiert

### Schritte
1. Alle vorherigen Prioritäten abschließen
2. RC1 taggen
3. 2-3 reale Nutzer damit arbeiten lassen
4. Feedback sammeln und priorisieren

---

## Zusätzliche Initiativen

### Shepherd.js Tutorials (Strategisch)
- Evaluierung und Konzeption
- Tutorial-Standards definieren
- Erste Pilot-Tutorials erstellen
- Feedback-Runde mit Anwendern
- Rollout-Konzept

### Vollständiges Activity-Tracking (Sehr Hoch)
- Aktuell: 8 Kategorien, 5 Audiences, 40+ Event-Typen
- Zu prüfen: Termine, Abwesenheiten, Genehmigungen, Statusänderungen
- Benachrichtigungen korrekt ausgelöst?
- Konsistenz zwischen Datenquelle und Activity-Feed

---

## Empfohlene Reihenfolge

1. **UX-Walkthrough** (Dokumentation)
2. **Loading/Error/Empty States** (Vervollständigung)
3. **Responsive-Test** (1024-1440px)
4. **Performance-Audit** (Code-Splitting)
5. **Design System** (Statusfarben, Badge-System)
6. **Tastatur-Workflow** (A11y-Vervollständigung)
7. **RC1** (Taggen, User-Feedback)

---

## Nächste Sofort-Schritte

1. UX-Walkthrough-Protokoll erstellen
2. ParticipantListCard States hinzufügen
3. Mobile-Teilnehmer-Selektor implementieren
4. Route-based Code Splitting einführen
5. Statusfarben in global.css definieren
