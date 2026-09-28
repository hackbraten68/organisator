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

### Aktueller Stand (aus Analyse)
| Komponente | Loading | Error | Empty |
|------------|---------|-------|-------|
| ParticipantListCard | ❌ | ❌ | ⚠️ Inline |
| ParticipantSummaryCard | ❌ | ❌ | ❌ |
| ParticipantAppointmentsTab | ✅ | ⚠️ Toast | ✅ |
| AvailabilitySlots | ❌ | ⚠️ Toast | ✅ |
| ParticipantActivity | ✅ | ✅ | ✅ |
| ParticipantAbsencesTab | ✅ | ⚠️ Toast | ⚠️ Custom |
| ParticipantLearningPath | ✅ | ✅ | ⚠️ Custom |

### Schritte
1. **ParticipantListCard** — Skeleton + EmptyState + Error-Alert hinzufügen
2. **ParticipantSummaryCard** — Skeleton + Error-Alert hinzufügen
3. **AvailabilitySlots** — Skeleton + Error-Alert hinzufügen
4. **Konsolidierung** — Alle Custom-Empty-States durch `EmptyState`-Komponente ersetzen
5. **Error-Handling** — Toast durch Inline-Alert ergänzen (nicht ersetzen)

### Dateien
- `src/components/participants/ParticipantListCard.tsx`
- `src/components/participants/ParticipantSummaryCard.tsx`
- `src/components/appointments/AvailabilitySlots.tsx`
- `src/components/participants/ParticipantAbsencesTab.tsx`
- `src/components/participants/ParticipantLearningPath.tsx`

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

### Aktueller Stand
- 1.1 MB JS / 107 KB CSS
- Kein Code-Splitting
- Keine React.lazy
- Keine Dynamic Imports
- Alle 7 Routes statisch importiert

### Schritte
1. **Route-based Code Splitting** — `React.lazy` + `Suspense` für alle Routes
2. **Vendor-Chunking** — React, Radix, date-fns, lucide-react separat
3. **Component-Level Lazy Loading** — `ActivityEventDetailsDrawer`, `ChangeSetViewer`, `DatePicker`
4. **Bundle-Analysis** — `rollup-plugin-visualizer` hinzufügen
5. **React-Query-Optimierung** — `staleTime`, `cacheTime` prüfen

### Dateien
- `vite.config.ts`
- `src/routes.tsx`
- `src/components/audit/ActivityEventDetailsDrawer.tsx`
- `src/components/audit/ChangeSetViewer.tsx`

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
- [ ] Tests 140/140
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
