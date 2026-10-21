# Setup Worklist — Academy data model in `hubSandbox`

**Stand:** 2026-10-21
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
sein Zielfeld existiert. Die 5 Wurzelobjekte sind unabhaengig.

| # | Objekt | Felder | Lookup-Voraussetzung |
| - | ------ | -----: | ------------------- |
| 1 | `AuditOutbox__c` | 9 | — (Wurzelobjekt) |
| 2 | `AvailabilitySlot__c` | 8 | — (Wurzelobjekt) |
| 3 | `Coach_Profile__c` | 7 | — (Wurzelobjekt) |
| 4 | `Contact` | 1 | — (Wurzelobjekt) |
| 5 | `Program__c` | 3 | — (Wurzelobjekt) |
| 6 | `Module__c` | 3 | `Program__c` |
| 7 | `ParticipantGroup__c` | 3 | `Coach_Profile__c`, `Program__c` |
| 8 | `Participant__c` | 12 | `Coach_Profile__c`, `Contact`, `Program__c` |
| 9 | `Absence__c` | 11 | `Participant__c` |
| 10 | `Appointment__c` | 13 | `Participant__c` |
| 11 | `AuditEvent__c` | 22 | `Participant__c` |
| 12 | `Learning_Path__c` | 6 | `Participant__c`, `Program__c` |
| 13 | `ParticipantGroupMember__c` | 3 | `ParticipantGroup__c`, `Participant__c` |
| 14 | `ProgramWeek__c` | 5 | `Module__c`, `Program__c` |
| 15 | `ScheduleTemplate__c` | 5 | `Module__c`, `ProgramWeek__c`, `Program__c` |
| 16 | `WeeklySchedule__c` | 13 | `ParticipantGroup__c`, `Participant__c`, `ProgramWeek__c`, `ScheduleTemplate__c` |
| 17 | `ScheduleEntry__c` | 22 | `Coach_Profile__c`, `ParticipantGroup__c`, `Participant__c`, `ScheduleEntry__c`, `ScheduleTemplate__c`, `WeeklySchedule__c` |
| 18 | `TaskCompletion__c` | 5 | `Participant__c`, `ScheduleEntry__c` |

---

## AuditOutbox__c

**Fields:** 9 &nbsp;&nbsp; **Record Name:** AutoNumber

### Step 1 — Create the object

`Setup → Object Manager → Create → Custom Object`

| Setup form field | Enter |
| --- | --- |
| Label | Audit Outbox |
| Object Name (API) | `AuditOutbox__c` |
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

> **Enter the API name exactly as given above.** Salesforce derives it from the Label, and for this object it would derive `Audit_Outbox__c` — not the name this project uses. The API name cannot be changed after saving: a wrong name means deleting the object and creating it again.
>
> **Verify:** the repository sets `externalSharingModel` to `Private` on this object. It is not offered in the new-object form in current releases, so treat it as something to confirm afterwards, not something to click now. For the portal this matters: a non-private value would let external users see the object through a sharing rule without one. Check in Object Manager after creating every object in this list that is not a standard object.
>
> **Set the org-wide default by hand.** The form above does not set it. The OWD lives in `Setup → Sharing Settings` and is **not** part of the object metadata — neither a deploy nor a retrieve carries it, and it does not survive a sandbox refresh. Set it to **Private** (internal **and** external) unless the object needs broader access, then confirm it in `Setup → Sharing Settings`. Record the step in `backend/docs/g1-manual-checklist.md` — it is the one thing about an object that the repository cannot prove.

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
> The repository has no tab metadata of its own, so the category is not fixed by it. Whatever category you pick, keep it the same for every object in this list so the tabs end up together.

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
| Object Name (API) | `AvailabilitySlot__c` |
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

> **Enter the API name exactly as given above.** Salesforce derives it from the Label, and for this object it would derive `Verfuegbarkeits_Slot__c` — not the name this project uses. The API name cannot be changed after saving: a wrong name means deleting the object and creating it again.
>
> **Verify:** the repository sets `externalSharingModel` to `Private` on this object. It is not offered in the new-object form in current releases, so treat it as something to confirm afterwards, not something to click now. For the portal this matters: a non-private value would let external users see the object through a sharing rule without one. Check in Object Manager after creating every object in this list that is not a standard object.
>
> **Set the org-wide default by hand.** The form above does not set it. The OWD lives in `Setup → Sharing Settings` and is **not** part of the object metadata — neither a deploy nor a retrieve carries it, and it does not survive a sandbox refresh. Set it to **Private** (internal **and** external) unless the object needs broader access, then confirm it in `Setup → Sharing Settings`. Record the step in `backend/docs/g1-manual-checklist.md` — it is the one thing about an object that the repository cannot prove.

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
> The repository has no tab metadata of its own, so the category is not fixed by it. Whatever category you pick, keep it the same for every object in this list so the tabs end up together.

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
| `Monday` | Monday |  |
| `Tuesday` | Tuesday |  |
| `Wednesday` | Wednesday |  |
| `Thursday` | Thursday |  |
| `Friday` | Friday |  |

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
| `CheckIn` | CheckIn |  |
| `General` | General | yes |

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

**Fields:** 7 &nbsp;&nbsp; **Record Name:** Text

### Step 1 — Create the object

`Setup → Object Manager → Create → Custom Object`

| Setup form field | Enter |
| --- | --- |
| Label | Coach Profile |
| Object Name (API) | `Coach_Profile__c` |
| Plural Label | Coach Profiles |
| Record Name | Text |
| Description | Die Person eines Coachs mit den fuer die Betreuung relevanten Stammdaten. Unterscheidet sich vom Contact: der Contact ist die Privatperson, das Coach-Profil die berufliche Rolle in der Academy. |
| Allow Reports | unchecked |
| Allow Activities | unchecked |
| Track Field History | unchecked |
| Allow Search | unchecked |
| Allow in Chatter Groups | unchecked |

> **Enter the API name exactly as given above.** It cannot be changed after saving.
>
> **Verify:** the repository sets `externalSharingModel` to `Private` on this object. It is not offered in the new-object form in current releases, so treat it as something to confirm afterwards, not something to click now. For the portal this matters: a non-private value would let external users see the object through a sharing rule without one. Check in Object Manager after creating every object in this list that is not a standard object.
>
> **Set the org-wide default by hand.** The form above does not set it. The OWD lives in `Setup → Sharing Settings` and is **not** part of the object metadata — neither a deploy nor a retrieve carries it, and it does not survive a sandbox refresh. Set it to **Private** (internal **and** external) unless the object needs broader access, then confirm it in `Setup → Sharing Settings`. Record the step in `backend/docs/g1-manual-checklist.md` — it is the one thing about an object that the repository cannot prove.

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
> The repository has no tab metadata of its own, so the category is not fixed by it. Whatever category you pick, keep it the same for every object in this list so the tabs end up together.

### Step 3 — Fields (7)

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
| `AWS Coach` | AWS Coach |  |
| `Kubernetes Coach` | Kubernetes Coach |  |
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

#### 7. `User__c`

`Object Manager → Coach Profile → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Lookup |
| Field Label | Salesforce Benutzer |
| Related To | User |
| Required | unchecked |
| Unique | unchecked |
| External ID | unchecked |
| Relationship Name | CoachingProfiles |
| What happens when the related record is deleted | Set null |
| Description | Verknuepft das Coach-Profil mit dem Salesforce-Login derselben Person. Ohne dieses Feld existiert die Zuordnung nur ueber den Namen, weil es keinen zweiten Anker gab: bei allen vier Profilen waren Email__c, Discord__c und GitHub__c leer, und Coach_Profile__c hat keinen eigenen Contact-Satz. Genau daran wurde sichtbar, dass Ghaith Saidani gar keinen User-Account hat. Das Feld aendert nichts daran, dass der Termin-Picker aus User-Ids speist: Appointment__c.Coach__c und AvailabilitySlot__c.User__c zeigen beide auf User, nicht auf Coach_Profile__c, und Salesforce lehnt Coach_Profile__c-Ids fuer diese Felder ab. Wer einen Termin bucht, waehlt weiterhin einen Login. Nach dem Anlegen einmal je Profil setzen; fuer einen Coach ohne Login bleibt das Feld leer, das ist der Befund und kein Fehler. |

---

## Contact

**Fields:** 1

Contact is a standard object and already exists. Only its custom fields are created here — Steps 1 and 2 do not apply.

### Step 3 — Fields (1)

#### 1. `Freigeschaltet__c`

`Object Manager → Contact → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Checkbox |
| Field Label | Freigeschaltet |
| Required | unchecked |
| Unique | unchecked |
| External ID | unchecked |
| Description | Steuert, ob der Kontakt im Backend unter /contacts auftaucht. Der Haken wird in Salesforce manuell gesetzt und ist der bewusste Freischalt-Schritt vor "Als Teilnehmer anlegen". Ohne Haken bleibt der Kontakt im Backend unsichtbar, auch wenn er in Salesforce existiert. Haken im Setup setzen: Objekte > Contact > Felder > Neues Feld > Checkbox. |

---

## Program__c

**Fields:** 3 &nbsp;&nbsp; **Record Name:** Text

### Step 1 — Create the object

`Setup → Object Manager → Create → Custom Object`

| Setup form field | Enter |
| --- | --- |
| Label | Program |
| Object Name (API) | `Program__c` |
| Plural Label | Programs |
| Record Name | Text |
| Description | Course Program |
| Allow Reports | unchecked |
| Allow Activities | unchecked |
| Track Field History | unchecked |
| Allow Search | unchecked |
| Allow in Chatter Groups | unchecked |

> **Enter the API name exactly as given above.** It cannot be changed after saving.
>
> **Verify:** the repository sets `externalSharingModel` to `Private` on this object. It is not offered in the new-object form in current releases, so treat it as something to confirm afterwards, not something to click now. For the portal this matters: a non-private value would let external users see the object through a sharing rule without one. Check in Object Manager after creating every object in this list that is not a standard object.
>
> **Set the org-wide default by hand.** The form above does not set it. The OWD lives in `Setup → Sharing Settings` and is **not** part of the object metadata — neither a deploy nor a retrieve carries it, and it does not survive a sandbox refresh. Set it to **Private** (internal **and** external) unless the object needs broader access, then confirm it in `Setup → Sharing Settings`. Record the step in `backend/docs/g1-manual-checklist.md` — it is the one thing about an object that the repository cannot prove.

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
> The repository has no tab metadata of its own, so the category is not fixed by it. Whatever category you pick, keep it the same for every object in this list so the tabs end up together.

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
| Object Name (API) | `Module__c` |
| Plural Label | Modules |
| Record Name | Text |
| Description | Reuseable program content template |
| Allow Reports | unchecked |
| Allow Activities | unchecked |
| Track Field History | unchecked |
| Allow Search | unchecked |
| Allow in Chatter Groups | unchecked |

> **Enter the API name exactly as given above.** It cannot be changed after saving.
>
> **Verify:** the repository sets `externalSharingModel` to `Private` on this object. It is not offered in the new-object form in current releases, so treat it as something to confirm afterwards, not something to click now. For the portal this matters: a non-private value would let external users see the object through a sharing rule without one. Check in Object Manager after creating every object in this list that is not a standard object.
>
> **Set the org-wide default by hand.** The form above does not set it. The OWD lives in `Setup → Sharing Settings` and is **not** part of the object metadata — neither a deploy nor a retrieve carries it, and it does not survive a sandbox refresh. Set it to **Private** (internal **and** external) unless the object needs broader access, then confirm it in `Setup → Sharing Settings`. Record the step in `backend/docs/g1-manual-checklist.md` — it is the one thing about an object that the repository cannot prove.

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
> The repository has no tab metadata of its own, so the category is not fixed by it. Whatever category you pick, keep it the same for every object in this list so the tabs end up together.

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

## ParticipantGroup__c

**Fields:** 3 &nbsp;&nbsp; **Record Name:** Text

### Step 1 — Create the object

`Setup → Object Manager → Create → Custom Object`

| Setup form field | Enter |
| --- | --- |
| Label | Teilnehmergruppe |
| Object Name (API) | `ParticipantGroup__c` |
| Plural Label | Teilnehmergruppen |
| Record Name | Text |
| Description | Gruppe von Teilnehmenden, die gemeinsam betreut wird |
| Allow Reports | checked |
| Allow Activities | unchecked |
| Track Field History | checked |
| Allow Search | checked |
| Allow in Chatter Groups | unchecked |

> **Enter the API name exactly as given above.** Salesforce derives it from the Label, and for this object it would derive `Teilnehmergruppe__c` — not the name this project uses. The API name cannot be changed after saving: a wrong name means deleting the object and creating it again.
>
> **Verify:** the repository sets `externalSharingModel` to `Private` on this object. It is not offered in the new-object form in current releases, so treat it as something to confirm afterwards, not something to click now. For the portal this matters: a non-private value would let external users see the object through a sharing rule without one. Check in Object Manager after creating every object in this list that is not a standard object.
>
> **Set the org-wide default by hand.** The form above does not set it. The OWD lives in `Setup → Sharing Settings` and is **not** part of the object metadata — neither a deploy nor a retrieve carries it, and it does not survive a sandbox refresh. Set it to **Private** (internal **and** external) unless the object needs broader access, then confirm it in `Setup → Sharing Settings`. Record the step in `backend/docs/g1-manual-checklist.md` — it is the one thing about an object that the repository cannot prove.

### Step 2 — Create the tab

`Setup → App Launcher → New → Object`

| Setup form field | Enter |
| --- | --- |
| Category | any existing category — the repo defines none |
| Tab | Teilnehmergruppe |
| Tab Style | any |
| Object | Teilnehmergruppe (`ParticipantGroup__c`) |

> Without a tab the object is invisible in Setup and you cannot reach the field screen. Do this before Step 3.
>
> The repository has no tab metadata of its own, so the category is not fixed by it. Whatever category you pick, keep it the same for every object in this list so the tabs end up together.

### Step 3 — Fields (3)

#### 1. `Description__c`

`Object Manager → Teilnehmergruppe → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Text Area (Long) |
| Field Label | Beschreibung |
| Length | 32768 |
| Lines to display | 3 |
| Required | unchecked |
| Unique | unchecked |
| External ID | unchecked |
| Description | Beschreibung der Gruppe |

#### 2. `Coach_Profile__c`

`Object Manager → Teilnehmergruppe → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Lookup |
| Field Label | Coach |
| Related To | Coach_Profile__c |
| Required | unchecked |
| Unique | unchecked |
| External ID | unchecked |
| Relationship Name | Participant_Groups |
| What happens when the related record is deleted | Set null |
| Description | Coach der Gruppe |
| Track Field History (Object-level, not per field) | see object step |

#### 3. `Program__c`

`Object Manager → Teilnehmergruppe → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Lookup |
| Field Label | Program |
| Related To | Program__c |
| Required | unchecked |
| Unique | unchecked |
| External ID | unchecked |
| Relationship Name | Participant_Groups |
| What happens when the related record is deleted | Set null |
| Description | Programm, in dem die Gruppe laeuft |
| Track Field History (Object-level, not per field) | see object step |

---

## Participant__c

**Fields:** 12 &nbsp;&nbsp; **Record Name:** Text

### Step 1 — Create the object

`Setup → Object Manager → Create → Custom Object`

| Setup form field | Enter |
| --- | --- |
| Label | Participant |
| Object Name (API) | `Participant__c` |
| Plural Label | Participants |
| Record Name | Text |
| Description | Participant Object |
| Allow Reports | unchecked |
| Allow Activities | unchecked |
| Track Field History | unchecked |
| Allow Search | unchecked |
| Allow in Chatter Groups | unchecked |

> **Enter the API name exactly as given above.** It cannot be changed after saving.
>
> **Verify:** the repository sets `externalSharingModel` to `Private` on this object. It is not offered in the new-object form in current releases, so treat it as something to confirm afterwards, not something to click now. For the portal this matters: a non-private value would let external users see the object through a sharing rule without one. Check in Object Manager after creating every object in this list that is not a standard object.
>
> **Set the org-wide default by hand.** The form above does not set it. The OWD lives in `Setup → Sharing Settings` and is **not** part of the object metadata — neither a deploy nor a retrieve carries it, and it does not survive a sandbox refresh. Set it to **Private** (internal **and** external) unless the object needs broader access, then confirm it in `Setup → Sharing Settings`. Record the step in `backend/docs/g1-manual-checklist.md` — it is the one thing about an object that the repository cannot prove.

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
> The repository has no tab metadata of its own, so the category is not fixed by it. Whatever category you pick, keep it the same for every object in this list so the tabs end up together.

### Step 3 — Fields (12)

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

#### 5. `Portal_Status__c`

`Object Manager → Participant → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Picklist |
| Field Label | Portal Status |
| Required | unchecked |
| Unique | unchecked |
| External ID | unchecked |
| Restrict picklist to the values defined in the value set | checked |
| Description | Zustand des Portalzugangs, getrennt von Status__c, das den fachlichen Status des Teilnehmers fuehrt. None: Zugang nicht eingerichtet. Invited: Einladung versendet, Zugang noch nicht abgeschlossen. Active: Portalzugang abgeschlossen. Revoked: gesperrt. ERROR: Provisionierung fehlgeschlagen. Active direkt nach der User-Erstellung waere fachlich zu frueh (ADR-006). Der API-Wert heisst ERROR statt Error, weil API-Namen nach dem Anlegen unveraenderlich sind. Fuer das Portal rein lesend: /me aktiviert nichts (ADR-011). Die Zeitpunkte aus ADR-006 sind bewusst noch nicht angelegt; sie gehoeren zum Provisionierungsprozess. |

Values — enter **Value** and **Display Value** separately:

| Value (API name) | Display Value | Default |
| --- | --- | --- |
| `None` | None | yes |
| `Invited` | Invited |  |
| `Active` | Active |  |
| `Revoked` | Revoked |  |
| `ERROR` | ERROR |  |

#### 6. `Portal_User_Id__c`

`Object Manager → Participant → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Text |
| Field Label | Portal-User-ID |
| Length |  |
| Required | unchecked |
| Unique | unchecked |
| External ID | unchecked |
| Description | Portal-User-ID als Text. Existiert nur fuer die Sharing Rule PortalParticipantSeesOwnRecord: Salesforce wertet $User.UserRecord.Id in einem Kriterium auf dem Lookup-Feld Portal_User__c nicht dynamisch aus, sondern vergleicht literal. Ueber ein Textfeld ist der Vergleich auswertbar. Nicht pflegen - Formel auf Portal_User__c. |

#### 7. `StartDate__c`

`Object Manager → Participant → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Date |
| Field Label | StartDate |
| Required | unchecked |
| Unique | unchecked |
| External ID | unchecked |
| Description | Student's Start Date |

#### 8. `Status__c`

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

#### 9. `Coach_Profile__c`

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

#### 10. `Contact__c`

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

#### 11. `Portal_User__c`

`Object Manager → Participant → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Lookup |
| Field Label | Portal User |
| Related To | User |
| Required | unchecked |
| Unique | unchecked |
| External ID | unchecked |
| Relationship Name | Portal_User |
| What happens when the related record is deleted | Set null |
| Description | Portal-Login dieses Teilnehmers. Fuellt die Sharing Rule PortalParticipantSeesOwnRecord und verlegt die Zugriffsgrenze des Portals damit vom Apex-Code auf ein Feld: der Portal-User liest genau seine eigene Row. Nicht selbst pflegen - wird aus User.ContactId abgeleitet. |

#### 12. `Program__c`

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
| Object Name (API) | `Absence__c` |
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

> **Enter the API name exactly as given above.** Salesforce derives it from the Label, and for this object it would derive `Abwesenheit__c` — not the name this project uses. The API name cannot be changed after saving: a wrong name means deleting the object and creating it again.
>
> **Verify:** the repository sets `externalSharingModel` to `Private` on this object. It is not offered in the new-object form in current releases, so treat it as something to confirm afterwards, not something to click now. For the portal this matters: a non-private value would let external users see the object through a sharing rule without one. Check in Object Manager after creating every object in this list that is not a standard object.
>
> **Set the org-wide default by hand.** The form above does not set it. The OWD lives in `Setup → Sharing Settings` and is **not** part of the object metadata — neither a deploy nor a retrieve carries it, and it does not survive a sandbox refresh. Set it to **Private** (internal **and** external) unless the object needs broader access, then confirm it in `Setup → Sharing Settings`. Record the step in `backend/docs/g1-manual-checklist.md` — it is the one thing about an object that the repository cannot prove.

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
> The repository has no tab metadata of its own, so the category is not fixed by it. Whatever category you pick, keep it the same for every object in this list so the tabs end up together.

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
| Object Name (API) | `Appointment__c` |
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

> **Enter the API name exactly as given above.** Salesforce derives it from the Label, and for this object it would derive `Termin__c` — not the name this project uses. The API name cannot be changed after saving: a wrong name means deleting the object and creating it again.
>
> **Verify:** the repository sets `externalSharingModel` to `Private` on this object. It is not offered in the new-object form in current releases, so treat it as something to confirm afterwards, not something to click now. For the portal this matters: a non-private value would let external users see the object through a sharing rule without one. Check in Object Manager after creating every object in this list that is not a standard object.
>
> **Set the org-wide default by hand.** The form above does not set it. The OWD lives in `Setup → Sharing Settings` and is **not** part of the object metadata — neither a deploy nor a retrieve carries it, and it does not survive a sandbox refresh. Set it to **Private** (internal **and** external) unless the object needs broader access, then confirm it in `Setup → Sharing Settings`. Record the step in `backend/docs/g1-manual-checklist.md` — it is the one thing about an object that the repository cannot prove.

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
> The repository has no tab metadata of its own, so the category is not fixed by it. Whatever category you pick, keep it the same for every object in this list so the tabs end up together.

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
| `Discord` | Discord |  |
| `Zoom` | Zoom |  |
| `Teams` | Teams |  |
| `External` | External |  |

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
| `Finding` | Finding |  |
| `Confirmed` | Confirmed |  |
| `Completed` | Completed |  |
| `Cancelled` | Cancelled |  |
| `NoShow` | NoShow |  |

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
| `CheckIn` | CheckIn |  |
| `Feedback` | Feedback |  |
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
| Object Name (API) | `AuditEvent__c` |
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

> **Enter the API name exactly as given above.** Salesforce derives it from the Label, and for this object it would derive `Audit_Event__c` — not the name this project uses. The API name cannot be changed after saving: a wrong name means deleting the object and creating it again.
>
> **Verify:** the repository sets `externalSharingModel` to `Private` on this object. It is not offered in the new-object form in current releases, so treat it as something to confirm afterwards, not something to click now. For the portal this matters: a non-private value would let external users see the object through a sharing rule without one. Check in Object Manager after creating every object in this list that is not a standard object.
>
> **Set the org-wide default by hand.** The form above does not set it. The OWD lives in `Setup → Sharing Settings` and is **not** part of the object metadata — neither a deploy nor a retrieve carries it, and it does not survive a sandbox refresh. Set it to **Private** (internal **and** external) unless the object needs broader access, then confirm it in `Setup → Sharing Settings`. Record the step in `backend/docs/g1-manual-checklist.md` — it is the one thing about an object that the repository cannot prove.

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
> The repository has no tab metadata of its own, so the category is not fixed by it. Whatever category you pick, keep it the same for every object in this list so the tabs end up together.

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
| Object Name (API) | `Learning_Path__c` |
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

> **Enter the API name exactly as given above.** It cannot be changed after saving.
>
> **Verify:** the repository sets `externalSharingModel` to `Private` on this object. It is not offered in the new-object form in current releases, so treat it as something to confirm afterwards, not something to click now. For the portal this matters: a non-private value would let external users see the object through a sharing rule without one. Check in Object Manager after creating every object in this list that is not a standard object.
>
> **Set the org-wide default by hand.** The form above does not set it. The OWD lives in `Setup → Sharing Settings` and is **not** part of the object metadata — neither a deploy nor a retrieve carries it, and it does not survive a sandbox refresh. Set it to **Private** (internal **and** external) unless the object needs broader access, then confirm it in `Setup → Sharing Settings`. Record the step in `backend/docs/g1-manual-checklist.md` — it is the one thing about an object that the repository cannot prove.

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
> The repository has no tab metadata of its own, so the category is not fixed by it. Whatever category you pick, keep it the same for every object in this list so the tabs end up together.

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

## ParticipantGroupMember__c

**Fields:** 3 &nbsp;&nbsp; **Record Name:** AutoNumber

### Step 1 — Create the object

`Setup → Object Manager → Create → Custom Object`

| Setup form field | Enter |
| --- | --- |
| Label | Gruppenzuordnung |
| Object Name (API) | `ParticipantGroupMember__c` |
| Plural Label | Gruppenzuordnungen |
| Record Name | AutoNumber |
| Display Format | PGM-{0000} |
| Starting Number | 1 |
| Description | Zuordnung eines Teilnehmers zu einer Teilnehmergruppe |
| Allow Reports | checked |
| Allow Activities | unchecked |
| Track Field History | checked |
| Allow Search | checked |
| Allow in Chatter Groups | unchecked |

> **Enter the API name exactly as given above.** Salesforce derives it from the Label, and for this object it would derive `Gruppenzuordnung__c` — not the name this project uses. The API name cannot be changed after saving: a wrong name means deleting the object and creating it again.
>
> **Verify:** the repository sets `externalSharingModel` to `Private` on this object. It is not offered in the new-object form in current releases, so treat it as something to confirm afterwards, not something to click now. For the portal this matters: a non-private value would let external users see the object through a sharing rule without one. Check in Object Manager after creating every object in this list that is not a standard object.
>
> **Set the org-wide default by hand.** The form above does not set it. The OWD lives in `Setup → Sharing Settings` and is **not** part of the object metadata — neither a deploy nor a retrieve carries it, and it does not survive a sandbox refresh. Set it to **Private** (internal **and** external) unless the object needs broader access, then confirm it in `Setup → Sharing Settings`. Record the step in `backend/docs/g1-manual-checklist.md` — it is the one thing about an object that the repository cannot prove.

### Step 2 — Create the tab

`Setup → App Launcher → New → Object`

| Setup form field | Enter |
| --- | --- |
| Category | any existing category — the repo defines none |
| Tab | Gruppenzuordnung |
| Tab Style | any |
| Object | Gruppenzuordnung (`ParticipantGroupMember__c`) |

> Without a tab the object is invisible in Setup and you cannot reach the field screen. Do this before Step 3.
>
> The repository has no tab metadata of its own, so the category is not fixed by it. Whatever category you pick, keep it the same for every object in this list so the tabs end up together.

### Step 3 — Fields (3)

#### 1. `Order__c`

`Object Manager → Gruppenzuordnung → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Number |
| Field Label | Reihenfolge |
| Length (total digits) | 3 |
| Decimal Places | 0 |
| Required | unchecked |
| Unique | unchecked |
| External ID | unchecked |
| Description | Reihenfolge in der Gruppe |
| Track Field History (Object-level, not per field) | see object step |

#### 2. `ParticipantGroup__c`

`Object Manager → Gruppenzuordnung → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Lookup |
| Field Label | Teilnehmergruppe |
| Related To | ParticipantGroup__c |
| Required | [x] |
| Unique | unchecked |
| External ID | unchecked |
| Relationship Name | Participant_Group_Members |
| What happens when the related record is deleted | Restrict |
| Description | Gruppe, der der Teilnehmer angehoert |
| Track Field History (Object-level, not per field) | see object step |

> **Set "Restrict delete" now.** It cannot be changed to a weaker setting later — only tightened.

#### 3. `Participant__c`

`Object Manager → Gruppenzuordnung → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Lookup |
| Field Label | Teilnehmer |
| Related To | Participant__c |
| Required | [x] |
| Unique | unchecked |
| External ID | unchecked |
| Relationship Name | Participant_Group_Members |
| What happens when the related record is deleted | Restrict |
| Description | Teilnehmer der Gruppe |
| Track Field History (Object-level, not per field) | see object step |

> **Set "Restrict delete" now.** It cannot be changed to a weaker setting later — only tightened.

---

## ProgramWeek__c

**Fields:** 5 &nbsp;&nbsp; **Record Name:** Text

### Step 1 — Create the object

`Setup → Object Manager → Create → Custom Object`

| Setup form field | Enter |
| --- | --- |
| Label | Kurswoche |
| Object Name (API) | `ProgramWeek__c` |
| Plural Label | Kurswochen |
| Record Name | Text |
| Description | Kurswoche (AZAV-Woche) innerhalb eines Programms |
| Allow Reports | checked |
| Allow Activities | unchecked |
| Track Field History | checked |
| Allow Search | checked |
| Allow in Chatter Groups | unchecked |

> **Enter the API name exactly as given above.** Salesforce derives it from the Label, and for this object it would derive `Kurswoche__c` — not the name this project uses. The API name cannot be changed after saving: a wrong name means deleting the object and creating it again.
>
> **Verify:** the repository sets `externalSharingModel` to `Private` on this object. It is not offered in the new-object form in current releases, so treat it as something to confirm afterwards, not something to click now. For the portal this matters: a non-private value would let external users see the object through a sharing rule without one. Check in Object Manager after creating every object in this list that is not a standard object.
>
> **Set the org-wide default by hand.** The form above does not set it. The OWD lives in `Setup → Sharing Settings` and is **not** part of the object metadata — neither a deploy nor a retrieve carries it, and it does not survive a sandbox refresh. Set it to **Private** (internal **and** external) unless the object needs broader access, then confirm it in `Setup → Sharing Settings`. Record the step in `backend/docs/g1-manual-checklist.md` — it is the one thing about an object that the repository cannot prove.

### Step 2 — Create the tab

`Setup → App Launcher → New → Object`

| Setup form field | Enter |
| --- | --- |
| Category | any existing category — the repo defines none |
| Tab | Kurswoche |
| Tab Style | any |
| Object | Kurswoche (`ProgramWeek__c`) |

> Without a tab the object is invisible in Setup and you cannot reach the field screen. Do this before Step 3.
>
> The repository has no tab metadata of its own, so the category is not fixed by it. Whatever category you pick, keep it the same for every object in this list so the tabs end up together.

### Step 3 — Fields (5)

#### 1. `Description__c`

`Object Manager → Kurswoche → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Text Area (Long) |
| Field Label | Beschreibung |
| Length | 32768 |
| Lines to display | 3 |
| Required | unchecked |
| Unique | unchecked |
| External ID | unchecked |
| Description | Didaktische Beschreibung der Kurswoche |

#### 2. `Number__c`

`Object Manager → Kurswoche → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Number |
| Field Label | Woche |
| Length (total digits) | 2 |
| Decimal Places | 0 |
| Required | [x] |
| Unique | unchecked |
| External ID | unchecked |
| Description | Wochenindex innerhalb des Programms (1..n). Eindeutigkeit je Program wird serverseitig geprueft |
| Track Field History (Object-level, not per field) | see object step |

#### 3. `Status__c`

`Object Manager → Kurswoche → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Picklist |
| Field Label | Status |
| Required | [x] |
| Unique | unchecked |
| External ID | unchecked |
| Restrict picklist to the values defined in the value set | checked |
| Description | Status der Kurswoche |
| Track Field History (Object-level, not per field) | see object step |

Values — enter **Value** and **Display Value** separately:

| Value (API name) | Display Value | Default |
| --- | --- | --- |
| `Draft` | Draft | yes |
| `Active` | Active |  |
| `Completed` | Completed |  |

#### 4. `Module__c`

`Object Manager → Kurswoche → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Lookup |
| Field Label | Modul |
| Related To | Module__c |
| Required | [x] |
| Unique | unchecked |
| External ID | unchecked |
| Relationship Name | Program_Weeks |
| What happens when the related record is deleted | Restrict |
| Description | Modul, das in dieser Kurswoche behandelt wird |
| Track Field History (Object-level, not per field) | see object step |

> **Set "Restrict delete" now.** It cannot be changed to a weaker setting later — only tightened.

#### 5. `Program__c`

`Object Manager → Kurswoche → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Lookup |
| Field Label | Program |
| Related To | Program__c |
| Required | [x] |
| Unique | unchecked |
| External ID | unchecked |
| Relationship Name | Program_Weeks |
| What happens when the related record is deleted | Restrict |
| Description | Programm, zu dem die Kurswoche gehoert |
| Track Field History (Object-level, not per field) | see object step |

> **Set "Restrict delete" now.** It cannot be changed to a weaker setting later — only tightened.

---

## ScheduleTemplate__c

**Fields:** 5 &nbsp;&nbsp; **Record Name:** Text

### Step 1 — Create the object

`Setup → Object Manager → Create → Custom Object`

| Setup form field | Enter |
| --- | --- |
| Label | Wochenplan-Vorlage |
| Object Name (API) | `ScheduleTemplate__c` |
| Plural Label | Wochenplan-Vorlagen |
| Record Name | Text |
| Description | Wiederverwendbare Vorlage fuer Kurswochen oder Programme |
| Allow Reports | checked |
| Allow Activities | unchecked |
| Track Field History | checked |
| Allow Search | checked |
| Allow in Chatter Groups | unchecked |

> **Enter the API name exactly as given above.** Salesforce derives it from the Label, and for this object it would derive `Wochenplan_Vorlage__c` — not the name this project uses. The API name cannot be changed after saving: a wrong name means deleting the object and creating it again.
>
> **Verify:** the repository sets `externalSharingModel` to `Private` on this object. It is not offered in the new-object form in current releases, so treat it as something to confirm afterwards, not something to click now. For the portal this matters: a non-private value would let external users see the object through a sharing rule without one. Check in Object Manager after creating every object in this list that is not a standard object.
>
> **Set the org-wide default by hand.** The form above does not set it. The OWD lives in `Setup → Sharing Settings` and is **not** part of the object metadata — neither a deploy nor a retrieve carries it, and it does not survive a sandbox refresh. Set it to **Private** (internal **and** external) unless the object needs broader access, then confirm it in `Setup → Sharing Settings`. Record the step in `backend/docs/g1-manual-checklist.md` — it is the one thing about an object that the repository cannot prove.

### Step 2 — Create the tab

`Setup → App Launcher → New → Object`

| Setup form field | Enter |
| --- | --- |
| Category | any existing category — the repo defines none |
| Tab | Wochenplan-Vorlage |
| Tab Style | any |
| Object | Wochenplan-Vorlage (`ScheduleTemplate__c`) |

> Without a tab the object is invisible in Setup and you cannot reach the field screen. Do this before Step 3.
>
> The repository has no tab metadata of its own, so the category is not fixed by it. Whatever category you pick, keep it the same for every object in this list so the tabs end up together.

### Step 3 — Fields (5)

#### 1. `Description__c`

`Object Manager → Wochenplan-Vorlage → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Text Area (Long) |
| Field Label | Beschreibung |
| Length | 32768 |
| Lines to display | 3 |
| Required | unchecked |
| Unique | unchecked |
| External ID | unchecked |
| Description | Beschreibung der Vorlage |

#### 2. `Status__c`

`Object Manager → Wochenplan-Vorlage → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Picklist |
| Field Label | Status |
| Required | [x] |
| Unique | unchecked |
| External ID | unchecked |
| Restrict picklist to the values defined in the value set | checked |
| Description | Status der Vorlage |
| Track Field History (Object-level, not per field) | see object step |

Values — enter **Value** and **Display Value** separately:

| Value (API name) | Display Value | Default |
| --- | --- | --- |
| `Active` | Active | yes |
| `Inactive` | Inactive |  |

#### 3. `Module__c`

`Object Manager → Wochenplan-Vorlage → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Lookup |
| Field Label | Modul |
| Related To | Module__c |
| Required | unchecked |
| Unique | unchecked |
| External ID | unchecked |
| Relationship Name | Schedule_Templates |
| What happens when the related record is deleted | Set null |
| Description | Fachliche Zuordnung, falls moduluebergreifend |
| Track Field History (Object-level, not per field) | see object step |

#### 4. `ProgramWeek__c`

`Object Manager → Wochenplan-Vorlage → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Lookup |
| Field Label | Kurswoche |
| Related To | ProgramWeek__c |
| Required | unchecked |
| Unique | unchecked |
| External ID | unchecked |
| Relationship Name | Schedule_Templates |
| What happens when the related record is deleted | Set null |
| Description | Regelfall: Vorlage fuer eine Kurswoche |
| Track Field History (Object-level, not per field) | see object step |

#### 5. `Program__c`

`Object Manager → Wochenplan-Vorlage → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Lookup |
| Field Label | Program |
| Related To | Program__c |
| Required | unchecked |
| Unique | unchecked |
| External ID | unchecked |
| Relationship Name | Schedule_Templates |
| What happens when the related record is deleted | Set null |
| Description | Vorlage fuer ein ganzes Programm |
| Track Field History (Object-level, not per field) | see object step |

---

## WeeklySchedule__c

**Fields:** 13 &nbsp;&nbsp; **Record Name:** Text

### Step 1 — Create the object

`Setup → Object Manager → Create → Custom Object`

| Setup form field | Enter |
| --- | --- |
| Label | Wochenplan |
| Object Name (API) | `WeeklySchedule__c` |
| Plural Label | Wochenpläne |
| Record Name | Text |
| Description | Wochenplan-Instanz: eine konkrete Kalenderwoche fuer Kurs, Gruppe oder Teilnehmer |
| Allow Reports | checked |
| Allow Activities | unchecked |
| Track Field History | checked |
| Allow Search | checked |
| Allow in Chatter Groups | unchecked |

> **Enter the API name exactly as given above.** Salesforce derives it from the Label, and for this object it would derive `Wochenplan__c` — not the name this project uses. The API name cannot be changed after saving: a wrong name means deleting the object and creating it again.
>
> **Verify:** the repository sets `externalSharingModel` to `Private` on this object. It is not offered in the new-object form in current releases, so treat it as something to confirm afterwards, not something to click now. For the portal this matters: a non-private value would let external users see the object through a sharing rule without one. Check in Object Manager after creating every object in this list that is not a standard object.
>
> **Set the org-wide default by hand.** The form above does not set it. The OWD lives in `Setup → Sharing Settings` and is **not** part of the object metadata — neither a deploy nor a retrieve carries it, and it does not survive a sandbox refresh. Set it to **Private** (internal **and** external) unless the object needs broader access, then confirm it in `Setup → Sharing Settings`. Record the step in `backend/docs/g1-manual-checklist.md` — it is the one thing about an object that the repository cannot prove.

### Step 2 — Create the tab

`Setup → App Launcher → New → Object`

| Setup form field | Enter |
| --- | --- |
| Category | any existing category — the repo defines none |
| Tab | Wochenplan |
| Tab Style | any |
| Object | Wochenplan (`WeeklySchedule__c`) |

> Without a tab the object is invisible in Setup and you cannot reach the field screen. Do this before Step 3.
>
> The repository has no tab metadata of its own, so the category is not fixed by it. Whatever category you pick, keep it the same for every object in this list so the tabs end up together.

### Step 3 — Fields (13)

#### 1. `DeviationReason__c`

`Object Manager → Wochenplan → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Text Area (Long) |
| Field Label | Abweichungsbegründung |
| Length | 32768 |
| Lines to display | 4 |
| Required | unchecked |
| Unique | unchecked |
| External ID | unchecked |
| Description | Begruendung, warum diese Instanz vom Standard der Kurswoche abweicht |

#### 2. `EndDate__c`

`Object Manager → Wochenplan → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Date |
| Field Label | Woche endet |
| Required | unchecked |
| Unique | unchecked |
| External ID | unchecked |
| Description | Letzter Tag der Woche |
| Track Field History (Object-level, not per field) | see object step |

#### 3. `Notes__c`

`Object Manager → Wochenplan → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Text Area (Long) |
| Field Label | Notizen |
| Length | 32768 |
| Lines to display | 4 |
| Required | unchecked |
| Unique | unchecked |
| External ID | unchecked |
| Description | Freie Notizen zum Wochenplan |

#### 4. `PublishedAt__c`

`Object Manager → Wochenplan → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Date/Time |
| Field Label | Veröffentlicht am |
| Required | unchecked |
| Unique | unchecked |
| External ID | unchecked |
| Description | Zeitpunkt der Veroeffentlichung |
| Track Field History (Object-level, not per field) | see object step |

#### 5. `ScopeType__c`

`Object Manager → Wochenplan → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Picklist |
| Field Label | Geltungsbereich |
| Required | [x] |
| Unique | unchecked |
| External ID | unchecked |
| Restrict picklist to the values defined in the value set | checked |
| Description | Course = Standard der Kurswoche, Group = eine Teilnehmergruppe, Individual = einzelne Teilnehmer |
| Track Field History (Object-level, not per field) | see object step |

Values — enter **Value** and **Display Value** separately:

| Value (API name) | Display Value | Default |
| --- | --- | --- |
| `Course` | Course | yes |
| `Group` | Group |  |
| `Individual` | Individual |  |

#### 6. `StartDate__c`

`Object Manager → Wochenplan → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Date |
| Field Label | Woche beginnt |
| Required | [x] |
| Unique | unchecked |
| External ID | unchecked |
| Description | Montag der kalendarischen Woche dieser Instanz |
| Track Field History (Object-level, not per field) | see object step |

#### 7. `Status__c`

`Object Manager → Wochenplan → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Picklist |
| Field Label | Status |
| Required | [x] |
| Unique | unchecked |
| External ID | unchecked |
| Restrict picklist to the values defined in the value set | checked |
| Description | Status der Woche |
| Track Field History (Object-level, not per field) | see object step |

Values — enter **Value** and **Display Value** separately:

| Value (API name) | Display Value | Default |
| --- | --- | --- |
| `Draft` | Draft | yes |
| `Published` | Published |  |

#### 8. `TemplateAppliedAt__c`

`Object Manager → Wochenplan → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Date/Time |
| Field Label | Vorlage angewendet am |
| Required | unchecked |
| Unique | unchecked |
| External ID | unchecked |
| Description | Zeitpunkt, zu dem die Vorlage angewendet wurde |
| Track Field History (Object-level, not per field) | see object step |

#### 9. `AppliedTemplate__c`

`Object Manager → Wochenplan → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Lookup |
| Field Label | Angewendete Vorlage |
| Related To | ScheduleTemplate__c |
| Required | unchecked |
| Unique | unchecked |
| External ID | unchecked |
| Relationship Name | Weekly_Schedules |
| What happens when the related record is deleted | Set null |
| Description | Nur Provenienz, keine fachliche Verbindung |
| Track Field History (Object-level, not per field) | see object step |

#### 10. `ParticipantGroup__c`

`Object Manager → Wochenplan → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Lookup |
| Field Label | Teilnehmergruppe |
| Related To | ParticipantGroup__c |
| Required | unchecked |
| Unique | unchecked |
| External ID | unchecked |
| Relationship Name | Weekly_Schedules |
| What happens when the related record is deleted | Set null |
| Description | Nur bei ScopeType = Group |
| Track Field History (Object-level, not per field) | see object step |

#### 11. `Participant__c`

`Object Manager → Wochenplan → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Lookup |
| Field Label | Teilnehmer |
| Related To | Participant__c |
| Required | unchecked |
| Unique | unchecked |
| External ID | unchecked |
| Relationship Name | Weekly_Schedules |
| What happens when the related record is deleted | Restrict |
| Description | Nur bei ScopeType = Individual |
| Track Field History (Object-level, not per field) | see object step |

> **Set "Restrict delete" now.** It cannot be changed to a weaker setting later — only tightened.

#### 12. `ProgramWeek__c`

`Object Manager → Wochenplan → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Lookup |
| Field Label | Kurswoche |
| Related To | ProgramWeek__c |
| Required | [x] |
| Unique | unchecked |
| External ID | unchecked |
| Relationship Name | Weekly_Schedules |
| What happens when the related record is deleted | Restrict |
| Description | Kurswoche, die dieser Plan abbildet |
| Track Field History (Object-level, not per field) | see object step |

> **Set "Restrict delete" now.** It cannot be changed to a weaker setting later — only tightened.

#### 13. `PublishedBy__c`

`Object Manager → Wochenplan → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Lookup |
| Field Label | Veröffentlicht von |
| Related To | User |
| Required | unchecked |
| Unique | unchecked |
| External ID | unchecked |
| Relationship Name | Weekly_Schedules |
| What happens when the related record is deleted | Set null |
| Description | Staff-Mitglied, das den Plan veroeffentlicht hat |
| Track Field History (Object-level, not per field) | see object step |

---

## ScheduleEntry__c

**Fields:** 22 &nbsp;&nbsp; **Record Name:** Text

### Step 1 — Create the object

`Setup → Object Manager → Create → Custom Object`

| Setup form field | Enter |
| --- | --- |
| Label | Planzeile |
| Object Name (API) | `ScheduleEntry__c` |
| Plural Label | Planzeilen |
| Record Name | Text |
| Description | Planzeile eines Wochenplans: eine Aktivitaet oder eine Aufgabe |
| Allow Reports | checked |
| Allow Activities | unchecked |
| Track Field History | checked |
| Allow Search | checked |
| Allow in Chatter Groups | unchecked |

> **Enter the API name exactly as given above.** Salesforce derives it from the Label, and for this object it would derive `Planzeile__c` — not the name this project uses. The API name cannot be changed after saving: a wrong name means deleting the object and creating it again.
>
> **Verify:** the repository sets `externalSharingModel` to `Private` on this object. It is not offered in the new-object form in current releases, so treat it as something to confirm afterwards, not something to click now. For the portal this matters: a non-private value would let external users see the object through a sharing rule without one. Check in Object Manager after creating every object in this list that is not a standard object.
>
> **Set the org-wide default by hand.** The form above does not set it. The OWD lives in `Setup → Sharing Settings` and is **not** part of the object metadata — neither a deploy nor a retrieve carries it, and it does not survive a sandbox refresh. Set it to **Private** (internal **and** external) unless the object needs broader access, then confirm it in `Setup → Sharing Settings`. Record the step in `backend/docs/g1-manual-checklist.md` — it is the one thing about an object that the repository cannot prove.

### Step 2 — Create the tab

`Setup → App Launcher → New → Object`

| Setup form field | Enter |
| --- | --- |
| Category | any existing category — the repo defines none |
| Tab | Planzeile |
| Tab Style | any |
| Object | Planzeile (`ScheduleEntry__c`) |

> Without a tab the object is invisible in Setup and you cannot reach the field screen. Do this before Step 3.
>
> The repository has no tab metadata of its own, so the category is not fixed by it. Whatever category you pick, keep it the same for every object in this list so the tabs end up together.

### Step 3 — Fields (22)

#### 1. `Date__c`

`Object Manager → Planzeile → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Date |
| Field Label | Datum |
| Required | unchecked |
| Unique | unchecked |
| External ID | unchecked |
| Description | In Vorlagenzeilen leer, in Planzeilen serverseitig aus StartDate__c der Instanz und dem Wochentag berechnet |
| Track Field History (Object-level, not per field) | see object step |

#### 2. `DayOfWeek__c`

`Object Manager → Planzeile → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Picklist |
| Field Label | Wochentag |
| Required | [x] |
| Unique | unchecked |
| External ID | unchecked |
| Restrict picklist to the values defined in the value set | checked |
| Description | Wochentag der Planzeile; Date__c wird daraus und StartDate__c berechnet |
| Track Field History (Object-level, not per field) | see object step |

Values — enter **Value** and **Display Value** separately:

| Value (API name) | Display Value | Default |
| --- | --- | --- |
| `Monday` | Monday | yes |
| `Tuesday` | Tuesday |  |
| `Wednesday` | Wednesday |  |
| `Thursday` | Thursday |  |
| `Friday` | Friday |  |
| `Saturday` | Saturday |  |
| `Sunday` | Sunday |  |

#### 3. `Description__c`

`Object Manager → Planzeile → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Text Area (Long) |
| Field Label | Beschreibung |
| Length | 32768 |
| Lines to display | 4 |
| Required | unchecked |
| Unique | unchecked |
| External ID | unchecked |
| Description | Standard-Aufgabenbeschreibung, editierbar |

#### 4. `DeviationReason__c`

`Object Manager → Planzeile → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Text Area (Long) |
| Field Label | Abweichungsbegründung |
| Length | 32768 |
| Lines to display | 4 |
| Required | unchecked |
| Unique | unchecked |
| External ID | unchecked |
| Description | Begruendung fuer die Abweichung dieser Zeile von der Vorlage |

#### 5. `DurationMinutes__c`

`Object Manager → Planzeile → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Number |
| Field Label | Dauer (Minuten) |
| Length (total digits) | 4 |
| Decimal Places | 0 |
| Required | unchecked |
| Unique | unchecked |
| External ID | unchecked |
| Description | Alternative zu EndTime__c |
| Track Field History (Object-level, not per field) | see object step |

#### 6. `EndTime__c`

`Object Manager → Planzeile → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Time |
| Field Label | Bis |
| Required | unchecked |
| Unique | unchecked |
| External ID | unchecked |
| Description | Ende der Aktivitaet; bei Aufgaben leer |
| Track Field History (Object-level, not per field) | see object step |

#### 7. `EntryKind__c`

`Object Manager → Planzeile → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Picklist |
| Field Label | Art |
| Required | [x] |
| Unique | unchecked |
| External ID | unchecked |
| Restrict picklist to the values defined in the value set | checked |
| Description | Aktivitaet = Termin mit Uhrzeit, Aufgabe = Arbeit ohne festen Zeitpunkt |
| Track Field History (Object-level, not per field) | see object step |

Values — enter **Value** and **Display Value** separately:

| Value (API name) | Display Value | Default |
| --- | --- | --- |
| `Aktivität` | Aktivität | yes |
| `Aufgabe` | Aufgabe |  |

#### 8. `IsCustomized__c`

`Object Manager → Planzeile → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Checkbox |
| Field Label | Angepasst |
| Required | unchecked |
| Unique | unchecked |
| External ID | unchecked |
| Description | Nach dem Anwenden einer Vorlage nachtraeglich geaendert |
| Track Field History (Object-level, not per field) | see object step |

#### 9. `IsRequired__c`

`Object Manager → Planzeile → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Checkbox |
| Field Label | Pflicht |
| Required | unchecked |
| Unique | unchecked |
| External ID | unchecked |
| Description | Pflichtbestandteil des AZAV-Standards |
| Track Field History (Object-level, not per field) | see object step |

#### 10. `Location__c`

`Object Manager → Planzeile → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Picklist |
| Field Label | Ort |
| Required | unchecked |
| Unique | unchecked |
| External ID | unchecked |
| Restrict picklist to the values defined in the value set | checked |
| Description | Ort oder Kanal der Aktivitaet |
| Track Field History (Object-level, not per field) | see object step |

Values — enter **Value** and **Display Value** separately:

| Value (API name) | Display Value | Default |
| --- | --- | --- |
| `Discord` | Discord |  |
| `Zoom` | Zoom |  |
| `Teams` | Teams |  |
| `External` | External |  |
| `Präsenz` | Präsenz |  |

#### 11. `MeetingLink__c`

`Object Manager → Planzeile → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | URL |
| Field Label | Meeting Link |
| Length |  |
| Required | unchecked |
| Unique | unchecked |
| External ID | unchecked |
| Description | Link zum Online-Meeting |
| Track Field History (Object-level, not per field) | see object step |

#### 12. `Notes__c`

`Object Manager → Planzeile → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Text Area (Long) |
| Field Label | Notizen |
| Length | 32768 |
| Lines to display | 4 |
| Required | unchecked |
| Unique | unchecked |
| External ID | unchecked |
| Description | Freie Notizen zur Planzeile |

#### 13. `Order__c`

`Object Manager → Planzeile → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Number |
| Field Label | Reihenfolge |
| Length (total digits) | 3 |
| Decimal Places | 0 |
| Required | unchecked |
| Unique | unchecked |
| External ID | unchecked |
| Description | Reihenfolge innerhalb des Tages |
| Track Field History (Object-level, not per field) | see object step |

#### 14. `StartTime__c`

`Object Manager → Planzeile → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Time |
| Field Label | Von |
| Required | unchecked |
| Unique | unchecked |
| External ID | unchecked |
| Description | Beginn der Aktivitaet; bei Aufgaben leer |
| Track Field History (Object-level, not per field) | see object step |

#### 15. `TargetType__c`

`Object Manager → Planzeile → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Picklist |
| Field Label | Zielgruppe |
| Required | [x] |
| Unique | unchecked |
| External ID | unchecked |
| Restrict picklist to the values defined in the value set | checked |
| Description | Zielgruppe der Planzeile |
| Track Field History (Object-level, not per field) | see object step |

Values — enter **Value** and **Display Value** separately:

| Value (API name) | Display Value | Default |
| --- | --- | --- |
| `Course` | Course | yes |
| `Group` | Group |  |
| `Individual` | Individual |  |

#### 16. `Type__c`

`Object Manager → Planzeile → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Picklist |
| Field Label | Typ |
| Required | [x] |
| Unique | unchecked |
| External ID | unchecked |
| Restrict picklist to the values defined in the value set | checked |
| Description | Art der Aktivitaet oder Aufgabe |
| Track Field History (Object-level, not per field) | see object step |

Values — enter **Value** and **Display Value** separately:

| Value (API name) | Display Value | Default |
| --- | --- | --- |
| `Einzelcoaching` | Einzelcoaching | yes |
| `Gruppencoaching` | Gruppencoaching |  |
| `Feedback` | Feedback |  |
| `Projekt-Kick-off` | Projekt-Kick-off |  |
| `Workshop` | Workshop |  |
| `Selbstlernphase` | Selbstlernphase |  |
| `Projektarbeit` | Projektarbeit |  |
| `Sonstiges` | Sonstiges |  |

#### 17. `Coach_Profile__c`

`Object Manager → Planzeile → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Lookup |
| Field Label | Coach |
| Related To | Coach_Profile__c |
| Required | unchecked |
| Unique | unchecked |
| External ID | unchecked |
| Relationship Name | Schedule_Entries |
| What happens when the related record is deleted | Set null |
| Description | Fachliche Coach-Entitaet. Appointment__c.Coach__c zeigt dagegen auf User |
| Track Field History (Object-level, not per field) | see object step |

#### 18. `ParticipantGroup__c`

`Object Manager → Planzeile → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Lookup |
| Field Label | Teilnehmergruppe |
| Related To | ParticipantGroup__c |
| Required | unchecked |
| Unique | unchecked |
| External ID | unchecked |
| Relationship Name | Schedule_Entries |
| What happens when the related record is deleted | Set null |
| Description | Nur bei TargetType = Group |
| Track Field History (Object-level, not per field) | see object step |

#### 19. `Participant__c`

`Object Manager → Planzeile → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Lookup |
| Field Label | Teilnehmer |
| Related To | Participant__c |
| Required | unchecked |
| Unique | unchecked |
| External ID | unchecked |
| Relationship Name | Schedule_Entries |
| What happens when the related record is deleted | Restrict |
| Description | Nur bei TargetType = Individual |
| Track Field History (Object-level, not per field) | see object step |

> **Set "Restrict delete" now.** It cannot be changed to a weaker setting later — only tightened.

#### 20. `ScheduleTemplate__c`

`Object Manager → Planzeile → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Lookup |
| Field Label | Vorlage |
| Related To | ScheduleTemplate__c |
| Required | unchecked |
| Unique | unchecked |
| External ID | unchecked |
| Relationship Name | Schedule_Entries |
| What happens when the related record is deleted | Restrict |
| Description | Null = Planzeile. Genau eines von beiden muss gesetzt sein |
| Track Field History (Object-level, not per field) | see object step |

> **Set "Restrict delete" now.** It cannot be changed to a weaker setting later — only tightened.

#### 21. `SourceTemplateEntry__c`

`Object Manager → Planzeile → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Lookup |
| Field Label | Aus Vorlageneintrag |
| Related To | ScheduleEntry__c |
| Required | unchecked |
| Unique | unchecked |
| External ID | unchecked |
| Relationship Name | Source_Entries |
| What happens when the related record is deleted | Set null |
| Description | Herkunftsnachweis der kopierten Zeile |
| Track Field History (Object-level, not per field) | see object step |

#### 22. `WeeklySchedule__c`

`Object Manager → Planzeile → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Lookup |
| Field Label | Wochenplan |
| Related To | WeeklySchedule__c |
| Required | unchecked |
| Unique | unchecked |
| External ID | unchecked |
| Relationship Name | Schedule_Entries |
| What happens when the related record is deleted | Restrict |
| Description | Null = Vorlagenzeile |
| Track Field History (Object-level, not per field) | see object step |

> **Set "Restrict delete" now.** It cannot be changed to a weaker setting later — only tightened.

---

## TaskCompletion__c

**Fields:** 5 &nbsp;&nbsp; **Record Name:** AutoNumber

### Step 1 — Create the object

`Setup → Object Manager → Create → Custom Object`

| Setup form field | Enter |
| --- | --- |
| Label | Aufgabenerfüllung |
| Object Name (API) | `TaskCompletion__c` |
| Plural Label | Aufgabenerfüllungen |
| Record Name | AutoNumber |
| Display Format | TC-{0000} |
| Starting Number | 1 |
| Description | Erfuellung einer Planzeile durch einen Teilnehmer |
| Allow Reports | checked |
| Allow Activities | unchecked |
| Track Field History | checked |
| Allow Search | checked |
| Allow in Chatter Groups | unchecked |

> **Enter the API name exactly as given above.** Salesforce derives it from the Label, and for this object it would derive `Aufgabenerfuellung__c` — not the name this project uses. The API name cannot be changed after saving: a wrong name means deleting the object and creating it again.
>
> **Verify:** the repository sets `externalSharingModel` to `Private` on this object. It is not offered in the new-object form in current releases, so treat it as something to confirm afterwards, not something to click now. For the portal this matters: a non-private value would let external users see the object through a sharing rule without one. Check in Object Manager after creating every object in this list that is not a standard object.
>
> **Set the org-wide default by hand.** The form above does not set it. The OWD lives in `Setup → Sharing Settings` and is **not** part of the object metadata — neither a deploy nor a retrieve carries it, and it does not survive a sandbox refresh. Set it to **Private** (internal **and** external) unless the object needs broader access, then confirm it in `Setup → Sharing Settings`. Record the step in `backend/docs/g1-manual-checklist.md` — it is the one thing about an object that the repository cannot prove.

### Step 2 — Create the tab

`Setup → App Launcher → New → Object`

| Setup form field | Enter |
| --- | --- |
| Category | any existing category — the repo defines none |
| Tab | Aufgabenerfüllung |
| Tab Style | any |
| Object | Aufgabenerfüllung (`TaskCompletion__c`) |

> Without a tab the object is invisible in Setup and you cannot reach the field screen. Do this before Step 3.
>
> The repository has no tab metadata of its own, so the category is not fixed by it. Whatever category you pick, keep it the same for every object in this list so the tabs end up together.

### Step 3 — Fields (5)

#### 1. `CompletedAt__c`

`Object Manager → Aufgabenerfüllung → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Date/Time |
| Field Label | Erfüllt am |
| Required | unchecked |
| Unique | unchecked |
| External ID | unchecked |
| Description | Zeitpunkt der Erfuellung |
| Track Field History (Object-level, not per field) | see object step |

#### 2. `DeviationReason__c`

`Object Manager → Aufgabenerfüllung → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Text Area (Long) |
| Field Label | Abweichungsbegründung |
| Length | 32768 |
| Lines to display | 4 |
| Required | unchecked |
| Unique | unchecked |
| External ID | unchecked |
| Description | Zum Beispiel: vorher schon erfuellt (Vorkenntnisse) |

#### 3. `Status__c`

`Object Manager → Aufgabenerfüllung → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Picklist |
| Field Label | Status |
| Required | [x] |
| Unique | unchecked |
| External ID | unchecked |
| Restrict picklist to the values defined in the value set | checked |
| Description | Erfuellungsstatus |
| Track Field History (Object-level, not per field) | see object step |

Values — enter **Value** and **Display Value** separately:

| Value (API name) | Display Value | Default |
| --- | --- | --- |
| `Offen` | Offen | yes |
| `Erfüllt` | Erfüllt |  |
| `Entfällt` | Entfällt |  |

#### 4. `Participant__c`

`Object Manager → Aufgabenerfüllung → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Lookup |
| Field Label | Teilnehmer |
| Related To | Participant__c |
| Required | [x] |
| Unique | unchecked |
| External ID | unchecked |
| Relationship Name | Task_Completions |
| What happens when the related record is deleted | Restrict |
| Description | Teilnehmer, der die Aufgabe erfuellt hat |
| Track Field History (Object-level, not per field) | see object step |

> **Set "Restrict delete" now.** It cannot be changed to a weaker setting later — only tightened.

#### 5. `ScheduleEntry__c`

`Object Manager → Aufgabenerfüllung → Fields & Relationships → New`

| Setup form field | Enter |
| --- | --- |
| Type | Lookup |
| Field Label | Planzeile |
| Related To | ScheduleEntry__c |
| Required | [x] |
| Unique | unchecked |
| External ID | unchecked |
| Relationship Name | Task_Completions |
| What happens when the related record is deleted | Restrict |
| Description | Planzeile, die erfuellt wurde |
| Track Field History (Object-level, not per field) | see object step |

> **Set "Restrict delete" now.** It cannot be changed to a weaker setting later — only tightened.

---


## Nach der Anlage

```bash
cd backend
npm run schema:check
```

Exit 0 heisst: alle 151 Felder sind im Runtime-Schema und per SOQL abfragbar. **Achtung:**
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
