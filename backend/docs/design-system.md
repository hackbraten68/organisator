# Design System

## Statusfarben

### Light Mode
| Token | Wert | Verwendung |
|-------|------|------------|
| `--success` | `oklch(0.52 0.16 145)` | Erfolg, Bestätigung, Ready |
| `--warning` | `oklch(0.65 0.15 75)` | Warnung, Achtung, Incomplete |
| `--info` | `oklch(0.55 0.15 250)` | Information, Hinweis |
| `--destructive` | `oklch(0.577 0.245 27.325)` | Fehler, Ablehnung, Needs Setup |

### Dark Mode
| Token | Wert | Verwendung |
|-------|------|------------|
| `--success` | `oklch(0.65 0.15 145)` | Erfolg, Bestätigung, Ready |
| `--warning` | `oklch(0.75 0.15 75)` | Warnung, Achtung, Incomplete |
| `--info` | `oklch(0.65 0.15 250)` | Information, Hinweis |
| `--destructive` | `oklch(0.704 0.191 22.216)` | Fehler, Ablehnung, Needs Setup |

### Tailwind Klassen
```tsx
// Success
<Badge className="bg-success text-success-foreground">Ready</Badge>

// Warning
<Badge className="bg-warning text-warning-foreground">Incomplete</Badge>

// Info
<Badge className="bg-info text-info-foreground">Info</Badge>

// Destructive
<Badge variant="destructive">Needs Setup</Badge>
```

---

## Badge-System

### Varianten
| Variant | Farbe | Verwendung |
|---------|-------|------------|
| `default` | Primary | Active, Ready, Approved, Confirmed |
| `secondary` | Secondary | Draft, Submitted, Pending, Incomplete |
| `destructive` | Destructive | Rejected, Cancelled, Needs Setup, Error |
| `outline` | Border | Archived, Inactive, Disabled |
| `ghost` | Transparent | Hover-only, subtle emphasis |
| `link` | Primary | Clickable, navigation |

### Status-Mapping
| Status | Variant | Beispiel |
|--------|---------|----------|
| Active | `default` | Teilnehmer ist aktiv |
| Ready | `default` | Onboarding abgeschlossen |
| Incomplete | `secondary` | Onboarding unvollständig |
| Needs Setup | `destructive` | Onboarding nicht gestartet |
| Draft | `secondary` | Termin-Entwurf |
| Confirmed | `default` | Termin bestätigt |
| Cancelled | `destructive` | Termin abgesagt |
| Completed | `default` | Termin abgeschlossen |
| Pending | `secondary` | Ausstehend |
| Rejected | `destructive` | Abgelehnt |
| Archived | `outline` | Archiviert |

---

## Icon-Konvention

### Navigation
| Icon | Verwendung |
|------|------------|
| `Users` | Teilnehmer |
| `Book` | Programme |
| `Search` | Suche |
| `Reports` | Dashboard |

### Termine
| Icon | Verwendung |
|------|------------|
| `Calendar` | Termine, Kalender |
| `Clock` | Verfügbarkeit, Zeiten |
| `MapPin` | Ort, Location |
| `Video` | Online-Termin |
| `Plus` | Hinzufügen |
| `ChevronLeft` / `ChevronRight` | Navigation |

### Aktionen
| Icon | Verwendung |
|------|------------|
| `Pencil` | Bearbeiten |
| `Trash2` | Löschen |
| `Check` | Bestätigen |
| `X` | Schließen |
| `MoreHorizontal` | Mehr Optionen |
| `Filter` | Filter |
| `Download` | Exportieren |

### Status
| Icon | Verwendung |
|------|------------|
| `CheckCircle2` | Erfolg, Abgeschlossen |
| `AlertCircle` | Fehler, Warnung |
| `Info` | Information |
| `Circle` | Ausstehend, Offen |

---

## Animation-Tokens

### Dauer
| Token | Wert | Verwendung |
|-------|------|------------|
| `--animate-fade-in` | `0.2s` | Einblenden |
| `--animate-fade-out` | `0.2s` | Ausblenden |
| `--animate-slide-in-from-right` | `0.3s` | Slide von rechts |
| `--animate-slide-in-from-left` | `0.3s` | Slide von links |
| `--animate-slide-in-from-top` | `0.3s` | Slide von oben |
| `--animate-slide-in-from-bottom` | `0.3s` | Slide von unten |
| `--animate-scale-in` | `0.2s` | Skalierung ein |
| `--animate-scale-out` | `0.2s` | Skalierung aus |

### Easing
| Token | Wert | Verwendung |
|-------|------|------------|
| `--ease-out` | `cubic-bezier(0, 0, 0.2, 1)` | Standard-Übergang |
| `--ease-in` | `cubic-bezier(0.4, 0, 1, 1)` | Beschleunigung |
| `--ease-in-out` | `cubic-bezier(0.4, 0, 0.2, 1)` | Standard-Animation |

---

## Z-Index-Skala

| Token | Wert | Verwendung |
|-------|------|------------|
| `--z-base` | `0` | Basis-Ebene |
| `--z-dropdown` | `10` | Dropdown-Menüs |
| `--z-sticky` | `20` | Sticky-Header |
| `--z-fixed` | `30` | Fixed-Elemente |
| `--z-modal-backdrop` | `40` | Modal-Hintergrund |
| `--z-modal` | `50` | Modale Dialoge |
| `--z-popover` | `60` | Popover |
| `--z-tooltip` | `70` | Tooltips |
| `--z-toast` | `80` | Toast-Benachrichtigungen |

---

## Typografie

### Token
| Token | Größe | Verwendung |
|-------|-------|------------|
| `text-display` | `2.25rem` | Seitentitel |
| `text-h1` | `1.875rem` | Section-Header |
| `text-h2` | `1.5rem` | Card-Titel |
| `text-h3` | `1.25rem` | Subsection |
| `text-h4` | `1.125rem` | Feld-Labels |
| `text-body` | `1rem` | Fließtext |
| `text-small` | `0.875rem` | Sekundärtext |
| `text-caption` | `0.75rem` | Captions |

---

## Spacing

### Token
| Token | Wert | Verwendung |
|-------|------|------------|
| `gap-2` | `0.5rem` | Kompakt |
| `gap-4` | `1rem` | Element-Abstand |
| `gap-6` | `1.5rem` | Card-Abstand |
| `gap-8` | `2rem` | Section-Abstand |

---

## Shadows

### Token
| Token | Wert | Verwendung |
|-------|------|------------|
| `shadow-card` | `0 1px 3px 0 rgb(0 0 0 / 0.1)` | Standard-Card |
| `shadow-card-hover` | `0 10px 15px -3px rgb(0 0 0 / 0.1)` | Hover-State |
| `shadow-elevated` | `0 20px 25px -5px rgb(0 0 0 / 0.1)` | Dialoge/Dropdowns |
