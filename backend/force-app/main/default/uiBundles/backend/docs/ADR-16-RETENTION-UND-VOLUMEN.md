# ADR-16: Event-Volumen & Retention

**Status:** Accepted (2026-09-27) — Design-Entscheidung, Implementierung folgt.
**Kontext:** `AuditEvent__c` wächst unbegrenzt; bisher keine Retention-Policy,
kein Archiv, keine Volumen-Schätzung (Design-Doc §7.3/Phase 5 nur Platzhalter).

## 1. Aktueller Stand (gemessen 2026-09-27, Org `backendtest`)

- **68 Events** (42 `learning_path`, 25 `participant`, 1 `authentication`).
- Record-Größe: ~22 Felder, davon 2× Long Text (`Changes__c`, `Metadata__c`)
  → grob **2–4 KB pro Event**.
- Timeline-Query filtert auf `ParticipantId__c` (**Lookup → selektiv, ok**),
  sortiert nach `OccurredAt__c` (DateTime, nicht indexiert — bei gefilterter
  Menge unkritisch). Keine External IDs, keine custom Indexes.

## 2. Volumen-Schätzung (Rechenmodell, zu validieren)

Annahmen: 200 Teilnehmer, je ~5 Status-/Profil-Events + ~10 Lernpfad-Events
pro Monat, + Session-Logins (~20 Staff × 20 Arbeitstage):

- ~200 × 15 + 400 ≈ **3.400 Events/Monat ≈ 40k/Jahr ≈ 10–15 MB/Jahr.**
- Data-Storage-Limit (je nach Edition, typ. mehrere GB): **kein akuter
  Druck** — aber Queries ohne selektiven Filter (Explorer, Reports) werden
  ab ~100k+ Records spürbar langsamer (Non-selektive-Query-Risiko).

**Schwelle:** Bei **>100k Events** wird diese ADR erneut geöffnet
(Index-Review, Archivierung). Bis dahin: messen, nicht optimieren.

## 3. Retention-Entscheidung

| Domäne | Retention | Begründung |
|---|---|---|
| `participant`, `workbook`, `learning_path`, `absence`, `appointment`, `classbook`, `daily_checkin`, `time_tracking` | **7 Jahre** | Fachliche Nachvollziehbarkeit (Teilnehmer-Historie) |
| `authentication` | **1 Jahr** | Zugriffs-Nachweis, kein Langzeitwert |
| `audit.*` (Selbstlesung: viewed/exported) | **90 Tage** | Nur für Missbrauchs-Analyse; sonst Rauschen |
| `system` | **1 Jahr** | Operativ, kein Fachbezug |

- **Legal Hold:** Bei rechtlicher Pflicht bleiben Events über Retention hinaus
  erhalten (manuell, kein Automatismus in v1).
- **Right to Erasure:** Löschung nur per Retention-Job + dokumentiertem
  manuellem Prozess; Löschungen selbst werden **nicht** als Events geschrieben
  (kein Infinite Regress — vgl. `audit.viewed`-Regel).

## 4. Umsetzung (später, nicht in diesem Sprint)

1. **Scheduled Flow / Batch** (v1, ausreichend): monatlich, löscht Events mit
   `OccurredAt__c < (NOW − Retention(Domäne))`, Batch-Größe klein, Fehler → Log.
2. **Archivierung (optional, erst bei Bedarf):** Export als CSV/JSON vor dem
   Löschen (Files oder externer Speicher) — kein Big Object, solange das
   Volumen <100k bleibt.
3. **Monitoring:** Quartals-Query `COUNT() GROUP BY Domain__c` (30 Sekunden
   Aufwand) — Trend im Blick, Re-Open-Trigger bei >100k.

## 5. Was diese ADR bewusst NICHT tut

- Keine Index-Änderungen heute (Lookup-Selektivität reicht).
- Keine Archiv-Automatik heute (Volumen rechtfertigt sie nicht).
- Keine Verschärfung der Query-Limits (Explorer bleibt wie-is, Rate-Limits
  bleiben auf der Known-Limitations-Liste aus dem Design-Doc).

## Offene Fragen (an PO)

1. 7 Jahre fachlich ok, oder gibt es (förder-/arbeitsrechtliche) Vorgaben?
2. `authentication` 1 Jahr — reicht für interne Revision?
3. Archiv-Export vor Löschung Pflicht oder Kür?
