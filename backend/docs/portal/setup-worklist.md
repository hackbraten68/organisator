# Setup Worklist — Academy data model in `hubSandbox`

**Stand:** 2026-09-30
**Zweck:** anleitung zum Anlegen aller Objekte und Felder von Hand in Salesforce Setup.

## Warum von Hand

Ein Deploy erzeugt die Felder nicht im Runtime-Schema. In `hubSandbox` gemessen
(Kontrollversuch E4, `Program__c`):

```text
sf project deploy start     Succeeded, 4 Komponenten "Created"
sf data query               ERROR: No such column 'Description__c'
Tooling API FieldDefinition Description__c, DurationWeeks__c, Status__c (vorhanden)
sf sobject describe         9 Felder, davon 0 mit __c
```

Drei APIs melden die Felder, SOQL und `sobject describe` kennen sie nicht. Es gibt
keinen Weg daran vorbei.

## Reihenfolge

Lookups erzwingen eine Reihenfolge: ein Lookup-Feld laesst sich erst anlegen, wenn
sein Zielfeld existiert. Die vier Wurzelobjekte sind unabhaengig.

| # | Objekt | Felder | Lookup-Voraussetzung |
| - | ------ | -----: | ------------------- |
| 1 | `AuditOutbox__c` | 9 | — (Wurzelobjekt) |
| 2 | `AvailabilitySlot__c` | 8 | — (Wurzelobjekt) |
| 3 | `Coach_Profile__c` | 6 | — (Wurzelobjekt) |
| 4 | `Program__c` | 3 | — (Wurzelobjekt) |
| 5 | `Module__c` | 3 | `Program__c` |
| 6 | `Participant__c` | 9 | `Coach_Profile__c`, `Program__c` |
| 7 | `Absence__c` | 11 | `Participant__c` |
| 8 | `Appointment__c` | 13 | `Participant__c` |
| 9 | `AuditEvent__c` | 22 | `Participant__c` |
| 10 | `Learning_Path__c` | 6 | `Participant__c`, `Program__c` |

---

## AuditOutbox__c

**Fields:** 9 &nbsp;&nbsp; **Record Name:** AutoNumber

### Step 1 — Create the object

`Setup → Object Manager → Create → Custom Object`

| Setup form field | Enter |
| --- | --- |
| Label | Audit Outbox |
| Plural Label | Audit Outbox Entries |
| Record Name | AutoNumber |
| Display Format | OB-{000000} |
| Starting Number | 1 |
| Description | Warteschlange fuer die zuverlaessige Zustellung von Audit-Ereignissen. Haelt ein Ereignis fest, wenn der direkte Schreibpfad scheitert, und wiederholt den Versuch mit Backoff. Nur Hintergrundinfrastruktur, nie durch Nutzer:innen pflegbar. |
| Allow Reports | checked |
| Allow Activities | unchecked |
| Track Field History | unchecked |
| Allow Search | unchecked |
| Allow in Chatter Groups | unchecked |

> The API name is generated from the Label. After saving, Object Manager must show the API name `AuditOutbox__c`. If it differs, the object cannot be renamed — delete it and redo.
>
> **Verify:** the repository sets `externalSharingModel` to `Private` on this object. It is not offered in the new-object form in current releases, so treat it as something to confirm afterwards, not something to click now. For the portal this matters: a non-private value would let external users see the object through a sharing rule without one. Check in Object Manager after creating all ten objects.

### Step 2 — Create the tab

`Setup → App Launcher → New → Object`

| Setup form field | Enter |
| --- | --- |
| Category | any existing category — the repo defines none |
| Tab | Audit Outbox |
| Tab Style | any |
| Object | Audit Outbox (`AuditOutbox__c`) |

> Without a tab the object is invisible in Setup and you cannot reach the field screen. Do this before Step 3.
>
> The repository has no tab metadata of its own, so the category is not fixed by it. Whatever category you pick, keep it the same for all ten objects so the tabs end up together.

### Step 3 — Fields (9)

#### 1. `CorrelationId__c`

`Object Manager → Audit Outbox → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Text |
| Field Label | Correlation Id |
| Length | 36 |
| Required | unchecked |
| Unique | unchecked |
| External ID | unchecked |
| Description | Gemeinsame Kennung aller Ereignisse einer zusammenhaengenden Aktion, identisch zur Semantik in AuditEvent__c.CorrelationId__c. Wird beim Erzeugen des Payloads uebernommen, damit auch nach der Zustellung der Zusammenhang zwischen den Ereignissen rekonstruierbar bleibt. |

#### 2. `Error__c`

`Object Manager → Audit Outbox → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Text Area (Long) |
| Field Label | Error |
| Length | 32768 |
| Lines to display | 3 |
| Required | unchecked |
| Unique | unchecked |
| External ID | unchecked |
| Description | Letzte Fehlermeldung des Zustellversuchs. Dient der Diagnose; wird bei Erfolg nicht beachtet und nicht geleert, damit der Verlauf nachvollziehbar bleibt. |

#### 3. `EventType__c`

`Object Manager → Audit Outbox → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Text |
| Field Label | Event Type |
| Length | 255 |
| Required | [x] |
| Unique | unchecked |
| External ID | unchecked |
| Description | Ereignistyp des eingereihten Ereignisses, identisch zur Semantik in AuditEvent__c.EventType__c. Hier zur Nachverfolgung des Zustellversuchs. |

#### 4. `NextRetryAt__c`

`Object Manager → Audit Outbox → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Date/Time |
| Field Label | Next Retry At |
| Required | unchecked |
| Unique | unchecked |
| External ID | unchecked |
| Description | Zeitpunkt des naechsten Versuchs. Leer, solange der Eintrag nicht erneut versucht wird. Wird nach einem Fehlversuch aus dem Backoff berechnet. |

#### 5. `ParticipantId__c`

`Object Manager → Audit Outbox → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Text |
| Field Label | Participant Id |
| Length | 18 |
| Required | unchecked |
| Unique | unchecked |
| External ID | unchecked |
| Description | Bezug zum Teilnehmer als Text-Id, kein Lookup: der Eintrag kann auch dann noch ausgewertet werden, wenn das Ereignis selbst noch nicht existiert. |

#### 6. `Payload__c`

`Object Manager → Audit Outbox → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Text Area (Long) |
| Field Label | Payload |
| Length | 32768 |
| Lines to display | 3 |
| Required | unchecked |
| Unique | unchecked |
| External ID | unchecked |
| Description | Vollstaendiges AuditEvent__c als JSON, einschliesslich CorrelationId und Sensitivity. Aus diesem Feld wird der eigentliche Audit-Datensatz erzeugt. |

#### 7. `RetryCount__c`

`Object Manager → Audit Outbox → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Number |
| Field Label | Retry Count |
| Length (total digits) | 3 |
| Decimal Places | 0 |
| Required | [x] |
| Unique | unchecked |
| External ID | unchecked |
| Description | Bisherige Fehlversuche. Bestimmt zusammen mit NextRetryAt__c den Backoff und setzt eine Obergrenze fuer Eintraege, die dauerhaft scheitern. |

#### 8. `Status__c`

`Object Manager → Audit Outbox → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Picklist |
| Field Label | Status |
| Required | [x] |
| Unique | unchecked |
| External ID | unchecked |
| Restrict picklist to the values defined in the value set | checked |
| Description | Zustand des Zustellversuchs. pending wartet, delivered ist angekommen, failed ist endgueltig gescheitert. Steuert, ob ein weiterer Versuch erfolgt. |

Values — enter **Value** and **Display Value** separately:

| Value (API name) | Display Value | Default |
| --- | --- | --- |
| `PENDING` | PENDING | yes |
| `PROCESSED` | PROCESSED |  |
| `FAILED` | FAILED |  |

#### 9. `SubjectId__c`

`Object Manager → Audit Outbox → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Text |
| Field Label | Subject Id |
| Length | 18 |
| Required | unchecked |
| Unique | unchecked |
| External ID | unchecked |
| Description | Id des betroffenen Datensatzes ohne Objektraegersymbol. Wie in AuditEvent__c, damit die Zustellung ohne Ladevorgang auskommt. |

---

## AvailabilitySlot__c

**Fields:** 8 &nbsp;&nbsp; **Record Name:** AutoNumber

### Step 1 — Create the object

`Setup → Object Manager → Create → Custom Object`

| Setup form field | Enter |
| --- | --- |
| Label | Verfügbarkeits-Slot |
| Plural Label | Verfügbarkeits-Slots |
| Record Name | AutoNumber |
| Display Format | SLOT-{0000} |
| Starting Number | 1 |
| Description | Verfügbarkeits-Slot für Coach/Staff (Terminfindung) |
| Allow Reports | checked |
| Allow Activities | unchecked |
| Track Field History | checked |
| Allow Search | checked |
| Allow in Chatter Groups | unchecked |

> The API name is generated from the Label. After saving, Object Manager must show the API name `AvailabilitySlot__c`. If it differs, the object cannot be renamed — delete it and redo.
>
> **Verify:** the repository sets `externalSharingModel` to `Private` on this object. It is not offered in the new-object form in current releases, so treat it as something to confirm afterwards, not something to click now. For the portal this matters: a non-private value would let external users see the object through a sharing rule without one. Check in Object Manager after creating all ten objects.

### Step 2 — Create the tab

`Setup → App Launcher → New → Object`

| Setup form field | Enter |
| --- | --- |
| Category | any existing category — the repo defines none |
| Tab | Verfügbarkeits-Slot |
| Tab Style | any |
| Object | Verfügbarkeits-Slot (`AvailabilitySlot__c`) |

> Without a tab the object is invisible in Setup and you cannot reach the field screen. Do this before Step 3.
>
> The repository has no tab metadata of its own, so the category is not fixed by it. Whatever category you pick, keep it the same for all ten objects so the tabs end up together.

### Step 3 — Fields (8)

#### 1. `DayOfWeek__c`

`Object Manager → Verfügbarkeits-Slot → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Picklist |
| Field Label | Wochentag |
| Required | [x] |
| Unique | unchecked |
| External ID | unchecked |
| Restrict picklist to the values defined in the value set | checked |
| Description | Wochentag |

Values — enter **Value** and **Display Value** separately:

| Value (API name) | Display Value | Default |
| --- | --- | --- |
| `Monday` | Montag  <- different! |  |
| `Tuesday` | Dienstag  <- different! |  |
| `Wednesday` | Mittwoch  <- different! |  |
| `Thursday` | Donnerstag  <- different! |  |
| `Friday` | Freitag  <- different! |  |

#### 2. `EndTime__c`

`Object Manager → Verfügbarkeits-Slot → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Time |
| Field Label | Bis |
| Required | [x] |
| Unique | unchecked |
| External ID | unchecked |
| Description | Ende des Slots (Uhrzeit) |

#### 3. `IsActive__c`

`Object Manager → Verfügbarkeits-Slot → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Checkbox |
| Field Label | Aktiv |
| Required | unchecked |
| Unique | unchecked |
| External ID | unchecked |
| Description | Slot ist aktiv und buchbar |

#### 4. `StartTime__c`

`Object Manager → Verfügbarkeits-Slot → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Time |
| Field Label | Von |
| Required | [x] |
| Unique | unchecked |
| External ID | unchecked |
| Description | Beginn des Slots (Uhrzeit) |

#### 5. `Type__c`

`Object Manager → Verfügbarkeits-Slot → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Picklist |
| Field Label | Typ |
| Required | [x] |
| Unique | unchecked |
| External ID | unchecked |
| Restrict picklist to the values defined in the value set | checked |
| Description | Art der Verfügbarkeit |

Values — enter **Value** and **Display Value** separately:

| Value (API name) | Display Value | Default |
| --- | --- | --- |
| `Coaching` | Coaching |  |
| `CheckIn` | Check-In  <- different! |  |
| `General` | Allgemein  <- different! | yes |

#### 6. `ValidFrom__c`

`Object Manager → Verfügbarkeits-Slot → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Date |
| Field Label | Gültig ab |
| Required | unchecked |
| Unique | unchecked |
| External ID | unchecked |
| Description | Gültig ab (Datum) |

#### 7. `ValidTo__c`

`Object Manager → Verfügbarkeits-Slot → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Date |
| Field Label | Gültig bis |
| Required | unchecked |
| Unique | unchecked |
| External ID | unchecked |
| Description | Gültig bis (Datum) |

#### 8. `User__c`

`Object Manager → Verfügbarkeits-Slot → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Lookup |
| Field Label | Coach/Staff |
| Related To | User |
| Required | unchecked |
| Unique | unchecked |
| External ID | unchecked |
| Relationship Name | AvailabilitySlots |
| Description | Coach/Staff, dem der Slot gehört |
| Track Field History (Object-level, not per field) | see object step |

---

## Coach_Profile__c

**Fields:** 6 &nbsp;&nbsp; **Record Name:** Text

### Step 1 — Create the object

`Setup → Object Manager → Create → Custom Object`

| Setup form field | Enter |
| --- | --- |
| Label | Coach Profile |
| Plural Label | Coach Profiles |
| Record Name | Text |
| Description | Die Person eines Coachs mit den fuer die Betreuung relevanten Stammdaten. Unterscheidet sich vom Contact: der Contact ist die Privatperson, das Coach-Profil die berufliche Rolle in der Academy. |
| Allow Reports | unchecked |
| Allow Activities | unchecked |
| Track Field History | unchecked |
| Allow Search | unchecked |
| Allow in Chatter Groups | unchecked |

> The API name is generated from the Label. After saving, Object Manager must show the API name `Coach_Profile__c`. If it differs, the object cannot be renamed — delete it and redo.
>
> **Verify:** the repository sets `externalSharingModel` to `Private` on this object. It is not offered in the new-object form in current releases, so treat it as something to confirm afterwards, not something to click now. For the portal this matters: a non-private value would let external users see the object through a sharing rule without one. Check in Object Manager after creating all ten objects.

### Step 2 — Create the tab

`Setup → App Launcher → New → Object`

| Setup form field | Enter |
| --- | --- |
| Category | any existing category — the repo defines none |
| Tab | Coach Profile |
| Tab Style | any |
| Object | Coach Profile (`Coach_Profile__c`) |

> Without a tab the object is invisible in Setup and you cannot reach the field screen. Do this before Step 3.
>
> The repository has no tab metadata of its own, so the category is not fixed by it. Whatever category you pick, keep it the same for all ten objects so the tabs end up together.

### Step 3 — Fields (6)

#### 1. `Capacity__c`

`Object Manager → Coach Profile → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Number |
| Field Label | Capacity |
| Length (total digits) | 2 |
| Decimal Places | 0 |
| Required | unchecked |
| Unique | unchecked |
| External ID | unchecked |
| Description | Coach Capacity |

#### 2. `Discord__c`

`Object Manager → Coach Profile → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Text |
| Field Label | Discord |
| Length | 255 |
| Required | unchecked |
| Unique | unchecked |
| External ID | unchecked |
| Description | Coach Discord User Handle |

#### 3. `Email__c`

`Object Manager → Coach Profile → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Email |
| Field Label | Email |
| Required | unchecked |
| Unique | unchecked |
| External ID | unchecked |
| Description | Coach Email |

#### 4. `GitHub__c`

`Object Manager → Coach Profile → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Text |
| Field Label | GitHub |
| Length | 255 |
| Required | unchecked |
| Unique | unchecked |
| External ID | unchecked |
| Description | Coach GitHub Username |

#### 5. `Role__c`

`Object Manager → Coach Profile → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Picklist |
| Field Label | Role |
| Required | unchecked |
| Unique | unchecked |
| External ID | unchecked |
| Restrict picklist to the values defined in the value set | checked |
| Description | Coach Role |

Values — enter **Value** and **Display Value** separately:

| Value (API name) | Display Value | Default |
| --- | --- | --- |
| `Lead IT Coach` | Lead IT Coach |  |
| `Kubernetes Coach` | Kubernetes Coach |  |
| `AWS Coach` | AWS Coach |  |
| `Staff` | Staff |  |

#### 6. `Status__c`

`Object Manager → Coach Profile → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Checkbox |
| Field Label | Status |
| Required | unchecked |
| Unique | unchecked |
| External ID | unchecked |
| Description | Coach active status |

---

## Program__c

**Fields:** 3 &nbsp;&nbsp; **Record Name:** Text

### Step 1 — Create the object

`Setup → Object Manager → Create → Custom Object`

| Setup form field | Enter |
| --- | --- |
| Label | Program |
| Plural Label | Programs |
| Record Name | Text |
| Description | Course Program |
| Allow Reports | unchecked |
| Allow Activities | unchecked |
| Track Field History | unchecked |
| Allow Search | unchecked |
| Allow in Chatter Groups | unchecked |

> The API name is generated from the Label. After saving, Object Manager must show the API name `Program__c`. If it differs, the object cannot be renamed — delete it and redo.
>
> **Verify:** the repository sets `externalSharingModel` to `Private` on this object. It is not offered in the new-object form in current releases, so treat it as something to confirm afterwards, not something to click now. For the portal this matters: a non-private value would let external users see the object through a sharing rule without one. Check in Object Manager after creating all ten objects.

### Step 2 — Create the tab

`Setup → App Launcher → New → Object`

| Setup form field | Enter |
| --- | --- |
| Category | any existing category — the repo defines none |
| Tab | Program |
| Tab Style | any |
| Object | Program (`Program__c`) |

> Without a tab the object is invisible in Setup and you cannot reach the field screen. Do this before Step 3.
>
> The repository has no tab metadata of its own, so the category is not fixed by it. Whatever category you pick, keep it the same for all ten objects so the tabs end up together.

### Step 3 — Fields (3)

#### 1. `Description__c`

`Object Manager → Program → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Text Area (Long) |
| Field Label | Description |
| Length | 32768 |
| Lines to display | 10 |
| Required | unchecked |
| Unique | unchecked |
| External ID | unchecked |
| Description | Detailed Description of the Course |

#### 2. `DurationWeeks__c`

`Object Manager → Program → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Number |
| Field Label | DurationWeeks |
| Length (total digits) | 2 |
| Decimal Places | 0 |
| Required | unchecked |
| Unique | unchecked |
| External ID | unchecked |
| Description | Course Duration in Weeks |

#### 3. `Status__c`

`Object Manager → Program → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Picklist |
| Field Label | Status |
| Required | unchecked |
| Unique | unchecked |
| External ID | unchecked |
| Restrict picklist to the values defined in the value set | checked |
| Description | Current Status of Program |

Values — enter **Value** and **Display Value** separately:

| Value (API name) | Display Value | Default |
| --- | --- | --- |
| `Draft` | Draft | yes |
| `Active` | Active |  |
| `Archived` | Archived |  |

---

## Module__c

**Fields:** 3 &nbsp;&nbsp; **Record Name:** Text

### Step 1 — Create the object

`Setup → Object Manager → Create → Custom Object`

| Setup form field | Enter |
| --- | --- |
| Label | Module |
| Plural Label | Modules |
| Record Name | Text |
| Description | Reuseable program content template |
| Allow Reports | unchecked |
| Allow Activities | unchecked |
| Track Field History | unchecked |
| Allow Search | unchecked |
| Allow in Chatter Groups | unchecked |

> The API name is generated from the Label. After saving, Object Manager must show the API name `Module__c`. If it differs, the object cannot be renamed — delete it and redo.
>
> **Verify:** the repository sets `externalSharingModel` to `Private` on this object. It is not offered in the new-object form in current releases, so treat it as something to confirm afterwards, not something to click now. For the portal this matters: a non-private value would let external users see the object through a sharing rule without one. Check in Object Manager after creating all ten objects.

### Step 2 — Create the tab

`Setup → App Launcher → New → Object`

| Setup form field | Enter |
| --- | --- |
| Category | any existing category — the repo defines none |
| Tab | Module |
| Tab Style | any |
| Object | Module (`Module__c`) |

> Without a tab the object is invisible in Setup and you cannot reach the field screen. Do this before Step 3.
>
> The repository has no tab metadata of its own, so the category is not fixed by it. Whatever category you pick, keep it the same for all ten objects so the tabs end up together.

### Step 3 — Fields (3)

#### 1. `Description__c`

`Object Manager → Module → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Text Area (Long) |
| Field Label | Description |
| Length | 32768 |
| Lines to display | 3 |
| Required | unchecked |
| Unique | unchecked |
| External ID | unchecked |
| Description | Inhaltliche Beschreibung des Moduls fuer Teilnehmer: welche Themen behandelt werden und was als Ergebnis erwartet wird. |

#### 2. `Order__c`

`Object Manager → Module → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Number |
| Field Label | Order |
| Length (total digits) | 3 |
| Decimal Places | 0 |
| Required | unchecked |
| Unique | unchecked |
| External ID | unchecked |
| Description | Reihenfolge der Module innerhalb des Programms, fortlaufend ab 1. Die Anzeigereihenfolge im Kursplan ergibt sich allein daraus. |

#### 3. `Program__c`

`Object Manager → Module → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Lookup |
| Field Label | Program |
| Related To | Program__c |
| Required | [x] |
| Unique | unchecked |
| External ID | unchecked |
| Relationship Name | Modules |
| What happens when the related record is deleted | Restrict |
| Description | Lookup Relationship → Related To: Program__c |

> **Set "Restrict delete" now.** It cannot be changed to a weaker setting later — only tightened.

---

## Participant__c

**Fields:** 9 &nbsp;&nbsp; **Record Name:** Text

### Step 1 — Create the object

`Setup → Object Manager → Create → Custom Object`

| Setup form field | Enter |
| --- | --- |
| Label | Participant |
| Plural Label | Participants |
| Record Name | Text |
| Description | Participant Object |
| Allow Reports | unchecked |
| Allow Activities | unchecked |
| Track Field History | unchecked |
| Allow Search | unchecked |
| Allow in Chatter Groups | unchecked |

> The API name is generated from the Label. After saving, Object Manager must show the API name `Participant__c`. If it differs, the object cannot be renamed — delete it and redo.
>
> **Verify:** the repository sets `externalSharingModel` to `Private` on this object. It is not offered in the new-object form in current releases, so treat it as something to confirm afterwards, not something to click now. For the portal this matters: a non-private value would let external users see the object through a sharing rule without one. Check in Object Manager after creating all ten objects.

### Step 2 — Create the tab

`Setup → App Launcher → New → Object`

| Setup form field | Enter |
| --- | --- |
| Category | any existing category — the repo defines none |
| Tab | Participant |
| Tab Style | any |
| Object | Participant (`Participant__c`) |

> Without a tab the object is invisible in Setup and you cannot reach the field screen. Do this before Step 3.
>
> The repository has no tab metadata of its own, so the category is not fixed by it. Whatever category you pick, keep it the same for all ten objects so the tabs end up together.

### Step 3 — Fields (9)

#### 1. `Discord__c`

`Object Manager → Participant → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Text |
| Field Label | Discord |
| Length | 255 |
| Required | unchecked |
| Unique | unchecked |
| External ID | unchecked |
| Description | Discord User Handle |

#### 2. `Email__c`

`Object Manager → Participant → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Email |
| Field Label | Email |
| Required | unchecked |
| Unique | unchecked |
| External ID | unchecked |
| Description | Student Email Addres |

#### 3. `ExpectedEndDate__c`

`Object Manager → Participant → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Date |
| Field Label | ExpectedEndDate |
| Required | unchecked |
| Unique | unchecked |
| External ID | unchecked |
| Description | Student's Expected End Date |

#### 4. `GitHub__c`

`Object Manager → Participant → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Text |
| Field Label | GitHub |
| Length | 255 |
| Required | unchecked |
| Unique | unchecked |
| External ID | unchecked |
| Description | Github Username |

#### 5. `StartDate__c`

`Object Manager → Participant → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Date |
| Field Label | StartDate |
| Required | unchecked |
| Unique | unchecked |
| External ID | unchecked |
| Description | Student's Start Date |

#### 6. `Status__c`

`Object Manager → Participant → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Picklist |
| Field Label | Status |
| Required | unchecked |
| Unique | unchecked |
| External ID | unchecked |
| Restrict picklist to the values defined in the value set | checked |
| Description | Current Student Status |

Values — enter **Value** and **Display Value** separately:

| Value (API name) | Display Value | Default |
| --- | --- | --- |
| `Onboarding` | Onboarding | yes |
| `Active` | Active |  |
| `Paused` | Paused |  |
| `Graduated` | Graduated |  |
| `Placed` | Placed |  |
| `Dropped` | Dropped |  |

#### 7. `Coach_Profile__c`

`Object Manager → Participant → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Lookup |
| Field Label | Coach Profile |
| Related To | Coach_Profile__c |
| Required | unchecked |
| Unique | unchecked |
| External ID | unchecked |
| Relationship Name | Coach_Profiles |
| What happens when the related record is deleted | Set null |
| Description | Betreuender Coach. Null ist zulaessig und bedeutet noch keine Betreuung zugewiesen, nicht unbekannt. |

#### 8. `Contact__c`

`Object Manager → Participant → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Lookup |
| Field Label | Contact |
| Related To | Contact |
| Required | [x] |
| Unique | unchecked |
| External ID | unchecked |
| Relationship Name | Contacts |
| What happens when the related record is deleted | Restrict |
| Description | Die Person hinter dieser Teilnehmerrolle. Pflichtfeld und eindeutig: genau ein Participant__c je Contact, serverseitig erzwungen. Name und E-Mail stammen immer von hier, nicht aus den Feldern dieses Objekts. Loeschen des Contacts ist blockiert, solange ein Teilnehmer daran haengt. |

> **Set "Restrict delete" now.** It cannot be changed to a weaker setting later — only tightened.

#### 9. `Program__c`

`Object Manager → Participant → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Lookup |
| Field Label | Program |
| Related To | Program__c |
| Required | unchecked |
| Unique | unchecked |
| External ID | unchecked |
| Relationship Name | Programs |
| What happens when the related record is deleted | Set null |
| Description | Programm, in dem die Person eingeschrieben ist. Null bedeutet: angemeldet, aber noch keinem Programm zugeordnet — der Zustand direkt nach der Anlage. |

---

## Absence__c

**Fields:** 11 &nbsp;&nbsp; **Record Name:** AutoNumber

### Step 1 — Create the object

`Setup → Object Manager → Create → Custom Object`

| Setup form field | Enter |
| --- | --- |
| Label | Abwesenheit |
| Plural Label | Abwesenheiten |
| Record Name | AutoNumber |
| Display Format | ABS-{0000} |
| Starting Number | 1 |
| Description | Abwesenheitsmeldung eines Teilnehmers (Krank, Urlaub, etc.) |
| Allow Reports | checked |
| Allow Activities | unchecked |
| Track Field History | checked |
| Allow Search | checked |
| Allow in Chatter Groups | unchecked |

> The API name is generated from the Label. After saving, Object Manager must show the API name `Absence__c`. If it differs, the object cannot be renamed — delete it and redo.
>
> **Verify:** the repository sets `externalSharingModel` to `Private` on this object. It is not offered in the new-object form in current releases, so treat it as something to confirm afterwards, not something to click now. For the portal this matters: a non-private value would let external users see the object through a sharing rule without one. Check in Object Manager after creating all ten objects.

### Step 2 — Create the tab

`Setup → App Launcher → New → Object`

| Setup form field | Enter |
| --- | --- |
| Category | any existing category — the repo defines none |
| Tab | Abwesenheit |
| Tab Style | any |
| Object | Abwesenheit (`Absence__c`) |

> Without a tab the object is invisible in Setup and you cannot reach the field screen. Do this before Step 3.
>
> The repository has no tab metadata of its own, so the category is not fixed by it. Whatever category you pick, keep it the same for all ten objects so the tabs end up together.

### Step 3 — Fields (11)

#### 1. `ApprovedAt__c`

`Object Manager → Abwesenheit → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Date/Time |
| Field Label | Genehmigt am |
| Required | unchecked |
| Unique | unchecked |
| External ID | unchecked |
| Description | Zeitpunkt der Genehmigung |
| Track Field History (Object-level, not per field) | see object step |

#### 2. `CoachComment__c`

`Object Manager → Abwesenheit → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Text Area (Long) |
| Field Label | Coach-Kommentar |
| Length | 32768 |
| Lines to display | 4 |
| Required | unchecked |
| Unique | unchecked |
| External ID | unchecked |
| Description | Begründung bei Ablehnung durch Coach/Staff |

#### 3. `EndDate__c`

`Object Manager → Abwesenheit → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Date |
| Field Label | Bis |
| Required | [x] |
| Unique | unchecked |
| External ID | unchecked |
| Description | Letzter Tag der Abwesenheit |
| Track Field History (Object-level, not per field) | see object step |

#### 4. `Reason__c`

`Object Manager → Abwesenheit → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Text Area (Long) |
| Field Label | Grund |
| Length | 32768 |
| Lines to display | 4 |
| Required | unchecked |
| Unique | unchecked |
| External ID | unchecked |
| Description | Begründung (optional, sensitiv - Audit redaktioniert) |

#### 5. `RejectedAt__c`

`Object Manager → Abwesenheit → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Date/Time |
| Field Label | Abgelehnt am |
| Required | unchecked |
| Unique | unchecked |
| External ID | unchecked |
| Description | Zeitpunkt der Ablehnung |
| Track Field History (Object-level, not per field) | see object step |

#### 6. `StartDate__c`

`Object Manager → Abwesenheit → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Date |
| Field Label | Von |
| Required | [x] |
| Unique | unchecked |
| External ID | unchecked |
| Description | Erster Tag der Abwesenheit |
| Track Field History (Object-level, not per field) | see object step |

#### 7. `Status__c`

`Object Manager → Abwesenheit → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Picklist |
| Field Label | Status |
| Required | [x] |
| Unique | unchecked |
| External ID | unchecked |
| Restrict picklist to the values defined in the value set | checked |
| Description | Status der Abwesenheitsmeldung |
| Track Field History (Object-level, not per field) | see object step |

Values — enter **Value** and **Display Value** separately:

| Value (API name) | Display Value | Default |
| --- | --- | --- |
| `Submitted` | Submitted | yes |
| `Approved` | Approved |  |
| `Rejected` | Rejected |  |
| `Cancelled` | Cancelled |  |

#### 8. `Type__c`

`Object Manager → Abwesenheit → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Picklist |
| Field Label | Typ |
| Required | [x] |
| Unique | unchecked |
| External ID | unchecked |
| Restrict picklist to the values defined in the value set | checked |
| Description | Art der Abwesenheit (verweist auf AbsenceType__mdt) |

Values — enter **Value** and **Display Value** separately:

| Value (API name) | Display Value | Default |
| --- | --- | --- |
| `Krank` | Krank |  |
| `Urlaub` | Urlaub |  |
| `Berufsschule` | Berufsschule |  |
| `Praktikum` | Praktikum |  |
| `Behörde` | Behörde |  |
| `Sonstiges` | Sonstiges |  |

#### 9. `ApprovedBy__c`

`Object Manager → Abwesenheit → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Lookup |
| Field Label | Genehmigt von |
| Related To | User |
| Required | unchecked |
| Unique | unchecked |
| External ID | unchecked |
| Relationship Name | ApprovedAbsences |
| Description | Coach/Staff, der genehmigt hat |
| Track Field History (Object-level, not per field) | see object step |

#### 10. `Participant__c`

`Object Manager → Abwesenheit → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Lookup |
| Field Label | Teilnehmer |
| Related To | Participant__c |
| Required | [x] |
| Unique | unchecked |
| External ID | unchecked |
| Relationship Name | Absences |
| What happens when the related record is deleted | Restrict |
| Description | Teilnehmer, der die Abwesenheit meldet |
| Track Field History (Object-level, not per field) | see object step |

> **Set "Restrict delete" now.** It cannot be changed to a weaker setting later — only tightened.

#### 11. `RejectedBy__c`

`Object Manager → Abwesenheit → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Lookup |
| Field Label | Abgelehnt von |
| Related To | User |
| Required | unchecked |
| Unique | unchecked |
| External ID | unchecked |
| Relationship Name | RejectedAbsences |
| Description | Coach/Staff, der abgelehnt hat |
| Track Field History (Object-level, not per field) | see object step |

---

## Appointment__c

**Fields:** 13 &nbsp;&nbsp; **Record Name:** AutoNumber

### Step 1 — Create the object

`Setup → Object Manager → Create → Custom Object`

| Setup form field | Enter |
| --- | --- |
| Label | Termin |
| Plural Label | Termine |
| Record Name | AutoNumber |
| Display Format | TERM-{0000} |
| Starting Number | 1 |
| Description | Termin zwischen Coach/Staff und Teilnehmer |
| Allow Reports | checked |
| Allow Activities | unchecked |
| Track Field History | checked |
| Allow Search | checked |
| Allow in Chatter Groups | unchecked |

> The API name is generated from the Label. After saving, Object Manager must show the API name `Appointment__c`. If it differs, the object cannot be renamed — delete it and redo.
>
> **Verify:** the repository sets `externalSharingModel` to `Private` on this object. It is not offered in the new-object form in current releases, so treat it as something to confirm afterwards, not something to click now. For the portal this matters: a non-private value would let external users see the object through a sharing rule without one. Check in Object Manager after creating all ten objects.

### Step 2 — Create the tab

`Setup → App Launcher → New → Object`

| Setup form field | Enter |
| --- | --- |
| Category | any existing category — the repo defines none |
| Tab | Termin |
| Tab Style | any |
| Object | Termin (`Appointment__c`) |

> Without a tab the object is invisible in Setup and you cannot reach the field screen. Do this before Step 3.
>
> The repository has no tab metadata of its own, so the category is not fixed by it. Whatever category you pick, keep it the same for all ten objects so the tabs end up together.

### Step 3 — Fields (13)

#### 1. `CancellationReason__c`

`Object Manager → Termin → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Text Area (Long) |
| Field Label | Absagegrund |
| Length | 32768 |
| Lines to display | 4 |
| Required | unchecked |
| Unique | unchecked |
| External ID | unchecked |
| Description | Begründung bei Absage |

#### 2. `CompletedAt__c`

`Object Manager → Termin → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Date/Time |
| Field Label | Durchgeführt am |
| Required | unchecked |
| Unique | unchecked |
| External ID | unchecked |
| Description | Zeitpunkt der Durchführung |
| Track Field History (Object-level, not per field) | see object step |

#### 3. `ConfirmedAt__c`

`Object Manager → Termin → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Date/Time |
| Field Label | Bestätigt am |
| Required | unchecked |
| Unique | unchecked |
| External ID | unchecked |
| Description | Zeitpunkt der Bestätigung |
| Track Field History (Object-level, not per field) | see object step |

#### 4. `CorrelationId__c`

`Object Manager → Termin → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Text |
| Field Label | Correlation ID |
| Length | 36 |
| Required | unchecked |
| Unique | [x] |
| External ID | [x] |
| Description | Booking Journey Correlation ID (First-Class Tracker) |

#### 5. `EndTime__c`

`Object Manager → Termin → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Date/Time |
| Field Label | Bis |
| Required | [x] |
| Unique | unchecked |
| External ID | unchecked |
| Description | Ende des Termins |
| Track Field History (Object-level, not per field) | see object step |

#### 6. `Location__c`

`Object Manager → Termin → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Picklist |
| Field Label | Ort |
| Required | unchecked |
| Unique | unchecked |
| External ID | unchecked |
| Restrict picklist to the values defined in the value set | checked |
| Description | Ort/Art des Termins |

Values — enter **Value** and **Display Value** separately:

| Value (API name) | Display Value | Default |
| --- | --- | --- |
| `OnSite` | Vor Ort  <- different! |  |
| `Teams` | MS Teams  <- different! |  |
| `Phone` | Telefon  <- different! |  |
| `Hybrid` | Hybrid |  |
| `External` | Extern  <- different! |  |

#### 7. `MeetingLink__c`

`Object Manager → Termin → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | URL |
| Field Label | Meeting Link |
| Length |  |
| Required | unchecked |
| Unique | unchecked |
| External ID | unchecked |
| Description | Link zum Online-Meeting (Teams, Zoom, etc.) |

#### 8. `Notes__c`

`Object Manager → Termin → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Text Area (Long) |
| Field Label | Notizen |
| Length | 32768 |
| Lines to display | 4 |
| Required | unchecked |
| Unique | unchecked |
| External ID | unchecked |
| Description | Notizen zum Termin |

#### 9. `StartTime__c`

`Object Manager → Termin → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Date/Time |
| Field Label | Von |
| Required | [x] |
| Unique | unchecked |
| External ID | unchecked |
| Description | Beginn des Termins |
| Track Field History (Object-level, not per field) | see object step |

#### 10. `Status__c`

`Object Manager → Termin → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Picklist |
| Field Label | Status |
| Required | [x] |
| Unique | unchecked |
| External ID | unchecked |
| Restrict picklist to the values defined in the value set | checked |
| Description | Status des Termins |
| Track Field History (Object-level, not per field) | see object step |

Values — enter **Value** and **Display Value** separately:

| Value (API name) | Display Value | Default |
| --- | --- | --- |
| `Draft` | Draft | yes |
| `Finding` | Terminfindung  <- different! |  |
| `Confirmed` | Bestätigt  <- different! |  |
| `Completed` | Durchgeführt  <- different! |  |
| `Documented` | Dokumentiert  <- different! |  |
| `Cancelled` | Abgesagt  <- different! |  |
| `NoShow` | Nicht erschienen  <- different! |  |

#### 11. `Type__c`

`Object Manager → Termin → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Picklist |
| Field Label | Typ |
| Required | [x] |
| Unique | unchecked |
| External ID | unchecked |
| Restrict picklist to the values defined in the value set | checked |
| Description | Art des Termins |
| Track Field History (Object-level, not per field) | see object step |

Values — enter **Value** and **Display Value** separately:

| Value (API name) | Display Value | Default |
| --- | --- | --- |
| `Coaching` | Coaching |  |
| `CheckIn` | Check-In  <- different! |  |
| `Berufsschule` | Berufsschule |  |
| `Behörde` | Behörde |  |
| `Praktikum` | Praktikum |  |
| `Sonstiges` | Sonstiges |  |

#### 12. `Coach__c`

`Object Manager → Termin → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Lookup |
| Field Label | Coach |
| Related To | User |
| Required | unchecked |
| Unique | unchecked |
| External ID | unchecked |
| Relationship Name | CoachedAppointments |
| Description | Coach, der den Termin durchführt |
| Track Field History (Object-level, not per field) | see object step |

#### 13. `Participant__c`

`Object Manager → Termin → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Lookup |
| Field Label | Teilnehmer |
| Related To | Participant__c |
| Required | [x] |
| Unique | unchecked |
| External ID | unchecked |
| Relationship Name | Appointments |
| What happens when the related record is deleted | Restrict |
| Description | Teilnehmer des Termins |
| Track Field History (Object-level, not per field) | see object step |

> **Set "Restrict delete" now.** It cannot be changed to a weaker setting later — only tightened.

---

## AuditEvent__c

**Fields:** 22 &nbsp;&nbsp; **Record Name:** AutoNumber

### Step 1 — Create the object

`Setup → Object Manager → Create → Custom Object`

| Setup form field | Enter |
| --- | --- |
| Label | Audit Event |
| Plural Label | Audit Events |
| Record Name | AutoNumber |
| Display Format | AE-{000000} |
| Starting Number | 1 |
| Description | Unveraenderliches Protokoll aller fachlich relevanten Aktionen. Ein Datensatz je Aktion, geschrieben und nie wieder geaendert. Dient als Nachweis fuer den Activity-Stream und fuer das Portal: Sichtbarkeit und Empfindlichkeit steuern, wer ein Ereignis sehen darf. |
| Allow Reports | checked |
| Allow Activities | unchecked |
| Track Field History | unchecked |
| Allow Search | unchecked |
| Allow in Chatter Groups | unchecked |

> The API name is generated from the Label. After saving, Object Manager must show the API name `AuditEvent__c`. If it differs, the object cannot be renamed — delete it and redo.
>
> **Verify:** the repository sets `externalSharingModel` to `Private` on this object. It is not offered in the new-object form in current releases, so treat it as something to confirm afterwards, not something to click now. For the portal this matters: a non-private value would let external users see the object through a sharing rule without one. Check in Object Manager after creating all ten objects.

### Step 2 — Create the tab

`Setup → App Launcher → New → Object`

| Setup form field | Enter |
| --- | --- |
| Category | any existing category — the repo defines none |
| Tab | Audit Event |
| Tab Style | any |
| Object | Audit Event (`AuditEvent__c`) |

> Without a tab the object is invisible in Setup and you cannot reach the field screen. Do this before Step 3.
>
> The repository has no tab metadata of its own, so the category is not fixed by it. Whatever category you pick, keep it the same for all ten objects so the tabs end up together.

### Step 3 — Fields (22)

#### 1. `Action__c`

`Object Manager → Audit Event → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Picklist |
| Field Label | Action |
| Required | [x] |
| Unique | unchecked |
| External ID | unchecked |
| Restrict picklist to the values defined in the value set | checked |
| Description | Kurzform der Aktion ohne Domaene, z. B. approved aus absence.approved. Redundant zu EventType__c, aber direkt gruppier- und sortierbar. |

Values — enter **Value** and **Display Value** separately:

| Value (API name) | Display Value | Default |
| --- | --- | --- |
| `created` | created |  |
| `updated` | updated |  |
| `deleted` | deleted |  |
| `archived` | archived |  |
| `restored` | restored |  |
| `status_changed` | status_changed |  |
| `submitted` | submitted |  |
| `approved` | approved |  |
| `rejected` | rejected |  |
| `cancelled` | cancelled |  |
| `assigned` | assigned |  |
| `started` | started |  |
| `stopped` | stopped |  |
| `checked_in` | checked_in |  |
| `checked_out` | checked_out |  |
| `corrected` | corrected |  |
| `flagged` | flagged |  |
| `reviewed` | reviewed |  |
| `rescheduled` | rescheduled |  |
| `attendance_changed` | attendance_changed |  |
| `document_added` | document_added |  |
| `answer_updated` | answer_updated |  |
| `reported` | reported |  |
| `entry_created` | entry_created |  |
| `entry_updated` | entry_updated |  |
| `entry_deleted` | entry_deleted |  |
| `reordered` | reordered |  |

#### 2. `ActorDisplayName__c`

`Object Manager → Audit Event → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Text |
| Field Label | Actor Display Name |
| Length | 255 |
| Required | unchecked |
| Unique | unchecked |
| External ID | unchecked |
| Description | Anzeigename des Akteurs zum Zeitpunkt des Ereignisses. Festgeschrieben, damit das Protokoll auch nach einer Namensanderung lesbar bleibt. |

#### 3. `ActorId__c`

`Object Manager → Audit Event → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Text |
| Field Label | Actor Id |
| Length | 18 |
| Required | unchecked |
| Unique | unchecked |
| External ID | unchecked |
| Description | Kennung des Akteurs, meist die Salesforce-User-Id. Bewusst Text und kein Lookup: das Ereignis muss auch dann lesbar bleiben, wenn der ausloesende User spaeter geloescht wird. |

#### 4. `ActorType__c`

`Object Manager → Audit Event → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Picklist |
| Field Label | Actor Type |
| Required | [x] |
| Unique | unchecked |
| External ID | unchecked |
| Restrict picklist to the values defined in the value set | checked |
| Description | Art des Akteurs. system und integration haben keine Salesforce-User-Id, weshalb ActorId__c dann ein stabiler Schluessel aus dem Aufrufer ist. |

Values — enter **Value** and **Display Value** separately:

| Value (API name) | Display Value | Default |
| --- | --- | --- |
| `staff` | staff |  |
| `participant` | participant |  |
| `system` | system |  |
| `integration` | integration |  |

#### 5. `ChangedFields__c`

`Object Manager → Audit Event → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Text Area (Long) |
| Field Label | Changed Fields |
| Length | 4000 |
| Lines to display | 5 |
| Required | unchecked |
| Unique | unchecked |
| External ID | unchecked |
| Description | Komma-getrennte Liste der Feld-API-Namen, die sich geaendert haben. fuer schnelles Filtern, ohne Changes__c parsen zu muessen. |

#### 6. `Changes__c`

`Object Manager → Audit Event → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Text Area (Long) |
| Field Label | Changes |
| Length | 131072 |
| Lines to display | 3 |
| Required | unchecked |
| Unique | unchecked |
| External ID | unchecked |
| Description | JSON mit den geaenderten Werten im Format {feld: {old: ..., new: ...}}. Enthaelt bei Abwesenheitsgruenden bewusst keine Klartextwerte — dort greift die Redaktion ueber Sensitivity__c. |

#### 7. `CorrelationId__c`

`Object Manager → Audit Event → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Text |
| Field Label | Correlation Id |
| Length | 36 |
| Required | unchecked |
| Unique | unchecked |
| External ID | unchecked |
| Description | Gemeinsame Kennung aller Ereignisse einer zusammenhaengenden Aktion, z. B. einer Statusaenderung mit Folgeereignissen. Erlaubt die Rekonstruktion eines Ablaufs ueber mehrere Datensaetze. |

#### 8. `Domain__c`

`Object Manager → Audit Event → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Picklist |
| Field Label | Domain |
| Required | [x] |
| Unique | unchecked |
| External ID | unchecked |
| Restrict picklist to the values defined in the value set | checked |
| Description | Fachlicher Bereich des Ereignisses, z. B. absence oder appointment. Steuert die Gruppierung in der Activity-Ansicht und ist unabhaengig vom konkreten Ereignistyp. |

Values — enter **Value** and **Display Value** separately:

| Value (API name) | Display Value | Default |
| --- | --- | --- |
| `workbook` | workbook |  |
| `absence` | absence |  |
| `appointment` | appointment |  |
| `classbook` | classbook |  |
| `daily_checkin` | daily_checkin |  |
| `time_tracking` | time_tracking |  |
| `authentication` | authentication |  |
| `participant` | participant |  |
| `system` | system |  |
| `learning_path` | learning_path |  |
| `availability` | availability |  |

#### 9. `EventType__c`

`Object Manager → Audit Event → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Text |
| Field Label | Event Type |
| Length | 80 |
| Required | [x] |
| Unique | unchecked |
| External ID | unchecked |
| Description | Ereignistyp im Format <domaene>.<aktion>, z. B. absence.approved. Die vollstaendige Matrix der erlaubten Werte steht in docs/activity-coverage.md; neue Typen werden dort ergaenzt, bevor sie hier verwendet werden. |

#### 10. `Metadata__c`

`Object Manager → Audit Event → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Text Area (Long) |
| Field Label | Metadata |
| Length | 131072 |
| Lines to display | 5 |
| Required | unchecked |
| Unique | unchecked |
| External ID | unchecked |
| Description | Zusaetzliche Kontextdaten als JSON, die nicht in Changes__c gehoeren, z. B. betroffene Feldlisten oder Parameter eines Fehlschlags. |

#### 11. `OccurredAt__c`

`Object Manager → Audit Event → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Date/Time |
| Field Label | Occurred At |
| Required | [x] |
| Unique | unchecked |
| External ID | unchecked |
| Description | Zeitpunkt, zu dem die fachliche Aktion eingetreten ist. Nicht der Schreibzeitpunkt des Datensatzes: ein spaeter nachgereichter Import kann beide unterscheiden. |

#### 12. `ParentId__c`

`Object Manager → Audit Event → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Text |
| Field Label | Parent Id |
| Length | 80 |
| Required | unchecked |
| Unique | unchecked |
| External ID | unchecked |
| Description | Id des uebergeordneten Datensatzes, ohne Objektraegersymbol. Paart mit ParentType__c. |

#### 13. `ParentType__c`

`Object Manager → Audit Event → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Text |
| Field Label | Parent Type |
| Length | 80 |
| Required | unchecked |
| Unique | unchecked |
| External ID | unchecked |
| Description | Objekt-API-Name des uebergeordneten Datensatzes, z. B. der Kontakt hinter einem Termin. Erlaubt die Gruppierung, wenn die Aektion streng genommen einem anderen Objekt als SubjectType__c gehoert. |

#### 14. `Reason__c`

`Object Manager → Audit Event → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Text Area (Long) |
| Field Label | Reason |
| Length | 1000 |
| Lines to display | 3 |
| Required | unchecked |
| Unique | unchecked |
| External ID | unchecked |
| Description | Freitextbegruendung der Aktion, z. B. der Ablehnungsgrund. Nur belegt, wenn die ausloesende Funktion bewusst eine Begruendung uebergibt. |

#### 15. `RequestId__c`

`Object Manager → Audit Event → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Text |
| Field Label | Request Id |
| Length | 36 |
| Required | unchecked |
| Unique | [x] |
| External ID | [x] |
| Description | Kennung des ausloesenden Requests, meist ein GUID aus dem Client. Bindet das Ereignis an einen konkreten HTTP-Aufruf, falls mehrerekoennig ueber AuditOutbox__c zustellbar sind. |

#### 16. `SchemaVersion__c`

`Object Manager → Audit Event → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Number |
| Field Label | Schema Version |
| Length (total digits) | 3 |
| Decimal Places | 0 |
| Required | [x] |
| Unique | unchecked |
| External ID | unchecked |
| Description | Version des beim Schreiben verwendeten Ereignisformats. Erlaubt spaeter das Auslesen alter Ereignisse, auch wenn sich die Struktur von Changes__c oder Metadata__c weiterentwickelt. |

#### 17. `Sensitivity__c`

`Object Manager → Audit Event → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Picklist |
| Field Label | Sensitivity |
| Required | [x] |
| Unique | unchecked |
| External ID | unchecked |
| Restrict picklist to the values defined in the value set | checked |
| Description | Empfindlichkeit des Inhalts. restricted verhindert die Ausgabe sensibler Werte an Berechtigte, die nur das Ereignis sehen duerfen — etwa Abwesenheitsgruende. Steuert die Redaktion, nicht die Sichtbarkeit. |

Values — enter **Value** and **Display Value** separately:

| Value (API name) | Display Value | Default |
| --- | --- | --- |
| `normal` | normal |  |
| `personal` | personal |  |
| `restricted` | restricted |  |

#### 18. `Source__c`

`Object Manager → Audit Event → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Picklist |
| Field Label | Source |
| Required | [x] |
| Unique | unchecked |
| External ID | unchecked |
| Restrict picklist to the values defined in the value set | checked |
| Description | Weg, auf dem die Aktion eingegangen ist. Unterscheidet direkte Bedienung (web, mobile) von Integrationen (api, import, migration) und erlaubt damit die Bewertung der Datenqualitaet. |

Values — enter **Value** and **Display Value** separately:

| Value (API name) | Display Value | Default |
| --- | --- | --- |
| `web` | web |  |
| `mobile` | mobile |  |
| `api` | api |  |
| `import` | import |  |
| `automation` | automation |  |
| `integration` | integration |  |
| `migration` | migration |  |

#### 19. `SubjectId__c`

`Object Manager → Audit Event → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Text |
| Field Label | Subject Id |
| Length | 18 |
| Required | [x] |
| Unique | unchecked |
| External ID | unchecked |
| Description | Id des geaenderten Datensatzes, ohne Objektraegersymbol. Paart mit SubjectType__c und wird dort zusammen ausgewertet. |

#### 20. `SubjectType__c`

`Object Manager → Audit Event → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Text |
| Field Label | Subject Type |
| Length | 80 |
| Required | [x] |
| Unique | unchecked |
| External ID | unchecked |
| Description | Objekt-API-Name des geaenderten Datensatzes, z. B. Participant__c. Freitext, damit auch Standardobjekte wie Opportunity protokolliert werden koennen ohne feste Auswahlliste. |

#### 21. `Visibility__c`

`Object Manager → Audit Event → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Picklist |
| Field Label | Visibility |
| Required | [x] |
| Unique | unchecked |
| External ID | unchecked |
| Restrict picklist to the values defined in the value set | checked |
| Description | Wer das Ereignis sehen darf. staff nur intern, participant auch im Portal, restricted nur fuer einen eingeschraenkten Personenkreis. Orthogonal zu Sensitivity__c: ein Ereignis kann sichtbar und trotzdem redigiert sein. |

Values — enter **Value** and **Display Value** separately:

| Value (API name) | Display Value | Default |
| --- | --- | --- |
| `staff` | staff |  |
| `participant` | participant |  |
| `restricted` | restricted |  |

#### 22. `ParticipantId__c`

`Object Manager → Audit Event → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Lookup |
| Field Label | Participant Id |
| Related To | Participant__c |
| Required | unchecked |
| Unique | unchecked |
| External ID | unchecked |
| Relationship Name | Audit_Events |
| What happens when the related record is deleted | Restrict |
| Description | Bezug zum Teilnehmer, bei dem die Aktion ausgeloest wurde. Denormalisiert, damit Ereignisse ohne Join und ohne Index auf den Textfeldern auswertbar sind. Leer, wenn die Aktion nicht einem Teilnehmer zuzuordnen ist. |

> **Set "Restrict delete" now.** It cannot be changed to a weaker setting later — only tightened.

---

## Learning_Path__c

**Fields:** 6 &nbsp;&nbsp; **Record Name:** AutoNumber

### Step 1 — Create the object

`Setup → Object Manager → Create → Custom Object`

| Setup form field | Enter |
| --- | --- |
| Label | Learning Path |
| Plural Label | Learning Paths |
| Record Name | AutoNumber |
| Display Format | LP-{0000} |
| Starting Number | 1 |
| Description | Participant-specific curriculum item |
| Allow Reports | unchecked |
| Allow Activities | unchecked |
| Track Field History | unchecked |
| Allow Search | unchecked |
| Allow in Chatter Groups | unchecked |

> The API name is generated from the Label. After saving, Object Manager must show the API name `Learning_Path__c`. If it differs, the object cannot be renamed — delete it and redo.
>
> **Verify:** the repository sets `externalSharingModel` to `Private` on this object. It is not offered in the new-object form in current releases, so treat it as something to confirm afterwards, not something to click now. For the portal this matters: a non-private value would let external users see the object through a sharing rule without one. Check in Object Manager after creating all ten objects.

### Step 2 — Create the tab

`Setup → App Launcher → New → Object`

| Setup form field | Enter |
| --- | --- |
| Category | any existing category — the repo defines none |
| Tab | Learning Path |
| Tab Style | any |
| Object | Learning Path (`Learning_Path__c`) |

> Without a tab the object is invisible in Setup and you cannot reach the field screen. Do this before Step 3.
>
> The repository has no tab metadata of its own, so the category is not fixed by it. Whatever category you pick, keep it the same for all ten objects so the tabs end up together.

### Step 3 — Fields (6)

#### 1. `Estimated_Weeks__c`

`Object Manager → Learning Path → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Number |
| Field Label | Estimated Weeks |
| Length (total digits) | 2 |
| Decimal Places | 0 |
| Required | unchecked |
| Unique | unchecked |
| External ID | unchecked |
| Description | Geplante Dauer in Wochen als Planungswert. Keine Ist-Zeit: Abweichungen ergeben sich aus Terminen und Lernfortschritt, nicht aus diesem Feld. |

#### 2. `Order__c`

`Object Manager → Learning Path → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Number |
| Field Label | Order |
| Length (total digits) | 3 |
| Decimal Places | 0 |
| Required | unchecked |
| Unique | unchecked |
| External ID | unchecked |
| Description | Position in der Reihenfolge des Lernpfads. Fortlaufend ab 1; bestimmt die Anzeigereihenfolge und ist der Grund fuer das reorder-Ereignis. |

#### 3. `Status__c`

`Object Manager → Learning Path → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Picklist |
| Field Label | Status |
| Required | unchecked |
| Unique | unchecked |
| External ID | unchecked |
| Restrict picklist to the values defined in the value set | checked |
| Description | Bearbeitungsstand dieses Elements beim Teilnehmer. Planned bis zum Start, In Progress waehrenddessen, Completed bei Abschluss. |

Values — enter **Value** and **Display Value** separately:

| Value (API name) | Display Value | Default |
| --- | --- | --- |
| `Planned` | Planned | yes |
| `In Progress` | In Progress |  |
| `Completed` | Completed |  |

#### 4. `Title__c`

`Object Manager → Learning Path → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Text |
| Field Label | Title |
| Length | 255 |
| Required | [x] |
| Unique | unchecked |
| External ID | unchecked |
| Description | Bezeichnung des Elements in der Lernpfad-Ansicht, z. B. AWS SAA. Kann vom Namen des verknuepften Programms abweichen, wenn der Teilnehmer eine kuerzere oder praezisere Bezeichnung sieht. |

#### 5. `Participant__c`

`Object Manager → Learning Path → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Lookup |
| Field Label | Participant |
| Related To | Participant__c |
| Required | unchecked |
| Unique | unchecked |
| External ID | unchecked |
| Relationship Name | Learning_Paths |
| What happens when the related record is deleted | Set null |
| Description | Teilnehmer, fuer den dieses Lernpfad-Element gilt. Pflichtfeld: ein Element ohne Teilnehmer gehoert zu niemandem und waere ein Datenhaufen. |

#### 6. `Program__c`

`Object Manager → Learning Path → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Lookup |
| Field Label | Program |
| Related To | Program__c |
| Required | unchecked |
| Unique | unchecked |
| External ID | unchecked |
| Relationship Name | Learning_Paths |
| What happens when the related record is deleted | Set null |
| Description | Programm, in dessen Rahmen das Element liegt. Stellt sicher, dass Lernpfad und Programm zusammenpassen; wird gegen Program__c des Teilnehmers abgeglichen. |

---


## Nach der Anlage

```bash
cd backend
npm run schema:check
```

Exit 0 heisst: alle 90 Felder sind im Runtime-Schema und per SOQL abfragbar. **Achtung:**
`schema-check` prueft nur die *Existenz* der Felder, nicht ihre Attribute. `required`,
`unique`, Picklist-Werte, Laengen und Descriptions sind damit nicht abgedeckt.

Der eigentliche Nachweis ist der Abgleich mit dem Repository:

```bash
sf project retrieve start \
  --metadata CustomObject:Program__c --metadata CustomObject:Participant__c \
  --target-org hubSandbox
git diff
```

Leerer Diff heisst: Setup und Repository beschreiben dieselbe Sache.

## Haeufige Fehlerquellen

| Fehler | Folge |
| ------ | ----- |
| Picklist-Value als Anzeigewert statt API-Name eingetragen | API-Id wird zu `Vor_Ort` statt `OnSite`; Apex und GraphQL brechen zur Laufzeit |
| Relationship Name weggelassen | Setup vergibt einen anderen; davon haengt die Related-Liste ab |
| API-Name nach dem Speichern nicht geprueft | falscher Name laesst sich nicht mehr korrigieren, nur loeschen |
| "Restrict delete" erst nachtraeglich gesetzt | gar nicht mehr moeglich, nur noch verschaerfen |
| Tab nicht angelegt | Objekt in Setup nicht erreichbar, Felder nicht anlegbar |
| Feld nach dem Anlegen umbenannt | nicht moeglich, Type und API-Name sind fix |
