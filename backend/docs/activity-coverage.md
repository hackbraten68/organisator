# Activity Coverage Dashboard

**Stand:** 2026-09-28  
**Ziel:** Vollständige Nachvollziehbarkeit aller Business-Aktionen im Activity-Stream

---

## Übersicht

| Domäne | Events | Verdrahtet | Fehlend |
|--------|--------|------------|---------|
| Participant | 5 | 5 | 0 |
| Learning Path | 4 | 4 | 0 |
| Session/Auth | 1 | 1 | 0 |
| Absence | 6 | 6 | 0 |
| Appointment | 5 | 5 | 0 |
| Availability | 3 | 3 | 0 |
| Workbook | 5 | 0 | 5 |
| Classbook | 4 | 0 | 4 |
| Daily Check-in | 4 | 0 | 4 |
| Time Entry | 7 | 0 | 7 |
| System | 1 | 0 | 1 |
| **Gesamt** | **48** | **27** | **21** |

---

## Detaillierte Matrix

### Participant (5/5 ✅)

| Event-Typ | Status | Audience | Technical | Correlation | Deep-Link |
|-----------|--------|----------|-----------|-------------|-----------|
| `participant.created` | ✅ | staff | ❌ | ✅ | ✅ |
| `participant.updated` | ✅ | staff | ❌ | ✅ | ✅ |
| `participant.status_changed` | ✅ | staff | ❌ | ✅ | ✅ |
| `participant.archived` | ✅ | staff | ❌ | ✅ | ✅ |
| `participant.restored` | ✅ | staff | ❌ | ✅ | ✅ |

### Learning Path (4/4 ✅)

| Event-Typ | Status | Audience | Technical | Correlation | Deep-Link |
|-----------|--------|----------|-----------|-------------|-----------|
| `learning_path.item_created` | ✅ | staff | ❌ | ✅ | ✅ |
| `learning_path.item_updated` | ✅ | staff | ❌ | ✅ | ✅ |
| `learning_path.item_deleted` | ✅ | staff | ❌ | ✅ | ✅ |
| `learning_path.item_reordered` | ✅ | staff | ❌ | ✅ | ✅ |

### Session/Auth (1/1 ✅)

| Event-Typ | Status | Audience | Technical | Correlation | Deep-Link |
|-----------|--------|----------|-----------|-------------|-----------|
| `authentication.created` | ✅ | restricted | ✅ | ❌ | ❌ |

### Absence (6/6 ✅)

| Event-Typ | Status | Audience | Technical | Correlation | Deep-Link |
|-----------|--------|----------|-----------|-------------|-----------|
| `absence.reported` | ✅ | restricted | ❌ | ✅ | ✅ |
| `absence.updated` | ✅ | restricted | ❌ | ✅ | ✅ |
| `absence.approved` | ✅ | restricted | ❌ | ✅ | ✅ |
| `absence.rejected` | ✅ | restricted | ❌ | ✅ | ✅ |
| `absence.cancelled` | ✅ | restricted | ❌ | ✅ | ✅ |
| `absence.document_added` | ✅ | restricted | ❌ | ✅ | ✅ |

### Appointment (5/5 ✅)

| Event-Typ | Status | Audience | Technical | Correlation | Deep-Link |
|-----------|--------|----------|-----------|-------------|-----------|
| `appointment.created` | ✅ | staff | ❌ | ✅ | ✅ |
| `appointment.rescheduled` | ✅ | staff | ❌ | ✅ | ✅ |
| `appointment.cancelled` | ✅ | staff | ❌ | ✅ | ✅ |
| `appointment.attendance_changed` | ✅ | staff | ❌ | ✅ | ✅ |
| `appointment.status_changed` | ✅ | staff | ❌ | ✅ | ✅ |

### Availability (3/3 ✅)

Slots sind Ressourcen-Daten (`User__c`), nicht teilnehmergebunden. Die Events tragen
deshalb **kein** `ParticipantId__c` — sie erscheinen in keiner Teilnehmer-Timeline,
sondern zentral erfasst (`includeInActivity: false`). Sichtbar werden sie erst über
den organisationsweiten Audit-Explorer, der noch nicht existiert.

| Event-Typ | Status | Audience | Technical | Correlation | Deep-Link |
|-----------|--------|----------|-----------|-------------|-----------|
| `availability.slot_added` | ✅ | staff | ❌ | ✅ | ❌ |
| `availability.slot_updated` | ✅ | staff | ❌ | ✅ | ❌ |
| `availability.slot_deleted` | ✅ | staff | ❌ | ✅ | ❌ |

### Workbook (0/5 ❌)

| Event-Typ | Status | Audience | Technical | Correlation | Deep-Link |
|-----------|--------|----------|-----------|-------------|-----------|
| `workbook.assigned` | ❌ | personal | ❌ | ✅ | ✅ |
| `workbook.started` | ❌ | personal | ❌ | ✅ | ✅ |
| `workbook.answer_updated` | ❌ | personal | ❌ | ✅ | ✅ |
| `workbook.submitted` | ❌ | personal | ❌ | ✅ | ✅ |
| `workbook.reviewed` | ❌ | personal | ❌ | ✅ | ✅ |

### Classbook (0/4 ❌)

| Event-Typ | Status | Audience | Technical | Correlation | Deep-Link |
|-----------|--------|----------|-----------|-------------|-----------|
| `classbook.entry_created` | ❌ | personal | ❌ | ✅ | ✅ |
| `classbook.entry_updated` | ❌ | personal | ❌ | ✅ | ✅ |
| `classbook.entry_deleted` | ❌ | personal | ❌ | ✅ | ✅ |
| `classbook.attendance_changed` | ❌ | personal | ❌ | ✅ | ✅ |

### Daily Check-in (0/4 ❌)

| Event-Typ | Status | Audience | Technical | Correlation | Deep-Link |
|-----------|--------|----------|-----------|-------------|-----------|
| `daily_checkin.submitted` | ❌ | restricted | ❌ | ✅ | ✅ |
| `daily_checkin.updated` | ❌ | restricted | ❌ | ✅ | ✅ |
| `daily_checkin.flagged` | ❌ | restricted | ❌ | ✅ | ✅ |
| `daily_checkin.reviewed` | ❌ | restricted | ❌ | ✅ | ✅ |

### Time Entry (0/7 ❌)

| Event-Typ | Status | Audience | Technical | Correlation | Deep-Link |
|-----------|--------|----------|-----------|-------------|-----------|
| `time_entry.started` | ❌ | staff | ✅ | ✅ | ✅ |
| `time_entry.stopped` | ❌ | staff | ✅ | ✅ | ✅ |
| `time_entry.created` | ❌ | staff | ❌ | ✅ | ✅ |
| `time_entry.corrected` | ❌ | staff | ❌ | ✅ | ✅ |
| `time_entry.deleted` | ❌ | staff | ❌ | ✅ | ✅ |
| `time_entry.approved` | ❌ | staff | ❌ | ✅ | ✅ |
| `time_entry.rejected` | ❌ | staff | ❌ | ✅ | ✅ |

### System (0/1 ❌)

| Event-Typ | Status | Audience | Technical | Correlation | Deep-Link |
|-----------|--------|----------|-----------|-------------|-----------|
| `system.created` | ❌ | staff | ✅ | ❌ | ❌ |

---

## Legende

| Spalte | Werte | Beschreibung |
|--------|-------|--------------|
| **Status** | ✅ / ❌ | Event wird aktuell erzeugt |
| **Audience** | staff / participant / restricted | Wer kann das Event sehen |
| **Technical** | ✅ / ❌ | Technisches Event (kein Business-Event) |
| **Correlation** | ✅ / ❌ | Unterstützt Correlation-ID für Gruppierung |
| **Deep-Link** | ✅ / ❌ | Kann per Deep-Link hervorgehoben werden |

---

## Bekannte Lücken

1. **Audit-Explorer fehlt.** `getOrganizationAuditEvents()` ist ein Platzhalter und
   gibt `[]` zurück. Events ohne Teilnehmerbezug — Availability, System, Login —
   werden zwar erfasst, sind aber derzeit nirgends einsehbar.
2. **Verfügbarkeits-Events ohne Betrachter.** Nach der Entscheidung, Slot-Events
   nicht in Teilnehmer-Timelines zu zeigen, sind sie ausschließlich über den
   Explorer erreichbar. Bis dahin ist die Erfassung eine reine Schreib-Historie.
3. **Coverage-Lücke unverändert:** Workbook, Classbook, Daily Check-in, Time Entry
   und System haben Event-Typen, aber keine Produzenten.

---

## Nächste Schritte

1. **RC2-B:** Absence verdrahten + Tests
2. **RC2-C:** Appointment verdrahten + Tests
3. **RC2-D:** Availability integrieren + Tests
4. **RC2-E:** Correlation-ID überall setzen
5. **RC2-F:** Workbook/Classbook/Daily Check-in/Time Entry
6. **RC2-G:** Feed-Relevanz feinjustieren
7. **RC2-H:** Shepherd.js Onboarding

---

## Definition of Done für RC2

- [ ] `docs/activity-coverage.md` vorhanden
- [ ] Alle vorhandenen Audit-Integrationen aktiv (Participant, Learning Path, Appointment, Absence, Availability)
- [ ] Coverage-Tests vorhanden (Business-Action → Activity-Event)
- [ ] Correlation-ID in allen Mutationen
- [ ] Keine Business-Mutation ohne Event
- [ ] Activity Feed zeigt alle relevanten Nutzeraktionen
