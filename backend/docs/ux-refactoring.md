# UI/UX Refactoring: `/participants` Bereich

## Übersicht

Umfassendes Redesign des Teilnehmerbereichs mit Fokus auf:
- Informationshierarchie
- Whitespace & Spacing
- Terminbereich (höchste Priorität)
- Card Design
- Typografie
- Responsive Verhalten
- Accessibility

## Design Tokens

### Typografie
| Token | Größe | Verwendung |
|-------|-------|------------|
| `text-display` | 36px | Seitentitel |
| `text-h1` | 30px | Section-Header |
| `text-h2` | 24px | Card-Titel |
| `text-h3` | 20px | Subsection |
| `text-h4` | 18px | Feld-Labels |
| `text-body` | 16px | Fließtext |
| `text-small` | 14px | Sekundärtext |
| `text-caption` | 12px | Captions |

### Spacing
| Token | Wert | Verwendung |
|-------|------|------------|
| `gap-6` | 24px | Card-Abstand |
| `gap-4` | 16px | Element-Abstand |
| `gap-2` | 8px | Kompakt |

### Shadows
| Token | Verwendung |
|-------|------------|
| `shadow-card` | Standard-Card |
| `shadow-card-hover` | Hover-State |
| `shadow-elevated` | Dialoge/Dropdowns |

## Layout

### Page Container
- Max-Width: 1600px
- Padding: 24px
- Gap: 32px

### Sidebar (Variante A)
- Breite: 384px (fix)
- Sichtbar: ab `lg` (1024px)
- Inhalt: Gruppierte Teilnehmerliste mit Suche

### Hauptbereich
- Flexibles Grid
- Tabs: Übersicht, Verlauf, Lernpfad, Abwesenheiten, Termine

## Komponenten

### ParticipantListCard
- Gruppierte Sektionen (Achtung/Aktiv/Alle)
- Globale Suche
- Count-Badges
- Accordion für Gruppen

### ParticipantSummaryCard
- Section-basiert (Kontakt/Zuordnung)
- View/Edit-Modus
- Responsive Grid

### ParticipantStickyHeader
- Sticky Position
- Avatar + Name + Status
- Aktionen (Zurücksetzen/Speichern)

### AppointmentListCard
- Standard shadcn Card
- Dropdown-Actions
- Status-Badges
- Meta-Zeile (Datum, Ort, Coach)

### ParticipantAppointmentsTab
- Flache Liste für Anstehende
- Accordion für Vergangene (gruppiert nach Monat)
- Filter (Status, Typ)

### AvailabilitySlots
- Card-Grid (1-4 Spalten responsiv)
- Filter (Tag, Typ, Status)
- Empty-State

### ActivityTimeline
- Vertikale Linie
- Event-Dots
- Expandierbare Gruppen

## Responsive Breakpoints

| Breakpoint | Sidebar | Übersicht | Appointments |
|------------|---------|-----------|--------------|
| `<640px` | Versteckt | Gestapelt | 1 Spalte |
| `640-1023px` | Versteckt | Gestapelt | 2 Spalten |
| `≥1024px` | 384px fix | 50/50 Grid | 3-4 Spalten |

## Accessibility

- `aria-label` auf allen interaktiven Elementen
- `aria-expanded`/`aria-controls` bei Accordion/Disclosure
- Focus-Visible Rings (shadcn/ui Standard)
- Keyboard-Navigation durch alle Elemente
- Color Contrast ≥ 4.5:1

## Commits

| Hash | Thema |
|------|-------|
| `74c7196` | aria-Labels für Tabs, Buttons, Dropdowns |
| `86e5b8a` | 50/50 Grid für Übersicht |
| `7058180` | AvailabilitySlots Redesign |
| `86e5b8a` | Termin-Tabs flach + Accordion |
| `244a9bf` | AvailabilitySlots + E2E |
| `af31bee` | Staff__c entfernen |
