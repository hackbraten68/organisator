# Schema-Repair-Checkliste

**Stand:** 2026-09-29
**Org:** `organiser-dev` (`00D9b00000dO8XR`)
**Zweck:** 25 Custom-Felder, die das Repo deklariert, aber die im Runtime-Schema fehlen,
in Salesforce Setup anlegen und ins Repo zurückholen.
**Verifikation:** `npm run schema:check` → Exit 0

---

## Grundregel für diese Reparatur

**Null fachliche Änderungen, null absichtliche Diffs.**

Die Spezifikation unten ist wörtlich aus den `*.field-meta.xml` im Repo abgelesen. Wer
abweichend anlegt, überschreibt beim Retrieve die XML-Datei mit der Orglenfassung — die
Abweichung landet dann still im Schema. Alles, was fachlich geändert werden soll
(z. B. `deleteConstraint` auf `Restrict`), ist eine **eigene, bewusste Entscheidung** nach
der Reparatur.

## Reihenfolge

1. Alle 25 Felder in Setup anlegen
2. Retrieve in alle fünf Objekte
3. `git diff` prüfen → **muss leer sein**
4. `npm run schema:check` → muss Exit 0 liefern
5. Erst danach: `Student_Test__c` löschen, dann Phase 1

## Nach jedem Objekt: Retrieve

```bash
cd /home/sam/github/organisator/backend
sf project retrieve start --metadata CustomObject:Program__c      --target-org organiser-dev
sf project retrieve start --metadata CustomObject:Learning_Path__c --target-org organiser-dev
sf project retrieve start --metadata CustomObject:Module__c       --target-org organiser-dev
sf project retrieve start --metadata CustomObject:AuditEvent__c   --target-org organiser-dev
sf project retrieve start --metadata CustomObject:AuditOutbox__c  --target-org organiser-dev
```

Zusätzlich, um zu sehen, ob der Retrieve beim Contact-Objekt überhaupt etwas liefert:

```bash
sf project retrieve start --metadata CustomObject:Participant__c --target-org organiser-dev
```

---

## 1. `Program__c` — 1 Feld

### `Status__c`

| Eigenschaft              | Wert                                         |
| ------------------------ | -------------------------------------------- |
| Feldtyp                  | Picklist (Werteschatz)                       |
| API-Name                 | `Status__c`                                  |
| Label                    | Status                                       |
| **Hilfetext**            | `Current Status of Program`                  |
| Werteschatz einschränken | Ja                                           |
| Werte                    | `Draft` **(Standard)**, `Active`, `Archived` |
| Erforderlich             | Nein                                         |

---

## 2. `Learning_Path__c` — 5 Felder

### `Participant__c`

| Eigenschaft           | Wert                            |
| --------------------- | ------------------------------- |
| Feldtyp               | Lookup (Beziehung)              |
| Verweist auf          | `Participant__c`                |
| API-Name              | `Participant__c`                |
| Label                 | Participant                     |
| Beziehungsname        | `Learning_Paths`                |
| Beziehungs-Label      | `Learning Paths`                |
| Löschen-Einschränkung | `Nicht löschen` (= **SetNull**) |
| Erforderlich          | **Nein**                        |

### `Program__c`

| Eigenschaft           | Wert                                                  |
| --------------------- | ----------------------------------------------------- |
| Feldtyp               | Lookup (Beziehung)                                    |
| Verweist auf          | `Program__c`                                          |
| API-Name              | `Program__c`                                          |
| Label                 | Program                                               |
| Beziehungsname        | `Learning_Paths`                                      |
| Beziehungs-Label      | `Learning Paths`                                      |
| Löschen-Einschränkung | `Nicht löschen` (= **SetNull**)                       |
| Erforderlich          | **Nein**                                              |
| **Hilfetext**         | `Lookup Relationship → Next → Related To: Program__c` |

### `Order__c`

| Eigenschaft    | Wert       |
| -------------- | ---------- |
| Feldtyp        | Zahl       |
| API-Name       | `Order__c` |
| Label          | Order      |
| Genauigkeit    | **3**      |
| Dezimalstellen | 0          |
| Erforderlich   | Nein       |
| Externe ID     | Nein       |
| Eindeutig      | Nein       |

### `Status__c`

| Eigenschaft              | Wert                                                 |
| ------------------------ | ---------------------------------------------------- |
| Feldtyp                  | Picklist                                             |
| API-Name                 | `Status__c`                                          |
| Label                    | Status                                               |
| Werteschatz einschränken | Ja                                                   |
| Werte                    | `Planned` **(Standard)**, `In Progress`, `Completed` |
| Erforderlich             | Nein                                                 |

### `Estimated_Weeks__c`

> ⚠️ **API-Name enthält einen Unterstrich zwischen `Estimated` und `Weeks`** — nicht
> `EstimatedWeeks__c`. Salesforce erzeugt aus dem Label "Estimated Weeks" automatisch
> `EstimatedWeeks__c`; das muss überschrieben werden.

| Eigenschaft    | Wert                 |
| -------------- | -------------------- |
| Feldtyp        | Zahl                 |
| API-Name       | `Estimated_Weeks__c` |
| Label          | Estimated Weeks      |
| Genauigkeit    | **2**                |
| Dezimalstellen | 0                    |
| Erforderlich   | Nein                 |
| Externe ID     | Nein                 |
| Eindeutig      | Nein                 |

---

## 3. `Module__c` — 2 Felder

### `Description__c`

| Eigenschaft      | Wert                         |
| ---------------- | ---------------------------- |
| Feldtyp          | Textbereich (Long Text Area) |
| API-Name         | `Description__c`             |
| Label            | Description                  |
| Länge            | 32768                        |
| Sichtbare Zeilen | **3**                        |
| Erforderlich     | Nein                         |

### `Order__c`

| Eigenschaft    | Wert       |
| -------------- | ---------- |
| Feldtyp        | Zahl       |
| API-Name       | `Order__c` |
| Label          | Order      |
| Genauigkeit    | 3          |
| Dezimalstellen | 0          |
| Erforderlich   | Nein       |
| Externe ID     | Nein       |
| Eindeutig      | Nein       |

---

## 4. `AuditEvent__c` — 11 Felder

Bereits vorhanden (11): `Action__c`, `ActorType__c`, `Domain__c`, `EventType__c`,
`OccurredAt__c`, `SchemaVersion__c`, `Sensitivity__c`, `Source__c`, `SubjectId__c`,
`SubjectType__c`, `Visibility__c`

Es fehlen die folgenden 11.

### `ActorId__c`

| Eigenschaft  | Wert         |
| ------------ | ------------ |
| Feldtyp      | Text         |
| API-Name     | `ActorId__c` |
| Label        | Actor Id     |
| Länge        | **18**       |
| Erforderlich | Nein         |
| Externe ID   | Nein         |
| Eindeutig    | Nein         |

### `ActorDisplayName__c`

| Eigenschaft  | Wert                  |
| ------------ | --------------------- |
| Feldtyp      | Text                  |
| API-Name     | `ActorDisplayName__c` |
| Label        | Actor Display Name    |
| Länge        | 255                   |
| Erforderlich | Nein                  |
| Externe ID   | Nein                  |
| Eindeutig    | Nein                  |

### `ParentId__c`

| Eigenschaft  | Wert          |
| ------------ | ------------- |
| Feldtyp      | Text          |
| API-Name     | `ParentId__c` |
| Label        | Parent Id     |
| Länge        | **80**        |
| Erforderlich | Nein          |
| Externe ID   | Nein          |
| Eindeutig    | Nein          |

### `ParentType__c`

| Eigenschaft  | Wert            |
| ------------ | --------------- |
| Feldtyp      | Text            |
| API-Name     | `ParentType__c` |
| Label        | Parent Type     |
| Länge        | **80**          |
| Erforderlich | Nein            |
| Externe ID   | Nein            |
| Eindeutig    | Nein            |

### `ParticipantId__c`

| Eigenschaft           | Wert                            |
| --------------------- | ------------------------------- |
| Feldtyp               | Lookup (Beziehung)              |
| Verweist auf          | `Participant__c`                |
| API-Name              | `ParticipantId__c`              |
| Label                 | Participant Id                  |
| Beziehungsname        | `Audit_Events`                  |
| Beziehungs-Label      | `Audit Events`                  |
| Löschen-Einschränkung | `Nicht löschen` (= **SetNull**) |
| Erforderlich          | Nein                            |

### `Reason__c`

| Eigenschaft      | Wert                         |
| ---------------- | ---------------------------- |
| Feldtyp          | Textbereich (Long Text Area) |
| API-Name         | `Reason__c`                  |
| Label            | Reason                       |
| Länge            | **1000**                     |
| Sichtbare Zeilen | 3                            |
| Erforderlich     | Nein                         |

### `RequestId__c`

> ⚠️ **Externe ID UND Eindeutig** — beide Haken müssen gesetzt sein. Das Feld wird von
> `auditService.generateUUID()` als External Id befüllt.

| Eigenschaft    | Wert           |
| -------------- | -------------- |
| Feldtyp        | Text           |
| API-Name       | `RequestId__c` |
| Label          | Request Id     |
| Länge          | **36**         |
| Erforderlich   | Nein           |
| **Externe ID** | **Ja**         |
| **Eindeutig**  | **Ja**         |

### `ChangedFields__c`

| Eigenschaft      | Wert                         |
| ---------------- | ---------------------------- |
| Feldtyp          | Textbereich (Long Text Area) |
| API-Name         | `ChangedFields__c`           |
| Label            | Changed Fields               |
| Länge            | **4000**                     |
| Sichtbare Zeilen | **5**                        |
| Erforderlich     | Nein                         |

### `Changes__c`

| Eigenschaft      | Wert                         |
| ---------------- | ---------------------------- |
| Feldtyp          | Textbereich (Long Text Area) |
| API-Name         | `Changes__c`                 |
| Label            | Changes                      |
| Länge            | **131072**                   |
| Sichtbare Zeilen | 3                            |
| Erforderlich     | Nein                         |

### `Metadata__c`

| Eigenschaft      | Wert                         |
| ---------------- | ---------------------------- |
| Feldtyp          | Textbereich (Long Text Area) |
| API-Name         | `Metadata__c`                |
| Label            | Metadata                     |
| Länge            | **131072**                   |
| Sichtbare Zeilen | **5**                        |
| Erforderlich     | Nein                         |

### `CorrelationId__c`

| Eigenschaft  | Wert               |
| ------------ | ------------------ |
| Feldtyp      | Text               |
| API-Name     | `CorrelationId__c` |
| Label        | Correlation Id     |
| Länge        | **36**             |
| Erforderlich | Nein               |
| Externe ID   | Nein               |
| Eindeutig    | Nein               |

---

## 5. `AuditOutbox__c` — 6 Felder

Bereits vorhanden (3): `EventType__c`, `RetryCount__c`, `Status__c`

Es fehlen die folgenden 6.

### `SubjectId__c`

| Eigenschaft  | Wert           |
| ------------ | -------------- |
| Feldtyp      | Text           |
| API-Name     | `SubjectId__c` |
| Label        | Subject Id     |
| Länge        | **18**         |
| Erforderlich | Nein           |
| Externe ID   | Nein           |
| Eindeutig    | Nein           |

### `ParticipantId__c`

| Eigenschaft  | Wert               |
| ------------ | ------------------ |
| Feldtyp      | Text               |
| API-Name     | `ParticipantId__c` |
| Label        | Participant Id     |
| Länge        | **18**             |
| Erforderlich | Nein               |
| Externe ID   | Nein               |
| Eindeutig    | Nein               |

> ⚠️ Auf `AuditOutbox__c` ist `ParticipantId__c` ein **Text**-Feld, auf `AuditEvent__c`
> ein **Lookup**. Das ist kein Tippfehler im Repo, sondern der Ist-Zustand.

### `Payload__c`

| Eigenschaft      | Wert                         |
| ---------------- | ---------------------------- |
| Feldtyp          | Textbereich (Long Text Area) |
| API-Name         | `Payload__c`                 |
| Label            | Payload                      |
| Länge            | **32768**                    |
| Sichtbare Zeilen | 3                            |
| Erforderlich     | Nein                         |

### `Error__c`

| Eigenschaft      | Wert                         |
| ---------------- | ---------------------------- |
| Feldtyp          | Textbereich (Long Text Area) |
| API-Name         | `Error__c`                   |
| Label            | Error                        |
| Länge            | **32768**                    |
| Sichtbare Zeilen | 3                            |
| Erforderlich     | Nein                         |

### `NextRetryAt__c`

| Eigenschaft  | Wert             |
| ------------ | ---------------- |
| Feldtyp      | Datum/Uhrzeit    |
| API-Name     | `NextRetryAt__c` |
| Label        | Next Retry At    |
| Erforderlich | Nein             |

### `CorrelationId__c`

| Eigenschaft  | Wert               |
| ------------ | ------------------ |
| Feldtyp      | Text               |
| API-Name     | `CorrelationId__c` |
| Label        | Correlation Id     |
| Länge        | **36**             |
| Erforderlich | Nein               |
| Externe ID   | Nein               |
| Eindeutig    | Nein               |

---

## Abschluss

```bash
cd /home/sam/github/organisator/backend
node scripts/schema-check.mjs; echo "EXIT=$?"
```

Erwartet: alle Objekte `ok`, `OK: Runtime-Schema entspricht dem Repository`, `EXIT=0`.

Danach `Student_Test__c` löschen (Plan-Phase 6.4) und mit Phase 1 beginnen
(`Participant__c.Contact__c` → `required=true`, `deleteConstraint=Restrict`).
